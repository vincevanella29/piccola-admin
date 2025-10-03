# config/gamification/rules.py

from __future__ import annotations
import math
import logging
import os
import importlib.util
from typing import Dict, Any, List, Iterable, Tuple, Optional

from web3 import Web3
from pymongo.database import Database
from .models import RuleContext, RuleAward
from utils.web3mongo import db
from utils.time_utils import get_chile_time  # ⬅️ para fallback de período

logger = logging.getLogger(__name__)

# --- Caché en Memoria para las Reglas Validadas ---
_cached_rule_templates: Optional[List[Dict[str, Any]]] = None
_cached_rule_preview_evaluators: Optional[Dict[str, Any]] = None
_cached_rule_modules: Optional[Dict[str, Any]] = None  # key -> módulo


def _load_and_validate_rule_templates() -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]:
    """
    Escanea dinámicamente la carpeta 'rules_models', valida cada regla,
    y devuelve:
      - las plantillas válidas
      - las funciones de evaluación para preview (si existen)
      - el mapping template_key -> módulo
    """
    global _cached_rule_templates, _cached_rule_preview_evaluators, _cached_rule_modules
    
    valid_templates: List[Dict[str, Any]] = []
    preview_evaluators: Dict[str, Any] = {}
    rule_modules: Dict[str, Any] = {}
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    rules_path = os.path.join(base_dir, 'rules_models')
    
    logger.info(f"Iniciando escaneo y validación de reglas desde: {os.path.abspath(rules_path)}")
    
    # Obtenemos la lista de colecciones una sola vez para eficiencia
    try:
        existing_collections = db.list_collection_names()
    except Exception as e:
        logger.error(f"No se pudo conectar a MongoDB para validar colecciones: {e}. No se cargarán reglas.")
        return [], {}, {}

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
            rule_modules[template_key] = module
            logger.info(f"✅ Regla '{template_key}' cargada y validada correctamente.")
            
            # Registrar también la función de evaluación para el preview si existe
            if hasattr(module, 'evaluate_perfect_attendance_rule'):  # compat
                 preview_evaluators[template_key] = module.evaluate_perfect_attendance_rule

        except Exception as e:
            logger.error(f"Error al cargar el módulo de regla '{module_name}': {e}", exc_info=True)
            
    _cached_rule_templates = valid_templates
    _cached_rule_preview_evaluators = preview_evaluators
    _cached_rule_modules = rule_modules
    return _cached_rule_templates, _cached_rule_preview_evaluators, _cached_rule_modules


def get_validated_rule_templates() -> List[Dict[str, Any]]:
    if _cached_rule_templates is None:
        _load_and_validate_rule_templates()
    return _cached_rule_templates


def get_preview_evaluators() -> Dict[str, Any]:
    if _cached_rule_preview_evaluators is None:
        _load_and_validate_rule_templates()
    return _cached_rule_preview_evaluators


def get_rule_modules() -> Dict[str, Any]:
    if _cached_rule_modules is None:
        _load_and_validate_rule_templates()
    return _cached_rule_modules


# --- Helpers internos para catálogos ---

def _infer_taxonomy_period() -> Tuple[str, str]:
    """
    Determina el mes/año más reciente disponible en rentabilidad_producto_locales.
    Retorna (mesano 'YYYYMM', year 'YYYY').
    """
    try:
        doc = db.rentabilidad_producto_locales.find(
            {}, {"_id": 0, "mesano": 1}
        ).sort("mesano", -1).limit(1)
        last = next(iter(doc), None)
        if last and last.get("mesano"):
            mesano = str(last["mesano"])
            year = mesano[:4]
            return mesano, year
    except Exception as e:
        logger.warning(f"No se pudo inferir 'mesano' desde rentabilidad_producto_locales: {e}")
    now = get_chile_time()
    return now.strftime("%Y%m"), now.strftime("%Y")


# ---- API Functions ----

def list_rule_templates() -> List[dict]:
    """
    Devuelve la lista de plantillas de reglas predefinidas (peladas).
    """
    templates = get_validated_rule_templates()
    return [t.copy() for t in templates]


def list_rule_templates_enriched(
    *, mesano: Optional[str] = None,
    year: Optional[str] = None,
    include_products: bool = True,                  # ⬅️ SIEMPRE True por default
    max_products_per_subfamily: Optional[int] = 300 # ⬅️ límite sano por default
) -> List[dict]:
    """
    Devuelve las plantillas y, si el módulo expone `get_template_descriptor`,
    las enriquece con catálogos (families/subfamilies/products).
    Si no se pasan parámetros, los INFIERA automáticamente (siempre entrega catálogos).
    """
    # Defaults obligatorios: siempre catálogo, con período inferido
    if mesano is None and year is None:
        mesano, year = _infer_taxonomy_period()

    templates = get_validated_rule_templates()
    modules = get_rule_modules()

    enriched: List[dict] = []
    for tpl in templates:
        key = tpl.get("key") or tpl.get("template_key")
        mod = modules.get(key)
        if mod and hasattr(mod, "get_template_descriptor"):
            try:
                full = mod.get_template_descriptor(
                    db,
                    mesano=mesano,
                    year=year,
                    include_products=include_products,
                    max_products_per_subfamily=max_products_per_subfamily,
                )
                enriched.append(full)
                continue
            except Exception as e:
                logger.error(f"get_template_descriptor falló para '{key}': {e}", exc_info=True)
        # Si el módulo no implementa catálogos, devolvemos el template tal cual
        enriched.append(tpl.copy())
    return enriched


def evaluate_rules_for_employee(db: Database, w3: Web3, ctx: RuleContext, rules: List[Dict[str, Any]], wallet: str) -> List[RuleAward]:
    awards: List[RuleAward] = []
    preview_evaluators = get_preview_evaluators()

    for rule in rules:
        if not rule.get("is_active", True):
            continue
        
        template_key = rule.get("template_key")
        
        eval_func = preview_evaluators.get(template_key)
        if eval_func:
            awards.extend(eval_func(db, w3, ctx, rule))
            continue

        if template_key == "sales_ranking_position":
            pass

    return awards


# --- Helpers (sin cambios) ---

WEI = 10 ** 18

def to_wei(amount_float: float | int) -> int:
    return int(math.floor(float(amount_float) * WEI))

def pack_batch_entries(awards: Iterable[RuleAward]) -> str:
    from eth_abi import encode  # noqa
    from eth_utils import to_bytes  # noqa
    packed: bytes = b""
    for a in awards:
        addr_bytes = bytes.fromhex(a.wallet.lower().replace("0x", ""))
        token_bytes = int(a.token_id).to_bytes(16, byteorder="big")
        amount_bytes = int(a.amount_wei).to_bytes(32, byteorder="big")
        packed += addr_bytes + token_bytes + amount_bytes
    return "0x" + packed.hex()
