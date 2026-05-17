import uuid
import logging
from typing import Dict, Any
from datetime import datetime

# Utilizando la conexión central de MongoDB
from utils.web3mongo import db
from services.automations.triggers import get_trigger

logger = logging.getLogger(__name__)

async def trigger_event(event_name: str, segment: str, payload: Dict[str, Any]):
    """
    Motor Central de Automatizaciones.
    Evalúa si un evento disparado por el sistema debe ejecutar una regla (Push/Email).
    
    :param event_name: El evento que ocurrió (ej: 'customer_registered', 'new_order')
    :param segment: El segmento de la audiencia (ej: 'customers', 'employees')
    :param payload: Los datos del evento para inyectar en las plantillas.
    """
    logger.info(f"[AutomationEngine] Evaluando evento '{event_name}' para segmento '{segment}'")
    
    # 1. Buscar reglas activas para este evento y segmento
    rules = list(db.automation_rules.find({
        "trigger_event": event_name,
        "segment": segment,
        "active": True
    }))
    
    if not rules:
        logger.info(f"[AutomationEngine] No hay reglas activas para '{event_name}' ({segment})")
        return
        
    for rule in rules:
        # 2. Get trigger plugin
        trigger_plugin = get_trigger(rule.get("trigger_event"))
        if not trigger_plugin:
            logger.warning(f"[AutomationEngine] No plugin found for trigger '{rule.get('trigger_event')}'. Skipping rule {rule.get('id')}.")
            continue
            
        # 3. Evaluate rule using the plugin's logic
        should_execute = await trigger_plugin.evaluate(rule, payload)
        if not should_execute:
            # The plugin decided this rule does not apply
            continue

        action_type = rule.get("action_type", "push")
        logger.info(f"[AutomationEngine] Regla '{rule.get('name')}' ejecutándose. Acción: {action_type}")
        
        # Opcional: manejar delay_minutes en el futuro insertando en notification_schedules
        # Por ahora enviamos directo si es Push
        if action_type == "push":
            await _execute_push_action(rule, payload)
        elif action_type == "email":
            await _execute_email_action(rule, payload)
        else:
            logger.warning(f"[AutomationEngine] Tipo de acción desconocida: {action_type}")

def _resolve_user_profile(payload: dict) -> dict:
    """Intenta buscar el perfil del usuario en las colecciones (delivery_customers, user_profiles, empleados)"""
    target_wallet = payload.get("wallet") or payload.get("customer", {}).get("wallet")
    target_sub = payload.get("sub") or payload.get("privy_id")
    target_email = payload.get("email") or payload.get("customer", {}).get("email")
    rut = payload.get("rut") or payload.get("employee_id") or payload.get("customer", {}).get("rut")
    
    if target_wallet:
        # Check profiles
        p = db.user_profiles.find_one({"wallet": {"$regex": f"^{target_wallet}$", "$options": "i"}})
        if p: return p
        e = db.empleados_usuarios.find_one({"wallet": {"$regex": f"^{target_wallet}$", "$options": "i"}})
        if e: return e
        d = db.delivery_customers.find_one({"wallet": {"$regex": f"^{target_wallet}$", "$options": "i"}})
        if d: return d
        
    if target_sub:
        p = db.user_profiles.find_one({"privy_id": target_sub})
        if p: return p
        e = db.empleados_usuarios.find_one({"sub": target_sub})
        if e: return e
        d = db.delivery_customers.find_one({"privy_id": target_sub})
        if d: return d
        
    if target_email:
        email_regex = {"$regex": f"^{target_email}$", "$options": "i"}
        d = db.delivery_customers.find_one({"email": email_regex})
        if d: return d
        p = db.user_profiles.find_one({"email": email_regex})
        if p: return p
        e = db.empleados_usuarios.find_one({"email": email_regex})
        if e: return e
        
    if rut:
        e = db.empleados_usuarios.find_one({"rut": rut, "status": "active"})
        if e: return e
        
    return {}

def _user_opted_out(profile: dict, trigger_event: str) -> bool:
    if not profile:
        return False
    prefs = profile.get("notification_preferences", {})
    # By default, opted IN unless explicitly set to False
    return prefs.get(trigger_event, True) is False

