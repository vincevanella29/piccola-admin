import logging
import asyncio
import os
import json
import redis
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from utils.auth.session import verify_session
from config.roles.access import require_admin_level, get_effective_role_level_from_user
from config.roles.access_gastos import (
    get_perms_from_user as get_gastos_perms_from_user,
    allowed_sucursales_filter,
    resolve_siglas_to_sucursales,
)
from utils.web3mongo import db
from utils.r2_upload import upload_to_r2
from utils.bot.common.filters import (
    is_worker_in_sales_kpis,
    apply_access_filters_for_product_like_intent,
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def _build_menus_recipes_cache_now() -> bool:
    """Ejecuta el worker de cache en el mismo proceso (sin Redis)."""
    try:
        mod = __import__('utils.workers.worker_menus_recipes_cache', fromlist=['run_worker'])
        if not hasattr(mod, 'run_worker'):
            return False
        await asyncio.to_thread(mod.run_worker)
        return True
    except Exception:
        return False

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
    # Capacity / layout
    capacidad_personas: Optional[int] = None
    cantidad_mesas: Optional[int] = None
    cantidad_sillas: Optional[int] = None
    # Descriptive
    descripcion: Optional[str] = None
    commune: Optional[str] = None          # comuna / barrio
    telephone: Optional[str] = None
    direccion: Optional[str] = None
    horario: Optional[str] = None          # "Lun-Dom 12:00–23:00"
    # Media
    cover_image_url: Optional[str] = None  # imagen principal del local
    media_urls: Optional[List[str]] = None
    # Structured schedules
    opening_hours: Optional[dict] = None   # { dinein: {...}, delivery: {...} }
    special_dates: Optional[list] = None   # [{date, label, closed, open, close}]
    # QR
    qr_url: Optional[str] = None           # auto-generated QR URL
    qr_redirect_url: Optional[str] = None  # user-chosen redirect URL


class UpdateLocationResponse(BaseModel):
    location: dict
    error: Optional[str] = None


class PhotoUploadResponse(BaseModel):
    urls: List[str]
    error: Optional[str] = None


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
            # Also set sales_units from the same rentabilidad data
            menu["sales_units"] = {
                lbl: (renta_idx.get(cod, {}).get(per) or {}).get("cantidad")
                for lbl, per in zip(
                    ["actual", "anterior", "antepasado", "anio_anterior", "anterior_anio_anterior"],
                    [periodo_actual, periodo_anterior, periodo_antepasado, periodo_anio_anterior, periodo_anterior_anio_anterior],
                )
            }

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


@router.get("/locations", response_model=LocationsResponse)
async def get_locations(user: dict = Depends(verify_session)):
    """Devuelve locations filtradas por permisos de sucursales.

    - role_level 1–5: ve todas las locations.
    - role_level 6:   sucursales según allowed_sucursales_filter (como gastos).
    - role_level 7:   sólo la sucursal de su ficha (own_id_sucursal).
    """
    logger.info(f"get_locations: user={user}")
    try:
        rl_int = get_effective_role_level_from_user(user or {})
        logger.info(f"get_locations: rl_int={rl_int}")

        # Niveles 1–5: sin filtro (todas las locations)
        if rl_int is None or rl_int <= 5:
            query = {}
        else:
            perms_full = (user or {}).get("permissions") or {}
            logger.info(f"get_locations: rl_int={rl_int}, perms_full={perms_full}")

            if rl_int == 7:
                # lvl 7: sucursal/es desde la ficha (trabajadores_vpn) usando el rut
                rut_value = perms_full.get("rut")
                vpn_doc = None
                if rut_value is not None:
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

                sucursal_code = None
                logger.info(f"get_locations: vpn_doc={vpn_doc}")
                if vpn_doc:
                    sucursal_code = (vpn_doc.get("sucursal") or "").strip()

                if sucursal_code:
                    try:
                        mapping = resolve_siglas_to_sucursales([sucursal_code])
                        allowed_ids = {
                            int(p["id_sucursal"])
                            for pairs in mapping.values()
                            for p in pairs
                            if p.get("id_sucursal") is not None
                        }
                    except Exception:
                        allowed_ids = set()
                else:
                    allowed_ids = set()
            else:
                # lvl 6 (u otros >=6 no 7): usar reglas de gastos
                perms = get_gastos_perms_from_user(user or {})
                allowed_ids = allowed_sucursales_filter(perms)

            if allowed_ids is None:
                # Acceso global a sucursales/empresas
                query = {}
            elif not allowed_ids:
                # Sin acceso efectivo a ninguna sucursal
                return LocationsResponse(locations=[], error=None)
            else:
                # Mapear id_sucursal -> permalink_slug de location
                try:
                    cursor = db.empresas.aggregate([
                        {"$unwind": "$sucursales"},
                        {"$match": {"sucursales.id_sucursal": {"$in": list(allowed_ids)}}},
                        {"$project": {
                            "_id": 0,
                            "slug": {"$ifNull": ["$sucursales.location.permalink_slug", None]},
                        }},
                    ])
                    slugs = {str(d.get("slug")) for d in cursor if d.get("slug")}
                except Exception:
                    slugs = set()

                if not slugs:
                    return LocationsResponse(locations=[], error=None)

                query = {"permalink_slug": {"$in": list(slugs)}}

        locations = list(db.locations.find(query, {}))
        logger.info(f"Fetched {len(locations)} locations with filter={query}")
        return LocationsResponse(locations=locations, error=None)
    except Exception as e:
        logger.error(f"Unexpected error in get_locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching locations: {str(e)}")


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
                {
                    "$push": {"media_urls": {"$each": uploaded_urls}},
                    "$set": {"updated_at": datetime.utcnow().isoformat()},
                },
            )

        return PhotoUploadResponse(urls=uploaded_urls, error=None)
    except Exception as e:
        logger.error(f"Unexpected error in upload_location_photos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error subiendo fotos: {str(e)}")


