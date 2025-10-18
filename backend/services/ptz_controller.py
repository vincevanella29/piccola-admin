import os
from typing import Literal, Optional
from onvif import ONVIFCamera
from utils.security.camera_secrets import decrypt_str
import importlib

# Configuración del WSDL (necesario para la librería ONVIF)
# Permite override por env: ONVIF_WSDL_DIR. Fallback: backend/wsdl
def _resolve_wsdl_dir() -> str:
    required = ['devicemgmt.wsdl', 'media.wsdl', 'ptz.wsdl']

    def _has_required(path: str) -> bool:
        return all(os.path.exists(os.path.join(path, f)) for f in required)

    candidates = []

    # 1) Env var override
    env_dir = os.getenv('ONVIF_WSDL_DIR')
    if env_dir:
        env_dir = os.path.abspath(os.path.expanduser(env_dir))
        candidates.append(env_dir)

    # 2) Local repo path: backend/wsdl
    local_wsdl = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'wsdl')
    candidates.append(local_wsdl)

    # 3) Bundled with installed packages
    for mod_name in ('onvif', 'onvif_zeep'):
        try:
            mod = importlib.import_module(mod_name)
            pkg_wsdl = os.path.join(os.path.dirname(getattr(mod, '__file__', '')), 'wsdl')
            if pkg_wsdl and pkg_wsdl not in candidates:
                candidates.append(pkg_wsdl)
        except Exception:
            pass

    # Return the first candidate that has all required files
    for c in candidates:
        if c and _has_required(c):
            return c

    # Nothing found -> raise a clear error with all candidates listed
    raise FileNotFoundError(
        "WSDL files missing. Tried: " + ", ".join(f"'{c}'" for c in candidates) + 
        ". Set ONVIF_WSDL_DIR or ensure devicemgmt.wsdl, media.wsdl, ptz.wsdl are present."
    )

def _ensure_wsdl_available(wsdl_dir: str):
    required = ['devicemgmt.wsdl', 'media.wsdl', 'ptz.wsdl']
    missing = []
    for fname in required:
        fpath = os.path.join(wsdl_dir, fname)
        if not os.path.exists(fpath):
            missing.append(fname)
    if missing:
        raise FileNotFoundError(
            f"WSDL files missing in '{wsdl_dir}': {', '.join(missing)}. "
            f"Copy the 'wsdl' folder from python-onvif-zeep repo or set ONVIF_WSDL_DIR."
        )


def _detect_onvif_port(ip: str, user: str, password: str, wsdl_dir: str, preferred: Optional[int] = None) -> Optional[int]:
    """Intenta detectar el puerto ONVIF probando GetCapabilities en varios puertos.
    Devuelve el puerto válido o None si no se detecta.
    """
    candidates = []
    # 1) Si viene un preferido (env/config), pruébalo primero
    if preferred:
        candidates.append(int(preferred))
    # 2) Conocidos más comunes + 6688 (descubierto en algunos modelos)
    for p in (80, 443, 8080, 8000, 8899, 6688):
        if p not in candidates:
            candidates.append(p)

    for port in candidates:
        try:
            cam = ONVIFCamera(ip, port, user, password, wsdl_dir)
            # Llamada ligera para validar el endpoint
            dm = cam.create_devicemgmt_service()
            dm.GetCapabilities({'Category': 'All'})
            return port
        except Exception:
            continue
    return None


def control_ptz(cam_config: dict, command: Literal['up', 'down', 'left', 'right', 'zoom_in', 'zoom_out', 'stop', 'center'], duration_ms: Optional[int] = None):
    """
    Se conecta a una cámara vía ONVIF y envía un comando PTZ.
    """
    local_cfg = cam_config.get('local', {})
    ip = local_cfg.get('ip')
    # El puerto ONVIF varía por fabricante; probaremos automáticamente.
    preferred_port = int(os.getenv('ONVIF_PORT', '0') or 0)
    raw_user = local_cfg.get('username')
    raw_pass = local_cfg.get('password')
    user = decrypt_str(raw_user) if raw_user else None
    password = decrypt_str(raw_pass) if raw_pass else None

    if not ip or not user or not password:
        raise ValueError("IP, usuario y contraseña son requeridos para control PTZ.")

    try:
        # 0. Validar WSDL
        wsdl_dir = _resolve_wsdl_dir()
        _ensure_wsdl_available(wsdl_dir)

        # 1. Detectar puerto ONVIF válido
        detected_port = _detect_onvif_port(ip, user, password, wsdl_dir, preferred=preferred_port)
        if not detected_port:
            raise ConnectionError("No se pudo detectar el puerto ONVIF. Verifica que ONVIF esté habilitado en la cámara.")

        # 2. Conectar a la cámara en el puerto detectado
        mycam = ONVIFCamera(ip, detected_port, user, password, wsdl_dir)
        
        # 3. Crear servicio PTZ
        ptz_service = mycam.create_ptz_service()

        # 4. Obtener el perfil de medios activo
        media_profile = mycam.create_media_service().GetProfiles()[0]
        
        # 5. Definir los parámetros de movimiento
        # Velocidades de movimiento (rango de -1.0 a 1.0)
        speed = 0.35  # más suave
        # Duración del movimiento: si viene duration_ms desde UI, úsalo; si no, por defecto 5s
        if duration_ms is not None:
            try:
                ms = max(50, min(int(duration_ms), 15000))  # clamp 50ms..15s
            except Exception:
                ms = 5000
        else:
            ms = 5000
        timeout = f"PT{ms/1000.0:.3f}S"

        if command == 'center':
            # Mover al centro (0,0) con AbsoluteMove
            ptz_service.AbsoluteMove({
                'ProfileToken': media_profile.token,
                'Position': {
                    'PanTilt': {'x': 0.0, 'y': 0.0},
                    'Zoom': {'x': 0.0}
                },
                'Speed': {
                    'PanTilt': {'x': 0.5, 'y': 0.5},
                    'Zoom': {'x': 0.5}
                }
            })
            return {"status": "ok", "command": "center"}

        request = ptz_service.create_type('ContinuousMove')
        request.ProfileToken = media_profile.token

        # Mapear comando a velocidad (usar dicts compatibles con zeep)
        velocity = {'PanTilt': {'x': 0.0, 'y': 0.0}, 'Zoom': {'x': 0.0}}

        if command == 'left':
            velocity['PanTilt']['x'] = -speed
        elif command == 'right':
            velocity['PanTilt']['x'] = speed
        elif command == 'up':
            velocity['PanTilt']['y'] = speed
        elif command == 'down':
            velocity['PanTilt']['y'] = -speed
        elif command == 'zoom_in':
            velocity['Zoom']['x'] = speed
        elif command == 'zoom_out':
            velocity['Zoom']['x'] = -speed

        if command == 'stop':
            ptz_service.Stop({'ProfileToken': media_profile.token, 'PanTilt': True, 'Zoom': True})
            return {"status": "ok", "command": "stop"}
        else:
            request.Velocity = velocity
            request.Timeout = timeout
            ptz_service.ContinuousMove(request)
            return {"status": "ok", "command": command}

    except FileNotFoundError as e:
        # WSDL faltante: error claro para el caller
        print(f"Error controlando PTZ - WSDL no encontrado: {e}")
        raise ConnectionError(f"WSDL no encontrado: {e}")
    except Exception as e:
        # Log y error genérico
        print(f"Error controlando PTZ: {e}")
        raise ConnectionError(f"No se pudo conectar o controlar la cámara: {e}")