async def _execute_push_action(rule: dict, payload: dict):
    # Evitar import circular
    from apis.marketing.notifications import render_template, send_fcm_notification, _log_campaign
    
    template_id = rule.get("template_id")
    if not template_id:
        return
        
    icon_url = None
    image_url = None
    link_url = None
    
    if template_id == "original":
        from services.automations.triggers import get_trigger
        trigger_class = get_trigger(rule.get("trigger_event"))
        default_data = trigger_class.get_default_payload(payload) if hasattr(trigger_class, 'get_default_payload') else payload
        
        title = render_template(default_data.get("title_default", "Nueva Notificación"), payload)
        body = render_template(default_data.get("body_default", ""), payload)
        icon_url = default_data.get("icon_url")
        image_url = default_data.get("image_url")
        link_url = default_data.get("link_url") or payload.get("link_url")
        api_config = db.notification_api_configs.find_one({})
        if not api_config:
            logger.error("[AutomationEngine] API Config no encontrada para el template original")
            return
            
        logger.warning(f"[AutomationEngine] 🛠️ ORIGINAL TEMPLATE EVALUATION:")
        logger.warning(f"   ↳ title_default raw: {default_data.get('title_default')}")
        logger.warning(f"   ↳ body_default raw: {default_data.get('body_default')}")
        logger.warning(f"   ↳ payload (keys): {list(payload.keys())}")
        logger.warning(f"   ↳ payload message: {payload.get('message')}")
        
    else:
        n_type = db.notification_types.find_one({"id": template_id})
        if not n_type:
            logger.error(f"[AutomationEngine] Template ID {template_id} no encontrado.")
            return
            
        api_config = db.notification_api_configs.find_one({"id": n_type["api_config_id"]})
        if not api_config:
            logger.error(f"[AutomationEngine] API Config no encontrada para el template {template_id}")
            return
            
        title = render_template(n_type["title_template"], payload)
        body = render_template(n_type["body_template"], payload)
        icon_url = n_type.get("icon_url")
        image_url = n_type.get("image_url")
        link_url = n_type.get("link_url")
        
        logger.warning(f"[AutomationEngine] 🛠️ CUSTOM TEMPLATE EVALUATION:")
        logger.warning(f"   ↳ title_template raw: {n_type['title_template']}")
        logger.warning(f"   ↳ body_template raw: {n_type['body_template']}")
        logger.warning(f"   ↳ payload (keys): {list(payload.keys())}")
        logger.warning(f"   ↳ payload message: {payload.get('message')}")

    logger.warning(f"[AutomationEngine] 📢 FINAL RENDERED NOTIFICATION:")
    logger.warning(f"   ↳ Title: '{title}'")
    logger.warning(f"   ↳ Body: '{body}'")
        
    campaign_id = str(uuid.uuid4())
    
    # Resolver identidad para revisar preferencias
    profile = _resolve_user_profile(payload)
    if _user_opted_out(profile, rule.get("trigger_event")):
        logger.info(f"[AutomationEngine] Usuario {profile.get('email') or profile.get('wallet')} optó por no recibir {rule.get('trigger_event')} (Push)")
        return

    # Extraemos identificadores desde el payload o el perfil encontrado
    target_wallet = payload.get("wallet") or payload.get("customer", {}).get("wallet") or profile.get("wallet")
    target_sub = payload.get("sub") or payload.get("privy_id") or profile.get("sub") or profile.get("privy_id")
    target_email = payload.get("email") or payload.get("customer", {}).get("email") or profile.get("email")
    
    if not target_wallet and not target_sub and not target_email:
        rut = payload.get("rut") or payload.get("employee_id") or payload.get("customer", {}).get("rut")
        identifier = f"rut '{rut}'" if rut else "sin identificador"
        logger.warning(f"[AutomationEngine] No se pudo resolver identidad (wallet, privy_id o email) para {identifier}.")
        return
            
    # Buscar tokens del usuario (cruzando privy_id, wallet o email directo)
    or_conditions = []
    if target_sub:
        or_conditions.append({"privy_id": target_sub})
    if target_wallet:
        or_conditions.append({"wallet": {"$regex": f"^{target_wallet}$", "$options": "i"}})
    if target_email:
        or_conditions.append({"email": {"$regex": f"^{target_email}$", "$options": "i"}})
        
    tokens = []
    if or_conditions:
        tokens = list(db.user_notification_tokens.find({
            "$or": or_conditions,
            "permissions_granted": True
        }).sort("_id", -1))
    
    if not tokens:
        logger.warning(f"[AutomationEngine] No hay tokens FCM registrados para el destinatario (sub: {target_sub}, wallet: {target_wallet}, email: {target_email})")
        return
        
    for t_doc in tokens:
        try:
            await send_fcm_notification(
                api_config=api_config, 
                title=title, 
                body=body, 
                icon_url=icon_url,
                image_url=image_url, 
                link_url=link_url,
                target_type="user", 
                target_value=t_doc["token"], 
                campaign_id=campaign_id
            )
            # Log successful automation push
            _log_campaign(
                campaign_id=campaign_id,
                title=title,
                body=body,
                target_type="automation_push",
                target_value=target_wallet or target_email or target_sub,
                success_count=1,
                error_count=0,
                errors=[],
                sender_wallet="automation_engine"
            )
            logger.info(f"[AutomationEngine] Push enviado a {target_wallet or target_email or target_sub}")
            break # Enviar solo al dispositivo más reciente
        except Exception as e:
            logger.error(f"[AutomationEngine] Error enviando push: {str(e)}")
            _log_campaign(
                campaign_id=campaign_id,
                title=title,
                body=body,
                target_type="automation_push",
                target_value=target_wallet or target_email or target_sub,
                success_count=0,
                error_count=1,
                errors=[str(e)],
                sender_wallet="automation_engine"
            )

