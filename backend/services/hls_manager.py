# services/hls_manager.py
import os
import subprocess
import tempfile
import time
import shutil
import json
import threading
import glob
from datetime import datetime
from typing import Dict, Optional, List

from utils.security.camera_secrets import decrypt_str

# --- CONFIGURACIÓN ---
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
STREAM_ROOT = os.path.join(BASE_DIR, 'static', 'streams')
RECORD_ROOT = os.path.join(BASE_DIR, 'static', 'recordings')
VPN_CONFIG_ROOT = os.path.join(BASE_DIR, 'vpn')
os.makedirs(STREAM_ROOT, exist_ok=True)
os.makedirs(RECORD_ROOT, exist_ok=True)

# --- ESTADO GLOBAL (SEGURO PARA THREADS) ---
_procs_lock = threading.Lock()
_procs: Dict[str, Dict[str, subprocess.Popen]] = {}
_monitors: Dict[str, Dict[str, object]] = {}


def _get_ffmpeg_bin() -> str:
    """Encuentra la ruta del binario de ffmpeg de forma robusta."""
    env_bin = os.getenv('FFMPEG_BIN')
    if env_bin:
        found = shutil.which(env_bin)
        if found: return found
    found = shutil.which('ffmpeg')
    if found: return found
    for p in ('/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'):
        if os.path.exists(p): return p
    raise FileNotFoundError("ffmpeg no encontrado.")

def _mask_url(rtsp_url: str) -> str:
    """Enmascara las credenciales en una URL RTSP para los logs."""
    try:
        scheme, rest = rtsp_url.split('://', 1)
        creds, host = rest.split('@', 1)
        user, _ = creds.split(':', 1)
        return f"{scheme}://{user}:***@{host}"
    except Exception:
        return rtsp_url

def _build_rtsp(cam: dict) -> str:
    """Construye la URL RTSP a partir de la configuración de la cámara."""
    local = cam.get('local', {})
    ip = local.get('ip')
    port = local.get('port', 8554)
    username = decrypt_str(local.get('username'))
    password = decrypt_str(local.get('password'))
    rtsp_path = local.get('rtsp_path', '/profile0')
    auth = f"{username}:{password}@" if username and password else ''
    return f"rtsp://{auth}{ip}:{port}{rtsp_path}"

def _latest_segment_mtime(out_dir: str) -> float:
    """Obtiene el tiempo de modificación del último segmento de video generado."""
    try:
        files = glob.glob(os.path.join(out_dir, 'index*.ts'))
        return max(os.path.getmtime(p) for p in files) if files else 0.0
    except Exception:
        return 0.0

def _cleanup_stream_dir(out_dir: str) -> None:
    """Elimina playlist y segmentos HLS para iniciar desde cero.
    Se invoca en start/stop para evitar referencias a archivos viejos.
    """
    try:
        # Borrar segmentos .ts y playlist principal
        to_delete = glob.glob(os.path.join(out_dir, 'index*.ts'))
        to_delete.append(os.path.join(out_dir, 'index.m3u8'))
        for p in to_delete:
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                continue
    except Exception:
        pass

def _start_openvpn(cid: str, cam: dict) -> Optional[subprocess.Popen]:
    # (Esta función se mantiene igual, no necesita cambios)
    return None

def _spawn_ffmpeg(cid: str, cam: dict, out_dir: str) -> Dict[str, object]:
    """Inicia el proceso ffmpeg para HLS en vivo."""
    rtsp_url = _build_rtsp(cam)
    out_index = os.path.join(out_dir, 'index.m3u8')
    ffmpeg_bin = _get_ffmpeg_bin()

    input_flags = ['-hide_banner', '-loglevel', 'info', '-nostdin', '-rtsp_transport', 'tcp', '-analyzeduration', '2M', '-probesize', '5M', '-use_wallclock_as_timestamps', '1', '-fflags', '+genpts']
    hls_flags = ['-f', 'hls', '-hls_time', '2', '-hls_list_size', '30', '-hls_flags', 'delete_segments+append_list+omit_endlist+temp_file+independent_segments+program_date_time']
    
    cmd = [ffmpeg_bin] + input_flags + ['-i', rtsp_url] + ['-map', '0:v:0', '-map', '0:a?', '-c:v', 'copy', '-async', '1', '-c:a', 'aac', '-b:a', '64k', '-ar', '16000'] + hls_flags + [out_index]

    log_path = os.path.join(out_dir, 'ffmpeg.log')
    print(f"🚀 [HLS] Iniciando ffmpeg para {cid} | URL: {_mask_url(rtsp_url)}")
    with open(log_path, 'w') as lf:
        proc = subprocess.Popen(cmd, stdout=lf, stderr=lf)
    
    return {'proc': proc, 'out_index': out_index, 'log_path': log_path}


