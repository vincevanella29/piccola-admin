import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db
from utils.r2_upload import upload_to_r2

router = APIRouter()
logger = logging.getLogger(__name__)

# Models for response structure
class LocationsResponse(BaseModel):
    locations: List[dict]
    error: Optional[str] = None

class MenusResponse(BaseModel):
    menus: List[dict]
    categories: List[dict]
    menu_options: List[dict]
    error: Optional[str] = None


class UpdateLocationRequest(BaseModel):
    # Campos opcionales que se pueden actualizar/agregar
    capacidad_personas: Optional[int] = None
    cantidad_mesas: Optional[int] = None
    cantidad_sillas: Optional[int] = None
    descripcion: Optional[str] = None
    media_urls: Optional[List[str]] = None  # para setear/overwrittear manualmente si se desea


class UpdateLocationResponse(BaseModel):
    location: dict
    error: Optional[str] = None


class PhotoUploadResponse(BaseModel):
    urls: List[str]
    error: Optional[str] = None

@router.get("/locations", response_model=LocationsResponse)
async def get_locations():
    """
    Fetch location data from MongoDB, returning raw documents.
    No session verification required.
    """
    try:
        locations = list(db.locations.find({}, {}))
        logger.info(f"Fetched {len(locations)} locations")
        return LocationsResponse(locations=locations, error=None)
    except Exception as e:
        logger.error(f"Unexpected error in get_locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching locations: {str(e)}")


@router.get("/menus", response_model=MenusResponse)
async def get_menus(user: dict = Depends(verify_session)):
    """
    Devuelve todos los menús, todas las categorías y todas las opciones de menú como colecciones independientes. El frontend hará el cruce usando menu_ids y option_ids.
    Además, agrega la data de rentabilidad de productos (cupro, total_costo, total_margen, total_venta, margen, cantidad) de la colección rentabilidad_producto_locales para el periodo actual, anterior y el mismo periodo del año anterior.
    Solo usuarios con nivel 3, 4 o 5 pueden acceder.
    """
    require_admin_level(user, "admin")
    try:
        menus = list(db.menus.find({}))
        categories = list(db.categories.find({}))
        menu_options = list(db.menu_options.find({}))

        # Periodos
        now = datetime.now()
        periodo_actual = now.strftime("%Y%m")
        mes = int(now.strftime("%m"))
        anio = int(now.strftime("%Y"))
        # Periodo anterior (mes anterior) y antepasado (dos meses antes)
        if mes == 1:
            periodo_anterior = f"{anio-1}12"
            periodo_antepasado = f"{anio-1}11"
        elif mes == 2:
            periodo_anterior = f"{anio}01"
            periodo_antepasado = f"{anio-1}12"
        else:
            periodo_anterior = f"{anio}{str(mes-1).zfill(2)}"
            periodo_antepasado = f"{anio}{str(mes-2).zfill(2)}"
        # Mismo periodo año anterior
        periodo_anio_anterior = f"{anio-1}{str(mes).zfill(2)}"
        # Periodo anterior del año anterior (mes anterior pero del año pasado)
        if mes == 1:
            periodo_anterior_anio_anterior = f"{anio-2}12"
        else:
            periodo_anterior_anio_anterior = f"{anio-1}{str(mes-1).zfill(2)}"
        # Incluir también el periodo 'antepasado' (dos meses antes del actual)
        periodos = [
            periodo_actual,
            periodo_anterior,
            periodo_antepasado,
            periodo_anio_anterior,
            periodo_anterior_anio_anterior,
        ]

        # Obtener todos los codigos de productos de menús (usa SIEMPRE 'codigo' del menú, normalizado)
        codigos_menu = set()
        for menu in menus:
            cod = menu.get("codigo")
            if cod:
                codigos_menu.add(str(cod).strip())
        # Buscar rentabilidad de todos los productos/codigos para los 3 periodos
        if codigos_menu:
            filtro = {"codig": {"$in": [str(c) for c in codigos_menu]}, "mesano": {"$in": [str(p) for p in periodos]}}
            rentabilidad_docs = list(db.rentabilidad_producto_locales.find(filtro))
        else:
            rentabilidad_docs = []
        # Indexar por codig y mesano (normaliza codig)
        renta_idx = {}
        for doc in rentabilidad_docs:
            cod = str(doc.get("codig")).strip()
            mesano = str(doc.get("mesano"))
            if cod not in renta_idx:
                renta_idx[cod] = {}
            renta_idx[cod][mesano] = doc


        # Limpia _id y convierte fechas a string ISO en menús
        for menu in menus:
            if not menu.get("id") and menu.get("_id"):
                menu["id"] = str(menu["_id"])
            elif not menu.get("id"):
                menu["id"] = ""
            menu.pop("_id", None)
            if menu.get("created_at") and hasattr(menu["created_at"], 'isoformat'):
                menu["created_at"] = menu["created_at"].isoformat()
            if menu.get("updated_at") and hasattr(menu["updated_at"], 'isoformat'):
                menu["updated_at"] = menu["updated_at"].isoformat()
            # Agrega rentabilidad a cada producto
            cod = str(menu.get("codigo") or "").strip()
            menu["rentabilidad"] = {}
            for label, periodo in zip(
                [
                    "actual",
                    "anterior",
                    "antepasado",
                    "anio_anterior",
                    "anterior_anio_anterior",
                ],
                [
                    periodo_actual,
                    periodo_anterior,
                    periodo_antepasado,
                    periodo_anio_anterior,
                    periodo_anterior_anio_anterior,
                ],
            ):
                rdoc = renta_idx.get(cod, {}).get(periodo)
                if rdoc:
                    menu["rentabilidad"][label] = {
                        "cupro": rdoc.get("cupro"),
                        "total_costo": rdoc.get("total_costo"),
                        "total_margen": rdoc.get("total_margen"),
                        "total_venta": rdoc.get("total_venta"),
                        "margen": rdoc.get("margen"),
                        "cantidad": rdoc.get("cantidad"),
                    }
                else:
                    menu["rentabilidad"][label] = None

        # Limpia _id y convierte fechas a string ISO en categorías
        for cat in categories:
            # Usa _id como id si no existe
            if not cat.get("id") and cat.get("_id"):
                cat["id"] = str(cat["_id"])
            elif not cat.get("id"):
                cat["id"] = ""
            cat.pop("_id", None)
            if cat.get("created_at") and hasattr(cat["created_at"], 'isoformat'):
                cat["created_at"] = cat["created_at"].isoformat()
            if cat.get("updated_at") and hasattr(cat["updated_at"], 'isoformat'):
                cat["updated_at"] = cat["updated_at"].isoformat()

        # Limpia _id y normaliza id en menu_options
        for opt in menu_options:
            if not opt.get("id") and opt.get("_id"):
                opt["id"] = str(opt["_id"])
            elif not opt.get("id"):
                opt["id"] = ""
            opt.pop("_id", None)
            # Si hay fechas, normalízalas aquí
            if opt.get("created_at") and hasattr(opt["created_at"], 'isoformat'):
                opt["created_at"] = opt["created_at"].isoformat()
            if opt.get("updated_at") and hasattr(opt["updated_at"], 'isoformat'):
                opt["updated_at"] = opt["updated_at"].isoformat()

        return MenusResponse(menus=menus, categories=categories, menu_options=menu_options, error=None)
    except Exception as e:
        logger.error(f"Unexpected error in get_menus: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching menus: {str(e)}")


