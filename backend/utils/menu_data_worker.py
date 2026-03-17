import logging
import requests
import os
from datetime import datetime
from dateutil.parser import parse
from PIL import Image
from io import BytesIO
import shutil
import boto3
from dotenv import load_dotenv
import hashlib
import botocore
import json
from deepdiff import DeepDiff
from utils.web3mongo import db

load_dotenv()

# --- Configuración para imágenes locales ---
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend-vite'))
FRONTEND_DIST_DIR = os.path.join(FRONTEND_DIR, 'dist')
FRONTEND_PUBLIC_DIR = os.path.join(FRONTEND_DIR, 'public')
LOCAL_IMG_SUBDIR = 'menu_images'
LOCAL_IMG_DIST_DIR = os.path.join(FRONTEND_DIST_DIR, LOCAL_IMG_SUBDIR)
LOCAL_IMG_PUBLIC_DIR = os.path.join(FRONTEND_PUBLIC_DIR, LOCAL_IMG_SUBDIR)
os.makedirs(LOCAL_IMG_DIST_DIR, exist_ok=True)
os.makedirs(LOCAL_IMG_PUBLIC_DIR, exist_ok=True)

EXTERNAL_API_BASE_URL = "https://tienda.lapiccolaitalia.cl/api"

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def download_and_convert_image_to_both(url, filename):
    """
    Descarga una imagen desde url, la convierte a webp y la guarda en ambos lugares:
    - public/menu_images/filename
    - dist/menu_images/filename
    Devuelve la ruta local (public) si todo OK, None si falla.
    """
    public_path = os.path.join(LOCAL_IMG_PUBLIC_DIR, filename)
    dist_path = os.path.join(LOCAL_IMG_DIST_DIR, filename)
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content))
        img.save(public_path, 'webp', quality=95, method=6)
        shutil.copy2(public_path, dist_path)
        return public_path
    except Exception as e:
        logger.warning(f"No se pudo descargar/convertir/copy imagen {url} -> {public_path}, {dist_path}: {e}")
        return None

def file_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

def upload_to_r2(local_path, remote_path):
    """
    Sube la imagen local a Cloudflare R2 y devuelve la URL CDN. Solo sube si es nueva o modificada (usa hash SHA256 como metadata).
    """
    try:
        session = boto3.session.Session()
        s3 = session.client(
            service_name='s3',
            aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
            endpoint_url=os.getenv('R2_ENDPOINT_URL'),
        )
        bucket = os.getenv('R2_BUCKET_NAME')
        local_hash = file_hash(local_path)
        try:
            response = s3.head_object(Bucket=bucket, Key=remote_path)
            remote_hash = response['Metadata'].get('hash')
            if remote_hash == local_hash:
                cdn_base = os.getenv('R2_CDN_BASE').rstrip('/')
                return f'{cdn_base}/{remote_path}'
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] != "404":
                raise
        with open(local_path, 'rb') as f:
            s3.upload_fileobj(
                f, bucket, remote_path,
                ExtraArgs={
                    'ACL': 'public-read',
                    'ContentType': 'image/webp',
                    'Metadata': {'hash': local_hash}
                }
            )
        cdn_base = os.getenv('R2_CDN_BASE').rstrip('/')
        return f'{cdn_base}/{remote_path}'
    except Exception as e:
        logger.warning(f"No se pudo subir a R2 {local_path} -> {remote_path}: {e}")
        return None

