# config/gamification/rules.py

from __future__ import annotations
import math
import logging
import os
import importlib.util
from typing import Dict, Any, List, Iterable, Tuple

from web3 import Web3
from pymongo.database import Database
from .models import RuleContext, RuleAward
from utils.web3mongo import db

logger = logging.getLogger(__name__)

# --- Caché en Memoria para las Reglas Validadas ---
_cached_rule_templates: Optional[List[Dict[str, Any]]] = None
_cached_rule_preview_evaluators: Optional[Dict[str, Any]] = None


def _load_and_validate_rule_templates() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Escanea dinámicamente la carpeta 'rules_models', valida cada regla,
    y devuelve las plantillas y funciones de evaluación que pasen la validación.
    """
    global _cached_rule_templates, _cached_rule_preview_evaluators
    
    valid_templates = []
    preview_evaluators = {}
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    rules_path = os.path.join(base_dir, 'rules_models')
    
    logger.info(f"Iniciando escaneo y validación de reglas desde: {os.path.abspath(rules_path)}")
    
    # Obtenemos la lista de colecciones una sola vez para eficiencia
    try:
        existing_collections = db.list_collection_names()
    except Exception as e:
        logger.error(f"No se pudo conectar a MongoDB para validar colecciones: {e}. No se cargarán reglas.")
        return [], {}

    for entry in os.scandir(rules_path):
        if not (entry.is_file() and entry.name.endswith('.py') and not entry.name.startswith('__')):
            continue

        module_name = entry.name[:-3]
        try:
            spec = importlib.util.spec_from_file_location(module_name, entry.path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # 1. Validar estructura del módulo
            if not hasattr(module, 'TEMPLATE_KEY') or not hasattr(module, 'evaluate'):
                logger.warning(f"Módulo '{module_name}' omitido: falta TEMPLATE_KEY o la función 'evaluate'.")
                continue

            template_key = module.TEMPLATE_KEY
            template_variable_name = f"{template_key.upper()}_RULE_TEMPLATE"
            if not hasattr(module, template_variable_name):
                logger.warning(f"Módulo '{module_name}' omitido: falta la definición de la plantilla '{template_variable_name}'.")
                continue

            template = getattr(module, template_variable_name)

            # 2. Validar fuentes de datos en la plantilla
            data_sources = template.get("data_sources", [])
            is_valid_source = True
            if not data_sources:
                logger.warning(f"Regla '{template_key}' no define 'data_sources'. Se cargará, pero es recomendable definirlo.")
            
            for source in data_sources:
                collection_name = source.get("collection")
                if not collection_name:
                    logger.error(f"Regla '{template_key}' omitida: 'data_sources' contiene una entrada sin 'collection'.")
                    is_valid_source = False
                    break
                if collection_name not in existing_collections:
                    logger.error(f"Regla '{template_key}' omitida: la colección '{collection_name}' no existe en la base de datos.")
                    is_valid_source = False
                    break
            
            if not is_valid_source:
                continue

            # Si pasa todas las validaciones, la agregamos
            valid_templates.append(template)
            logger.info(f"✅ Regla '{template_key}' cargada y validada correctamente.")
            
            # Registrar también la función de evaluación para el preview si existe
            if hasattr(module, 'evaluate_perfect_attendance_rule'): # Caso especial para mantener compatibilidad
                 preview_evaluators[template_key] = module.evaluate_perfect_attendance_rule
            # Aquí podrías añadir un estándar, ej: if hasattr(module, 'evaluate_for_preview')

        except Exception as e:
            logger.error(f"Error al cargar el módulo de regla '{module_name}': {e}", exc_info=True)
            
    _cached_rule_templates = valid_templates
    _cached_rule_preview_evaluators = preview_evaluators
    return _cached_rule_templates, _cached_rule_preview_evaluators


def get_validated_rule_templates() -> List[Dict[str, Any]]:
    """
    Obtiene la lista de plantillas de reglas validadas, usando caché.
    """
    if _cached_rule_templates is None:
        _load_and_validate_rule_templates()
    return _cached_rule_templates


def get_preview_evaluators() -> Dict[str, Any]:
    """
    Obtiene el diccionario de funciones de evaluación para preview, usando caché.
    """
    if _cached_rule_preview_evaluators is None:
        _load_and_validate_rule_templates()
    return _cached_rule_preview_evaluators


# ---- API Functions ----

def list_rule_templates() -> list[dict]:
    """
    Devuelve la lista de plantillas de reglas predefinidas y validadas dinámicamente.
    """
    templates = get_validated_rule_templates()
    return [t.copy() for t in templates]


def evaluate_rules_for_employee(db: Database, w3: Web3, ctx: RuleContext, rules: List[Dict[str, Any]], wallet: str) -> List[RuleAward]:
    """
    (Función para PREVIEW) Evalúa un conjunto de reglas para un empleado específico.
    NOTA: Esta función es para simulaciones y necesita lógica específica por template.
    El worker principal usa la función 'evaluate' de cada módulo.
    """
    awards: List[RuleAward] = []
    preview_evaluators = get_preview_evaluators()

    for rule in rules:
        if not rule.get("is_active", True):
            continue
        
        template_key = rule.get("template_key")
        
        # Lógica de delegación dinámica para preview
        eval_func = preview_evaluators.get(template_key)
        if eval_func:
            awards.extend(eval_func(db, w3, ctx, rule))
            continue

        # TODO: Implementar lógica de preview para otras reglas si es necesario
        # Por ejemplo, para la regla de ranking, se necesitaría una consulta específica
        # que no devuelve solo el RUT, sino la información para generar un 'RuleAward'.
        if template_key == "sales_ranking_position":
            # logger.info(f"Preview para '{template_key}' no implementado aún.")
            pass # Dejar pasar sin error por ahora

    return awards


# --- Helpers (sin cambios) ---

WEI = 10 ** 18

def to_wei(amount_float: float | int) -> int:
    return int(math.floor(float(amount_float) * WEI))

def pack_batch_entries(awards: Iterable[RuleAward]) -> str:
    from eth_abi import encode
    from eth_utils import to_bytes
    packed: bytes = b""
    for a in awards:
        addr_bytes = bytes.fromhex(a.wallet.lower().replace("0x", ""))
        token_bytes = int(a.token_id).to_bytes(16, byteorder="big")
        amount_bytes = int(a.amount_wei).to_bytes(32, byteorder="big")
        packed += addr_bytes + token_bytes + amount_bytes
    return "0x" + packed.hex()