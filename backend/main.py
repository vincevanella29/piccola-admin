import logging
import os
import sys
import time
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from contextlib import asynccontextmanager
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi.exceptions import RequestValidationError  # en vez de fastapi.exception_handler
from redis import asyncio as aioredis
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from utils.web3mongo import w3, sessions_collection
import jwt as pyjwt
import glob
import importlib
from utils.time_utils import format_chile_time, CHILE_TZ
from utils.auth.access_control import ensure_api_rules_for_app, check_api_access
from datetime import datetime

# Set timezone to Chile
os.environ['TZ'] = 'America/Santiago'
time.tzset()

load_dotenv()

# Logging setup with Chile timezone
class ChileTimeFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created).astimezone(CHILE_TZ)
        if datefmt:
            return dt.strftime(datefmt)
        return format_chile_time(dt, '%Y-%m-%d %H:%M:%S %Z')

logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = ChileTimeFormatter('%(asctime)s (Chile) %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S %Z')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        host = os.getenv("REDIS_HOST", "localhost")
        port = os.getenv("REDIS_PORT", "6379")
        db = os.getenv("REDIS_DB", "0")
        if host.startswith(("redis://", "rediss://", "unix://")):
            redis_url = host
        else:
            redis_url = f"redis://{host}:{port}/{db}"
    try:
        redis = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        await redis.ping()
        FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
        logger.info(f"Redis cache connected successfully at {redis_url}")
    except Exception as e:
        logger.error(f"Failed to connect to Redis at {redis_url}: {e}")
        logger.warning("Falling back to in-memory cache. API performance will be degraded.")
        FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    yield
    # --- shutdown ---

# FastAPI app
app = FastAPI(title="Api Club Della Nonna", lifespan=lifespan)

from fastapi.exception_handlers import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

def json_compatible_encoder(obj):
    from decimal import Decimal
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, BaseException):
        return str(obj)
    if isinstance(obj, dict):
        return {k: json_compatible_encoder(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_compatible_encoder(i) for i in obj]
    return obj

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    errors = json_compatible_encoder(exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": errors},
    )


# CORS middleware
allowed_origins_env = os.getenv("ALLOWED_REFERERS")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "https://test.vanellix.com",
        "https://dmenu5.vanellixprueba.com",
        "https://wallet.vanellix.com",
        "https://dex2.vanellix.com:5173",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://103.199.187.37:5173",
        "https://103.199.187.37:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,  # Solo si usas cookies/autenticación
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
PRIVY_JWT_PUBLIC_KEY = os.getenv("PRIVY_JWT_PUBLIC_KEY")
# If the key is provided with literal \n characters (e.g. from Docker env var), convert them to real newlines
if PRIVY_JWT_PUBLIC_KEY:
    PRIVY_JWT_PUBLIC_KEY = PRIVY_JWT_PUBLIC_KEY.replace('\\n', '\n')
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")
PRIVY_JWT_COOKIE = "privy-token"


# Login with Privy JWT and wallet
@app.post("/api/login")
async def login_with_privy(request: Request):
    data = await request.json()
    token = data.get("token")  # Privy JWT
    wallet = data.get("wallet")  # Wallet address
    # Notification token handling removed: tokens are saved via /api/notifications/tokens

    if not token or not wallet:
        raise HTTPException(status_code=400, detail="Missing token or wallet")
    
    try:
        # Verificar Privy JWT
        payload = pyjwt.decode(
            token, PRIVY_JWT_PUBLIC_KEY, algorithms=["ES256"],
            issuer="privy.io", audience=PRIVY_APP_ID,
        )
        
        # Validar wallet
        checksum_wallet = w3.to_checksum_address(wallet)
        
        # Guardar sesión
        session_data = {
            "token": token,
            "wallet": wallet.lower(),
            "sub": payload.get("sub"),
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
            "sid": payload.get("sid")
        }
        sessions_collection.update_one(
            {"wallet": wallet.lower(), "sid": payload.get("sid")},
            {"$set": session_data}, upsert=True
        )
        return {"success": True, "sub": payload.get("sub"), "wallet": wallet.lower()}
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid Privy JWT: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Privy JWT")
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed, wn: {str(e)}")

# Debug cookies
@app.get("/debug/cookies")
async def debug_cookies(request: Request):
    cookies = request.cookies
    return {"cookies": cookies}

# Load API routers
APIS_DIR = os.path.join(os.path.dirname(__file__), "apis")
# Busca todos los .py en apis y subcarpetas
api_files = glob.glob(os.path.join(APIS_DIR, "**", "*.py"), recursive=True)
for file_path in api_files:
    rel_path = os.path.relpath(file_path, APIS_DIR)
    module_path = rel_path.replace(os.sep, ".")
    module_name = os.path.splitext(module_path)[0]
    if module_name.endswith("__init__"):
        continue
    try:
        module = importlib.import_module(f"apis.{module_name}")
        if hasattr(module, "router"):
            app.include_router(module.router, prefix="/api", dependencies=[Depends(check_api_access)])
        else:
            logger.warning(f"apis.{module_name} has no router defined")
    except Exception as e:
        logger.error(f"Error loading API {module_name}: {str(e)}")

# Ensure default API access rules exist for all prefixes
ensure_api_rules_for_app(app)

# Serve HLS streams directory for camera playback
try:
    static_streams_dir = os.path.join(os.path.dirname(__file__), 'static', 'streams')
    os.makedirs(static_streams_dir, exist_ok=True)
    app.mount("/streams", StaticFiles(directory=static_streams_dir), name="streams")
except Exception as e:
    logger.warning(f"Could not mount /streams: {e}")

# Serve /static for recordings and other assets (e.g., /static/recordings/<cid>/<file>.mp4)
try:
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    os.makedirs(static_dir, exist_ok=True)
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
except Exception as e:
    logger.warning(f"Could not mount /static: {e}")

# Debug routes
@app.get("/debug/routes")
async def list_routes():
    routes = [{"path": route.path, "methods": list(route.methods)} for route in app.routes if hasattr(route, "path") and hasattr(route, "methods")]
    return {"routes": routes}

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)