def fetch_api(endpoint):
    try:
        if endpoint == "menu_item_options":
            url = f"{EXTERNAL_API_BASE_URL}/{endpoint}"
            all_data = []
            page = 1
            all_included = []
            while True:
                logger.info(f"Fetching {url}?page={page}")
                resp = requests.get(f"{url}?page={page}", timeout=15)
                resp.raise_for_status()
                result = resp.json()
                logger.debug(f"Response for {endpoint} page {page}: {result}")
                if not isinstance(result, dict):
                    logger.warning(f"Unexpected response format for {endpoint}: {type(result)}")
                    return {"data": [], "included": []}
                all_data.extend(result.get("data", []))
                all_included.extend(result.get("included", []))
                if not result.get("links", {}).get("next"):
                    break
                page += 1
            logger.info(f"Fetched {len(all_data)} menu_item_options and {len(all_included)} included items across all pages.")
            return {"data": all_data, "included": all_included}
        else:
            url = f"{EXTERNAL_API_BASE_URL}/{endpoint}"
            logger.info(f"Fetching {url}")
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            result = resp.json()
            logger.debug(f"Response for {endpoint}: {result}")
            if not isinstance(result, dict):
                logger.warning(f"Unexpected response format for {endpoint}: {type(result)}")
                return {"data": [], "included": []}
            return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch {endpoint}: {str(e)}")
        return {"data": [], "included": []}
    except ValueError as e:
        logger.error(f"Invalid JSON response for {endpoint}: {str(e)}")
        return {"data": [], "included": []}

