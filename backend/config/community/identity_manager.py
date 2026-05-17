import logging
from config.roles.access import compute_permissions_for_identity
from utils.web3mongo import db

logger = logging.getLogger(__name__)

def _user_identity(user: dict) -> dict:
    wallet = user.get("wallet")
    sub = user.get("sub")
    if not wallet and sub:
        # Fallback to rut_... if they are an employee without wallet
        eu = db.empleados_usuarios.find_one({"sub": sub})
        if eu and eu.get("rut"):
            wallet = f"rut_{eu['rut']}"
    return {"wallet": wallet.lower() if wallet else None, "privy_id": sub}


def _get_user_perms(user: dict) -> dict:
    perms = user.get("permissions")
    if perms:
        return perms
    ident = _user_identity(user)
    identity = ident.get("wallet") or ident.get("privy_id")
    if identity:
        try:
            return compute_permissions_for_identity(identity)
        except Exception:
            pass
    return {}


def _enrich_sender(user: dict, perms: dict) -> dict:
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    display_name = wallet or "User"
    avatar_url = None
    try:
        if wallet:
            if wallet.startswith("rut_"):
                rut_val = wallet.replace("rut_", "")
                try:
                    rut_val = int(rut_val)
                except:
                    pass
                tv = db.trabajadores_vpn.find_one({"rut": rut_val})
                if tv:
                    nombres = (tv.get("nombres") or "").strip()
                    ap_pat = (tv.get("apellidopaterno") or "").strip()
                    display_name = f"{nombres} {ap_pat}".strip() or display_name
                    avatar_url = tv.get("profile_image_url")
            else:
                eu = db.empleados_usuarios.find_one({"wallet": wallet})
                if eu and eu.get("rut"):
                    tv = db.trabajadores_vpn.find_one({"rut": eu["rut"]})
                    if tv:
                        nombres = (tv.get("nombres") or "").strip()
                        ap_pat = (tv.get("apellidopaterno") or "").strip()
                        display_name = f"{nombres} {ap_pat}".strip() or display_name
                        avatar_url = tv.get("profile_image_url")
                
                if display_name == wallet:
                    cu = db.community_users.find_one({"wallet": wallet})
                    if cu:
                        profile = cu.get("profile") or {}
                        display_name = profile.get("name") or display_name
                        avatar_url = profile.get("profile_image_url") or cu.get("profile_image_url")
        
    except Exception as e:
        logger.error(f"Error enriching sender: {e}")
    
    return {
        "sender_wallet": wallet,
        "sender_privy_id": ident.get("privy_id"),
        "sender_name": display_name,
        "sender_avatar_url": avatar_url,
        "sender_cargo": perms.get("cargo"),
        "sender_seccion": perms.get("seccion"),
    }
