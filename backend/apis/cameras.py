# /backend/apis/cameras.py
from __future__ import annotations
import os
import json
import uuid
import time
import re
from datetime import datetime, timedelta, timezone
import glob
from typing import Optional, List, Literal
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from utils.auth.session import verify_session
from utils.security.camera_secrets import (
    encrypt_str,
    decrypt_str,
    mask_secret,
    hmac_sign,
    hmac_verify,
)
from services.ptz_queue import enqueue_ptz_job
from services.hls_manager import start_hls, stop_hls, status_hls
from services.ptz_controller import control_ptz
from utils.web3mongo import db
import logging
logger = logging.getLogger(__name__)

router = APIRouter()

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data"))
OVPN_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "vpn"))
# Align with services.hls_manager BASE_DIR (=backend/) and put recordings under backend/static/recordings
BACKEND_BASE = os.path.dirname(os.path.dirname(__file__))
RECORD_ROOT = os.path.join(BACKEND_BASE, "static", "recordings")
STREAM_ROOT = os.path.join(BACKEND_BASE, "static", "streams")


os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OVPN_DIR, exist_ok=True)

# Mongo collection
COLL = db.cameras
COMPANY_ID = int(os.getenv("COMPANY_ID", "0") or 0)

# Models
class LocalConfig(BaseModel):
    ip: Optional[str] = None
    port: Optional[int] = Field(default=8554)
    username: Optional[str] = None
    password: Optional[str] = None
    rtsp_path: Optional[str] = Field(default="/profile0")

class VpnConfig(BaseModel):
    enabled: bool = False
    ovpn_file: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class CameraConfig(BaseModel):
    id: str
    name: str
    mode: Literal["local", "vpn"] = "local"
    location_id: Optional[str] = None
    section: Optional[str] = None
    description: Optional[str] = None
    local: LocalConfig = Field(default_factory=LocalConfig)
    vpn: VpnConfig = Field(default_factory=VpnConfig)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    active: bool = False
    live_enabled: bool = False
    signature: Optional[str] = None
    retention_days: int = Field(default=30, ge=1, le=365)

# Storage helpers (sin cambios)
def _load_all() -> List[CameraConfig]:
    items: List[CameraConfig] = []
    try:
        for doc in COLL.find({}):
            try:
                cam = CameraConfig(**doc)
                to_sign = cam.model_dump()
                sig = to_sign.pop("signature", None)
                if sig and not hmac_verify(to_sign, sig): continue
                items.append(cam)
            except Exception: continue
    except Exception: return []
    return items

def _save_all(items: List[CameraConfig]):
    ids = set()
    for cam in items:
        d = cam.model_dump()
        d.pop("signature", None)
        d["signature"] = hmac_sign(d)
        d["_id"] = d["id"]
        if COMPANY_ID: d["company_id"] = COMPANY_ID
        ids.add(d["id"])
        try:
            COLL.update_one({"_id": d["id"]}, {"$set": d}, upsert=True)
        except Exception: continue
    try:
        COLL.delete_many({"_id": {"$nin": list(ids)}})
    except Exception: pass

def _get_by_id(cid: str) -> Optional[CameraConfig]:
    doc = COLL.find_one({"_id": cid})
    if not doc: return None
    try: return CameraConfig(**doc)
    except Exception: return None

def _encrypt_cam(cam: CameraConfig) -> CameraConfig:
    if cam.local.username: cam.local.username = encrypt_str(cam.local.username)
    if cam.local.password: cam.local.password = encrypt_str(cam.local.password)
    if cam.vpn.username: cam.vpn.username = encrypt_str(cam.vpn.username)
    if cam.vpn.password: cam.vpn.password = encrypt_str(cam.vpn.password)
    return cam

def _sanitize(cam: CameraConfig) -> dict:
    d = cam.model_dump()
    if d.get("local", {}).get("username"): d["local"]["username"] = mask_secret(d["local"]["username"])
    if d.get("local", {}).get("password"): d["local"]["password"] = mask_secret(d["local"]["password"])
    if d.get("vpn", {}).get("username"): d["vpn"]["username"] = mask_secret(d["vpn"]["username"])
    if d.get("vpn", {}).get("password"): d["vpn"]["password"] = mask_secret(d["vpn"]["password"])
    if d.get("vpn", {}).get("ovpn_file"): d["vpn"]["ovpn_file"] = f"...{d['vpn']['ovpn_file'][-10:]}"
    return d

