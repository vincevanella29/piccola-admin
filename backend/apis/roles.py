# roles.py
from fastapi import APIRouter, Depends, HTTPException, Response, Request, Query
import os, logging
from pydantic import BaseModel
from utils.auth.session import verify_session
from utils.web3mongo import w3, launchpad_contract, company_contract, db
from web3.exceptions import ContractLogicError

router = APIRouter()
logger = logging.getLogger(__name__)
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# Modelos Pydantic para las solicitudes
class AssignRoleRequest(BaseModel):
    role_name: str
    account: str
    role_level: int
    signature: str
    plain_data: str

class RevokeRoleRequest(BaseModel):
    account: str
    signature: str
    plain_data: str

# Constantes de roles
ROLE_LEVELS = {
    "DOMINUS_SAPORIS": 3,  # Puede agregar/revocar niveles 4 y 5
    "CENTURIO_MENSARUM": 4,  # Puede agregar/revocar nivel 5
    "MILITES_CULINAE": 5  # No puede agregar/revocar
}

# Validar firma
def verify_signature(wallet: str, plain_data: str, signature: str) -> bool:
    try:
        if not w3.is_address(wallet):
            logger.error(f"Invalid wallet address: {wallet}")
            return False
        message = encode_defunct(text=plain_data)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        return recovered.lower() == wallet.lower()
    except Exception as e:
        logger.error(f"Error verifying signature: {str(e)}")
        return False

# Obtener nivel de rol del usuario en la compañía 1
def get_company_role_level(wallet: str) -> int:
    try:
        if not w3.is_address(wallet):
            logger.error(f"Invalid wallet address: {wallet}")
            return -1
        checksum_address = w3.to_checksum_address(wallet)
        role_level = launchpad_contract.functions.getCompanyLevel(checksum_address, COMPANY_ID).call()
        if not isinstance(role_level, int) or role_level < 0 or role_level > 5:
            logger.info(f"Role level out of range for {wallet} in company {COMPANY_ID}: {role_level}, assigning -1")
            return -1
        return role_level
    except ContractLogicError as e:
        logger.error(f"Contract error fetching role for {wallet} in company {COMPANY_ID}: {str(e)}")
        return -1
    except Exception as e:
        logger.error(f"Error fetching role for {wallet} in company {COMPANY_ID}: {str(e)}")
        return -1

# Validar permisos según jerarquía
def validate_hierarchy(caller_level: int, target_level: int) -> bool:
    if caller_level == -1 or caller_level == 5:  # MILITES_CULINAE o sin rol no pueden gestionar
        return False
    if caller_level == 3:  # DOMINUS_SAPORIS
        return target_level in [4, 5]  # Puede gestionar niveles 4 y 5
    if caller_level == 4:  # CENTURIO_MENSARUM
        return target_level == 5  # Solo puede gestionar nivel 5
    return False

@router.options("/user/role")
async def options_user_role():
    return Response(status_code=200)

