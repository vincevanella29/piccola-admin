# backend/apis/roles.py
from fastapi import APIRouter, Depends, HTTPException, Response, Request, Query
import os, logging
from pydantic import BaseModel
from bson import ObjectId

from utils.auth.session import verify_session
from utils.web3mongo import w3, launchpad_contract, company_contract, db
from config.roles.service import (
    get_company_role_level,
    verify_signature,
    validate_hierarchy,
    invalidate_role_cache,
)
from config.roles.access import compute_permissions_for_identity

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))
CHAIN_ID = int(os.getenv("CHAIN_ID", "0"))

COL_EMPRESAS = db.empresas

# ---------------------------
# Modelos Pydantic
# ---------------------------
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

# Roles on-chain válidos (para validar inputs)
ROLE_LEVELS = {
    "DOMINUS_SAPORIS": 3,
    "CENTURIO_MENSARUM": 4,
    "MILITES_CULINAE": 5,
}

# ---------------------------
# Preflight
# ---------------------------
@router.options("/user/role")
async def options_user_role():
    return Response(status_code=200)

@router.options("/contract/company/assign-role")
async def options_assign_role():
    return Response(status_code=200)

@router.options("/contract/company/revoke-role")
async def options_revoke_role():
    return Response(status_code=200)

@router.options("/contract/company/users")
async def options_contract_company_users():
    return Response(status_code=200)

