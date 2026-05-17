import logging
from utils.web3mongo import db
from utils.time_utils import get_chile_time
from config.community.identity_manager import _user_identity, _get_user_perms

logger = logging.getLogger(__name__)

def _is_group_member(group: dict, user: dict) -> bool:
    """Check if user is a member of the group (or auto-joined via section)."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    privy_id = ident.get("privy_id")

    # Explicit member check
    for m in (group.get("members") or []):
        if wallet and (m.get("wallet") or "").lower() == wallet:
            return True
        if privy_id and m.get("privy_id") == privy_id:
            return True

    # Section-based auto-join
    if group.get("is_section_based"):
        perms = _get_user_perms(user)
        user_section = (perms.get("seccion") or "").strip().lower()
        user_cargo = (perms.get("cargo") or "").strip().lower()
        is_active = perms.get("is_active_worker", False)
        
        allowed_secciones = [s.strip().lower() for s in group.get("allowed_secciones") or []]
        allowed_cargos = [c.strip().lower() for c in group.get("allowed_cargos") or []]

        if is_active and (user_section in allowed_secciones or user_cargo in allowed_cargos):
            # Auto-add to members list
            _auto_add_member(group, user, perms)
            return True

    return False


def _auto_add_member(group: dict, user: dict, perms: dict):
    """Auto-add a user to a group's members list (section-based join)."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    if not wallet:
        return

    # Check if already in members
    for m in (group.get("members") or []):
        if (m.get("wallet") or "").lower() == wallet:
            return

    now = get_chile_time()
    display_name = wallet
    avatar_url = None
    try:
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
            # Check empleados_usuarios for wallet first
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
        logger.error(f"Error resolving profile in auto_add: {e}")

    member_doc = {
        "wallet": wallet,
        "privy_id": ident.get("privy_id"),
        "role": "member",
        "display_name": display_name,
        "avatar_url": avatar_url,
        "cargo": perms.get("cargo"),
        "seccion": perms.get("seccion"),
        "joined_at": now,
    }
    db.chat_groups.update_one(
        {"group_id": group["group_id"]},
        {"$push": {"members": member_doc}, "$inc": {"member_count": 1}}
    )


def _get_member_role(group: dict, user: dict) -> str:
    """Get the user's role within a group."""
    ident = _user_identity(user)
    wallet = ident.get("wallet")
    for m in (group.get("members") or []):
        if wallet and (m.get("wallet") or "").lower() == wallet:
            return m.get("role", "member")
    return None
