"""
Admin Carta Management API
Thin route layer — all business logic lives in config.menus.*
"""

import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

from config.menus import products as product_svc
from config.menus import categories as category_svc
from config.menus import menu_options as option_svc
from config.menus import mtz as mtz_svc
from config.menus import sync as sync_svc
from config.menus import public_catalog as catalog_svc
from config.menus import locations as location_svc
from config.menus import menu_types as menu_type_svc
from config.menus.helpers import get_id_query
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    precio_especial: Optional[float] = None
    estado: Optional[bool] = None
    prioridad: Optional[int] = None
    media_r2: Optional[str] = None
    media_url: Optional[str] = None
    media_images: Optional[List[str]] = None
    media_video: Optional[str] = None
    category_ids: Optional[List[str]] = None
    currency: Optional[str] = None
    codigo: Optional[str] = None
    media_local: Optional[str] = None
    option_ids: Optional[List[str]] = None
    restriccion: Optional[List[str]] = None


class CategoryUpdate(BaseModel):
    nombre: Optional[str] = None
    alias: Optional[str] = None
    estado: Optional[bool] = None
    prioridad: Optional[int] = None
    menu_ids: Optional[List[str]] = None
    location_ids: Optional[List[str]] = None
    menu_type: Optional[str] = None


class LocationButtonsUpdate(BaseModel):
    custom_buttons: List[dict]


class LocationUpdate(BaseModel):
    """General-purpose location update — pass only the fields you want to change."""
    nombre:          Optional[str]        = None
    permalink_slug:  Optional[str]        = None
    media_r2:        Optional[str]        = None
    media_url:       Optional[str]        = None
    media_logo:      Optional[str]        = None
    custom_buttons:  Optional[List[dict]] = None
    direccion:       Optional[str]        = None
    telefono:        Optional[str]        = None
    horario:         Optional[str]        = None
    color:           Optional[str]        = None


class ProductCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    precio: Optional[float] = 0.0
    precio_especial: Optional[float] = None
    estado: Optional[bool] = True
    prioridad: Optional[int] = 0
    media_r2: Optional[str] = ""
    media_url: Optional[str] = ""
    media_images: Optional[List[str]] = []
    media_video: Optional[str] = ""
    category_ids: Optional[List[str]] = []
    currency: Optional[str] = "CLP"
    codigo: Optional[str] = ""
    media_local: Optional[str] = ""
    option_ids: Optional[List[str]] = []
    restriccion: Optional[List[str]] = []


class CategoryCreate(BaseModel):
    nombre: str
    alias: Optional[str] = ""
    estado: Optional[bool] = True
    prioridad: Optional[int] = 0
    menu_ids: Optional[List[str]] = []
    location_ids: Optional[List[str]] = []
    menu_type: Optional[str] = "carta"


class BulkDeleteRequest(BaseModel):
    ids: List[str]


class OrganizeMediaRequest(BaseModel):
    images: List[str] = []
    video_url: Optional[str] = None


class MenuOptionValueUpdate(BaseModel):
    name: Optional[str] = None
    codigo: Optional[str] = None
    price: Optional[float] = None
    priority: Optional[int] = None


class EspecialUpdate(BaseModel):
    special_price: Optional[float] = None
    special_status: Optional[bool] = None
    type: Optional[str] = None              # 'F' = fixed, 'P' = percent
    validity: Optional[str] = None          # 'forever' | 'recurring' | 'date_range'
    recurring_every: Optional[List[str]] = None   # ['1','2',...,'7']  ISO weekdays
    recurring_from: Optional[str] = None    # 'HH:MM:SS'
    recurring_to: Optional[str] = None      # 'HH:MM:SS'
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class MoveOptionValueRequest(BaseModel):
    target_option_id: str   # _id of the destination option group


class OptionValueInput(BaseModel):
    id: Optional[str] = None
    option_value_id: Optional[str] = None
    name: str
    codigo: Optional[str] = ""
    price: Optional[float] = 0.0
    priority: Optional[int] = 0
    is_default: Optional[bool] = False