# Endpoints (sin cambios, excepto list_recordings)
@router.get("/cameras/configs", summary="Listar configuraciones de cámaras", dependencies=[Depends(verify_session)])
async def list_cameras():
    return {"data": [_sanitize(_c) for _c in _load_all()]}

class RegisterBody(BaseModel):
    name: str; mode: Literal["local", "vpn"] = "local"; location_id: Optional[str] = None; section: Optional[str] = None; description: Optional[str] = None; local: Optional[LocalConfig] = None; vpn: Optional[VpnConfig] = None; retention_days: Optional[int] = Field(default=30, ge=1, le=365); live_enabled: Optional[bool] = False

@router.post("/cameras/configs", summary="Registrar nueva cámara", dependencies=[Depends(verify_session)])
async def register_camera(body: RegisterBody):
    items = _load_all(); cid = f"cam_{uuid.uuid4().hex[:8]}"; cam = CameraConfig(id=cid, name=body.name, mode=body.mode, location_id=body.location_id, section=body.section, description=body.description, local=body.local or LocalConfig(), vpn=body.vpn or VpnConfig(enabled=(body.mode == "vpn")), retention_days=body.retention_days or 30, live_enabled=body.live_enabled or False); cam = _encrypt_cam(cam); items.append(cam); _save_all(items); return {"id": cid, "config": _sanitize(cam), "hls": f"/streams/{cid}/index.m3u8"}

@router.delete("/cameras/configs/{cid}", summary="Eliminar cámara", dependencies=[Depends(verify_session)])
async def delete_camera(cid: str):
    items = _load_all(); new_items = [c for c in items if c.id != cid];_save_all(new_items); return {"deleted": cid}

class LiveToggleBody(BaseModel): enabled: bool

@router.post("/cameras/configs/{cid}/live", summary="Activar o desactivar HLS en vivo", dependencies=[Depends(verify_session)])
async def toggle_live_hls(cid: str, body: LiveToggleBody):
    cam = _get_by_id(cid); items=_load_all(); [setattr(c, 'live_enabled', body.enabled) for c in items if c.id == cid]; _save_all(items)
    if status_hls(cid).get('running'): stop_hls(cid); time.sleep(1); cam.live_enabled = body.enabled; start_hls(cid, cam.model_dump())
    return {"id": cid, "live_enabled": body.enabled}

@router.post("/cameras/{cid}/start", dependencies=[Depends(verify_session)])
async def start_camera_hls(cid: str):
    cam = _get_by_id(cid); return {"ok": True, **start_hls(cid, cam.model_dump())}

@router.post("/cameras/{cid}/stop", dependencies=[Depends(verify_session)])
async def stop_camera_hls(cid: str):
    return {"ok": True, **stop_hls(cid)}

@router.get("/cameras/{cid}/status", dependencies=[Depends(verify_session)])
async def status_camera_hls(cid: str):
    return status_hls(cid)

def _hls_ready(cid: str) -> dict:
    out_dir = os.path.join(STREAM_ROOT, cid)
    idx = os.path.join(out_dir, 'index.m3u8')
    if not os.path.exists(out_dir):
        return {"ready": False, "reason": "no_stream_dir"}
    if not os.path.exists(idx):
        return {"ready": False, "reason": "no_index"}
    segs = sorted(glob.glob(os.path.join(out_dir, 'index*.ts')))
    if not segs:
        return {"ready": False, "reason": "no_segments"}
    try:
        latest_mtime = max(os.path.getmtime(p) for p in segs)
    except Exception:
        latest_mtime = 0
    age = max(0, time.time() - latest_mtime)
    return {"ready": age < 10, "age_sec": age}

@router.get("/cameras/{cid}/ready", summary="Indica si HLS tiene segmentos vivos", dependencies=[Depends(verify_session)])
async def camera_hls_ready(cid: str, timeout: Optional[int] = 0):
    deadline = time.time() + max(0, int(timeout or 0)) / 1000.0
    while True:
        info = _hls_ready(cid)
        if info.get("ready"):
            return {"ready": True, "age_sec": info.get("age_sec", 0)}
        if time.time() >= deadline:
            return {"ready": False, "reason": info.get("reason", "not_ready"), "age_sec": info.get("age_sec", None)}
        await asyncio.sleep(0.2)

