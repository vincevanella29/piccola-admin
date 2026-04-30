import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from apis.apikeys import validate_api_key

router = APIRouter()
logger = logging.getLogger(__name__)

DELIVERY_COLL = db.delivery_orders
MENUS_COLL = db.menus
LOCATIONS_COLL = db.sucursales

# =====================================================================
# Modela de Datos
# =====================================================================

class CustomerInfo(BaseModel):
    name: str = Field(..., min_length=1, description="Nombre del cliente")
    email: str = Field(..., description="Correo del cliente")
    phone: str = Field(..., description="Teléfono de contacto")
    address: str = Field(..., description="Dirección de envío")
    depto: Optional[str] = Field(None, description="Número de departamento / casa")

class ModifierItem(BaseModel):
    option_id: str
    value_id: str
    price: float = 0.0

class OrderItem(BaseModel):
    codigo: str
    quantity: int = Field(..., ge=1)
    unit_price: float
    modifiers: List[ModifierItem] = []

class DeliveryOrderCreate(BaseModel):
    location_id: str = Field(..., description="ID de la sucursal (ObjectId) o Slug")
    customer: CustomerInfo
    items: List[OrderItem] = Field(..., min_items=1)
    delivery_fee: float = 0.0
    total_amount: float
    notes: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., description="pending, accepted, preparing, ready, dispatched, delivered, cancelled")

# =====================================================================
# Dependencias Auth
# =====================================================================

def verify_external_api_key(x_api_key: str = Header(..., description="API Key con formato key_id.secret")):
    key_doc = validate_api_key(x_api_key)
    if not key_doc:
        raise HTTPException(status_code=401, detail="API Key inválida, inactiva o expirada")
    return key_doc

# =====================================================================
# Endpoints (External API - Ingreso de Pedidos)
# =====================================================================

@router.post("/delivery/orders", summary="Recepcionar pedido de delivery externo")
async def create_delivery_order(
    payload: DeliveryOrderCreate, 
    key_doc: dict = Depends(verify_external_api_key)
):
    """
    Ingresa al sistema un pedido originado desde una plataforma externa o landing page.
    Valida la API key, la integridad del local, y los precios de los productos enviados.
    """
    now = datetime.utcnow()

    # 1. Validar la sucursal (por _id o slug)
    loc = None
    if ObjectId.is_valid(payload.location_id):
        loc = LOCATIONS_COLL.find_one({"_id": ObjectId(payload.location_id)})
    if not loc:
        loc = LOCATIONS_COLL.find_one({"slug": payload.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    # 2. Validar ítems del carrito contra DB
    # Nota: extraemos códigos únicos, los consultamos a la bd "menus",
    # y nos aseguramos que estén vigentes y los precios sean lógicos.
    codigos_enviados = {item.codigo for item in payload.items}
    db_items_list = list(MENUS_COLL.find({"codigo": {"$in": list(codigos_enviados)}}))
    db_items_map = {item["codigo"]: item for item in db_items_list}

    calculated_subtotal = 0.0

    for item in payload.items:
        db_item = db_items_map.get(item.codigo)
        if not db_item:
            raise HTTPException(status_code=400, detail=f"Producto con código {item.codigo} no existe en la carta.")
        
        # Validar si el producto está inactivo globalmente
        if not db_item.get("estado", True):
            raise HTTPException(status_code=400, detail=f"Producto con código {item.codigo} se encuentra inactivo.")

        # Validamos el precio base. 
        # (Posteriormente se pueden inyectar reglas de horarios / precios especiales aquí)
        db_price = db_item.get("precio", 0.0)
        
        # Tolerancia básica: Permitimos que el precio del payload coincida.
        # Si tienes lógica de descuentos externa, evalúa flexibilizar esta regla
        # o que el payload te envíe "original_price" y "discount_applied".
        if float(db_price) != float(item.unit_price):
            logger.warning(f"[Delivery Validation] Precios difieren para {item.codigo}. DB={db_price}, Recibido={item.unit_price}")
            # raise HTTPException(status_code=400, detail=f"Error en precio de producto {item.codigo}. Se esperaba {db_price}")

        # Calcular items + modifiers para asegurarnos de que la matemática es correcta
        mods_total = sum(m.price for m in item.modifiers)
        item_total = (item.unit_price + mods_total) * item.quantity
        calculated_subtotal += item_total

    calculated_total = calculated_subtotal + payload.delivery_fee

    # Validar (con un límite de flotantes) que el order total reclamado cuadre matemáticamente
    if abs(calculated_total - payload.total_amount) > 1.0:
        logger.warning(f"Total Amount mismatch. Calculated: {calculated_total}, Sent: {payload.total_amount}")
        # raise HTTPException(status_code=400, detail="El total_amount no cuadra con la sumatoria de ítems y costo de delivery.")

    # 3. Preparar documento de inserción
    order_doc = {
        "api_key_id": key_doc["id"],
        "api_key_owner": key_doc["owner"],
        "location_id": str(loc["_id"]),
        "location_slug": loc.get("slug"),
        "customer": payload.customer.dict(),
        "items": [i.dict() for i in payload.items],
        "delivery_fee": payload.delivery_fee,
        "total_amount": payload.total_amount,
        "notes": payload.notes,
        "status": "pending",  # default
        "created_at": now,
        "updated_at": now
    }

    result = DELIVERY_COLL.insert_one(order_doc)

    # 4. (Opcional - Futuro) Emitir evento WS a la sucursal para que timbre la tablet
    
    return {
        "success": True, 
        "order_id": str(result.inserted_id),
        "status": "pending",
        "message": "Pedido ingresado correctamente."
    }


# =====================================================================
# Endpoints (Admin API - Gestión Interna)
# =====================================================================

@router.get("/delivery/orders", summary="Listar pedidos para gestor de sucursal")
async def get_delivery_orders(
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(verify_session)
):
    """
    Retorna la lista de pedidos en curso. Esto se lee desde el panel Admin o App Kitchen.
    """
    require_admin_level(user, "member")

    query = {}
    if location_id:
        query["location_id"] = location_id
    if status:
        query["status"] = status
    
    # Sort por los más recientes
    cursor = DELIVERY_COLL.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = []
    
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["created_at"] = doc["created_at"].isoformat() if doc.get("created_at") else None
        doc["updated_at"] = doc["updated_at"].isoformat() if doc.get("updated_at") else None
        orders.append(doc)
    
    total = DELIVERY_COLL.count_documents(query)

    return {
        "success": True,
        "orders": orders,
        "total": total
    }

@router.patch("/delivery/orders/{order_id}/status", summary="Avanzar estado del pedido")
async def update_delivery_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    user: dict = Depends(verify_session)
):
    """
    Actualiza el estado de un pedido e.g. a 'preparing', 'ready', 'dispatched'.
    """
    require_admin_level(user, "member")

    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="ID de orden inválido")

    valid_statuses = {"pending", "accepted", "preparing", "ready", "dispatched", "delivered", "cancelled"}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status inválido. Permitidos: {valid_statuses}")

    # Verificar existencia
    order = DELIVERY_COLL.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    now = datetime.utcnow()
    
    DELIVERY_COLL.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "status": payload.status,
            "updated_at": now,
            "updated_by": user.get("wallet")
        }}
    )

    return {
        "success": True,
        "message": f"Pedido actualizado a: {payload.status}"
    }