def _spawn_recorder(cid: str, cam: dict) -> Dict[str, object]:
    """Inicia un proceso ffmpeg para grabar segmentos MP4 continuos."""
    rtsp_url = _build_rtsp(cam)
    ffmpeg_bin = _get_ffmpeg_bin()
    rec_dir = os.path.join(RECORD_ROOT, cid)
    os.makedirs(rec_dir, exist_ok=True)

    input_flags = ['-hide_banner', '-loglevel', 'info', '-nostdin', '-rtsp_transport', 'tcp', '-analyzeduration', '2M', '-probesize', '5M', '-use_wallclock_as_timestamps', '1', '-fflags', '+genpts']
    out_pattern = os.path.join(rec_dir, '%Y%m%d_%H%M%S.mp4')
    cmd = [ffmpeg_bin] + input_flags + ['-i', rtsp_url] + ['-map', '0:v:0', '-map', '0:a?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', '-ar', '16000', '-f', 'segment', '-segment_time', '300', '-reset_timestamps', '1', '-strftime', '1', out_pattern]

    log_path = os.path.join(rec_dir, 'recorder.log')
    print(f"🎥 [REC] Iniciando grabación para {cid} | URL: {_mask_url(rtsp_url)}")

    # --- INICIO DE LA CORRECCIÓN DE ZONA HORARIA ---
    # Forzar a ffmpeg a usar UTC para los nombres de archivo, estandarizando todo.
    env = os.environ.copy()
    env['TZ'] = 'UTC'
    # --- FIN DE LA CORRECCIÓN ---

    with open(log_path, 'a') as lf:
        # Pasar el entorno modificado a Popen para que los nombres de archivo sean UTC
        proc = subprocess.Popen(cmd, stdout=lf, stderr=lf, env=env)

    return {'proc': proc, 'log_path': log_path, 'rec_dir': rec_dir}


def _start_monitor(cid: str, cam: dict, out_dir: str):
    """Inicia el 'watchdog' que vigila y reinicia procesos si fallan."""
    with _procs_lock:
        if cid in _monitors: return

    stop_evt = threading.Event()
    live_enabled = cam.get('live_enabled', False)

    def run():
        stall_seconds = 15
        check_interval = 5
        print(f"🛡️  [WATCHDOG] Monitor activado para {cid} (live: {live_enabled})")
        while not stop_evt.wait(check_interval):
            status = None
            with _procs_lock:
                proc_info = _procs.get(cid, {})
                recorder_proc = proc_info.get('recorder')
                ffmpeg_proc = proc_info.get('ffmpeg')
                
                if not proc_info or (recorder_proc and recorder_proc.poll() is not None):
                    status = "recorder caído"
                elif live_enabled and (not ffmpeg_proc or ffmpeg_proc.poll() is not None):
                    status = "hls caído"
                elif live_enabled and _latest_segment_mtime(out_dir) > 0 and (time.time() - _latest_segment_mtime(out_dir)) > stall_seconds:
                    status = "hls congelado"
                else:
                    continue

            print(f"🚨 [WATCHDOG] Proceso '{status}' detectado para {cid}. Reiniciando...")
            stop_hls(cid, internal_call=True) 
            time.sleep(2)
            start_hls(cid, cam, internal_call=True)
            break
        print(f"🛑 [WATCHDOG] Monitor desactivado para {cid}")

    def cleaner():
        rec_dir = os.path.join(RECORD_ROOT, cid)
        retention_days = int(cam.get('retention_days', 30) or 30)
        print(f"🧹 [RETENTION] Cleaner activado para {cid} (dias={retention_days})")
        while not stop_evt.wait(3600):  # cada hora
            try:
                cutoff = time.time() - (retention_days * 86400)
                for fname in os.listdir(rec_dir):
                    if not fname.lower().endswith('.mp4'): continue
                    fpath = os.path.join(rec_dir, fname)
                    try:
                        if os.path.getmtime(fpath) < cutoff:
                            os.remove(fpath)
                    except Exception: continue
            except Exception as e:
                print(f"⚠️ [RETENTION] Error limpiando {cid}: {e}")
        print(f"🛑 [RETENTION] Cleaner desactivado para {cid}")

    th = threading.Thread(target=run, name=f"watchdog-{cid}", daemon=True)
    th_clean = threading.Thread(target=cleaner, name=f"cleaner-{cid}", daemon=True)
    th.start()
    th_clean.start()
    with _procs_lock:
        _monitors[cid] = {'thread': th, 'cleaner': th_clean, 'stop': stop_evt}

