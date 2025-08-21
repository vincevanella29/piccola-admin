import logging
import os
import sys
import time
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from utils.web3mongo import w3, sessions_collection
import importlib
import jwt as pyjwt
import glob
from utils.web3mongo import db
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Piccola Italia Admin API")

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
        "https://test.lapiccolaitalia.cl",
        "http://localhost:3000",
        "http://localhost:5173",
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
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL", "https://rpc-amoy.polygon.technology")
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
    logger.info(f"[login_with_privy] Received data: {data}")
    token = data.get("token")  # Privy JWT
    wallet = data.get("wallet")  # Wallet address
    notification_token = data.get("notification_token")  # Token FCM
    device_type = data.get("device_type", "web")  # Tipo de dispositivo
    permissions_granted = data.get("permissions_granted", False)  # Permisos

    if not token or not wallet:
        raise HTTPException(status_code=400, detail="Missing token or wallet")
    
    try:
        # Verificar Privy JWT
        payload = pyjwt.decode(
            token, PRIVY_JWT_PUBLIC_KEY, algorithms=["ES256"],
            issuer="privy.io", audience=PRIVY_APP_ID,
        )
        logger.info(f"Privy JWT payload (login): {payload}")
        
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
        
        # Guardar token de notificación si se envía
        if notification_token and permissions_granted:
            db.user_notification_tokens.update_one(
                {"wallet": wallet.lower(), "token": notification_token},
                {
                    "$set": {
                        "wallet": wallet.lower(),
                        "token": notification_token,
                        "device_type": device_type,
                        "permissions_granted": permissions_granted,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.info(f"Notification token saved for wallet: {wallet.lower()}")

        logger.info(f"Session created/updated for wallet: {wallet.lower()}")
        return {"success": True, "sub": payload.get("sub"), "wallet": wallet.lower()}
    except pyjwt.InvalidTokenError as e:
        logger.error(f"Invalid Privy JWT: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Privy JWT")
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed, wn: {str(e)}")

# Verify session with Privy
async def verify_session(request: Request) -> dict:
    # Accept Origin if present; otherwise, derive origin from Referer
    origin_header = request.headers.get('origin')
    referer_header = request.headers.get('referer', '')
    host_header = request.headers.get('host', '')
    request_origin = origin_header
    if not request_origin and referer_header:
        try:
            from urllib.parse import urlsplit
            parts = urlsplit(referer_header)
            if parts.scheme and parts.netloc:
                request_origin = f"{parts.scheme}://{parts.netloc}"
        except Exception:
            request_origin = referer_header

    # If still missing, try X-Forwarded-Proto/Forwarded headers or request.url scheme + Host
    if not request_origin and host_header:
        xf_proto = request.headers.get('x-forwarded-proto')
        if not xf_proto:
            fwd = request.headers.get('forwarded', '')
            # e.g., Forwarded: proto=https;host=example.com
            if 'proto=' in fwd:
                try:
                    xf_proto = next(p.split('=')[1] for p in fwd.split(';') if p.strip().startswith('proto='))
                except Exception:
                    xf_proto = None
        scheme = xf_proto or request.url.scheme or 'https'
        request_origin = f"{scheme}://{host_header}"

    # Build allowed list: prefer explicit env, else reuse CORS allowed_origins
    allowed_referers_env = os.getenv("ALLOWED_REFERERS")
    if allowed_referers_env:
        allowed_list = [r.strip() for r in allowed_referers_env.split(',') if r.strip()]
    else:
        # Use the CORS allowed_origins defined above
        allowed_list = allowed_origins

    if not request_origin or not any(request_origin.startswith(origin) for origin in allowed_list):
        logger.error(f"Forbidden origin/referer: origin={origin_header}, referer={referer_header}")
        raise HTTPException(status_code=403, detail="Forbidden: invalid origin")

    # Get Privy token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        token = request.cookies.get(PRIVY_JWT_COOKIE)
        if not token:
            logger.error("No Privy token in Authorization header or cookies")
            raise HTTPException(status_code=401, detail="Not authenticated")
    else:
        token = auth_header.split(" ", 1)[1]

    # Get wallet address
    wallet = request.headers.get("X-Wallet-Address")
    if not wallet:
        logger.error("Missing X-Wallet-Address header")
        raise HTTPException(status_code=400, detail="Missing wallet address")

    try:
        # Verify Privy JWT
        payload = pyjwt.decode(
            token,
            PRIVY_JWT_PUBLIC_KEY,
            algorithms=["ES256"],
            issuer="privy.io",
            audience=PRIVY_APP_ID,
        )
        logger.info(f"Privy JWT payload: {payload}")
        # Validate wallet address format
        try:
            checksum_wallet = w3.to_checksum_address(wallet)
        except ValueError as e:
            logger.error(f"Invalid wallet address format: {wallet}")
            raise HTTPException(status_code=400, detail=f"Invalid wallet address format: {str(e)}")
        # Check session
        session = sessions_collection.find_one({"token": token, "wallet": wallet.lower()})
        if not session:
            logger.error(f"No session found for wallet: {wallet.lower()}")
            raise HTTPException(status_code=401, detail="No valid session")
        if session["exp"] < int(time.time()):
            logger.error(f"Session expired for wallet: {wallet.lower()}")
            sessions_collection.delete_one({"token": token})
            raise HTTPException(status_code=401, detail="Session expired")
        logger.info(f"Session verified for wallet: {wallet.lower()}")
        return {"id": wallet.lower(), "wallet": wallet.lower(), "sub": payload.get("sub")}
    except pyjwt.InvalidTokenError as e:
        logger.error(f"Invalid Privy JWT: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid Privy JWT")
    except Exception as e:
        logger.error(f"Error verifying session: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Session verification failed, wn: {str(e)}")

# Debug cookies
@app.get("/debug/cookies")
async def debug_cookies(request: Request):
    cookies = request.cookies
    logger.info(f"Received cookies: {cookies}")
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
    logger.info(f"Loading API module: apis.{module_name}")
    try:
        module = importlib.import_module(f"apis.{module_name}")
        if hasattr(module, "router"):
            app.include_router(module.router, prefix="/api")
            logger.info(f"Loaded router for apis.{module_name}")
        else:
            logger.warning(f"apis.{module_name} has no router defined")
    except Exception as e:
        logger.error(f"Error loading API {module_name}: {str(e)}")

# Debug routes
@app.get("/debug/routes")
async def list_routes():
    routes = [{"path": route.path, "methods": list(route.methods)} for route in app.routes if hasattr(route, "path") and hasattr(route, "methods")]
    return {"routes": routes}

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)