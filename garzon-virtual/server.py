# garzon-virtual/server.py
import os
import uuid
import logging
import httpx
import json
import re
import random
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("garzon-backend")

# 1. Load environment variables from the main backend .env file
def load_backend_env():
    # Find .env relative to this file
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "backend", ".env"),
        os.path.join("c:\\", "Users", "angelo", "Vanellix", "Piccola_admin", "backend", ".env")
    ]
    for path in possible_paths:
        if os.path.exists(path):
            logger.info(f"Loading environment variables from: {path}")
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip('"\'')
            return
    logger.warning("No backend .env file found. Using default environment values.")

load_backend_env()

# 2. Setup MongoDB connection
mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/piccola_italia_admin")
logger.info(f"Connecting to MongoDB at: {mongo_uri}")
try:
    client = MongoClient(mongo_uri)
    db = client.get_database()
    # Test connection
    client.server_info()
    logger.info("MongoDB connected successfully.")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    db = None

# 3. Initialize FastAPI App
app = FastAPI(title="Garzón Virtual Dedicated Backend")

# 4. Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helpers to clean MongoDB documents for JSON serialization
def clean_doc(doc):
    if not doc:
        return doc
    doc["id"] = str(doc.get("_id"))
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if hasattr(v, "isoformat"):
            doc[k] = v.isoformat()
    return doc

# Pydantic models for request bodies
class StartSessionRequest(BaseModel):
    metadata: Optional[dict] = None

class ChatMessageRequest(BaseModel):
    conv_id: str
    text: str
    cart: Optional[List[dict]] = None
    profile: Optional[dict] = None
    onboarding_face_id: Optional[str] = None

class ProfileRequest(BaseModel):
    face_id: str
    name: str
    favorite_item_id: Optional[str] = None
    last_order_ids: Optional[List[str]] = None

# 5. API ROUTES

@app.get("/api/menus")
async def get_menus():
    """
    Public menu endpoint for Garzon Virtual.
    Fetches categories, menus, and menu options directly from the MongoDB database
    without requiring admin authentication.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        menus = list(db.menus.find({}))
        categories = list(db.categories.find({}))
        menu_options = list(db.menu_options.find({}))
        
        return {
            "categories": [clean_doc(c) for c in categories],
            "menus": [clean_doc(m) for m in menus],
            "menu_options": [clean_doc(o) for o in menu_options]
        }
    except Exception as e:
        logger.error(f"Error fetching menus: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/locations")
async def get_locations():
    """
    Public locations endpoint for Garzon Virtual.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        locations = list(db.locations.find({}))
        return {
            "locations": [clean_doc(l) for l in locations]
        }
    except Exception as e:
        logger.error(f"Error fetching locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/session/start")
async def start_chat_session(data: Optional[StartSessionRequest] = None):
    """
    Starts a new chat session for the Garzon Virtual.
    Saves the session in chat_conversations.
    """
    if db is None:
        return {"conv_id": str(uuid.uuid4())}
    try:
        conv_id = str(uuid.uuid4())
        now = datetime.now()
        conv_doc = {
            "conv_id": conv_id,
            "status": "open",
            "mode": "bot",
            "created_at": now,
            "updated_at": now,
            "wallet": None,
            "privy_id": None
        }
        db.chat_conversations.insert_one(conv_doc)
        return {"conv_id": conv_id}
    except Exception as e:
        logger.error(f"Error starting chat session: {e}")
        # Return fallback ID so application doesn't crash
        return {"conv_id": str(uuid.uuid4())}

def clean_keyword(s):
    return re.sub(r'[^\w\s]', '', s.lower())