async def _execute_email_action(rule: dict, payload: dict):
    from workers.mail_worker import enqueue_automation
    from utils.mailing_helpers import (
        _format_order_date, _get_status_label, _build_order_items_html, 
        _build_order_items_text, _build_suggested_products_html, LOCATIONS_COLL, SITE_BASE_URL
    )
    
    template_id = rule.get("template_id")
    if not template_id:
        return
        
    if template_id == "original":
        logger.warning(f"[AutomationEngine] Email action does not support 'original' template for rule {rule.get('name')}")
        return
        
    delay = rule.get("delay_minutes", 0)
    customer = payload.get("customer", {})
    email = payload.get("email") or customer.get("email", "")
    if not email or "@" not in email:
        logger.warning(f"[AutomationEngine] No valid email in payload for rule {rule.get('name')}")
        return
        
    profile = _resolve_user_profile({"email": email, **payload})
    if _user_opted_out(profile, rule.get("trigger_event")):
        logger.info(f"[AutomationEngine] Usuario {email} optó por no recibir {rule.get('trigger_event')} (Email)")
        return
        
    order_number = payload.get("order_number", str(payload.get("_id", "")))
    new_status = payload.get("status", "")
    items = payload.get("items", [])
    
    location = {}
    loc_id = payload.get("location_id")
    loc_slug = payload.get("location_slug")
    if loc_id or loc_slug:
        try:
            q = {"permalink_slug": loc_slug} if loc_slug else {"_id": loc_id}
            loc_doc = LOCATIONS_COLL.find_one(q)
            if loc_doc:
                location = {
                    "name": loc_doc.get("nombre", ""),
                    "address": loc_doc.get("direccion", ""),
                    "phone": loc_doc.get("telefono", ""),
                }
        except Exception as e:
            logger.warning(f"[AutomationEngine] Failed to resolve location: {e}")
            
    delivery_app_url = SITE_BASE_URL
    provider_slug = payload.get("provider_slug")
    if provider_slug:
        try:
            provider = db.ecosystem_providers.find_one(
                {"slug": provider_slug, "ecosystem_type": "delivery", "status": "active"},
                {"domain": 1}
            )
            if provider and provider.get("domain"):
                delivery_app_url = provider["domain"].rstrip("/")
        except Exception:
            pass
            
    order_id_str = str(payload.get("_id", ""))

    variables = {
        "customer_name": customer.get("name", "Cliente"),
        "customer_email": email,
        "customer_phone": customer.get("phone", ""),
        "order_number": order_number,
        "order_total": f"${payload.get('total_amount', 0):,.0f}",
        "delivery_fee": f"${payload.get('delivery_fee', 0):,.0f}",
        "order_date": _format_order_date(payload.get("created_at")),
        "order_notes": payload.get("notes", "") or "",
        "delivery_address": customer.get("address", ""),
        "status": new_status,
        "status_label": _get_status_label(new_status),
        "restaurant_name": "La Piccola Italia",
        "location_name": location.get("name", ""),
        "location_address": location.get("address", ""),
        "location_phone": location.get("phone", ""),
        "tracking_url": payload.get("tracking_url", ""),
        "review_url": f"{delivery_app_url}/mi-perfil?review={order_id_str}",
        "reorder_url": f"{delivery_app_url}/mi-perfil?reorder={order_id_str}",
    }
    
    if rule.get("include_order_items", False) and items:
        variables["order_items_html"] = _build_order_items_html(items)
        variables["order_items_text"] = _build_order_items_text(items)

    if rule.get("include_reorder", False):
        variables["reorder_url"] = f"{SITE_BASE_URL}/carta"

    if rule.get("include_suggestions", False) and items:
        variables["suggested_products_html"] = _build_suggested_products_html(items)
        
    enqueue_automation(
        to=email,
        template_id=template_id,
        variables=variables,
        delay_minutes=delay,
    )
    
    # Log campaign success
    db.automation_rules.update_one(
        {"id": rule.get("id")},
        {"$inc": {"sent_count": 1}}
    )
    logger.info(f"[AutomationEngine] Email disparado para {email} via template {template_id}")