class CreateOptionGroupRequest(BaseModel):
    option_name: str
    display_type: Optional[str] = "select"          # select | quantity | checkbox
    required: Optional[bool] = False
    priority: Optional[int] = 0
    min_selected: Optional[int] = 0
    max_selected: Optional[int] = 1
    menu_id: Optional[str] = ""                     # parent product _id (modifier) or "" (product-group)
    menu_ids: Optional[List[str]] = []              # multi product linking
    option_id: Optional[str] = None                 # canonical type id (optional)
    option_type: Optional[str] = None               # 'modifier' | 'product_group'
    values: Optional[List[OptionValueInput]] = []   # initial values


class LinkModifierRequest(BaseModel):
    product_id: str  # target product _id; pass "" to unlink


# ─────────────────────────────────────────────
# Auth guard
# ─────────────────────────────────────────────

def _require_catalog_access(request: Request = None, user: dict = Depends(verify_session)):
    """Guard: requiere nivel 3, 4 o 5 (DOMINUS, CENTURIO o MILITES)."""
    require_admin_level(user, "member")
    return user


async def _require_catalog_or_token(request: Request) -> dict:
    """
    Dual-auth guard para endpoints semi-públicos (ej: /carta/locations).
    Acepta:
      1. Sesión admin válida (verify_session + require_admin_level)
      2. Header X-API-Key con el token público (mismo que /public/menus_catalog)
    Útil para que la carta digital pueda consultar locations sin sesión.
    """
    from config.menus.public_catalog import EXTERNAL_API_KEY
    api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
    if api_key and api_key == EXTERNAL_API_KEY:
        return {"role": "public", "api_key": api_key}
    # Fallback: sesión admin
    try:
        user = await verify_session(request)
        require_admin_level(user, "member")
        return user
    except Exception:
        raise HTTPException(
            status_code=403,
            detail="Se requiere sesión de administrador o X-API-Key válida.",
        )


# ═════════════════════════════════════════════
# Products (menus) CRUD
# ═════════════════════════════════════════════

@router.get("/carta/products")
async def list_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    only_active: bool = False,
    skip: int = 0,
    limit: int = 2000,   # admin needs all products — raised from 200
    user: dict = Depends(_require_catalog_access),
):
    return product_svc.list_products(search, category_id, only_active, skip, limit)