def start_hls(cid: str, cam: dict, internal_call=False) -> dict:
    """Inicia grabador y/o HLS según la configuración de la cámara."""
    with _procs_lock:
        if cid in _procs:
            return {'cid': cid, 'status': 'already_running'}
    
    out_dir = os.path.join(STREAM_ROOT, cid)
    os.makedirs(out_dir, exist_ok=True)
    # Limpieza previa: asegurar que no queden segmentos/playlist antiguos
    _cleanup_stream_dir(out_dir)
    
    hls_spawned, recorder_spawned, vpn_proc = {}, {}, None
    live_enabled = cam.get('live_enabled', False)
    
    try:
        if cam.get('mode') == 'vpn':
            vpn_proc = _start_openvpn(cid, cam)
            if not vpn_proc or vpn_proc.poll() is not None:
                raise RuntimeError("Falló la conexión VPN")

        recorder_spawned = _spawn_recorder(cid, cam)
        procs_to_store = {'recorder': recorder_spawned['proc']}
        if vpn_proc: procs_to_store['openvpn'] = vpn_proc

        if live_enabled:
            hls_spawned = _spawn_ffmpeg(cid, cam, out_dir)
            procs_to_store['ffmpeg'] = hls_spawned['proc']
        
        with _procs_lock:
            _procs[cid] = procs_to_store
        
        if not internal_call:
            _start_monitor(cid, cam, out_dir)

    except Exception as e:
        print(f"🔥 [START] Falla crítica al iniciar {cid}: {e}")
        if vpn_proc: vpn_proc.terminate()
        if recorder_spawned.get('proc'): recorder_spawned['proc'].terminate()
        if hls_spawned.get('proc'): hls_spawned['proc'].terminate()
        return {'cid': cid, 'error': 'start_failed', 'message': str(e)}

    if live_enabled:
        deadline = time.time() + 8
        while time.time() < deadline:
            if os.path.exists(hls_spawned['out_index']):
                return {'cid': cid, 'status': 'live_and_recording', 'hls': f"/streams/{cid}/index.m3u8"}
            if hls_spawned['proc'].poll() is not None: break
            time.sleep(0.2)
        
        log = "".join(open(hls_spawned['log_path']).readlines()[-20:]) if os.path.exists(hls_spawned.get('log_path','')) else "No log."
        stop_hls(cid)
        return {'cid': cid, 'error': 'ffmpeg_crashed_on_start', 'log_tail': log}
    else:
        time.sleep(1)
        if recorder_spawned['proc'].poll() is not None:
            log = "".join(open(recorder_spawned['log_path']).readlines()[-20:]) if os.path.exists(recorder_spawned.get('log_path','')) else "No log."
            stop_hls(cid)
            return {'cid': cid, 'error': 'recorder_crashed_on_start', 'log_tail': log}
        return {'cid': cid, 'status': 'recording_started'}

def stop_hls(cid: str, internal_call=False) -> dict:
    """Detiene todos los procesos asociados a una cámara."""
    with _procs_lock:
        if not internal_call:
            mon = _monitors.pop(cid, None)
            if mon: mon['stop'].set()

        info = _procs.pop(cid, None)
        if not info:
            return {'stopped': cid, 'found': False}
    
    for name, p in info.items():
        try:
            print(f"🔌 Deteniendo proceso '{name}' para {cid} (PID: {p.pid})")
            p.terminate()
            p.wait(timeout=5)
        except Exception:
            p.kill()
    # Limpieza posterior: remover archivos HLS residuales
    try:
        out_dir = os.path.join(STREAM_ROOT, cid)
        _cleanup_stream_dir(out_dir)
    except Exception:
        pass

    return {'stopped': cid, 'found': True}

def status_hls(cid: str) -> dict:
    """Verifica el estado de los procesos de una cámara."""
    with _procs_lock:
        info = _procs.get(cid)
        if not info:
            return {'running': False}
        
        recorder_proc = info.get('recorder')
        if not recorder_proc or recorder_proc.poll() is not None:
            return {'running': False}

        hls_proc = info.get('ffmpeg')
        if hls_proc and hls_proc.poll() is not None:
            return {'running': False}

        return {'running': True}