@router.patch("/locations/{location_id}", response_model=UpdateLocationResponse)
async def update_location(location_id: str, body: UpdateLocationRequest, user: dict = Depends(verify_session)):
    """
    Actualiza campos editables de un local (capacidad, comuna, imagen, etc.).
    Solo persiste los campos que vienen en el body (no sobreescribe los que no se mandan).
    """
    require_admin_level(user, "member")
    try:
        set_fields = {}
        if body.capacidad_personas is not None:
            set_fields["capacidad_personas"] = body.capacidad_personas
        if body.cantidad_mesas is not None:
            set_fields["cantidad_mesas"] = body.cantidad_mesas
        if body.cantidad_sillas is not None:
            set_fields["cantidad_sillas"] = body.cantidad_sillas
        if body.descripcion is not None:
            set_fields["descripcion"] = body.descripcion
        if body.commune is not None:
            set_fields["commune"] = body.commune
        if body.telephone is not None:
            set_fields["telephone"] = body.telephone
        if body.direccion is not None:
            set_fields["direccion"] = body.direccion
        if body.horario is not None:
            set_fields["horario"] = body.horario
        if body.cover_image_url is not None:
            set_fields["cover_image_url"] = body.cover_image_url
        if body.media_urls is not None:
            set_fields["media_urls"] = body.media_urls
        # Structured schedules
        if body.opening_hours is not None:
            set_fields["opening_hours"] = body.opening_hours
        if body.special_dates is not None:
            set_fields["special_dates"] = body.special_dates
        # QR — always persist (even empty string) so user can clear redirect
        if body.qr_url is not None:
            set_fields["qr_url"] = body.qr_url
        if body.qr_redirect_url is not None:
            set_fields["qr_redirect_url"] = body.qr_redirect_url

        if not set_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        set_fields["updated_at"] = datetime.utcnow().isoformat()

        # Try _id as string first, then ObjectId
        from bson import ObjectId as _ObjId
        result = db.locations.find_one_and_update(
            {"_id": location_id},
            {"$set": set_fields},
            return_document=True,
        )
        if result is None:
            # Try ObjectId variant
            try:
                result = db.locations.find_one_and_update(
                    {"_id": _ObjId(location_id)},
                    {"$set": set_fields},
                    return_document=True,
                )
            except Exception:
                pass

        if result is None:
            raise HTTPException(status_code=404, detail="Location not found")

        # Serialize
        result["_id"] = str(result["_id"])
        return UpdateLocationResponse(location=result, error=None)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_location: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error actualizando local: {str(e)}")


