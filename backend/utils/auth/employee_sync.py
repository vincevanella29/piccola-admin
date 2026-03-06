# backend/utils/auth/employee_sync.py
"""Sincronización automática de empleados_usuarios con la ficha RRHH (trabajadores_vpn).

Se ejecuta oportunistamente en login y en consulta de rol, para mantener
empleados_usuarios actualizado sin requerir re-registro.

Resuelve:
1) Wallet stale: empleados registrados con sub (did:privy:...) que después
   crean wallet Ethereum → actualiza el campo 'wallet'.
2) Cargo/sección stale: cambios de puesto en RRHH que no se reflejan en
   empleados_usuarios → sincroniza desde trabajadores_vpn.
"""

import logging
import time

logger = logging.getLogger(__name__)


def sync_employee_link(sub: str, wallet_lower: str, db):
    """Sincroniza empleados_usuarios cuando un empleado hace login con wallet real.

    Args:
        sub: Privy subject identifier (did:privy:...) del JWT.
        wallet_lower: Wallet Ethereum en lowercase (0x...).
        db: Instancia de la base de datos MongoDB.

    Returns:
        dict con los campos actualizados, o None si no hubo cambios.
    """
    if not sub:
        return None

    LINKS = db.empleados_usuarios
    TRAB = db.trabajadores_vpn
    CARGOS = db.cargos_intranet

    # Buscar link por sub
    link = LINKS.find_one({"sub": sub})
    if not link and wallet_lower:
        # También intentar buscar link por wallet (por si ya tiene la wallet correcta)
        link = LINKS.find_one({"wallet": wallet_lower})

    if not link:
        return None  # No es empleado vinculado, nada que hacer

    rut = link.get("rut")
    if not rut:
        return None

    update_fields = {}

    # 1) Actualizar wallet si estaba como did:privy:... o no coincide
    if wallet_lower:
        stored_wallet = (link.get("wallet") or "")
        is_privy_wallet = stored_wallet.startswith("did:privy:")
        wallet_missing = not stored_wallet
        wallet_differs = stored_wallet != wallet_lower and not stored_wallet.startswith("0x")

        if is_privy_wallet or wallet_missing or wallet_differs:
            # Solo actualizar si la wallet nueva es una dirección Ethereum real
            if wallet_lower.startswith("0x") and len(wallet_lower) == 42:
                update_fields["wallet"] = wallet_lower
                logger.info(
                    f"[SYNC_EMPLOYEE] Updating wallet for rut={rut}: "
                    f"'{stored_wallet}' → '{wallet_lower}'"
                )

    # 2) Sincronizar cargo/sección desde trabajadores_vpn (fuente de verdad RRHH)
    trab = _find_trabajador(TRAB, rut)

    if trab:
        real_cargo = (trab.get("cargo") or "").strip() or None
        real_seccion = None
        if real_cargo:
            ci = CARGOS.find_one({"cargo": real_cargo}, {"_id": 0, "seccion": 1})
            if ci and ci.get("seccion"):
                real_seccion = ci["seccion"]

        old_cargo = (link.get("cargo") or "").strip() or None
        old_seccion = (link.get("seccion") or "").strip() or None

        if real_cargo and real_cargo != old_cargo:
            update_fields["cargo"] = real_cargo
            logger.info(
                f"[SYNC_EMPLOYEE] Cargo changed for rut={rut}: "
                f"'{old_cargo}' → '{real_cargo}'"
            )
        if real_seccion and real_seccion != old_seccion:
            update_fields["seccion"] = real_seccion
            logger.info(
                f"[SYNC_EMPLOYEE] Sección changed for rut={rut}: "
                f"'{old_seccion}' → '{real_seccion}'"
            )

    # Aplicar cambios si hay alguno
    if update_fields:
        update_fields["synced_at"] = int(time.time())
        LINKS.update_one({"_id": link["_id"]}, {"$set": update_fields})
        logger.info(
            f"[SYNC_EMPLOYEE] Updated empleados_usuarios for rut={rut}: "
            f"{list(update_fields.keys())}"
        )
        return update_fields

    return None


def sync_employee_from_vpn_doc(empleado: dict, vpn_doc: dict, target_address: str, db):
    """Sincronización oportunista durante GET /user/role.

    Ya tenemos empleado (empleados_usuarios) y vpn_doc (trabajadores_vpn)
    cargados, así que solo detectamos drift y corregimos.

    Args:
        empleado: Documento de empleados_usuarios.
        vpn_doc: Documento de trabajadores_vpn (ficha RRHH).
        target_address: Wallet Ethereum checksum del usuario (puede ser None).
        db: Instancia de la base de datos MongoDB.

    Returns:
        dict con los campos actualizados, o None si no hubo cambios.
    """
    if not empleado or not vpn_doc:
        return None

    rut_value = empleado.get("rut")
    sync_updates = {}

    # Cargo
    real_cargo = (vpn_doc.get("cargo") or "").strip() or None
    old_cargo = (empleado.get("cargo") or "").strip() or None
    if real_cargo and real_cargo != old_cargo:
        sync_updates["cargo"] = real_cargo
        logger.info(
            f"[ROLE_SYNC] Cargo sync for rut={rut_value}: "
            f"'{old_cargo}' → '{real_cargo}'"
        )

    # Sección
    real_seccion = None
    if real_cargo:
        ci = db.cargos_intranet.find_one({"cargo": real_cargo}, {"_id": 0, "seccion": 1})
        if ci and ci.get("seccion"):
            real_seccion = ci["seccion"]
    old_seccion = (empleado.get("seccion") or "").strip() or None
    if real_seccion and real_seccion != old_seccion:
        sync_updates["seccion"] = real_seccion
        logger.info(
            f"[ROLE_SYNC] Sección sync for rut={rut_value}: "
            f"'{old_seccion}' → '{real_seccion}'"
        )

    # Wallet
    stored_wallet = (empleado.get("wallet") or "")
    if target_address and stored_wallet.startswith("did:privy:"):
        sync_updates["wallet"] = target_address.lower()
        logger.info(
            f"[ROLE_SYNC] Wallet sync for rut={rut_value}: "
            f"'{stored_wallet}' → '{target_address.lower()}'"
        )

    if sync_updates:
        sync_updates["synced_at"] = int(time.time())
        db.empleados_usuarios.update_one(
            {"_id": empleado["_id"]}, {"$set": sync_updates}
        )
        return sync_updates

    return None


def _find_trabajador(trab_col, rut):
    """Lookup robusto de trabajadores_vpn: probar rut como str y como int."""
    rut_str = str(rut).strip()
    for q in [{"rut": rut_str}]:
        doc = trab_col.find_one(q)
        if doc:
            return doc
    # Intentar como int
    if rut_str.isdigit():
        doc = trab_col.find_one({"rut": int(rut_str)})
        if doc:
            return doc
    return None