@router.patch("/locations/{location_id}", response_model=UpdateLocationResponse)
async def update_location(location_id: str, payload: UpdateLocationRequest, user: dict = Depends(verify_session)):
    """
    Actualiza campos de una location. Requiere nivel de rol 3, 4 o 5.
    Campos admitidos: capacidad_personas, cantidad_mesas, cantidad_sillas, descripcion, media_urls.
    """
    require_admin_level(user, "admin")
    try:
        update_doc = {k: v for k, v in payload.dict().items() if v is not None}
        update_doc["updated_at"] = datetime.utcnow().isoformat()
        res = db.locations.find_one_and_update(
            {"_id": location_id},
            {"$set": update_doc},
            return_document=True
        )
        if not res:
            raise HTTPException(status_code=404, detail="Local no encontrado")
        return UpdateLocationResponse(location=res, error=None)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_location: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error actualizando local: {str(e)}")


@router.post("/locations/{location_id}/photos", response_model=PhotoUploadResponse)
async def upload_location_photos(location_id: str, files: List[UploadFile] = File(...), user: dict = Depends(verify_session)):
    """
    Sube una o varias fotos de un local a R2 y agrega sus URLs al array media_urls del local.
    Requiere nivel de rol 3, 4 o 5.
    """
    require_admin_level(user, "admin")
    try:
        uploaded_urls: List[str] = []
        for f in files:
            # nombre seguro: locations/{id}/{timestamp}_{filename}
            ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
            key = f"locations/{location_id}/{ts}_{f.filename}"
            content_type = f.content_type or "application/octet-stream"
            # leer en memoria
            data = await f.read()
            from io import BytesIO
            url = upload_to_r2(BytesIO(data), key=key, content_type=content_type, public=True)
            uploaded_urls.append(url)

        if uploaded_urls:
            db.locations.update_one(
                {"_id": location_id},
                {"$push": {"media_urls": {"$each": uploaded_urls}}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
            )

        return PhotoUploadResponse(urls=uploaded_urls, error=None)
    except Exception as e:
        logger.error(f"Unexpected error in upload_location_photos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error subiendo fotos: {str(e)}")