class RecordingSegment(BaseModel):
    filename: str
    url: str
    started_at: datetime
    ended_at: datetime
    size_bytes: int
    duration_sec: int

# --- Endpoint Modificado ---
class RecordingsResponse(BaseModel):
    segments: List[RecordingSegment]

@router.get("/cameras/{cid}/recordings", summary="Listar grabaciones (VOD)", response_model=RecordingsResponse, dependencies=[Depends(verify_session)])
async def list_recordings(request: Request, cid: str, start: Optional[datetime] = None, end: Optional[datetime] = None):
    cam_dir = os.path.join(RECORD_ROOT, cid)
    if not os.path.isdir(cam_dir):
        return RecordingsResponse(segments=[])

    all_segments = []
    fname_re = re.compile(r"(\d{8}_\d{6})\.mp4$")
    
    try:
        all_files = [f for f in os.listdir(cam_dir) if f.lower().endswith('.mp4')]
    except FileNotFoundError:
        return RecordingsResponse(segments=[])

    for filename in all_files:
        fpath = os.path.join(cam_dir, filename)
        try:
            stat_info = os.stat(fpath)
            if stat_info.st_size < 1024: continue
            
            match = fname_re.search(filename)
            if not match: continue

            started_at = datetime.strptime(match.group(1), "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
            seg_end = started_at + timedelta(seconds=300)

            all_segments.append(
                RecordingSegment(
                    filename=filename,
                    url=f"{str(request.base_url).rstrip('/')}/static/recordings/{cid}/{filename}",
                    started_at=started_at,
                    ended_at=seg_end,
                    size_bytes=stat_info.st_size,
                    duration_sec=300
                )
            )
        except (IOError, FileNotFoundError, ValueError):
            continue
    
    # Ordenar todos los segmentos por fecha, del más nuevo al más antiguo para el dropdown
    all_segments.sort(key=lambda s: s.started_at, reverse=True)

    # --- Lógica de filtrado condicional ---
    if start and end:
        # Si se proveen fechas, filtrar como antes
        if start.tzinfo is None: start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None: end = end.replace(tzinfo=timezone.utc)
        
        filtered_segments = [
            s for s in all_segments if s.started_at < end and s.ended_at > start
        ]
        return RecordingsResponse(segments=filtered_segments)
    else:
        # Si NO se proveen fechas, devolver el inventario completo
        return RecordingsResponse(segments=all_segments)

@router.get("/cameras/{cid}/vod/live.m3u8", response_class=PlainTextResponse, dependencies=[Depends(verify_session)])
async def get_vod_live_playlist(cid: str):
    cam_dir = os.path.join(RECORD_ROOT, cid)
    if not os.path.isdir(cam_dir): return "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n"
    try:
        files = sorted([f for f in os.listdir(cam_dir) if f.endswith('.mp4')], key=lambda fn: os.path.getmtime(os.path.join(cam_dir, fn)))
        logger.info(files)
        recent_files = files[-4:]
    except Exception: recent_files = []
    if not recent_files: return "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n"
    playlist_content = ["#EXTM3U","#EXT-X-VERSION:3","#EXT-X-PLAYLIST-TYPE:VOD","#EXT-X-TARGETDURATION:301"]
    for filename in recent_files:
        playlist_content.append(f"#EXTINF:300.000,")
        playlist_content.append(f"/static/recordings/{cid}/{filename}")
    playlist_content.append("#EXT-X-ENDLIST")
    return "\n".join(playlist_content)

class PTZBody(BaseModel):
    command: Literal['up', 'down', 'left', 'right', 'zoom_in', 'zoom_out', 'stop', 'center']
    duration_ms: Optional[int] = None

@router.post("/cameras/{cid}/ptz", dependencies=[Depends(verify_session)])
async def ptz_control(cid: str, body: PTZBody):
    cam = _get_by_id(cid)
    if not cam: raise HTTPException(status_code=404, detail="Cámara no encontrada")
    try:
        enqueue_ptz_job({
            "cid": cid,
            "command": body.command,
            "duration_ms": body.duration_ms,
            "cam_config": cam.model_dump(),
        })
        return {"ok": True, "queued": True}
    except Exception as e: raise HTTPException(status_code=500, detail=f"Error interno: {e}")