import os
import requests
import logging
from dotenv import load_dotenv

# Carga el .env al importar el archivo
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

drip_logger = logging.getLogger("drip_api")


def update_drip_burn(email: str, burn_data: dict) -> dict:
    """
    Actualiza el campo custom de Drip con el total de tokens quemados para el usuario.
    burn_data: { symbol: amount, ... }
    """
    DRIP_API_KEY = os.getenv("DRIP_API_KEY")
    DRIP_ACCOUNT_ID = os.getenv("DRIP_ACCOUNT_ID")
    DRIP_API_BASE = "https://api.getdrip.com/v2"

    """
    Actualiza el campo custom de Drip con el total de tokens quemados para el usuario.
    burn_data: { token_address: str, amount: str (decimal string), ... }
    """
    if not DRIP_API_KEY or not DRIP_ACCOUNT_ID:
        drip_logger.error("Drip API config missing!")
        return {"error": "Drip API config missing"}
    if not email:
        drip_logger.error("Email is required for Drip update!")
        return {"error": "Email is required"}

    url = f"{DRIP_API_BASE}/{DRIP_ACCOUNT_ID}/subscribers"
    results = {}
    for symbol, amount in burn_data.items():
        field_name = f"{symbol}_token_burn"
        payload = {
            "subscribers": [
                {
                    "email": email,
                    "custom_fields": {field_name: amount}
                }
            ]
        }
        try:
            resp = requests.post(url, json=payload, auth=(DRIP_API_KEY, ''))
            results[field_name] = {"status": resp.status_code, "resp": resp.text}
        except Exception as e:
            drip_logger.error(f"[Drip] Exception updating burn for {email}, field {field_name}: {e}")
            results[field_name] = {"error": str(e)}
    return results


def update_drip_custom_fields(email: str, custom_fields: dict) -> dict:
    """
    Actualiza campos custom arbitrarios de Drip para el usuario.
    custom_fields: { campo: valor, ... }
    Cada campo se actualiza en un request separado para evitar errores de Drip.
    """
    DRIP_API_KEY = os.getenv("DRIP_API_KEY")
    DRIP_ACCOUNT_ID = os.getenv("DRIP_ACCOUNT_ID")
    DRIP_API_BASE = "https://api.getdrip.com/v2"
    if not DRIP_API_KEY or not DRIP_ACCOUNT_ID:
        drip_logger.error("Drip API config missing!")
        return {"error": "Drip API config missing"}
    if not email:
        drip_logger.error("Email is required for Drip update!")
        return {"error": "Email is required"}
    url = f"{DRIP_API_BASE}/{DRIP_ACCOUNT_ID}/subscribers"
    results = {}
    for field, value in custom_fields.items():
        payload = {
            "subscribers": [
                {
                    "email": email,
                    "custom_fields": {field: value}
                }
            ]
        }
        try:
            resp = requests.post(url, json=payload, auth=(DRIP_API_KEY, ''))
            results[field] = {"status": resp.status_code, "resp": resp.text}
        except Exception as e:
            drip_logger.error(f"[Drip] Exception updating custom field {field} for {email}: {e}")
            results[field] = {"error": str(e)}
    return results
