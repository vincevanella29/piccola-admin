# /utils/index/index.py
import sys
import os
import logging
from pymongo import ASCENDING, DESCENDING
from pymongo.operations import UpdateOne
from web3 import Web3

# Hacemos el truco para importar desde la raíz del backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

try:
    from utils.web3mongo import db, logger, contracts
except ImportError:
    # Fallback si se corre como script (aunque -m es mejor)
    from utils.web3mongo import db, logger, contracts

def ensure_event_indexes():
    """
    Crea índices base para colecciones de eventos y los índices de aplicación
    que ya tenías definidos. Es idempotente y usa background=True.
    """
    # --- Índices de aplicación (no eventos) ---
    try:
        db.notification_types.create_index([("id", ASCENDING)], name="uniq_notification_type_id", unique=True, background=True)
        # ... (el resto de tus índices de app) ...
        db.empleados_usuarios.create_index([("rut", ASCENDING)], name="uniq_rut", unique=True, background=True)
        db.asistencia_diaria_intranet.create_index([("periodo", ASCENDING), ("rut", ASCENDING)], name="idx_periodo_rut", background=True)
        db.restaurant_data.create_index([("mesano", ASCENDING), ("Estado", ASCENDING), ("Tipo", ASCENDING), ("local_norm", ASCENDING), ("Fecha", ASCENDING)], name="idx_mesano_estado_tipo_localnorm_fecha", background=True)
        db.ventas_producto_dia_hora_cprodu.create_index([("mesano", ASCENDING), ("local_norm", ASCENDING), ("fecha", ASCENDING)], name="idx_mesano_localnorm_fecha", background=True)
        db.sales_by_waiter_hour.create_index([("MESANO", ASCENDING), ("LOCAL", ASCENDING)], name="idx_mesano_local", background=True)
        
        logger.info("Application indexes ensured (ensure_event_indexes).")
    except Exception as e:
        logger.error(f"Error ensuring application indexes: {e}")

    # --- Índices base para colecciones de eventos ---
    event_collections = [
        "company_events",
        "token_factory_events",
        "staking_events",
        "launchpad_events",
        "token_sale_events",
        "global_meritocracy_events",
        "dao_events" # Aseguramos la del DAO
    ]

    # --- Paso previo: drop índices antiguos conflictivos por NOMBRE ---
    # Estos nombres existían con claves antiguas (p.ej. contractAddress/eventName)
    # y generan conflictos de especificación.
    old_conflicting_index_names = [
        "idx_event_block",
        "idx_contract_event_block",
        "idx_tx_log_unique",
    ]
    for cname in event_collections:
        col = db[cname]
        for idx in old_conflicting_index_names:
            try:
                col.drop_index(idx)
                logger.info(f"Dropped old index '{idx}' on '{cname}'")
            except Exception as e:
                # Silencioso si no existe
                pass

    # --- CAMBIO 1 (Solución Conflicto) ---
    # Renombramos los índices para que coincidan con los campos del V4
    # y no choquen con los índices antiguos (que usaban eventName)
    standard_indexes = {
        "idx_event_block_v4": [("event", ASCENDING), ("blockNumber", DESCENDING)],
        # Nota: el _id único ya es txhash-logindex-contract; no creamos unique duplicado.
        # Dejamos un índice no-único auxiliar sólo si quieres acelerar búsquedas por tx+log.
        "idx_tx_log_v4": [("transactionHash", ASCENDING), ("logIndex", ASCENDING)],
        "idx_contract_event_block_v4": [("contract", ASCENDING), ("event", ASCENDING), ("blockNumber", DESCENDING)],
        "idx_block_desc": [("blockNumber", DESCENDING)],
    }
    
    for cname in event_collections:
        col = db[cname]
        for idx_name, spec in standard_indexes.items():
            try:
                col.create_index(spec, name=idx_name, unique=False, background=True)
            except Exception as e:
                # Ignoramos si el índice ya existe con otro nombre (código 85)
                # o si hay conflicto de nombre (código 86)
                if e.details and e.details.get('code') in [85, 86]:
                     logger.warning(f"Index conflict (ignorable) on '{cname}': {e.details.get('errmsg')}")
                else:
                    logger.error(f"Error creating index '{idx_name}' on '{cname}': {e}")


