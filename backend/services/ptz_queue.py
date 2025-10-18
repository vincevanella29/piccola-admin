import os
import json
import threading
import time
from typing import Optional, Dict, Any

import redis

from .ptz_controller import control_ptz

_QUEUE_KEY = os.getenv("PTZ_QUEUE_KEY", "ptz:queue")
_worker_started = False
_worker_lock = threading.Lock()
_redis_client: Optional[redis.Redis] = None


def _build_redis_url() -> str:
    url = os.getenv("REDIS_URL")
    if url:
        return url
    host = os.getenv("REDIS_HOST", "localhost")
    port = os.getenv("REDIS_PORT", "6379")
    db = os.getenv("REDIS_DB", "0")
    if host.startswith(("redis://", "rediss://", "unix://")):
        return host
    return f"redis://{host}:{port}/{db}"


def _redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(_build_redis_url(), decode_responses=True)
    return _redis_client


def enqueue_ptz_job(job: Dict[str, Any]) -> None:
    # Minimal validation
    if not isinstance(job, dict) or "cid" not in job or "command" not in job or "cam_config" not in job:
        raise ValueError("Job inválido para PTZ")
    job.setdefault("ts", time.time())
    # LPUSH so BRPOP consumes the most recent command first (reduce lag between press/release)
    _redis().lpush(_QUEUE_KEY, json.dumps(job))
    _ensure_worker_started()


def _worker_loop():
    r = _redis()
    while True:
        try:
            # BLPOP pairs with LPUSH for LIFO behavior (consume newest first)
            item = r.blpop(_QUEUE_KEY, timeout=1)
            if not item:
                continue
            _, payload = item
            try:
                data = json.loads(payload)
                cam_config = data.get("cam_config")
                command = data.get("command")
                duration_ms = data.get("duration_ms")
                # Ejecutar PTZ de manera síncrona en este hilo
                control_ptz(cam_config, command, duration_ms=duration_ms)
            except Exception as e:
                # Log mínimo a stderr
                print(f"PTZ worker error: {e}")
        except Exception as e:
            # Si hay un problema con Redis, espera un poco y reintenta
            print(f"PTZ worker Redis error: {e}")
            time.sleep(1)


def _ensure_worker_started():
    global _worker_started
    if _worker_started:
        return
    with _worker_lock:
        if _worker_started:
            return
        t = threading.Thread(target=_worker_loop, name="ptz-worker", daemon=True)
        t.start()
        _worker_started = True
