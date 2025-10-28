from __future__ import annotations
import os, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from utils.auth.session import verify_session
from utils.web3mongo import db
import requests
import logging
logger = logging.getLogger(__name__)

router = APIRouter()

VANELLIX_AI_BASE_URL = os.getenv("VANELLIX_AI_BASE_URL", "http://127.0.0.1:8081")
VANELLIX_AI_API_KEY = os.getenv("VANELLIX_AI_API_KEY")
COMPANY_ID_ENV = os.getenv("COMPANY_ID") or os.getenv("COMANY_ID")
SYNC_READ_TIMEOUT = int(os.getenv("DISHES_SYNC_TIMEOUT_SEC", "300"))

def _ai_headers():
    h = {}
    if VANELLIX_AI_API_KEY:
        h["Authorization"] = f"Bearer {VANELLIX_AI_API_KEY}"
    return h

def _require_company_id() -> str:
    if COMPANY_ID_ENV:
        return COMPANY_ID_ENV
    raise HTTPException(status_code=400, detail="Missing COMPANY_ID env var")

def _resolve_image_urls_from_doc(doc: dict):
    # Solo aceptamos R2. Si no hay, no se envía el producto.
    r2 = doc.get("media_r2")
    return [r2] if r2 else []

@router.post("/dishes/catalog/sync/", summary="Sincronizar catálogo con Vanellix AI (solo no sincronizados)")
async def dishes_catalog_sync(user: dict = Depends(verify_session)):
    company_id = _require_company_id()
    try:
        flt = {"$or": [{"ai_synced": {"$exists": False}}, {"ai_synced": False}]}
        cur = db.menus.find(
            flt,
            {"_id": 1, "nombre": 1, "descripcion": 1, "media_r2": 1, "media_url": 1, "media_local": 1, "category_ids": 1},
        )
        logger.info(f"Syncing catalog for company {company_id}")
        docs = list(cur)
        logger.info(f"Found {len(docs)} docs to sync for company {company_id}")
        if not docs:
            logger.info(f"No docs to sync for company {company_id}")
            return {"ok": True, "company": company_id, "count": 0, "sec": 0.0, "index": None}
        # Preload categories map to resolve category/subcategory per product
        cat_docs = list(db.categories.find({}, {"_id": 1, "nombre": 1, "alias": 1}))
        cats_by_id = {str(c.get("_id")): {"nombre": c.get("nombre"), "alias": c.get("alias")} for c in cat_docs}
        products = []
        ids = []
        for d in docs:
            pid = str(d.get("_id"))
            item = {
                "_id": pid,
                "nombre": d.get("nombre"),
                "descripcion": d.get("descripcion"),
            }
            # Resolve category and subcategory from linked category_ids
            category_ids = [str(cid) for cid in (d.get("category_ids") or [])]
            primary_cat = cats_by_id.get(category_ids[0]) if category_ids else None
            if primary_cat:
                cat_name = primary_cat.get("nombre") or primary_cat.get("alias") or None
                subcat = None
                alias = primary_cat.get("alias")
                if alias and alias != cat_name:
                    subcat = alias
                item["category"] = cat_name
                item["subcategory"] = subcat
            imgs = _resolve_image_urls_from_doc(d)
            # si no hay imágenes válidas, NO enviar este producto
            if not imgs:
                continue
            # payload nuevo: solo 'images' (array de URLs)
            item["images"] = imgs
            products.append(item)
            ids.append(d.get("_id"))
        # si luego del filtrado no quedó ningún producto, evitar llamar al upstream
        if not products:
            return {"ok": True, "company": company_id, "count": 0, "sec": 0.0, "index": None}
        tic = time.time()
        base = VANELLIX_AI_BASE_URL.rstrip('/')
        # usa api_key por query si está configurada
        if VANELLIX_AI_API_KEY:
            url = f"{base}/api/company/{company_id}/catalog/sync?api_key={VANELLIX_AI_API_KEY}"
        else:
            url = f"{base}/api/company/{company_id}/catalog/sync"
        try:
            r = requests.post(
                url,
                headers={**_ai_headers(), "Content-Type": "application/json"},
                json={"products": products},
                # espera hasta DISHES_SYNC_TIMEOUT_SEC para construir índice remoto
                timeout=(10, max(30, SYNC_READ_TIMEOUT)),
            )
            r.raise_for_status()
        except requests.RequestException as e:
            # Propaga detalle del upstream si existe
            detail = getattr(e.response, "text", None) or str(e)
            status = getattr(e.response, "status_code", None) or 502
            raise HTTPException(status_code=status, detail=detail)
        try:
            payload = r.json()
        except Exception:
            payload = {"raw": r.text}
        db.menus.update_many(
            {"_id": {"$in": ids}},
            {"$set": {"ai_synced": True, "ai_synced_at": int(time.time())}},
        )
        toc = time.time()
        return {
            "ok": True,
            "company": company_id,
            "count": len(products),
            "sec": round(toc - tic, 3),
            "index": payload.get("index") if isinstance(payload, dict) else None,
        }
    except HTTPException as e:
        raise e
    except requests.Timeout as e:
        raise HTTPException(status_code=504, detail=f"Upstream timeout while syncing catalog: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post("/dishes/match", summary="Proxy de matching a Vanellix AI")
async def dishes_match_ai(
    request: Request,
    user: dict = Depends(verify_session),
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = None,
    product_id: Optional[str] = None,
    catalog_image_url: Optional[str] = None,
):
    try:
        company_id = _require_company_id()
        base = VANELLIX_AI_BASE_URL.rstrip('/')
        if VANELLIX_AI_API_KEY:
            url = f"{base}/api/company/{company_id}/match?api_key={VANELLIX_AI_API_KEY}"
        else:
            url = f"{base}/api/company/{company_id}/match"
        headers = _ai_headers()
        if file is not None:
            content = await file.read()
            files = {"file": (file.filename, content, file.content_type or "application/octet-stream")}
            r = requests.post(url, headers=headers, files=files, timeout=(5, 30))
        else:
            body = None
            try:
                data = await request.json()
            except Exception:
                data = {}
            if image_url:
                body = {"image_url": image_url}
            elif product_id:
                body = {"product_id": product_id}
            elif catalog_image_url:
                body = {"catalog_image_url": catalog_image_url}
            else:
                if isinstance(data, dict) and data:
                    body = data
            if not body:
                raise HTTPException(status_code=400, detail="Missing image or URL")
            r = requests.post(
                url,
                headers={**headers, "Content-Type": "application/json"},
                json=body,
                timeout=(5, 30),
            )
        if r.status_code >= 400:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        # Parse upstream JSON
        try:
            payload = r.json()
        except Exception:
            return JSONResponse(content={"ok": True, "raw": r.text})

        # Enriquecer con datos del menú (precio, media, etc.)
        try:
            if not isinstance(payload, dict):
                return payload

            # Recolectar IDs a resolver
            ids: set[str] = set()
            # match._id
            match = payload.get("match")
            if isinstance(match, dict):
                mid = str(match.get("_id")) if match.get("_id") is not None else None
                if mid:
                    ids.add(mid)
            # label_info._id
            label_info = payload.get("label_info")
            if isinstance(label_info, dict):
                lid = str(label_info.get("_id")) if label_info.get("_id") is not None else None
                if lid:
                    ids.add(lid)
            # topk[].doc._id or topk[].plato_id
            topk = payload.get("topk")
            if isinstance(topk, list):
                for item in topk:
                    if not isinstance(item, dict):
                        continue
                    doc = item.get("doc")
                    if isinstance(doc, dict) and doc.get("_id") is not None:
                        ids.add(str(doc.get("_id")))
                    elif item.get("plato_id") is not None:
                        ids.add(str(item.get("plato_id")))

            if ids:
                # Traer docs del menú
                menu_docs = list(db.menus.find({"_id": {"$in": list(ids)}}))
                by_id = {str(d.get("_id")): d for d in menu_docs}

                def _merge(dst: dict, src: dict):
                    # No pisar campos ya retornados por el upstream a menos que aporten valor
                    for k, v in src.items():
                        if k not in dst or dst.get(k) in (None, ""):
                            dst[k] = v

                # Merge en match
                if isinstance(match, dict):
                    mid = str(match.get("_id")) if match.get("_id") is not None else None
                    if mid and mid in by_id:
                        _merge(match, by_id[mid])
                        payload["match"] = match

                # Merge/establecer label_info basado en match o ID conocido
                if isinstance(label_info, dict):
                    lid = str(label_info.get("_id")) if label_info.get("_id") is not None else None
                    if lid and lid in by_id:
                        _merge(label_info, by_id[lid])
                        payload["label_info"] = label_info
                elif isinstance(match, dict) and match.get("_id") is not None:
                    mid = str(match.get("_id"))
                    if mid in by_id:
                        payload["label_info"] = {**by_id[mid]}

                # Merge en topk[].doc
                if isinstance(topk, list):
                    for i, item in enumerate(topk):
                        if not isinstance(item, dict):
                            continue
                        doc = item.get("doc")
                        pid = None
                        if isinstance(doc, dict) and doc.get("_id") is not None:
                            pid = str(doc.get("_id"))
                        elif item.get("plato_id") is not None:
                            pid = str(item.get("plato_id"))
                            # asegurar estructura doc
                            if not isinstance(doc, dict):
                                doc = {}
                                item["doc"] = doc
                                doc["_id"] = pid
                        if pid and pid in by_id:
                            _merge(doc, by_id[pid])
                            topk[i] = item
                    payload["topk"] = topk

            return payload
        except Exception:
            # Si algo falla en el enriquecimiento, devolver payload original
            return payload
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