def cleanup_event_listener_state():
    """
    Elimina checkpoints de event_listener_state que no correspondan a eventos reales
    según los contratos y ABIs actuales. Mantiene sólo _id = "<address>:<EventName>"
    donde <address> pertenece a contracts y <EventName> existe en su ABI.
    """
    try:
        allowed_ids = set()
        current_addresses = set()
        for cname, c in contracts.items():
            try:
                addr = Web3.to_checksum_address(c.address)
            except Exception:
                continue
            current_addresses.add(addr)
            if not getattr(c, 'abi', None):
                continue
            for item in c.abi:
                if item.get('type') == 'event' and item.get('name'):
                    allowed_ids.add(f"{addr}:{item['name']}")

        # Borra todo lo que no esté en allowed_ids
        if allowed_ids:
            result = db.event_listener_state.delete_many({"_id": {"$nin": list(allowed_ids)}})
            if result.deleted_count:
                logger.info(f"Cleanup: eliminados {result.deleted_count} checkpoints no reales.")
            else:
                logger.info("Cleanup: no se encontraron checkpoints para eliminar.")
        else:
            logger.warning("Cleanup: no hay contratos/ABIs válidos para validar checkpoints.")
    except Exception as e:
        logger.error(f"Error en cleanup_event_listener_state: {e}")


def seed_event_listener_state(start_block: int = 26419000) -> int:
    """
    (Sembrador)
    Declara TODOS los eventos de TODOS los contratos en event_listener_state
    con un bloque inicial y active: True.
    NO SOBREESCRIBE data existente (last_processed_block).
    AÑADE 'active: True' si el campo falta.
    """
    created = 0
    base_block = int(start_block) - 1 # Empezará a escanear EN el start_block
    operations = []
    
    try:
        logger.info(f"Seeding event_listener_state... (Default Block: {base_block})")
        for cname, c in contracts.items():
            try:
                addr = Web3.to_checksum_address(c.address)
            except Exception:
                logger.warning(f"Contrato {cname} no tiene dirección. Saltando.")
                continue
                
            for item in c.abi:
                if item.get('type') != 'event':
                    continue
                ename = item.get('name')
                if not ename:
                    continue
                
                _id = f"{addr}:{ename}"
                
                # $setOnInsert: Solo escribe si el _id es NUEVO.
                # No tocará los bloques que ya tienes procesados.
                operations.append(
                    UpdateOne(
                        {"_id": _id},
                        {
                            "$setOnInsert": {
                                "last_processed_block": base_block,
                                "active": True # ¡Se crean activos por defecto!
                            }
                        },
                        upsert=True
                    )
                )

        if not operations:
            logger.warning("No se generaron operaciones de seed.")
            return 0
            
        result = db.event_listener_state.bulk_write(operations, ordered=False)
        created = result.upserted_count
        
        if created > 0:
            logger.info(f"¡Éxito! Seeded {created} nuevos event checkpoints en block {base_block}.")
        else:
            logger.info("Checkpoints ya existen. No se crearon nuevos.")
        
        # --- CAMBIO 2 (Tu Petición) ---
        # Ahora, actualiza 'active: True' en los checkpoints que YA EXISTÍAN
        # pero no tenían el campo 'active'.
        logger.info("Verificando checkpoints existentes sin campo 'active'...")
        update_result = db.event_listener_state.update_many(
            { "active": { "$exists": False } },
            { "$set": { "active": True } }
        )
        if update_result.modified_count > 0:
            logger.info(f"Actualizados {update_result.modified_count} checkpoints existentes a 'active: True'.")
        else:
            logger.info("No se encontraron checkpoints existentes para actualizar.")
        
        # --- LIMPIEZA (solo eventos reales) ---
        cleanup_event_listener_state()
            
    except Exception as e:
        logger.error(f"Error catástrófico en seed_event_listener_state: {e}")
    return created

if __name__ == "__main__":
    # Para correr esto: python -m utils.index.index
    ensure_event_indexes()
    seed_event_listener_state()