def python_fallback_command(text: str, menus: list, cart: list, profile: Optional[dict], onboarding_face_id: Optional[str]) -> dict:
    text_lower = text.lower().strip()
    
    # 1. Onboarding face check
    if onboarding_face_id and not profile:
        name = text
        for prefix in ["me llamo", "mi nombre es", "soy", "hola", "buenos dias", "buenos días"]:
            if prefix in name.lower():
                name = re.sub(re.escape(prefix), "", name, flags=re.IGNORECASE)
        name = name.strip()
        name = " ".join([w.capitalize() for w in name.split()])
        if name:
            return {
                "text": f"¡Mucho gusto, **{name}**! Qué lindo nombre, mio caro. La Nonna ha guardado tu rostro en la memoria de la casa. ¿Qué te gustaría comer de rico hoy, po?",
                "intent": "register_profile_success",
                "registerName": name,
                "addItem": None,
                "removeItem": None,
                "highlightIds": None
            }

    # 2. Greeting / Returning Customer (3rd time / order_count >= 2)
    if any(greet in text_lower for greet in ["hola", "buenos dias", "buenos días", "buen día", "buen dia"]):
        name_str = f" {profile['name']}" if (profile and profile.get("name")) else ""
        order_cnt = profile.get("order_count", 0) if profile else 0
        last_orders = profile.get("last_order_ids", []) if profile else []
        
        if order_cnt >= 2 and last_orders:
            # Find a dish from last_orders in menus
            fav_item = next((m for m in menus if m["id"] in last_orders), None)
            if fav_item:
                return {
                    "text": f"¡Hola de nuevo{name_str}, qué alegría verte por tercera vez con la Nonna, bambino! Veo en mi memoria que te encantó la **{fav_item['nombre']}** en tus visitas anteriores. ¿Te traigo de nuevo lo mismo de la otra vez, o prefieres probar algo nuevo hoy, po?",
                    "intent": "greeting",
                    "addItem": None,
                    "removeItem": None,
                    "registerName": None,
                    "highlightIds": [fav_item["id"]]
                }
                
        return {
            "text": f"¡Hola{name_str}, cómo estái, bambino! Qué alegría tenerte en La Piccola Italia. ¿Qué les gustaría pedir de comer hoy, po?",
            "intent": "greeting",
            "addItem": None,
            "removeItem": None,
            "registerName": None,
            "highlightIds": None
        }

    # 3. Bill / Account
    if any(bill_word in text_lower for bill_word in ["cuenta", "pagar", "boleta", "total"]):
        name_str = f", {profile['name']}" if (profile and profile.get("name")) else ""
        return {
            "text": f"¡Por supuesto{name_str}, mio caro! Te he preparado la cuenta aquí mismo en la pantalla. Puedes pagar con tarjeta de inmediato o, si prefieres, mi bambino del salón se acercará con la máquina Redbanc en un ratito. ¡Muchas gracias por comer con la Nonna!",
            "intent": "bill",
            "addItem": None,
            "removeItem": None,
            "registerName": None,
            "highlightIds": None
        }

    # 4. Call physical waiter
    if any(waiter_word in text_lower for waiter_word in ["llamar", "mesero", "garzon", "ayuda", "humano"]):
        return {
            "text": "¡Entendido! Ya le hice una seña a uno de mis bambinos del salón. Se dirige a tu mesa volando para asistirte personalmente en unos segundos, po.",
            "intent": "call_waiter",
            "addItem": None,
            "removeItem": None,
            "registerName": None,
            "highlightIds": None
        }

    # 5. Recommendation
    if any(rec_word in text_lower for rec_word in ["recomienda", "recomiendas", "sugerencia", "sugieres", "especialidad", "rico", "bueno"]):
        chosen = []
        if "pasta" in text_lower:
            chosen = [m for m in menus if m.get("categoria_id") == "cat_pastas"]
        elif "postre" in text_lower or "dulce" in text_lower:
            chosen = [m for m in menus if m.get("categoria_id") == "cat_postres"]
        elif any(drink in text_lower for drink in ["tomar", "beber", "vino", "pisco"]):
            chosen = [m for m in menus if m.get("categoria_id") == "cat_bebidas"]
        else:
            # Special default: Margherita (p1) or Fettuccine (pa1)
            chosen = [m for m in menus if m.get("id") in ["p1", "pa1"]]
        
        if not chosen and menus:
            chosen = [menus[0]]
            
        if chosen:
            return {
                "text": f"¡Mio caro! Tienes que probar la especialidad de la casa: **{chosen[0]['nombre']}**. {chosen[0].get('descripcion', '')} ¡Quedó exquisito, hecho con mucho amor como le gusta a la Nonna! ¿Te lo agrego al pedido, po?",
                "intent": "recommendation",
                "highlightIds": [chosen[0]["id"]],
                "addItem": None,
                "removeItem": None,
                "registerName": None
            }

    # 6. Cancellation / Removal
    is_cancellation = any(cancel in text_lower for cancel in ["cancelar", "eliminar", "quitar", "borrar", "saca", "sacar", "descartar", "remover"])
    if is_cancellation:
        for item in menus:
            name_clean = clean_keyword(item["nombre"])
            code_clean = clean_keyword(item.get("codigo", ""))
            # Check if name/code is in the text
            if name_clean in clean_keyword(text) or (code_clean and code_clean in clean_keyword(text)):
                # Check if it is in the cart
                is_in_cart = any(c.get("id") == item["id"] for c in cart)
                if not is_in_cart:
                    return {
                        "text": f"¡Oye po, bambino! El plato **{item['nombre']}** no está en tu pedido actual. ¿Deseas ordenar algo más de mangiare o prefieres que enviemos el pedido a la cocina?",
                        "intent": "remove_item_failed",
                        "addItem": None,
                        "removeItem": None,
                        "registerName": None,
                        "highlightIds": None
                    }
                return {
                    "text": f"Entendido, mio caro. He quitado **{item['nombre']}** de tu pedido. ¿Deseas algo más de mangiare o prefieres que enviemos el pedido a la cocina?",
                    "intent": "remove_item",
                    "removeItem": {"id": item["id"], "nombre": item["nombre"], "precio": item["precio"]},
                    "addItem": None,
                    "registerName": None,
                    "highlightIds": None
                }
        return {
            "text": "Disculpa, mio caro, no logré entender qué plato o bebida quieres sacar de la mesa. ¿Me lo podrías repetir con calma?",
            "intent": "remove_item_failed",
            "addItem": None,
            "removeItem": None,
            "registerName": None,
            "highlightIds": None
        }

    # 7. Ask for "lo de siempre" (favorite item)
    if any(fav_phrase in text_lower for fav_phrase in ["lo de siempre", "mi favorito", "lo mismo de la otra vez", "lo mismo de siempre", "traeme lo mismo", "tráeme lo mismo"]):
        if profile and profile.get("favorite_item_id"):
            fav_item = next((m for m in menus if m["id"] == profile["favorite_item_id"]), None)
            if fav_item:
                return {
                    "text": f"¡Al tiro, bambino! Te he agregado tu favorito de siempre: **{fav_item['nombre']}** al pedido. ¿Deseas algo más o prefieres que lo enviemos a la cocina?",
                    "intent": "add_item",
                    "addItem": {"id": fav_item["id"], "nombre": fav_item["nombre"], "precio": fav_item["precio"]},
                    "removeItem": None,
                    "registerName": None,
                    "highlightIds": None
                }
        return {
            "text": "Aún no tengo registrado tu plato favorito en mi memoria, bambina. Pídeme algo rico hoy para que me lo aprenda y te lo traiga la próxima vez, po.",
            "intent": "add_favorite_failed",
            "addItem": None,
            "removeItem": None,
            "registerName": None,
            "highlightIds": None
        }

    # 8. Send to kitchen
    if any(kitchen_phrase in text_lower for kitchen_phrase in ["enviar a la cocina", "mandar a la cocina", "enviar pedido", "mandar pedido", "confirmar pedido", "enviar a cocina", "mandar a cocina", "enviar el pedido", "mandar el pedido"]) or text_lower in ["enviar", "confirmar", "mandar"]:
        return {
            "text": "¡Excelente, bambino! Acabo de mandar tu pedido volando a la cocina. ¡Se comenzará a preparar de inmediato para que coman calientito y delicioso!",
            "intent": "send_to_kitchen",
            "addItem": None,
            "removeItem": None,
            "registerName": None,
            "highlightIds": None
        }

    # 9. Add Item
    for item in menus:
        name_clean = clean_keyword(item["nombre"])
        code_clean = clean_keyword(item.get("codigo", ""))
        if name_clean in clean_keyword(text) or (code_clean and code_clean in clean_keyword(text)):
            return {
                "text": f"¡Qué delicia, mio caro! He agregado **{item['nombre']}** a tu pedido. ¿Deseas algo más de mangiare o prefieres que enviemos el pedido a la cocina?",
                "intent": "add_item",
                "addItem": {"id": item["id"], "nombre": item["nombre"], "precio": item["precio"]},
                "removeItem": None,
                "registerName": None,
                "highlightIds": None
            }

    # General Conversational Reply
    responses = [
        "¡Hola, bambinos! Soy la Nonna Marriana. Estoy aquí para tomar tu pedido o recomendarte un vino bien rico. ¿Qué se te antoja mangiare hoy?",
        "Me encanta conversar contigo, mio caro. ¿Te gustaría que te recomiende un vinito reserva de la casa para acompañar la cena?",
        "Perfecto, po. Recuerda que puedes pedirme cosas como 'tráeme una lasagna', 'recomiéndame una pasta' o 'tráeme la cuenta' a viva voz.",
        "Entendido, mio caro. La Nonna está atenta a lo que necesites para que disfrutes de la mejor experiencia italiana en Santiago."
    ]
    return {
        "text": random.choice(responses),
        "intent": "chat",
        "addItem": None,
        "removeItem": None,
        "registerName": None,
        "highlightIds": None
    }