@router.get("/carta/products/{product_id}")
async def get_product(product_id: str, user: dict = Depends(_require_catalog_access)):
    doc = product_svc.get_product(product_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return doc


@router.post("/carta/products")
async def create_product(data: ProductCreate, user: dict = Depends(_require_catalog_access)):
    pid = await product_svc.create_product(data.dict())
    return {"success": True, "id": pid}


@router.put("/carta/products/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, user: dict = Depends(_require_catalog_access)):
    update_fields = data.dict(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    matched = await product_svc.update_product(product_id, update_fields)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}


@router.patch("/carta/products/{product_id}/especial")
async def update_product_especial(
    product_id: str,
    data: EspecialUpdate,
    user: dict = Depends(_require_catalog_access),
):
    """
    Patch only the 'especial' sub-document of a product.
    Preserves existing especial fields not included in the request.
    """
    fields = data.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No especial fields to update")

    set_payload = {f"especial.{k}": v for k, v in fields.items()}
    matched = await product_svc.update_product(product_id, set_payload)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}


@router.delete("/carta/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(_require_catalog_access)):
    await product_svc.delete_product(product_id)
    return {"success": True}


@router.post("/carta/products/bulk-delete")
async def bulk_delete_products(data: BulkDeleteRequest, user: dict = Depends(_require_catalog_access)):
    deleted = await product_svc.bulk_delete_products(data.ids)
    return {"success": True, "deleted_count": deleted}


class ReorderItem(BaseModel):
    id: str
    prioridad: int

class ReorderRequest(BaseModel):
    items: List[ReorderItem]

@router.post("/carta/products/reorder")
async def reorder_products(data: ReorderRequest, user: dict = Depends(_require_catalog_access)):
    """Bulk update product priorities for drag-and-drop reordering."""
    from pymongo import UpdateOne
    ops = [
        UpdateOne(
            get_id_query(item.id),
            {"$set": {"prioridad": item.prioridad}}
        )
        for item in data.items
    ]
    if ops:
        result = db.menus.bulk_write(ops, ordered=False)
        logger.info(f"[carta] Reordered {result.modified_count}/{len(ops)} products")
    return {"success": True, "updated": len(ops)}


@router.post("/carta/products/upload-image")
async def upload_product_image(file: UploadFile = File(...), user: dict = Depends(_require_catalog_access)):
    try:
        url = product_svc.upload_image(file.file, file.filename, file.content_type)
        return {"url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading product image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/carta/products/upload-video")
async def upload_product_video(file: UploadFile = File(...), user: dict = Depends(_require_catalog_access)):
    """Upload a product video directly to R2. Accepts mp4, mov, webm."""
    try:
        url = product_svc.upload_video(file.file, file.filename, file.content_type)
        logger.info(f"[carta] Video uploaded to R2: {url}")
        return {"url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading product video: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/carta/products/{product_id}/organize-media")
async def organize_product_media(product_id: str, req: OrganizeMediaRequest, user: dict = Depends(_require_catalog_access)):
    try:
        result = await product_svc.organize_media(product_id, req.images, req.video_url)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ═════════════════════════════════════════════
# Categories CRUD
# ═════════════════════════════════════════════

@router.get("/carta/categories")
async def list_categories(only_active: bool = False, menu_type: Optional[str] = None, user: dict = Depends(_require_catalog_access)):
    return category_svc.list_categories(only_active, menu_type=menu_type)


@router.get("/carta/categories/{category_id}")
async def get_category(category_id: str, user: dict = Depends(_require_catalog_access)):
    doc = category_svc.get_category(category_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")
    return doc


@router.post("/carta/categories")
async def create_category(data: CategoryCreate, user: dict = Depends(_require_catalog_access)):
    cid = await category_svc.create_category(data.dict())
    return {"success": True, "id": cid}


@router.put("/carta/categories/{category_id}")
async def update_category(category_id: str, data: CategoryUpdate, user: dict = Depends(_require_catalog_access)):
    update_fields = data.dict(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    matched = await category_svc.update_category(category_id, update_fields)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}


@router.delete("/carta/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(_require_catalog_access)):
    deleted = await category_svc.delete_category(category_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}


@router.post("/carta/categories/bulk-delete")
async def bulk_delete_categories(data: BulkDeleteRequest, user: dict = Depends(_require_catalog_access)):
    deleted = await category_svc.bulk_delete_categories(data.ids)
    return {"success": True, "deleted_count": deleted}


# ═════════════════════════════════════════════
# Menu Types (carta, promociones, bar, etc.)
# ═════════════════════════════════════════════

class MenuTypeCreate(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = "BookOpen"
    color: Optional[str] = "#607D8B"
    priority: Optional[int] = 99

class MenuTypeUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    priority: Optional[int] = None


@router.get("/carta/menu-types")
async def list_menu_types(user: dict = Depends(_require_catalog_access)):
    return menu_type_svc.list_menu_types()


@router.post("/carta/menu-types")
async def create_menu_type(data: MenuTypeCreate, user: dict = Depends(_require_catalog_access)):
    try:
        slug = menu_type_svc.create_menu_type(data.dict())
        return {"success": True, "slug": slug}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/carta/menu-types/{slug}")
async def update_menu_type(slug: str, data: MenuTypeUpdate, user: dict = Depends(_require_catalog_access)):
    fields = data.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    matched = menu_type_svc.update_menu_type(slug, fields)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Menu type not found")
    return {"success": True}


@router.delete("/carta/menu-types/{slug}")
async def delete_menu_type(slug: str, user: dict = Depends(_require_catalog_access)):
    result = menu_type_svc.delete_menu_type(slug)
    if not result.get("deleted"):
        if result.get("error") == "not_found":
            raise HTTPException(status_code=404, detail="Menu type not found")
        if result.get("error") == "cannot_delete_default":
            raise HTTPException(status_code=400, detail="Cannot delete the default menu type")
    return {"success": True, "moved_categories": result.get("moved_categories", 0)}


# ═════════════════════════════════════════════
# Menu Options (product grouping)
# ═════════════════════════════════════════════

@router.get("/carta/menu-options")
async def list_menu_options(user: dict = Depends(_require_catalog_access)):
    return option_svc.list_menu_options()


@router.post("/carta/menu-options")
async def create_menu_option_group(
    data: CreateOptionGroupRequest,
    user: dict = Depends(_require_catalog_access),
):
    """Create a new option group (modifier or product group)."""
    payload = data.dict()
    # Convert OptionValueInput objects to plain dicts and add generated ids
    import uuid
    raw_values = []
    for i, v in enumerate(payload.get("values") or []):
        raw_values.append({
            "id": str(uuid.uuid4().int)[:8],
            "option_value_id": str(i + 1),
            "name": v["name"],
            "codigo": v.get("codigo") or "",
            "price": v.get("price") or 0,
            "priority": v.get("priority") or i,
            "is_default": v.get("is_default") or False,
            "stock_qty": 0,
            "location_ids": [],
        })
    payload["values"] = raw_values
    new_id = option_svc.create_option_group(payload)
    return {"success": True, "id": new_id}


class ReorderGroupItem(BaseModel):
    id: str
    category_priority: int

class ReorderGroupsRequest(BaseModel):
    items: List[ReorderGroupItem]

@router.post("/carta/menu-options/reorder")
async def reorder_menu_option_groups(data: ReorderGroupsRequest, user: dict = Depends(_require_catalog_access)):
    """Bulk update category_priority for product-group option groups (drag-and-drop ordering)."""
    updated = option_svc.reorder_groups([item.dict() for item in data.items])
    return {"success": True, "updated": updated}


@router.put("/carta/menu-options/{option_id}")
async def update_menu_option_group(
    option_id: str,
    data: CreateOptionGroupRequest,
    user: dict = Depends(_require_catalog_access),
):
    """Update an existing option group (modifier or product group)."""
    payload = data.dict()
    import uuid
    raw_values = []
    for i, v in enumerate(payload.get("values") or []):
        raw_values.append({
            "id": v.get("id") or str(uuid.uuid4().int)[:8],
            "option_value_id": v.get("option_value_id") or str(i + 1),
            "name": v["name"],
            "codigo": v.get("codigo") or "",
            "price": v.get("price") or 0,
            "priority": v.get("priority") or i,
            "is_default": v.get("is_default") or False,
            "stock_qty": 0,
            "location_ids": [],
        })
    payload["values"] = raw_values
    matched = option_svc.update_option_group(option_id, payload)
    if not matched:
        raise HTTPException(status_code=404, detail="Option group not found")
    return {"success": True, "id": option_id}


@router.put("/carta/menu-options/{option_id}/values/{value_id}")
async def update_menu_option_value(option_id: str, value_id: str, data: MenuOptionValueUpdate, user: dict = Depends(_require_catalog_access)):
    update_fields = data.dict(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    matched = option_svc.update_value(option_id, value_id, update_fields)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Menu option not found")
    return {"success": True}


@router.delete("/carta/menu-options/{option_id}/values/{value_id}")
async def delete_menu_option_value(option_id: str, value_id: str, user: dict = Depends(_require_catalog_access)):
    matched = option_svc.delete_value(option_id, value_id)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Menu option not found")
    return {"success": True}


@router.post("/carta/menu-options/{option_id}/values/{value_id}/move")
async def move_menu_option_value(
    option_id: str,
    value_id: str,
    data: MoveOptionValueRequest,
    user: dict = Depends(_require_catalog_access),
):
    """Move a modifier value from one option group to another."""
    result = option_svc.move_value(option_id, value_id, data.target_option_id)
    if not result.get("moved"):
        raise HTTPException(status_code=404, detail=result.get("error", "Move failed"))
    return {"success": True, "value": result["value"]}


@router.delete("/carta/menu-options/{option_id}")
async def delete_menu_option(option_id: str, user: dict = Depends(_require_catalog_access)):
    deleted = option_svc.delete_option(option_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Menu option not found")
    return {"success": True}




@router.get("/carta/menu-options/duplicates")
async def get_duplicate_codigos(user: dict = Depends(_require_catalog_access)):
    """
    Returns all codigos that appear in more than one option group,
    plus a count of how many extra values would be removed.
    """
    return option_svc.find_duplicate_codigos()


@router.post("/carta/menu-options/remove-duplicates")
async def remove_duplicate_values(
    dry_run: bool = False,
    user: dict = Depends(_require_catalog_access),
):
    """
    For every duplicated codigo in product-group type options,
    keep the FIRST occurrence and delete the rest.
    Pass ?dry_run=true to preview without writing to DB.
    """
    result = option_svc.bulk_remove_duplicate_values(dry_run=dry_run)
    return result


@router.get("/carta/products/{product_id}/modifiers")
async def get_product_modifiers(product_id: str, user: dict = Depends(_require_catalog_access)):
    """
    Return all modifier groups currently linked to a given product.
    These are menu_options where menu_id == product._id.
    """
    return option_svc.list_modifiers_for_product(product_id)


@router.patch("/carta/menu-options/{option_id}/link")
async def link_modifier_to_product(
    option_id: str,
    data: LinkModifierRequest,
    user: dict = Depends(_require_catalog_access),
):
    """
    Link a modifier group to a product (sets menu_id = product_id).
    Pass product_id="" to unlink and convert to a standalone product-group.
    """
    matched = option_svc.link_modifier_to_product(option_id, data.product_id)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Menu option not found")
    action = "linked" if data.product_id else "unlinked"
    return {"success": True, "action": action, "menu_id": data.product_id}


# ═════════════════════════════════════════════
# MTZ Data Integration
# ═════════════════════════════════════════════

@router.get("/carta/products/{product_id}/mtz-data")
async def get_mtz_data(product_id: str, user: dict = Depends(_require_catalog_access)):
    result = mtz_svc.get_mtz_data(product_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return result


@router.get("/carta/mtz-summary")
async def get_mtz_summary(user: dict = Depends(_require_catalog_access)):
    """Batch: latest-month sales/margin summary per product code for the table."""
    # Get latest mesano
    latest_doc = db.rentabilidad_producto_locales.find_one(
        {}, {"mesano": 1, "_id": 0}, sort=[("mesano", -1)]
    )
    if not latest_doc:
        return {"mesano": None, "data": {}}
    mesano = latest_doc["mesano"]

    # One aggregation for all products in the latest month
    pipeline = [
        {"$match": {"mesano": mesano}},
        {"$group": {
            "_id": "$codig",
            "cantidad": {"$sum": "$cantidad"},
            "total_venta": {"$sum": "$total_venta"},
            "total_margen": {"$sum": "$total_margen"},
            "total_costo": {"$sum": "$total_costo"},
            "puven": {"$first": "$puven"},
        }},
    ]
    results = list(db.rentabilidad_producto_locales.aggregate(pipeline))

    data = {}
    for r in results:
        cod = r["_id"]
        if not cod:
            continue
        cant = r.get("cantidad", 0)
        venta = r.get("total_venta", 0)
        margen = r.get("total_margen", 0)
        costo = r.get("total_costo", 0)
        cupro = round(costo / cant, 0) if cant > 0 else None
        margin_pct = round(margen / venta * 100, 1) if venta > 0 else None
        data[cod] = {
            "cantidad": cant,
            "total_venta": round(venta),
            "total_margen": round(margen),
            "cupro": cupro,
            "margin_pct": margin_pct,
            "puven": r.get("puven"),
        }

    return {"mesano": mesano, "data": data}


@router.get("/carta/mtz-missing")
async def get_mtz_missing_products(user: dict = Depends(_require_catalog_access)):
    return mtz_svc.get_missing_products()


@router.post("/carta/trigger-public-sync")
async def trigger_public_sync(user: dict = Depends(_require_catalog_access)):
    """
    Triggers the carta digital worker to re-sync its catalog from MongoDB.
    Propagates cooldown (429) and error responses from the remote worker.
    """
    result = await sync_svc.trigger_public_sync()
    if not result.get("ok"):
        status_code = result.get("status") or 500
        # Map remote 429 → our 429; anything else → 502 (bad gateway)
        http_status = 429 if status_code == 429 else (502 if status_code != 200 else 500)
        raise HTTPException(
            status_code=http_status,
            detail=result.get("detail") or "El worker de la carta no respondió correctamente.",
        )
    return {
        "success": True,
        "message": "Sincronización disparada correctamente",
        "worker": result.get("detail"),
    }


@router.post("/carta/debug/clean-duplicates")
async def clean_database_duplicates(user: dict = Depends(_require_catalog_access)):
    message = sync_svc.clean_database_duplicates()
    return {"success": True, "message": message}


# ═════════════════════════════════════════════
# Public Catalog API
# ═════════════════════════════════════════════

@router.get("/public/menus_catalog")
async def get_public_catalog(request: Request):
    api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
    # Aceptar el EXTERNAL_API_KEY hardcodeado
    if api_key == catalog_svc.EXTERNAL_API_KEY:
        try:
            return catalog_svc.get_public_catalog(api_key)
        except PermissionError:
            raise HTTPException(status_code=401, detail="Invalid API Key")
    # Aceptar también tokens de BD (api_keys / api_tokens) — igual que piccola_apis
    if api_key:
        from apis.piccola_apis import verify_api_key as _verify_db_key
        try:
            await _verify_db_key(api_key)
        except HTTPException:
            raise HTTPException(status_code=401, detail="Invalid API Key")
        try:
            return catalog_svc.get_public_catalog(catalog_svc.EXTERNAL_API_KEY)
        except PermissionError:
            raise HTTPException(status_code=401, detail="Invalid API Key")
    raise HTTPException(status_code=401, detail="Missing API Key")


# ═════════════════════════════════════════════
# QR redirect — public, no auth required
# ═════════════════════════════════════════════

@router.get("/go/{slug}")
async def qr_redirect(slug: str, request: Request):
    """
    Public redirect endpoint for QR codes.
    Logs the scan event then redirects to the location's qr_redirect_url.
    """
    from starlette.responses import RedirectResponse

    loc = location_svc.get_location_by_slug(slug)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    # Log the scan asynchronously-ish (fire & forget — still sync pymongo but fast insert)
    try:
        location_svc.log_qr_scan(
            slug=slug,
            location_id=loc.get("id", ""),
            user_agent=request.headers.get("user-agent", ""),
            ip=request.client.host if request.client else "",
            referer=request.headers.get("referer", ""),
        )
    except Exception as e:
        logger.warning(f"QR scan log failed: {e}")

    redirect_url = (loc.get("qr_redirect_url") or "").strip()
    if not redirect_url:
        redirect_url = f"https://lapiccolaitalia.cl/local/{slug}"

    return RedirectResponse(url=redirect_url, status_code=307)


@router.get("/carta/qr-stats/{slug}")
async def get_qr_stats(slug: str, user: dict = Depends(_require_catalog_or_token)):
    """Return QR scan analytics for a location slug."""
    try:
        stats = location_svc.get_qr_scan_stats(slug)
        # Also include live visitor count from Redis
        try:
            from fastapi_cache import FastAPICache
            redis = FastAPICache.get_backend().redis
            raw_keys = await redis.keys(f"visitor:{slug}:*")
            stats["live_visitors"] = len(raw_keys)
        except Exception:
            stats["live_visitors"] = 0
        return stats
    except Exception as e:
        logger.error(f"Error getting QR stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═════════════════════════════════════════════
# Visitor tracking — public heartbeat + admin counts
# ═════════════════════════════════════════════

@router.post("/public/heartbeat")
async def visitor_heartbeat(request: Request):
    """
    Public endpoint — the carta digital pings this every 30s.
    Body: { slug, session_id, device_type? }
    Each session is a Redis key with 90s TTL (auto-expires if no ping).
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    slug = (body.get("slug") or "").strip()
    session_id = (body.get("session_id") or "").strip()
    if not slug or not session_id:
        raise HTTPException(status_code=400, detail="slug and session_id required")

    device_type = body.get("device_type", "unknown")
    user_agent = request.headers.get("user-agent", "")[:200]

    try:
        from fastapi_cache import FastAPICache
        redis = FastAPICache.get_backend().redis
        key = f"visitor:{slug}:{session_id}"
        # Store visitor info with 90s TTL — auto-expires if carta stops pinging
        import json as _json
        payload = _json.dumps({
            "dt": device_type,
            "ua": user_agent,
            "t": datetime.now(timezone.utc).isoformat(),
        })
        await redis.set(key, payload, ex=90)
        print(f"[HEARTBEAT] SET {key} → TTL=90s, device={device_type}")
    except Exception as e:
        logger.warning(f"Heartbeat redis error: {e}")

    return {"ok": True}


@router.get("/carta/live-visitors")
async def get_live_visitors(user: dict = Depends(_require_catalog_or_token)):
    """Return active visitor count per location slug."""
    try:
        from fastapi_cache import FastAPICache
        import json as _json
        redis = FastAPICache.get_backend().redis
        raw_keys = await redis.keys("visitor:*")
        print(f"[LIVE-VISITORS] Redis keys found: {len(raw_keys)} — raw sample: {raw_keys[:3]}")

        # Parse: visitor:{slug}:{session_id}
        counts = {}
        details = {}
        for raw_key in raw_keys:
            # Redis may return bytes — decode to str
            key_str = raw_key.decode("utf-8") if isinstance(raw_key, bytes) else str(raw_key)
            parts = key_str.split(":", 2)
            if len(parts) < 3:
                print(f"[LIVE-VISITORS] Bad key format: {key_str}")
                continue
            slug = parts[1]
            counts[slug] = counts.get(slug, 0) + 1
            # Get device detail for this visitor
            try:
                raw = await redis.get(raw_key)
                if raw:
                    val_str = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
                    info = _json.loads(val_str)
                    if slug not in details:
                        details[slug] = {"mobile": 0, "desktop": 0, "tablet": 0, "unknown": 0}
                    dt = info.get("dt", "unknown")
                    details[slug][dt] = details[slug].get(dt, 0) + 1
            except Exception:
                pass

        print(f"[LIVE-VISITORS] Result: counts={counts}, total={sum(counts.values())}")
        return {"counts": counts, "details": details, "total": sum(counts.values())}
    except Exception as e:
        logger.error(f"Error getting live visitors: {e}")
        return {"counts": {}, "details": {}, "total": 0}


# ═════════════════════════════════════════════
# Locations
# ═════════════════════════════════════════════

@router.get("/carta/locations")
async def get_locations(user: dict = Depends(_require_catalog_or_token)):
    """
    Return all locations with their images (media_r2, media_url, media_logo)
    and optional metadata (direccion, telefono, horario, color, custom_buttons).

    Auth: acepta sesión admin O X-API-Key (token público de la carta digital).
    """
    return location_svc.list_locations()


@router.put("/carta/locations/{location_id}")
async def update_location(
    location_id: str,
    data: LocationUpdate,
    user: dict = Depends(_require_catalog_access),
):
    """Update any combination of a location's safe fields (including images)."""
    fields = data.dict(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        matched = await location_svc.update_location(location_id, fields)
        if matched == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        return {"status": "success", "updated": list(fields.keys())}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating location {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/carta/locations/{location_id}/buttons")
async def update_location_buttons(
    location_id: str,
    data: LocationButtonsUpdate,
    user: dict = Depends(_require_catalog_access),
):
    try:
        matched = await location_svc.update_location_buttons(location_id, data.custom_buttons)
        if matched == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        return {"status": "success", "message": "Buttons updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating location buttons: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/carta/locations/{location_id}/upload-image")
async def upload_location_image(
    location_id: str,
    file: UploadFile = File(...),
    field: str = "media_r2",   # 'media_r2' | 'media_logo'
    user: dict = Depends(_require_catalog_access),
):
    """
    Upload an image to R2 and save its URL to the location document.

    Query param `field` chooses which field to update:
      - media_r2   → main banner/header image  (default)
      - media_logo → secondary logo image
    """
    if field not in ("media_r2", "media_logo", "media_url"):
        raise HTTPException(status_code=400, detail="Invalid field. Use 'media_r2' or 'media_logo'.")
    try:
        url = location_svc.upload_location_image(file.file, file.filename, file.content_type)
        matched = await location_svc.update_location(location_id, {field: url})
        if matched == 0:
            raise HTTPException(status_code=404, detail="Location not found")
        return {"success": True, "field": field, "url": url}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading location image for {location_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