@router.get("/menus_recipes", response_model=MenusResponse)
async def get_menus_recipes(user: dict = Depends(verify_session)):
    """
    Igual que /menus, pero adjunta la última receta disponible de cada producto
    en el campo `recipe`.

    Control de acceso:
    - Solo role_level 1..7.
    - Para role_level 7, solo si aparece en KPIs de ventas (garzón); cocina NO ve recetas.
    """
    perms = (user or {}).get("permissions") or {}
    role_level_int = get_effective_role_level_from_user(user or {})

    if role_level_int is None:
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso para ver esta información (role_level inválido).",
        )

    # Período actual YYYYMM para distinguir lvl 7 garzón vs cocina en el scoping
    tz = ZoneInfo("America/Santiago")
    now = datetime.now(tz)
    period_ym = now.strftime("%Y%m")

    try:
        # Cargar colecciones base
        menus = list(db.menus.find({}))
        categories = list(db.categories.find({}))
        menu_options = list(db.menu_options.find({}))

        # -------- Aplicar reglas de acceso --------
        # Rol <= 5: siempre mandamos TODA la data (sin restricciones).
        # Rol > 5: aplicamos las restricciones del bot (centros / lvl7).
        if int(role_level_int) <= 5:
            is_lvl7 = False
            is_lvl7_garzon = False
            filters_after = {}
            allowed_codes = set()
            lvl7_denied = False
        else:
            # Usamos el helper global del bot para intents tipo productos/menus.
            # Armamos un spec mínimo (sin NLP) solo para que resuelva include_codigos.
            base_spec = {
                "key": "menus",
                "filters": {},  # sin filtros previos de NLP
            }

            # Si es lvl7, ya sabemos si es garzón o cocina por is_worker_in_sales_kpis arriba.
            # Replicamos la lógica del bot: si es garzón, NO pasamos period_ym; si es cocina, sí.
            is_lvl7 = role_level_int == 7
            try:
                is_lvl7_garzon = bool(is_worker_in_sales_kpis(period_ym, perms)) if is_lvl7 else False
            except Exception:
                is_lvl7_garzon = False

            scoped = apply_access_filters_for_product_like_intent(
                "menus",
                base_spec,
                perms or {},
                role_level_int,
                None if is_lvl7_garzon else period_ym,
            )

            filters_after = (scoped or {}).get("filters") or {}
            allowed_codes = {str(x).upper() for x in (filters_after.get("include_codigos") or [])}
            lvl7_denied = bool(filters_after.get("_lvl7_denied"))

        try:
            cache_any = db.menus_recipes_cache.find_one({}, {"_id": 1})
        except Exception:
            cache_any = None
        if not cache_any:
            ran = await _build_menus_recipes_cache_now()
            if ran:
                logger.info("/menus_recipes: menus_recipes_cache vacía, worker ejecutado")

        # Para nivel 7 cocina (no garzón), reforzamos el scope por centros
        # SÓLO cuando hay allowed_codes definidos. Si _lvl7_denied viene
        # explícito o no hay códigos, igual dejamos pasar, pero confiando en el
        # scope de sucursal aplicado antes.
        if is_lvl7 and not is_lvl7_garzon and allowed_codes:
            def _code_allowed(m):
                c = str(m.get("codigo") or "").upper().strip()
                return c and c in allowed_codes

            menus = [m for m in menus if _code_allowed(m)]

        # -------- Agregar solo cantidades de venta (sin montos) --------
        # Reutilizamos la misma lógica de periodos que /menus, pero sólo traemos "cantidad".
        try:
            mes = int(now.strftime("%m"))
            anio = int(now.strftime("%Y"))
        except Exception:
            mes, anio = 1, int(period_ym[:4]) if period_ym and len(period_ym) >= 4 else 1970

        periodo_actual = period_ym
        if mes == 1:
            periodo_anterior = f"{anio-1}12"
            periodo_antepasado = f"{anio-1}11"
        elif mes == 2:
            periodo_anterior = f"{anio}01"
            periodo_antepasado = f"{anio-1}12"
        else:
            periodo_anterior = f"{anio}{str(mes-1).zfill(2)}"
            periodo_antepasado = f"{anio}{str(mes-2).zfill(2)}"

        periodo_anio_anterior = f"{anio-1}{str(mes).zfill(2)}"
        if mes == 1:
            periodo_anterior_anio_anterior = f"{anio-2}12"
        else:
            periodo_anterior_anio_anterior = f"{anio-1}{str(mes-1).zfill(2)}"

        periodos = [
            periodo_actual,
            periodo_anterior,
            periodo_antepasado,
            periodo_anio_anterior,
            periodo_anterior_anio_anterior,
        ]

        # Códigos de los menús actualmente visibles (tras filtros de acceso)
        codigos_menu = set()
        for m in menus:
            cod = m.get("codigo")
            if cod:
                codigos_menu.add(str(cod).strip())

        sales_idx = {}
        if codigos_menu:
            # Scoping por sucursal/centro igual que el bot
            include_siglas = [str(x).upper() for x in (filters_after.get("include_siglas") or [])]

            # Helper para obtener rango de fechas (1..hoy) para un periodo YYYYMM
            def _date_range_for_period(p: str):
                try:
                    y = int(str(p)[:4])
                    m = int(str(p)[4:6])
                except Exception:
                    return None, None
                # día actual del mes, acotado al último día razonable
                try:
                    today_day = now.day
                except Exception:
                    today_day = 28
                # último día del mes (aprox; suficiente para agrupar por rango)
                if m in (1, 3, 5, 7, 8, 10, 12):
                    last_day = 31
                elif m == 2:
                    last_day = 29
                else:
                    last_day = 30
                end_day = max(1, min(today_day, last_day))
                start_str = f"{y:04d}-{m:02d}-01"
                end_str = f"{y:04d}-{m:02d}-{end_day:02d}"
                return start_str, end_str

            # Para cada periodo, agregamos cantidades desde ventas_producto_dia_hora_cprodu
            period_map = {
                periodo_actual: periodo_actual,
                periodo_anterior: periodo_anterior,
                periodo_antepasado: periodo_antepasado,
                periodo_anio_anterior: periodo_anio_anterior,
                periodo_anterior_anio_anterior: periodo_anterior_anio_anterior,
            }

            for periodo in period_map.values():
                start_str, end_str = _date_range_for_period(periodo)
                if not start_str or not end_str:
                    continue

                match = {
                    "codigo": {"$in": list(codigos_menu)},
                    "fecha": {"$gte": start_str, "$lte": end_str},
                }

                # lvl 6 y lvl 7 garzón: filtrar por sucursal/local via include_siglas
                try:
                    rl_int = int(role_level_int) if role_level_int is not None else None
                except Exception:
                    rl_int = None

                if include_siglas and rl_int is not None and rl_int >= 6:
                    match["local_norm"] = {"$in": include_siglas}

                try:
                    pipeline = [
                        {"$match": match},
                        {"$group": {"_id": "$codigo", "cantidad": {"$sum": "$cantidad"}}},
                    ]
                    docs = list(db.ventas_producto_dia_hora_cprodu.aggregate(pipeline))
                except Exception:
                    docs = []

                for doc in docs:
                    cod = str(doc.get("_id") or "").strip()
                    if not cod:
                        continue
                    if cod not in sales_idx:
                        sales_idx[cod] = {}
                    sales_idx[cod][periodo] = doc.get("cantidad")

        # -------- Normalizar menús (sin rentabilidad ni montos) --------
        for menu in menus:
            if not menu.get("id") and menu.get("_id"):
                menu["id"] = str(menu["_id"])
            elif not menu.get("id"):
                menu["id"] = ""
            menu.pop("_id", None)
            if menu.get("created_at") and hasattr(menu["created_at"], "isoformat"):
                menu["created_at"] = menu["created_at"].isoformat()
            if menu.get("updated_at") and hasattr(menu["updated_at"], "isoformat"):
                menu["updated_at"] = menu["updated_at"].isoformat()
            # IMPORTANTE: NO agregamos ni devolvemos 'rentabilidad' ni montos calculados aquí.
            # Sólo cantidades de venta por periodo, sin valores monetarios.

            cod_norm = str(menu.get("codigo") or "").strip()
            if cod_norm and cod_norm in sales_idx:
                by_period = sales_idx.get(cod_norm, {})
                menu["sales_units"] = {
                    "actual": by_period.get(periodo_actual),
                    "anterior": by_period.get(periodo_anterior),
                    "antepasado": by_period.get(periodo_antepasado),
                    "anio_anterior": by_period.get(periodo_anio_anterior),
                    "anterior_anio_anterior": by_period.get(periodo_anterior_anio_anterior),
                }
            else:
                menu["sales_units"] = {
                    "actual": None,
                    "anterior": None,
                    "antepasado": None,
                    "anio_anterior": None,
                    "anterior_anio_anterior": None,
                }

        # Normalizar categorías y quedarnos sólo con las que tienen menús visibles
        # Primero normalizamos ids de categorías
        for cat in categories:
            if not cat.get("id") and cat.get("_id"):
                cat["id"] = str(cat["_id"])
            elif not cat.get("id"):
                cat["id"] = ""
            cat.pop("_id", None)
            if cat.get("created_at") and hasattr(cat["created_at"], "isoformat"):
                cat["created_at"] = cat["created_at"].isoformat()
            if cat.get("updated_at") and hasattr(cat["updated_at"], "isoformat"):
                cat["updated_at"] = cat["updated_at"].isoformat()

        # Conjunto de ids de menús realmente visibles después de TODOS los filtros
        visible_menu_ids = {str(m.get("id") or "") for m in menus if m.get("id")}

        # Filtrar categorías: sólo las que tengan al menos un menu_id dentro de los menús visibles
        if visible_menu_ids:
            filtered_categories = []
            for cat in categories:
                raw_menu_ids = cat.get("menu_ids") or []
                cat_menu_ids = {str(x) for x in raw_menu_ids}
                if not cat_menu_ids:
                    continue
                if visible_menu_ids.intersection(cat_menu_ids):
                    filtered_categories.append(cat)
            categories = filtered_categories

        # Normalizar opciones de menú
        for opt in menu_options:
            if not opt.get("id") and opt.get("_id"):
                opt["id"] = str(opt["_id"])
            elif not opt.get("id"):
                opt["id"] = ""
            opt.pop("_id", None)
            if opt.get("created_at") and hasattr(opt["created_at"], "isoformat"):
                opt["created_at"] = opt["created_at"].isoformat()
            if opt.get("updated_at") and hasattr(opt["updated_at"], "isoformat"):
                opt["updated_at"] = opt["updated_at"].isoformat()

        # -------- Adjuntar recetas (último mesano por código) --------
        # Regla explícita: lvl7 cocina NO ve recetas.
        attach_recipes = not (is_lvl7 and not is_lvl7_garzon)

        if attach_recipes:
            codes = sorted(
                {str(m.get("codigo") or "").strip() for m in menus if m.get("codigo")}
            )
            recipes_by_code = {}

            if codes:
                try:
                    cached = list(
                        db.menus_recipes_cache.find(
                            {"producto_codigo": {"$in": codes}},
                            {"_id": 0, "producto_codigo": 1, "recipe": 1},
                        )
                    )
                except Exception:
                    cached = []

                # Si la cache está vacía, intentamos construirla al tiro y re-leer.
                if not cached:
                    ran = await _build_menus_recipes_cache_now()
                    if ran:
                        try:
                            cached = list(
                                db.menus_recipes_cache.find(
                                    {"producto_codigo": {"$in": codes}},
                                    {"_id": 0, "producto_codigo": 1, "recipe": 1},
                                )
                            )
                        except Exception:
                            cached = []

                for doc in cached:
                    c = str(doc.get("producto_codigo") or "").strip()
                    r = doc.get("recipe")
                    if c and r:
                        recipes_by_code[c] = r

            for menu in menus:
                code = str(menu.get("codigo") or "").strip()
                if code and code in recipes_by_code:
                    menu["recipe"] = recipes_by_code[code]

        return MenusResponse(
            menus=menus, categories=categories, menu_options=menu_options, error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_menus_recipes: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching menus with recipes: {str(e)}",
        )