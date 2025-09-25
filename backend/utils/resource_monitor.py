# utils/resource_monitor.py
import psutil
import logging

logger = logging.getLogger(__name__)
logger.info("✅ Monitor de recursos inicializado para CPU y RAM.")

# --- Umbrales de Carga ---
# No lanzar nuevos trabajos si se superan estos porcentajes
CPU_THRESHOLD = 90.0  # %
RAM_THRESHOLD = 90.0  # %

def get_system_load() -> dict:
    """
    Obtiene la carga actual de CPU y RAM.
    Retorna un diccionario con los porcentajes de uso y si los recursos están disponibles.
    """
    load = {
        'cpu_percent': psutil.cpu_percent(interval=1),
        'ram_percent': psutil.virtual_memory().percent,
        'cpu_available': True,
        'ram_available': True
    }

    load['cpu_available'] = load['cpu_percent'] < CPU_THRESHOLD
    load['ram_available'] = load['ram_percent'] < RAM_THRESHOLD

    return load

def cleanup():
    """Función de limpieza (actualmente no hace nada, pero se mantiene por consistencia)."""
    pass