def normalize_data():
    logger.info("Fetching raw data...")
    menus_json = fetch_api("menusAjax")
    locations_json = fetch_api("locations")
    menu_item_options_json = fetch_api("menu_item_options")
    dishes_json = fetch_api("tastyajax")

    menus_data = menus_json.get("data", [])
    menus_included = menus_json.get("included", [])
    locations_data = locations_json.get("data", [])
    menu_item_options_data = menu_item_options_json.get("data", [])
    menu_item_options_included = menu_item_options_json.get("included", [])
    dishes_data = dishes_json.get("data", [])

    included = menus_included + menu_item_options_included
    logger.info(f"Total included items: {len(included)}")
    categories = [inc for inc in included if inc.get("type") == "categories"]
    logger.info(f"Found {len(categories)} categories in included: {categories}")
    
    if not categories:
        logger.warning("No categories found in included array, checking tastyajax")
        categories = [item for item in dishes_data if item.get("type") == "categories"]
        logger.info(f"Found {len(categories)} categories in tastyajax: {categories}")

    media = [inc for inc in included if inc.get("type") == "media"]
    menu_option_values = [inc for inc in included if inc.get("type") == "menu_option_values"]

    menu_to_category_ids = {}
    for cat in categories:
        cat_id = str(cat.get("id", ""))
        menu_ids = [str(m.get("id")) for m in cat.get("relationships", {}).get("menus", {}).get("data", [])]
        for menu_id in menu_ids:
            if menu_id not in menu_to_category_ids:
                menu_to_category_ids[menu_id] = []
            menu_to_category_ids[menu_id].append(cat_id)
        logger.info(f"Category {cat_id} mapped to menus: {menu_ids}")

    options_by_menu = {}
    for opt in menu_item_options_data:
        opt_attrs = opt.get("attributes", {})
        menu_id = str(opt_attrs.get("menu_id", ""))
        if not menu_id:
            logger.warning(f"Skipping option with missing menu_id: {opt}")
            continue
        if menu_id not in options_by_menu:
            options_by_menu[menu_id] = []
        
        option_value_ids = set(str(val.get("id", "")) for val in opt.get("relationships", {}).get("menu_option_values", {}).get("data", []))
        opt_menu_option_id = str(opt_attrs.get("menu_option_id") or opt_attrs.get("option_id") or "")
        opt_values = []
        for val in menu_option_values:
            val_attrs = val.get("attributes", {})
            if (
                opt_menu_option_id
                and str(val_attrs.get("menu_option_id", "")) == opt_menu_option_id
            ) or (str(val.get("id", "")) in option_value_ids):
                name = val_attrs.get("name")
                price = val_attrs.get("new_price")
                if name is None or price is None:
                    nested = val_attrs.get("option_value") or {}
                    if name is None:
                        name = nested.get("value") or nested.get("name")
                    if price is None:
                        price = nested.get("price")
                opt_values.append({
                    "id": str(val.get("id", "")),
                    "option_value_id": str(val_attrs.get("option_value_id", "")),
                    "name": name or "",
                    "price": price if price is not None else 0,
                    "priority": val_attrs.get("priority", 0),
                    "is_default": val_attrs.get("is_default", False),
                    "codigo": val_attrs.get("codigo", None),
                    "stock_qty": val_attrs.get("stock_qty", 0),
                    "created_at": parse(val_attrs.get("created_at")) if val_attrs.get("created_at") else None,
                    "updated_at": parse(val_attrs.get("updated_at")) if val_attrs.get("updated_at") else None,
                    "location_ids": [
                        str(loc.get("location_id", ""))
                        for loc in (
                            ((val_attrs.get("option_value") or {}).get("option") or {}).get("locations") or []
                        )
                    ]
                })
        logger.info(f"[menu_option] Option {opt.get('id')} for menu {menu_id} has {len(opt_values)} values: {opt_values}")
        options_by_menu[menu_id].append({
            "id": str(opt.get("id", "")),
            "menu_id": menu_id,
            "option_id": str(opt_attrs.get("option_id", "")),
            "option_name": opt_attrs.get("option_name", ""),
            "display_type": opt_attrs.get("display_type", "select"),
            "required": opt_attrs.get("required", False),
            "priority": opt_attrs.get("priority", 0),
            "min_selected": opt_attrs.get("min_selected", 0),
            "max_selected": opt_attrs.get("max_selected", 0),
            "created_at": parse(opt_attrs.get("created_at")) if opt_attrs.get("created_at") else None,
            "updated_at": parse(opt_attrs.get("updated_at")) if opt_attrs.get("updated_at") else None,
            "values": opt_values
        })

    menus_out = []
    for menu in menus_data:
        menu_id = str(menu.get("id", ""))
        if not menu_id:
            logger.warning(f"Skipping menu with missing id: {menu}")
            continue
        attrs = menu.get("attributes", {})
        media_id = menu.get("relationships", {}).get("media", {}).get("data", {}).get("id", "")
        media_url = None
        if media_id:
            for m in media:
                if str(m.get("id")) == str(media_id):
                    media_url = m.get("attributes", {}).get("Url")
                    break
        category_ids = menu_to_category_ids.get(menu_id, [])
        location_ids = [str(loc.get("id", "")) for loc in menu.get("relationships", {}).get("locations", {}).get("data", [])]
        options = options_by_menu.get(menu_id, [])
        especial = attrs.get("especial", {}) if attrs.get("especial") is not None else {}

        prev_menu = db.menus.find_one({"_id": menu_id}, {"media_r2": 1, "media_local": 1, "media_url": 1, "created_at": 1})
        prev_media_r2 = prev_menu.get("media_r2") if prev_menu else None
        prev_media_local = prev_menu.get("media_local") if prev_menu else None
        prev_media_url = prev_menu.get("media_url") if prev_menu else None
        prev_created_at = prev_menu.get("created_at") if prev_menu else None

        media_local = None
        media_r2 = None
        if media_url and media_url == prev_media_url and (prev_media_local or prev_media_r2):
            media_local = prev_media_local
            media_r2 = prev_media_r2
        elif media_url:
            filename = f"{menu_id}.webp"
            local_path = download_and_convert_image_to_both(media_url, filename)
            if local_path:
                media_local = f"/{LOCAL_IMG_SUBDIR}/{menu_id}.webp"
                remote_path = f"menu_images/{filename}"
                for _ in range(3):
                    media_r2 = upload_to_r2(local_path, remote_path)
                    if media_r2:
                        break
                if not media_r2 and prev_media_r2:
                    media_r2 = prev_media_r2
        if not media_r2 and prev_media_r2:
            media_r2 = prev_media_r2

        new_menu_doc = {
            "_id": menu_id,
            "nombre": attrs.get("Nombre", ""),
            "codigo": attrs.get("Codigo", ""),
            "descripcion": attrs.get("Descripcion", ""),
            "precio": attrs.get("Precio", 0),
            "especial": {
                "special_id": especial.get("special_id", None),
                "special_price": especial.get("special_price", 0),
                "special_status": especial.get("special_status", False),
                "type": especial.get("type", None),
                "validity": especial.get("validity", None),
                "recurring_every": especial.get("recurring_every", None),
                "recurring_from": especial.get("recurring_from", None),
                "recurring_to": especial.get("recurring_to", None),
                "start_date": parse(especial.get("start_date")) if especial.get("start_date") else None,
                "end_date": parse(especial.get("end_date")) if especial.get("end_date") else None,
                "created_at": parse(especial.get("created_at")) if especial.get("created_at") else None,
                "updated_at": parse(especial.get("updated_at")) if especial.get("updated_at") else None
            },
            "estado": attrs.get("Estado", False),
            "prioridad": attrs.get("Prioridad", 0),
            "restriccion": attrs.get("Restriccion", []),
            "currency": attrs.get("currency", "CLP"),
            "media_id": media_id if media_id else None,
            "media_url": media_url,
            "media_local": media_local,
            "media_r2": media_r2,
            "category_ids": category_ids,
            "location_ids": location_ids,
            "option_ids": [opt["id"] for opt in options],
            "created_at": prev_created_at or datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        menus_out.append((new_menu_doc, prev_menu))

    categories_out = []
    for cat in categories:
        cat_id = str(cat.get("id", ""))
        if not cat_id:
            logger.warning(f"Skipping category with missing id: {cat}")
            continue
        cat_attrs = cat.get("attributes", {})
        menu_ids = [m[0]["_id"] for m in menus_out if cat_id in m[0]["category_ids"]]
        prev_cat = db.categories.find_one({"_id": cat_id}, {"created_at": 1})
        categories_out.append({
            "_id": cat_id,
            "nombre": cat_attrs.get("Nombre", ""),
            "estado": cat_attrs.get("Estado", False),
            "prioridad": cat_attrs.get("Prioridad", 0),
            "alias": cat_attrs.get("Alias", ""),
            "menu_ids": menu_ids,
            "created_at": prev_cat.get("created_at") if prev_cat else datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

    locations_out = []
    for loc in locations_data:
        loc_id = str(loc.get("id", ""))
        if not loc_id:
            logger.warning(f"Skipping location with missing id: {loc}")
            continue
        loc_attrs = loc.get("attributes", {})
        menu_ids = [m[0]["_id"] for m in menus_out if loc_id in m[0]["location_ids"]]
        prev_loc = db.locations.find_one({"_id": loc_id}, {"created_at": 1})
        locations_out.append({
            "_id": loc_id,
            "nombre": loc_attrs.get("location_name", loc_attrs.get("Nombre", "")),
            "direccion": loc_attrs.get("location_address_1", loc_attrs.get("Direccion", "")),
            "email": loc_attrs.get("location_email", ""),
            "city": loc_attrs.get("location_city", ""),
            "state": loc_attrs.get("location_state", ""),
            "postcode": loc_attrs.get("location_postcode", ""),
            "telephone": loc_attrs.get("location_telephone", ""),
            "lat": loc_attrs.get("location_lat", None),
            "lng": loc_attrs.get("location_lng", None),
            "status": loc_attrs.get("location_status", False),
            "permalink_slug": loc_attrs.get("permalink_slug", ""),
            "media_ids": [str(m.get("id", "")) for m in loc_attrs.get("media", [])],
            "menu_ids": menu_ids,
            "created_at": prev_loc.get("created_at") if prev_loc else datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })

    options_out = []
    for menu_id, options in options_by_menu.items():
        for opt in options:
            prev_opt = db.menu_options.find_one({"_id": opt["id"]}, {"created_at": 1})
            options_out.append({
                "_id": opt["id"],
                "menu_id": menu_id,
                "option_id": opt["option_id"],
                "option_name": opt["option_name"],
                "display_type": opt["display_type"],
                "required": opt["required"],
                "priority": opt["priority"],
                "min_selected": opt["min_selected"],
                "max_selected": opt["max_selected"],
                "values": opt["values"],
                "created_at": prev_opt.get("created_at") if prev_opt else opt["created_at"] or datetime.utcnow(),
                "updated_at": opt["updated_at"] or datetime.utcnow()
            })

    return {
        "locations": locations_out,
        "categories": categories_out,
        "menus": menus_out,
        "menu_options": options_out
    }

def upsert_data():
    try:
        data = normalize_data()
        
        # Upsert locations
        for loc in data["locations"]:
            result = db.locations.replace_one({"_id": loc["_id"]}, loc, upsert=True)
            logger.info(f"Location {loc['_id']}: {'Updated' if result.modified_count else 'Inserted' if result.upserted_id else 'Unchanged'}")

        # Upsert categories
        for cat in data["categories"]:
            result = db.categories.replace_one({"_id": cat["_id"]}, cat, upsert=True)
            logger.info(f"Category {cat['_id']}: {'Updated' if result.modified_count else 'Inserted' if result.upserted_id else 'Unchanged'}")

        # Upsert menus and track updates
        for new_menu, prev_menu in data["menus"]:
            menu_id = new_menu["_id"]
            # Obtener el documento completo del menú anterior
            prev_menu = db.menus.find_one({"_id": menu_id})  # Sin limitar campos
            prev_menu_no_ts = prev_menu.copy() if prev_menu else {}
            prev_menu_no_ts.pop("created_at", None)
            prev_menu_no_ts.pop("updated_at", None)
            new_menu_no_ts = new_menu.copy()
            new_menu_no_ts.pop("created_at", None)
            new_menu_no_ts.pop("updated_at", None)
            
            # Calcular diff para detectar cambios reales
            diff = DeepDiff(prev_menu_no_ts, new_menu_no_ts, ignore_order=True) if prev_menu else {"new_document": new_menu_no_ts}
            change_type = "unchanged"
            if prev_menu and diff:
                change_type = "updated"
            elif not prev_menu:
                change_type = "inserted"
            
            # Loguear solo si hay cambios reales o es un nuevo documento
            if change_type != "unchanged":
                # Serialización segura del diff (DeepDiff o dict)
                if isinstance(diff, DeepDiff):
                    try:
                        diff_payload = json.loads(diff.to_json())
                    except Exception:
                        # Fallback a str por robustez
                        diff_payload = {"_raw": str(diff)}
                else:
                    diff_payload = diff or {}
                db.menu_updates.insert_one({
                    "menu_id": menu_id,
                    "change_type": change_type,
                    "diff": diff_payload,
                    "timestamp": datetime.utcnow()
                })
                logger.info(f"Menu {menu_id}: Logged {change_type} with diff: {diff}")
            else:
                logger.info(f"Menu {menu_id}: No changes detected, skipping update log.")

            # Perform upsert only if changed or new
            if change_type != "unchanged":
                result = db.menus.replace_one({"_id": menu_id}, new_menu, upsert=True)
                logger.info(f"Menu {menu_id}: {'Updated' if result.modified_count else 'Inserted' if result.upserted_id else 'Unchanged'}")
            else:
                logger.info(f"Menu {menu_id}: Unchanged, no upsert needed.")

        # Upsert menu options
        for opt in data["menu_options"]:
            result = db.menu_options.replace_one({"_id": opt["_id"]}, opt, upsert=True)
            logger.info(f"Menu option {opt['_id']}: {'Updated' if result.modified_count else 'Inserted' if result.upserted_id else 'Unchanged'}")

        logger.info("Upsert operation completed successfully.")
    except Exception as e:
        logger.error(f"Error during upsert: {str(e)}")
        raise

def run_worker():
    logger.info("El sincronizador automático del antiguo menú público ha sido deshabilitado porque ahora se utiliza la Carta Admin interactiva.")
    return
    try:
        upsert_data()
        logger.info("Menu data worker finished successfully.")
    except Exception as e:
        logger.error(f"Error in menu data worker: {str(e)}")
        raise

if __name__ == "__main__":
    run_worker()