@app.post("/api/chat/message")
async def chat_message(data: ChatMessageRequest):
    """
    Processes chat message using Grok and returns a structured action + conversational reply.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    try:
        now = datetime.now()
        # Save user message in DB
        db.chat_messages.insert_one({
            "conv_id": data.conv_id,
            "role": "user",
            "text": data.text,
            "created_at": now,
            "sender_wallet": None,
            "sender_privy_id": None
        })
        
        # Update conversation timestamp
        db.chat_conversations.update_one(
            {"conv_id": data.conv_id},
            {"$set": {"updated_at": now}}
        )
        
        # Fetch menus & categories from MongoDB
        menus = list(db.menus.find({}))
        categories = list(db.categories.find({}))
        
        # Fetch delivery config from MongoDB
        delivery_config = db.delivery_config.find_one({"_id": "delivery_config"})
        if not delivery_config:
            delivery_config = db.delivery_config.find_one({}) or {}
            
        # Parse data to clean format
        menus_clean = [
            {
                "id": str(m.get("_id") or m.get("id")),
                "nombre": m.get("nombre"),
                "precio": m.get("precio"),
                "descripcion": m.get("descripcion", ""),
                "categoria_id": m.get("categoria_id"),
                "codigo": m.get("codigo", "")
            }
            for m in menus
        ]
        
        categories_clean = [
            {
                "id": str(c.get("_id") or c.get("id")),
                "name": c.get("name")
            }
            for c in categories
        ]
        
        delivery_config_clean = {
            "schedule": delivery_config.get("schedule", {}),
            "payment_methods": delivery_config.get("payment_methods", []),
            "delivery_fee_config": delivery_config.get("delivery_fee_config", {})
        }
        
        cart_clean = data.cart or []
        profile_clean = data.profile
        onboarding_face_id = data.onboarding_face_id
        
        # Check for XAI (Grok) config
        xai_api_key = os.environ.get("XAI_API_KEY")
        xai_api_url = os.environ.get("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
        xai_model = os.environ.get("XAI_MODEL", "grok-4-1-fast-non-reasoning")
        
        result_payload = None
        
        if xai_api_key:
            # Build system prompt for Grok
            catalog_summary = json.dumps({"categories": categories_clean, "dishes": menus_clean}, ensure_ascii=False)
            delivery_summary = json.dumps(delivery_config_clean, ensure_ascii=False)
            cart_summary = json.dumps(cart_clean, ensure_ascii=False)
            profile_summary = json.dumps(profile_clean, ensure_ascii=False) if profile_clean else "None"
            
            system_prompt = (
                "Eres La Nonna Marriana, la cariñosa, alegre y maternal abuela italo-chilena de la familia Piccola Italia. "
                "Respondes con mucho cariño, usando un español chileno súper natural mezclado con algunas palabras italianas "
                "(como 'mio caro', 'bambino', 'mangiare', 'po', 'ma qué', 'al tiro'). Eres graciosa, te preocupas mucho de "
                "que coman rico, pero eres concisa y directa cuando se trata de la orden. "
                "Evita usar asteriscos u otros caracteres especiales innecesarios en los nombres y platos (por ejemplo, di "
                "Pizza Margherita en vez de **Pizza Margherita** en el texto principal para evitar deletreos feos en el TTS, "
                "aunque puedes usar texto simple).\n\n"
                f"Catálogo del menú disponible en MongoDB:\n{catalog_summary}\n\n"
                f"Configuración de Delivery (tarifas, horarios y pagos unificados del Hub):\n{delivery_summary}\n\n"
                f"Perfil del cliente actual (reconocido por rostro): {profile_summary}\n"
                f"ID de rostro en proceso de registro (onboarding): {onboarding_face_id or 'Ninguno'}\n"
                f"Carrito actual de compras en la mesa: {cart_summary}\n\n"
                "Tu objetivo es conversar amigablemente con el cliente y clasificar su intención en un JSON estructurado. "
                "Tipos de intenciones (intent) válidas:\n"
                "- 'greeting': Si el cliente saluda.\n"
                "- 'recommendation': Si pide sugerencias o qué comer de rico.\n"
                "- 'add_item': Si indica explícitamente que quiere ordenar, traer o agregar un plato/bebida/postre. Debes identificar el plato del menú que más coincide en 'addItem'.\n"
                "- 'remove_item': Si el cliente pide explícitamente CANCELAR, ELIMINAR, QUITAR o SACAR un plato de su mesa que actualmente esté en el carrito. Identifica el plato en 'removeItem'. Si el plato no está en el carrito, responde que no está y pon intent='remove_item_failed'.\n"
                "- 'send_to_kitchen': Si confirma que quiere enviar/mandar su pedido a la cocina para que lo preparen.\n"
                "- 'bill': Si pide la cuenta o pagar la mesa.\n"
                "- 'call_waiter': Si solicita llamar al mesero/garzón físico o ayuda humana.\n"
                "- 'register_profile_success': Si estamos en onboarding (rostro reconocido pero sin perfil) y el usuario dice su nombre o cómo se llama. Extrae el nombre en 'registerName'.\n"
                "- 'chat': Conversación general o preguntas sobre horarios, formas de pago, costos de despacho o sobre el menú.\n\n"
                "INSTRUCCIÓN CRÍTICA DE RESPUESTA:\n"
                "Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta, sin código markdown ni texto adicional:\n"
                "{\n"
                '  "text": "La respuesta cariñosa en español chileno de La Nonna.",\n'
                '  "intent": "greeting|recommendation|add_item|remove_item|send_to_kitchen|bill|call_waiter|register_profile_success|chat|remove_item_failed",\n'
                '  "addItem": {"id": "item_id", "nombre": "Nombre del plato", "precio": 1000} o null,\n'
                '  "removeItem": {"id": "item_id", "nombre": "Nombre del plato", "precio": 1000} o null,\n'
                '  "registerName": "Nombre capturado" o null,\n'
                '  "highlightIds": ["id1", "id2"] o null\n'
                "}"
            )
            
            headers = {
                "Authorization": f"Bearer {xai_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": xai_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": data.text}
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"}
            }
            
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(xai_api_url, headers=headers, json=payload)
                if resp.status_code == 200:
                    grok_data = resp.json()
                    raw_content = grok_data["choices"][0]["message"]["content"]
                    result_payload = json.loads(raw_content)
                    logger.info(f"Grok responded successfully: {result_payload}")
                else:
                    logger.warning(f"Grok API returned status {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Error calling Grok API: {e}")
                
        # If Grok failed or was not configured, run Python fallback
        if not result_payload:
            logger.info("Running Python rule-based fallback command analyzer...")
            result_payload = python_fallback_command(data.text, menus_clean, cart_clean, profile_clean, onboarding_face_id)
            
        # Save assistant message in DB
        db.chat_messages.insert_one({
            "conv_id": data.conv_id,
            "role": "assistant",
            "text": result_payload.get("text", ""),
            "created_at": datetime.now()
        })
        
        return result_payload
        
    except Exception as e:
        logger.error(f"Error in chat_message route: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/profile/{face_id}")
async def get_profile(face_id: str):
    """
    Retrieves the customer profile associated with the face ID from MongoDB.
    Increments visit count upon scanner detection.
    """
    if db is None:
        return None
    try:
        db.garzon_profiles.update_one(
            {"face_id": face_id},
            {"$inc": {"visit_count": 1}},
            upsert=False
        )
        profile = db.garzon_profiles.find_one({"face_id": face_id})
        if profile:
            return clean_doc(profile)
        return None
    except Exception as e:
        logger.error(f"Error fetching profile: {e}")
        return None

@app.post("/api/profile")
async def save_profile(data: ProfileRequest):
    """
    Creates or updates the customer profile.
    Increments order count if completing a new order.
    """
    if db is None:
        return {"ok": False}
    try:
        now = datetime.now()
        existing = db.garzon_profiles.find_one({"face_id": data.face_id})
        if existing:
            update_fields = {
                "name": data.name,
                "updated_at": now
            }
            if data.favorite_item_id is not None:
                update_fields["favorite_item_id"] = data.favorite_item_id
            if data.last_order_ids is not None:
                prev_orders = existing.get("last_order_ids", []) or []
                new_list = list(set(prev_orders + data.last_order_ids))
                update_fields["last_order_ids"] = new_list
                update_fields["order_count"] = existing.get("order_count", 0) + 1
            db.garzon_profiles.update_one(
                {"face_id": data.face_id},
                {"$set": update_fields}
            )
        else:
            profile_doc = {
                "face_id": data.face_id,
                "name": data.name,
                "favorite_item_id": data.favorite_item_id,
                "last_order_ids": data.last_order_ids or [],
                "order_count": 1 if (data.last_order_ids and len(data.last_order_ids) > 0) else 0,
                "visit_count": 1,
                "created_at": now,
                "updated_at": now
            }
            db.garzon_profiles.insert_one(profile_doc)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Error saving profile: {e}")
        return {"ok": False}

# --- Ecosystem Provider Integration Endpoints ---

@app.post("/api/admin/claim")
async def claim_provider(request: Request):
    """
    Called by the admin panel to claim this satellite as a provider.
    Saves credentials and marks as claimed.
    """
    try:
        data = await request.json()
        now = datetime.now()
        config_doc = {
            "claimed": True,
            "company_id": data.get("company_id"),
            "provider_slug": data.get("provider_slug"),
            "api_key": data.get("api_key"),
            "dilithium_mnemonic": data.get("dilithium_mnemonic"),
            "dilithium_pk": data.get("dilithium_pk"),
            "admin_api_url": data.get("admin_api_url"),
            "claimed_by": data.get("claimed_by"),
            "updated_at": now
        }
        if db is not None:
            db.garzon_config.update_one(
                {"config_type": "ecosystem"},
                {"$set": config_doc, "$setOnInsert": {"created_at": now}},
                upsert=True
            )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error claiming provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/claim/status")
async def claim_status():
    """
    Returns the claim status of this provider.
    """
    if db is None:
        return {"claimed": False}
    try:
        config = db.garzon_config.find_one({"config_type": "ecosystem"})
        if config and config.get("claimed"):
            return {
                "claimed": True,
                "provider_slug": config.get("provider_slug"),
                "company_id": config.get("company_id")
            }
        return {"claimed": False}
    except Exception as e:
        logger.error(f"Error fetching claim status: {e}")
        return {"claimed": False}

@app.post("/api/admin/config/sync")
async def config_sync(request: Request):
    """
    Called by the admin panel to sync configuration (resync).
    """
    try:
        data = await request.json()
        now = datetime.now()
        update_fields = {
            "api_key": data.get("api_key"),
            "dilithium_mnemonic": data.get("dilithium_mnemonic"),
            "dilithium_pk": data.get("dilithium_pk"),
            "admin_api_url": data.get("admin_api_url"),
            "updated_at": now
        }
        if data.get("company_id") is not None:
            update_fields["company_id"] = data.get("company_id")
        if data.get("provider_slug") is not None:
            update_fields["provider_slug"] = data.get("provider_slug")
            
        if db is not None:
            db.garzon_config.update_one(
                {"config_type": "ecosystem"},
                {"$set": update_fields},
                upsert=True
            )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error syncing config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/config/sync/status")
async def config_sync_status():
    return {"success": True, "status": "synced"}

@app.post("/api/catalog/sync")
async def catalog_sync(request: Request):
    """
    Called by the admin panel to trigger catalog synchronization.
    Since we query MongoDB directly, we just return success.
    """
    return {"success": True, "message": "Catalog sync complete (read directly from MongoDB)"}

@app.get("/api/catalog/sync/status")
async def catalog_sync_status():
    return {"success": True, "status": "synced"}

@app.post("/api/home-config/sync")
async def home_config_sync():
    return {"success": True}

@app.get("/api/delivery-config")
async def get_delivery_config():
    """
    Returns the delivery configuration.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    try:
        config = db.delivery_config.find_one({})
        if config:
            return clean_doc(config)
        return {
            "status": "active",
            "schedule": {},
            "zones": [],
            "payment_methods": []
        }
    except Exception as e:
        logger.error(f"Error fetching delivery config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Start server on port 8082
    uvicorn.run(app, host="0.0.0.0", port=8082)
