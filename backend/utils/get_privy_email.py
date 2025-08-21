import requests
import base64
import os
import logging
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Load .env file from the backend directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
logger.info(f"Loading .env file from: {env_path}")
load_dotenv(env_path)

def get_email_from_privy(sub: str):
    PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")
    PRIVY_APP_SECRET = os.getenv("PRIVY_API_SECRET")
    PRIVY_API_BASE = "https://auth.privy.io/api/v1"
    
    # Log environment variables for debugging
    logger.debug(f"PRIVY_APP_ID: {PRIVY_APP_ID}")
    logger.debug(f"PRIVY_APP_SECRET: {PRIVY_APP_SECRET[:4] if PRIVY_APP_SECRET else None}...{PRIVY_APP_SECRET[-4:] if PRIVY_APP_SECRET else None}")
    
    if not PRIVY_APP_ID or not PRIVY_APP_SECRET:
        logger.error(f"PRIVY_APP_ID or PRIVY_APP_SECRET not set: PRIVY_APP_ID={PRIVY_APP_ID}, PRIVY_APP_SECRET={PRIVY_APP_SECRET}")
        return None
    
    # Replicate cURL's Basic Auth
    credentials = f"{PRIVY_APP_ID}:{PRIVY_APP_SECRET}"
    b64_credentials = base64.b64encode(credentials.encode()).decode()
    headers = {
        "Authorization": f"Basic {b64_credentials}",
        "Content-Type": "application/json",
        "privy-app-id": PRIVY_APP_ID
    }
    url = f"{PRIVY_API_BASE}/users/{sub}"
    
    try:
        logger.debug(f"Sending Privy API request: URL={url}, Headers={headers}")
        resp = requests.get(url, headers=headers, timeout=8)
        logger.debug(f"Privy response: status={resp.status_code}, body={resp.text}")
        
        if resp.status_code != 200:
            logger.error(f"Privy API error: status={resp.status_code}, body={resp.text}")
            return None
        
        data = resp.json()
        logger.info(f"Privy response: {data}")
        emails = []
        fuentes = []
        if data.get("email"):
            emails.append(data["email"])
            fuentes.append("raiz:email")
        if "emails" in data and isinstance(data["emails"], list):
            for e in data["emails"]:
                if e and e not in emails:
                    emails.append(e)
                    fuentes.append("raiz:emails[]")
        if "linked_accounts" in data:
            for acc in data["linked_accounts"]:
                # Google and other OAuth
                if acc.get("email") and acc["email"] not in emails:
                    emails.append(acc["email"])
                    fuentes.append(f"linked_accounts:{acc.get('type')}")
                # Email/password users (classic)
                if acc.get("type") == "email" and acc.get("address") and acc["address"] not in emails:
                    emails.append(acc["address"])
                    fuentes.append("linked_accounts:email(address)")
        
        logger.info(f"Emails encontrados para sub {sub}: {emails} | fuentes: {fuentes}")
        if not emails:
            logger.warning(f"No email found for sub {sub}. Full response: {data}")
            return None
        
        return emails[0]
    
    except Exception as e:
        logger.error(f"Error querying Privy for sub {sub}: {e}")
        return None

if __name__ == "__main__":
    # Test with the known user ID from the cURL command
    sub = "did:privy:cmdai66rh00del80njxqq3wl7"
    email = get_email_from_privy(sub)
    print(f"Email for {sub}: {email}")