# ---------------------------
# GET /user/role  (incluye OFFCHAIN level=6 cuando aplica)
# ---------------------------
@router.get("/user/role")
def get_user_role(account: str = Query(None), user: dict = Depends(verify_session)):
    try:
        wallet_from_session = user.get("wallet")
        sub = user.get("sub")

        # identity genérica: lo que venga del front (account), o la wallet real de sesión, o el sub
        identity = account or wallet_from_session or sub
        if not identity:
            raise HTTPException(status_code=400, detail="No identity in session")

        perms = None
        role_level = -1

        # Calcular siempre permisos efectivos desde una sola función (wallet o sub)
        perms = compute_permissions_for_identity(identity)
        role_level = perms.get("role_level", -1)

        # --- OFFCHAIN MEMBER (level 6) ---
        # Si no tiene rol on-chain (role_level -1/None) pero SÍ tiene acceso backend a empresas/sucursales,
        # lo marcamos como 6 (aplica tanto para wallet como para sub).
        if perms and (role_level is None or role_level == -1):
            has_backend_access = (
                bool(perms.get("can_view_all_companies")) or
                bool(perms.get("can_view_all_sucursales")) or
                (isinstance(perms.get("empresa_ids"), list) and len(perms.get("empresa_ids")) > 0) or
                (isinstance(perms.get("sucursal_ids"), list) and len(perms.get("sucursal_ids")) > 0)
            )
            if has_backend_access:
                role_level = 6  # OFFCHAIN_MEMBER

        # Datos auxiliares (perfil)
        # address solo si identity es una wallet válida
        target_address = None
        try:
            if identity and w3.is_address(identity):
                target_address = w3.to_checksum_address(identity)
        except Exception:
            target_address = None

        if target_address:
            user_data = db.users.find_one({"wallet": target_address.lower(), "company_id": COMPANY_ID}) or {}
        elif sub:
            user_data = db.users.find_one({"sub": sub, "company_id": COMPANY_ID}) or {}
        else:
            user_data = {}
        role_name = user_data.get("role_name", "")

        empleado = None
        if target_address:
            empleado = db.empleados_usuarios.find_one({"wallet": target_address.lower()})
        elif sub:
            empleado = db.empleados_usuarios.find_one({"sub": sub})

        rut_value = empleado.get("rut") if empleado else None

        vpn_doc = None
        if rut_value is not None:
            # lookup robusto para rut int/str
            candidates = []
            if isinstance(rut_value, int):
                candidates = [{"rut": rut_value}, {"rut": str(rut_value)}]
            elif isinstance(rut_value, str):
                r = rut_value.strip()
                candidates = [{"rut": r}]
                try:
                    candidates.append({"rut": int(r)})
                except Exception:
                    pass
            else:
                try:
                    candidates.append({"rut": int(rut_value)})
                except Exception:
                    pass
                candidates.append({"rut": str(rut_value)})

            for q in candidates:
                found = db.trabajadores_vpn.find_one(q)
                if found:
                    vpn_doc = found
                    break

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
            if role_level == -1:
                role_level = 7

            # 🔄 Sync oportunista: si empleados_usuarios tiene cargo/sección/wallet
            # desincronizado respecto a trabajadores_vpn, corregirlo ahora.
            if empleado:
                try:
                    from utils.auth.employee_sync import sync_employee_from_vpn_doc
                    sync_employee_from_vpn_doc(empleado, vpn_doc, target_address, db)
                except Exception as sync_err:
                    logger.warning(f"[ROLE_SYNC] Employee sync failed (non-fatal): {sync_err}")

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
            # compat
            "subscribe_news": None, "public_profile": None, "public_name": None,
            "public_birthdate": None, "twitter": None, "discord": None, "instagram": None,
            "bio": None, "additional_socials": None, "liked_products": None,
            "created_at": None, "updated_at": None,
        }

        # Allowed (empresas con sucursales filtradas por permisos)
        allowed = None
        if perms:
            emp_ids = list(perms.get("empresa_ids") or [])
            suc_ids = list(perms.get("sucursal_ids") or [])
            can_all_emp = bool(perms.get("can_view_all_companies"))
            can_all_suc = bool(perms.get("can_view_all_sucursales"))

            if can_all_emp:
                emp_filter = {}
            else:
                oids = []
                for e in emp_ids:
                    try:
                        oids.append(ObjectId(str(e)))
                    except Exception:
                        continue
                emp_filter = {"_id": {"$in": oids}} if oids else {"_id": {"$in": []}}

            cursor = COL_EMPRESAS.find(
                emp_filter,
                {
                    "_id": 1, "nombre": 1, "slug": 1, "sigla": 1, "sucursales": 1,
                    "cuentas_include": 1, "cuentas_exclude": 1,
                    "resumen2_include": 1, "resumen2_exclude": 1,
                }
            )

            suc_set = set(int(x) for x in (suc_ids or []))
            empresas_meta = []
            for d in cursor:
                if can_all_suc:
                    emb = [
                        {
                            "id_sucursal": int(s.get("id_sucursal")),
                            "sigla": s.get("sigla"),
                            "sigla_local": ((s.get("mtz") or {}).get("sigla_local")),
                            "location_slug": ((s.get("location") or {}).get("permalink_slug")),
                        }
                        for s in (d.get("sucursales") or [])
                        if s.get("id_sucursal") is not None
                    ]
                else:
                    emb = []
                    for s in (d.get("sucursales") or []):
                        sid = s.get("id_sucursal")
                        if sid is None:
                            continue
                        if int(sid) in suc_set:
                            emb.append({
                                "id_sucursal": int(sid),
                                "sigla": s.get("sigla"),
                                "sigla_local": ((s.get("mtz") or {}).get("sigla_local")),
                                "location_slug": ((s.get("location") or {}).get("permalink_slug")),
                            })

                    if not emb:
                        continue

                empresas_meta.append({
                    "_id": str(d["_id"]),
                    "nombre": d.get("nombre"),
                    "slug": d.get("slug"),
                    "sigla": d.get("sigla") or d.get("slug"),
                    "sucursales": emb,
                    "cuentas_include": sorted(list(d.get("cuentas_include") or [])),
                    "cuentas_exclude": sorted(list(d.get("cuentas_exclude") or [])),
                    "resumen2_include": sorted(list(d.get("resumen2_include") or [])),
                    "resumen2_exclude": sorted(list(d.get("resumen2_exclude") or [])),
                })

            allowed = {"empresas": empresas_meta}

        return {
            "company_id": COMPANY_ID,
            "role_level": role_level,  # incluye 6 si es OFFCHAIN_MEMBER y 7 si es empleado sin rol on-chain
            "role_name": role_name,
            "address": target_address,
            "profile": profile_data,
            "permissions": perms,
            "allowed": allowed,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching user role: {str(e)}")

# ---------------------------
# POST /contract/company/assign-role
# ---------------------------
@router.post("/contract/company/assign-role")
async def assign_company_role(request: Request, data: AssignRoleRequest, user: dict = Depends(verify_session)):
    # Check cached role first
    if user.get("role_level", -1) not in (3, 4):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Verify signature (still required for sensitive operations)
    if not verify_signature(user["wallet"], data.plain_data, data.signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    caller_wallet = user.get("wallet")
    if not caller_wallet:
        raise HTTPException(status_code=400, detail="No wallet address in session")

    # Validaciones direcciones
    if not w3.is_address(caller_wallet):
        raise HTTPException(status_code=400, detail="Invalid caller wallet address")
    if not w3.is_address(data.account):
        raise HTTPException(status_code=400, detail="Invalid target account address")

    caller_wallet = w3.to_checksum_address(caller_wallet)
    target_address = w3.to_checksum_address(data.account)

    # Validar rol solicitado existe y coincide nivel
    if data.role_name not in ROLE_LEVELS or ROLE_LEVELS[data.role_name] != data.role_level:
        raise HTTPException(status_code=400, detail="Invalid role_name or role_level")

    # Jerarquía caller (on-chain) — force_refresh since this is a sensitive operation
    caller_level = get_company_role_level(caller_wallet, force_refresh=True)
    if caller_level in (-1, 6, 5):
        # nivel 6 es offchain y no puede gestionar
        raise HTTPException(status_code=403, detail="Caller has no permission to assign roles")
    if not validate_hierarchy(caller_level, data.role_level):
        raise HTTPException(status_code=403, detail="Insufficient role level to assign this role")

    # Build tx
    try:
        nonce = w3.eth.get_transaction_count(caller_wallet)
        try:
            estimated_gas = company_contract.functions.registerCompanyUser(
                COMPANY_ID, target_address, data.role_name
            ).estimate_gas({"from": caller_wallet})
        except Exception as e:
            logger.warning(f"Gas estimation failed, using default. Error: {e}")
            estimated_gas = 400_000

        tx = company_contract.functions.registerCompanyUser(
            COMPANY_ID, target_address, data.role_name
        ).build_transaction({
            "from": caller_wallet,
            "nonce": nonce,
            "gas": estimated_gas,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        })

        # Invalidate cache for target wallet so next check fetches fresh on-chain data
        invalidate_role_cache(target_address)

        return {
            "success": True,
            "msg": "Transaction built. Sign and send from your wallet.",
            "tx": tx,
            "estimated_gas": estimated_gas
        }
    except Exception as e:
        logger.error(f"Error assigning role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error assigning role: {str(e)}")

# ---------------------------
# POST /contract/company/revoke-role
# ---------------------------
@router.post("/contract/company/revoke-role")
async def revoke_company_role(request: Request, data: RevokeRoleRequest, user: dict = Depends(verify_session)):
    caller_wallet = user.get("wallet")
    if not caller_wallet:
        raise HTTPException(status_code=400, detail="No wallet address in session")

    # Validaciones direcciones
    if not w3.is_address(caller_wallet):
        raise HTTPException(status_code=400, detail="Invalid caller wallet address")
    if not w3.is_address(data.account):
        raise HTTPException(status_code=400, detail="Invalid target account address")

    caller_wallet = w3.to_checksum_address(caller_wallet)
    target_address = w3.to_checksum_address(data.account)

    # Firma
    if not verify_signature(caller_wallet, data.plain_data, data.signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Jerarquía caller (on-chain) — force_refresh since this is a sensitive operation
    caller_level = get_company_role_level(caller_wallet, force_refresh=True)
    if caller_level in (-1, 6, 5):
        # nivel 6 es offchain y no puede gestionar
        raise HTTPException(status_code=403, detail="Caller has no permission to revoke roles")

    # Nivel del target (on-chain)
    target_level = get_company_role_level(target_address, force_refresh=True)
    if target_level == -1:
        raise HTTPException(status_code=400, detail="Target user has no role in this company")

    if not validate_hierarchy(caller_level, target_level):
        raise HTTPException(status_code=403, detail="Insufficient role level to revoke this role")

    # Build tx
    try:
        nonce = w3.eth.get_transaction_count(caller_wallet)
        try:
            estimated_gas = company_contract.functions.removeCompanyUser(
                COMPANY_ID, target_address
            ).estimate_gas({"from": caller_wallet})
        except Exception as e:
            logger.warning(f"Gas estimation failed, using default. Error: {e}")
            estimated_gas = 400_000

        tx = company_contract.functions.removeCompanyUser(
            COMPANY_ID, target_address
        ).build_transaction({
            "from": caller_wallet,
            "nonce": nonce,
            "gas": estimated_gas,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        })

        # Invalidate cache for target wallet so next check fetches fresh on-chain data
        invalidate_role_cache(target_address)

        return {
            "success": True,
            "msg": "Transaction built. Sign and send from your wallet.",
            "tx": tx
        }
    except Exception as e:
        logger.error(f"Error revoking role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error revoking role: {str(e)}")

# ---------------------------
# GET /contract/company/users (requiere membership on-chain)
# ---------------------------
@router.get("/contract/company/users")
def get_company_users(user: dict = Depends(verify_session)):
    caller_wallet = user.get("wallet")
    if not caller_wallet:
        raise HTTPException(status_code=400, detail="No wallet address in session")

    if not w3.is_address(caller_wallet):
        raise HTTPException(status_code=400, detail="Invalid caller wallet address")
    caller_wallet = w3.to_checksum_address(caller_wallet)

    # Debe ser miembro on-chain (niveles 3/4/5). Offchain (6) no alcanza acá.
    caller_level = get_company_role_level(caller_wallet)
    if caller_level == -1:
        raise HTTPException(status_code=403, detail="Only company members can view company users")

    try:
        events = list(db.company_events.find({
            "contract": {"$in": [str(company_contract.address), str(launchpad_contract.address)]},
            "event": {"$in": ["UserRegistered", "UserRemoved"]},
            "args.companyId": COMPANY_ID
        }).sort([("blockNumber", 1), ("logIndex", 1)]))

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
            last_reg = max(reg_events[wallet], key=lambda e: (e["blockNumber"], e.get("logIndex", 0)))
            last_rem = max(rem_events[wallet], key=lambda e: (e["blockNumber"], e.get("logIndex", 0)), default=None)
            if (not last_rem) or (last_reg["blockNumber"] > last_rem["blockNumber"]) or (
                last_reg["blockNumber"] == last_rem["blockNumber"] and last_reg.get("logIndex", 0) > last_rem.get("logIndex", 0)
            ):
                role_level = -1
                role = last_reg["args"].get("role", "")
                if role == "DOMINUS_SAPORIS":
                    role_level = 3
                elif role == "CENTURIO_MENSARUM":
                    role_level = 4
                elif role == "MILITES_CULINAE":
                    role_level = 5

                users_out.append({
                    "address": wallet,
                    "role_level": role_level,
                    "role_name": role,
                    "is_active": True,
                    "blockNumber": last_reg["blockNumber"],
                    "event": last_reg["event"]
                })

        logger.info(f"Fetched {len(users_out)} users for company_id: {COMPANY_ID} via events")
        return {"users": users_out}

    except Exception as e:
        logger.error(f"Error fetching company users from events: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching company users from events: {str(e)}")

logger.info("roles.py initialization completed")