@router.get("/user/role")
def get_user_role(account: str = Query(None), user: dict = Depends(verify_session)):
    wallet_address = user.get("wallet")
    if not wallet_address:
        raise HTTPException(status_code=400, detail="No wallet address in session")

    # target = el account pedido o, por defecto, el de la sesión
    target_address = account or wallet_address
    if not w3.is_address(target_address):
        raise HTTPException(status_code=400, detail="Invalid target address")
    target_address = w3.to_checksum_address(target_address)

    try:
        # Permisos solo si se consulta el mismo usuario de la sesión
        perms = user.get("permissions") if target_address.lower() == wallet_address.lower() else None

        # role_level: preferir el de permisos; si no, consultar on-chain desde el service puro
        role_level = (perms or {}).get("role_level")
        if role_level is None:
            from config.roles.service import get_company_role_level  # servicio puro (sin apis.*)
            role_level = get_company_role_level(target_address)

        # Datos auxiliares (nombre/correo/foto desde Mongo)
        user_data = db.users.find_one({"wallet": target_address.lower(), "company_id": COMPANY_ID}) or {}
        role_name = user_data.get("role_name", "")

        empleado = db.empleados_usuarios.find_one({"wallet": target_address.lower()})
        rut_value = empleado.get("rut") if empleado else None

        vpn_doc = None
        if rut_value is not None:
            # tratar int/str
            try:
                rut_int = int(rut_value)
            except Exception:
                rut_int = None
            if isinstance(rut_value, int):
                vpn_doc = db.trabajadores_vpn.find_one({"rut": rut_value})
            if not vpn_doc and rut_int is not None:
                vpn_doc = db.trabajadores_vpn.find_one({"rut": rut_int})
            if not vpn_doc and isinstance(rut_value, str):
                vpn_doc = db.trabajadores_vpn.find_one({"rut": rut_value})

        # Armar perfil
        name = profile_image_url = birthdate = email = cargo = favorite_location = None
        if vpn_doc:
            nombres = (vpn_doc.get("nombres") or "").strip()
            ap_pat = (vpn_doc.get("apellidopaterno") or "").strip()
            ap_mat = (vpn_doc.get("apellidomaterno") or "").strip()
            name = " ".join([p for p in [nombres, ap_pat, ap_mat] if p]) or None
            profile_image_url = vpn_doc.get("profile_image_url") or None
            birthdate = vpn_doc.get("fechanacimiento") or None
            cargo = vpn_doc.get("cargo") or None
            favorite_location = vpn_doc.get("sucursal") or None
        if empleado:
            email = empleado.get("email") or email

        profile_data = {
            "wallet": target_address,
            "name": name,
            "email": email,
            "profile_image_url": profile_image_url,
            "birthdate": birthdate,
            "favorite_location": favorite_location,
            "cargo": cargo,
            # legacy/compat:
            "subscribe_news": None, "public_profile": None, "public_name": None,
            "public_birthdate": None, "twitter": None, "discord": None, "instagram": None,
            "bio": None, "additional_socials": None, "liked_products": None,
            "created_at": None, "updated_at": None,
        }

        # Allowed locales/empresas enriquecidos cuando hay permisos
        allowed = None
        if perms:
            suc_ids = perms.get("sucursal_ids") or []
            emp_ids = perms.get("empresa_ids") or []
            # mapear sucursales (id -> sigla/nombre si existen)
            ref_cursor = db.gastos_refs_sucursales.find(
                {"id_sucursal": {"$in": suc_ids}},
                {"_id": 0, "id_sucursal": 1, "sigla": 1, "nombre": 1}
            )
            allowed = {
                "sucursales_ids": suc_ids,
                "sucursales": list(ref_cursor),
                "empresa_ids": emp_ids,
                # flags útiles del permiso
                "can_view_all_companies": bool(perms.get("can_view_all_companies")),
                "can_view_all_sucursales": bool(perms.get("can_view_all_sucursales")),
            }

        return {
            "company_id": COMPANY_ID,
            "role_level": role_level,
            "role_name": role_name,
            "address": target_address,
            "profile": profile_data,
            "permissions": perms,   # ← todo el objeto que trae verify_session
            "allowed": allowed,     # ← locales/empresas resolvidos
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching user role: {str(e)}")

@router.options("/contract/company/assign-role")
async def options_assign_role():
    return Response(status_code=200)

@router.post("/contract/company/assign-role")
async def assign_company_role(request: Request, data: AssignRoleRequest, user: dict = Depends(verify_session)):
    caller_wallet = user.get("wallet")
    if not caller_wallet:
        logger.error("No wallet address in session")
        raise HTTPException(status_code=400, detail="No wallet address in session")
    
    # Validar direcciones
    if not w3.is_address(caller_wallet):
        logger.error(f"Invalid caller wallet address: {caller_wallet}")
        raise HTTPException(status_code=400, detail="Invalid caller wallet address")
    if not w3.is_address(data.account):
        logger.error(f"Invalid target account address: {data.account}")
        raise HTTPException(status_code=400, detail="Invalid target account address")
    
    # Convertir a checksum
    caller_wallet = w3.to_checksum_address(caller_wallet)
    target_address = w3.to_checksum_address(data.account)
    
    # Verificar firma
    if not verify_signature(caller_wallet, data.plain_data, data.signature):
        logger.error(f"Invalid signature for wallet: {caller_wallet}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Validar que el role_name y role_level coincidan con los definidos
    if data.role_name not in ROLE_LEVELS or ROLE_LEVELS[data.role_name] != data.role_level:
        logger.error(f"Invalid role_name or role_level: {data.role_name}, {data.role_level}")
        raise HTTPException(status_code=400, detail="Invalid role_name or role_level")
    
    # Obtener nivel del caller en la compañía
    caller_level = get_company_role_level(caller_wallet)
    if caller_level == -1:
        logger.error(f"Caller {caller_wallet} has no role in company {COMPANY_ID}")
        raise HTTPException(status_code=403, detail="Caller has no role in this company")
    
    # Validar jerarquía explícitamente
    if caller_level == 5:
        logger.error(f"Caller level {caller_level} (MILITES_CULINAE) cannot assign any roles")
        raise HTTPException(status_code=403, detail="MILITES_CULINAE cannot assign roles")
    if not validate_hierarchy(caller_level, data.role_level):
        logger.error(f"Caller level {caller_level} cannot assign role level {data.role_level}")
        raise HTTPException(status_code=403, detail="Insufficient role level to assign this role")
    
    try:
        # Construir transacción para asignar rol
        nonce = w3.eth.get_transaction_count(caller_wallet)
        
        # Estimar gas
        try:
            estimated_gas = company_contract.functions.registerCompanyUser(
                COMPANY_ID,
                target_address,
                data.role_name
            ).estimate_gas({
                "from": caller_wallet
            })
        except Exception as e:
            logger.warning(f"Gas estimation failed, using default. Error: {e}")
            estimated_gas = 400_000

        tx = company_contract.functions.registerCompanyUser(
            COMPANY_ID,
            target_address,
            data.role_name
        ).build_transaction({
            "from": caller_wallet,
            "nonce": nonce,
            "gas": estimated_gas,
            "gasPrice": w3.eth.gas_price,
            "chainId": int(os.getenv("CHAIN_ID"))
        })
        
        return {
            "success": True,
            "msg": "Transaction built. Sign and send from your wallet.",
            "tx": tx,
            "estimated_gas": estimated_gas
        }
    except Exception as e:
        logger.error(f"Error assigning role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error assigning role: {str(e)}")

@router.options("/contract/company/revoke-role")
async def options_revoke_role():
    return Response(status_code=200)

@router.post("/contract/company/revoke-role")
async def revoke_company_role(request: Request, data: RevokeRoleRequest, user: dict = Depends(verify_session)):
    caller_wallet = user.get("wallet")
    if not caller_wallet:
        logger.error("No wallet address in session")
        raise HTTPException(status_code=400, detail="No wallet address in session")
    
    # Validar direcciones
    if not w3.is_address(caller_wallet):
        logger.error(f"Invalid caller wallet address: {caller_wallet}")
        raise HTTPException(status_code=400, detail="Invalid caller wallet address")
    if not w3.is_address(data.account):
        logger.error(f"Invalid target account address: {data.account}")
        raise HTTPException(status_code=400, detail="Invalid target account address")
    
    # Convertir a checksum
    caller_wallet = w3.to_checksum_address(caller_wallet)
    target_address = w3.to_checksum_address(data.account)
    
    # Verificar firma
    if not verify_signature(caller_wallet, data.plain_data, data.signature):
        logger.error(f"Invalid signature for wallet: {caller_wallet}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Obtener nivel del caller en la compañía
    caller_level = get_company_role_level(caller_wallet)
    if caller_level == -1:
        logger.error(f"Caller {caller_wallet} has no role in company {COMPANY_ID}")
        raise HTTPException(status_code=403, detail="Caller has no role in this company")
    
    # Obtener nivel del usuario a revocar
    target_level = get_company_role_level(target_address)
    if target_level == -1:
        logger.error(f"Target {target_address} has no role in company {COMPANY_ID}")
        raise HTTPException(status_code=400, detail="Target user has no role in this company")
    
    # Validar jerarquía explícitamente
    if caller_level == 5:
        logger.error(f"Caller level {caller_level} (MILITES_CULINAE) cannot revoke any roles")
        raise HTTPException(status_code=403, detail="MILITES_CULINAE cannot revoke roles")
    if not validate_hierarchy(caller_level, target_level):
        logger.error(f"Caller level {caller_level} cannot revoke role level {target_level}")
        raise HTTPException(status_code=403, detail="Insufficient role level to revoke this role")
    
    try:
        # Construir transacción para revocar rol
        nonce = w3.eth.get_transaction_count(caller_wallet)
        
        # Estimar gas
        try:
            estimated_gas = company_contract.functions.removeCompanyUser(
                COMPANY_ID,
                target_address
            ).estimate_gas({
                "from": caller_wallet
            })
        except Exception as e:
            logger.warning(f"Gas estimation failed, using default. Error: {e}")
            estimated_gas = 400_000

        tx = company_contract.functions.removeCompanyUser(
            COMPANY_ID,
            target_address
        ).build_transaction({
            "from": caller_wallet,
            "nonce": nonce,
            "gas": estimated_gas,
            "gasPrice": w3.eth.gas_price,
            "chainId": int(os.getenv("CHAIN_ID"))
        })
        
        return {
            "success": True,
            "msg": "Transaction built. Sign and send from your wallet.",
            "tx": tx
        }
    except Exception as e:
        logger.error(f"Error revoking role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error revoking role: {str(e)}")

@router.options("/contract/company/users")
async def options_contract_company_users():
    return Response(status_code=200)

@router.get("/contract/company/users")
def get_company_users(user: dict = Depends(verify_session)):
    caller_wallet = user.get("wallet")
    if not caller_wallet:
        logger.error("No wallet address in session")
        raise HTTPException(status_code=400, detail="No wallet address in session")
    
    # Validar dirección
    if not w3.is_address(caller_wallet):
        logger.error(f"Invalid caller wallet address: {caller_wallet}")
        raise HTTPException(status_code=400, detail="Invalid caller wallet address")
    
    # Convertir a checksum
    caller_wallet = w3.to_checksum_address(caller_wallet)
    
    # Verificar que el usuario tenga un rol en la compañía
    caller_level = get_company_role_level(caller_wallet)
    if caller_level == -1:
        logger.error(f"User {caller_wallet} does not have permission to view company users")
        raise HTTPException(status_code=403, detail="Only company members can view company users")

    try:
        # Leer eventos relevantes de la colección company_events
        events = list(db.company_events.find({
            "contract": {"$in": [str(company_contract.address), str(launchpad_contract.address)]},
            "event": {"$in": ["UserRegistered", "UserRemoved"]},
            "args.companyId": COMPANY_ID
        }).sort([("blockNumber", 1), ("logIndex", 1)]))

        # Agrupar eventos por wallet
        from collections import defaultdict
        reg_events = defaultdict(list)
        rem_events = defaultdict(list)
        for ev in events:
            wallet = w3.to_checksum_address(ev["args"]["wallet"])
            if ev["event"] == "UserRegistered":
                reg_events[wallet].append(ev)
            elif ev["event"] == "UserRemoved":
                rem_events[wallet].append(ev)

        users_out = []
        for wallet in reg_events:
            # Buscar el último UserRegistered
            last_reg = max(reg_events[wallet], key=lambda e: (e["blockNumber"], e.get("logIndex", 0)))
            # Buscar el último UserRemoved (si existe)
            last_rem = max(rem_events[wallet], key=lambda e: (e["blockNumber"], e.get("logIndex", 0)), default=None)
            # Usuario activo solo si el último registro es posterior al último removed (o nunca fue removido)
            if not last_rem or last_reg["blockNumber"] > last_rem["blockNumber"] or (last_reg["blockNumber"] == last_rem["blockNumber"] and last_reg.get("logIndex", 0) > last_rem.get("logIndex", 0)):
                role_level = -1
                if last_reg["args"].get("role", "") == "DOMINUS_SAPORIS":
                    role_level = 3
                elif last_reg["args"].get("role", "") == "CENTURIO_MENSARUM":
                    role_level = 4
                elif last_reg["args"].get("role", "") == "MILITES_CULINAE":
                    role_level = 5
                users_out.append({
                    "address": wallet,
                    "role_level": role_level,
                    "role_name": last_reg["args"].get("role", ""),
                    "is_active": True,
                    "blockNumber": last_reg["blockNumber"],
                    "event": last_reg["event"]
                })
        # Solo usuarios activos según la relación entre registros y removidos

        logger.info(f"Fetched {len(users_out)} users for company_id: {COMPANY_ID} via events")
        return {"users": users_out}
    except Exception as e:
        logger.error(f"Error fetching company users from events: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching company users from events: {str(e)}")

logger.info("roles.py initialization completed")