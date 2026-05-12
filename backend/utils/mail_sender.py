"""
utils/mail_sender.py
====================
Async SMTP email sender with connection pooling.

Config via env vars:
  SMTP_HOST     — SMTP server (default: localhost)
  SMTP_PORT     — SMTP port (default: 587)
  SMTP_USER     — SMTP login user
  SMTP_PASS     — SMTP login password
  SMTP_FROM     — From address (default: noreply@lapiccolaitalia.cl)
  SMTP_TLS      — Use STARTTLS (default: true)
  SMTP_SSL      — Use SSL (default: false)

Works with: Coolify built-in SMTP, Amazon SES, Gmail, Zoho, any SMTP provider.
"""

import os
import logging
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@lapiccolaitalia.cl")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "La Piccola Italia")
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() == "true"
SMTP_SSL = os.getenv("SMTP_SSL", "false").lower() == "true"

# Pool config
MAX_CONNECTIONS = int(os.getenv("SMTP_MAX_CONNECTIONS", "3"))

_initialized = False


def _check_config():
    """Log SMTP configuration status on first use."""
    global _initialized
    if _initialized:
        return
    _initialized = True

    if not SMTP_HOST or SMTP_HOST == "localhost":
        logger.warning("[mail] ⚠️ SMTP_HOST not configured — emails will fail. Set SMTP_HOST in .env")
    else:
        logger.info(f"[mail] ✅ SMTP configured: {SMTP_HOST}:{SMTP_PORT} from={SMTP_FROM} tls={SMTP_TLS}")


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    from_addr: Optional[str] = None,
    from_name: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> dict:
    """
    Send a single email via SMTP.

    Args:
        to: Recipient email address
        subject: Email subject
        html: HTML body
        text: Plain text fallback (auto-generated if None)
        from_addr: Override sender address
        from_name: Override sender name
        reply_to: Reply-To header

    Returns:
        {"success": True} or {"success": False, "error": "..."}
    """
    _check_config()

    sender = from_addr or SMTP_FROM
    sender_name = from_name or SMTP_FROM_NAME

    # Build MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender}>"
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to

    # Plain text fallback
    if not text:
        # Strip HTML tags for plain text version
        import re
        text = re.sub(r'<[^>]+>', '', html)
        text = re.sub(r'\s+', ' ', text).strip()

    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        import aiosmtplib

        kwargs = {
            "hostname": SMTP_HOST,
            "port": SMTP_PORT,
            "timeout": 30,
        }

        if SMTP_SSL:
            kwargs["use_tls"] = True
        elif SMTP_TLS:
            kwargs["start_tls"] = True

        if SMTP_USER and SMTP_PASS:
            kwargs["username"] = SMTP_USER
            kwargs["password"] = SMTP_PASS

        await aiosmtplib.send(msg, **kwargs)

        logger.info(f"[mail] ✅ Sent to {to}: {subject[:50]}")
        return {"success": True}

    except ImportError:
        # Fallback to sync smtplib in thread pool
        logger.warning("[mail] aiosmtplib not installed — using sync smtplib fallback")
        return await _send_sync(msg, sender, to, subject)

    except Exception as e:
        logger.error(f"[mail] ❌ Failed to send to {to}: {e}")
        return {"success": False, "error": str(e)}


async def _send_sync(msg, sender: str, to: str, subject: str) -> dict:
    """Fallback: send via stdlib smtplib in thread pool."""
    import smtplib

    def _do_send():
        try:
            if SMTP_SSL:
                server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30)
            else:
                server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
                if SMTP_TLS:
                    server.starttls()

            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)

            server.sendmail(sender, [to], msg.as_string())
            server.quit()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    result = await asyncio.get_event_loop().run_in_executor(None, _do_send)
    if result["success"]:
        logger.info(f"[mail] ✅ Sent (sync) to {to}: {subject[:50]}")
    else:
        logger.error(f"[mail] ❌ Sync send failed to {to}: {result['error']}")
    return result


def render_template(html: str, variables: dict) -> str:
    """
    Simple Mustache-style template rendering.
    Replaces {{variable_name}} with values from the dict.
    """
    result = html
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", str(value))
    return result


def get_mail_config_from_db() -> Optional[dict]:
    """Try to load decrypted mail config from MongoDB. Returns None if not configured."""
    try:
        from utils.web3mongo import db
        from utils.vanellix_crypto import decrypt_sync_config as decrypt_config

        doc = db.mail_settings.find_one({"_id": "mail_config"})
        if not doc or not doc.get("encrypted_blob"):
            return None

        # Get mnemonic from first active provider
        prov = db.delivery_providers.find_one(
            {"status": "active", "dilithium_mnemonic_enc": {"$exists": True, "$ne": ""}},
            {"dilithium_mnemonic_enc": 1}
        )
        if not prov or not prov.get("dilithium_mnemonic_enc"):
            return None

        from utils.vanellix_crypto import decrypt_b2b_mnemonic
        mnemonic = decrypt_b2b_mnemonic(prov["dilithium_mnemonic_enc"])
        config = decrypt_config(doc["encrypted_blob"], mnemonic)
        logger.info(f"[mail] Using DB config: provider={config.get('provider')} host={config.get('host')}")
        return config
    except Exception as e:
        logger.warning(f"[mail] Could not load DB mail config (using env fallback): {e}")
        return None


async def send_email_with_config(
    config: dict,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> dict:
    """
    Send email using a specific config dict (from decrypted MongoDB blob).
    Supports provider types: smtp, gmail, ses, direct (MX delivery).
    """
    provider = config.get("provider", "smtp")

    # Direct MX delivery — no external SMTP needed
    if provider == "direct":
        return await _send_direct_mx(config, to, subject, html, text)

    sender = config.get("from_email", SMTP_FROM)
    sender_name = config.get("from_name", SMTP_FROM_NAME)
    host = config.get("host", SMTP_HOST)
    port = int(config.get("port", SMTP_PORT))
    user = config.get("user", "")
    password = config.get("password", "")

    pw_preview = f"{password[:3]}***{password[-2:]}" if password and len(password) > 5 else ("(set)" if password else "(empty)")
    logger.info(f"[mail] Config → host={host} user={user} pass={pw_preview} provider={config.get('provider')}")

    msg = _build_mime(sender, sender_name, to, subject, html, text)

    # Build ordered list of strategies to try
    strategies = _build_smtp_strategies(host, port, config)
    logger.info(f"[mail] Sending to {to} via {host} — {len(strategies)} strategies to try")

    import smtplib
    last_error = "No strategies available"

    for strat in strategies:
        s_host, s_port, s_mode = strat["host"], strat["port"], strat["mode"]
        logger.info(f"[mail] Trying {s_mode} → {s_host}:{s_port}")

        def _try_send(h=s_host, p=s_port, m=s_mode):
            try:
                if m == "ssl":
                    server = smtplib.SMTP_SSL(h, p, timeout=20)
                else:
                    server = smtplib.SMTP(h, p, timeout=20)
                    server.ehlo()
                    if m == "starttls":
                        server.starttls()
                        server.ehlo()
                if user and password:
                    server.login(user, password)
                server.sendmail(sender, [to], msg.as_string())
                server.quit()
                return {"success": True, "mode": m, "port": p}
            except Exception as e:
                return {"success": False, "error": str(e)}

        result = await asyncio.get_event_loop().run_in_executor(None, _try_send)
        if result["success"]:
            logger.info(f"[mail] ✅ Sent to {to}: {subject[:50]} (via {s_host}:{result['port']} {result['mode']})")
            return {"success": True}
        last_error = result["error"]
        logger.warning(f"[mail] ⚠️ {s_mode}@{s_port} failed: {last_error[:80]}")

    logger.error(f"[mail] ❌ All strategies failed for {to} via {host}: {last_error}")
    return {"success": False, "error": last_error}


def _build_smtp_strategies(host: str, port: int, config: dict) -> list:
    """
    Build ordered list of SMTP connection strategies.
    Tries configured settings first, then auto-detects.
    """
    use_tls = config.get("tls", True)
    use_ssl = config.get("ssl", False)

    strategies = []
    seen = set()

    def _add(h, p, mode):
        key = f"{h}:{p}:{mode}"
        if key not in seen:
            seen.add(key)
            strategies.append({"host": h, "port": p, "mode": mode})

    # 1. User's configured combo first
    if use_ssl:
        _add(host, port, "ssl")
    elif use_tls:
        _add(host, port, "starttls")
    else:
        _add(host, port, "plain")

    # 2. Auto-detect fallbacks
    _add(host, 587, "starttls")
    _add(host, 465, "ssl")
    _add(host, 25, "plain")
    _add(host, 587, "plain")

    return strategies


def _build_mime(sender: str, sender_name: str, to: str, subject: str, html: str, text: Optional[str] = None):
    """Build a MIME message."""
    import re
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender}>"
    msg["To"] = to
    if not text:
        text = re.sub(r'<[^>]+>', '', html)
        text = re.sub(r'\s+', ' ', text).strip()
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


# ── Direct MX Delivery ─────────────────────────────────────────
# Sends email directly to recipient's mail server via DNS MX lookup.
# No external SMTP relay needed — your server IS the sender.
# REQUIRES: SPF, DKIM, DMARC DNS records on your domain.

async def _send_direct_mx(
    config: dict,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> dict:
    """
    Deliver email directly to recipient's MX server.
    Uses dns.resolver for MX lookup + smtplib for delivery.
    """
    import smtplib
    import dns.resolver

    sender = config.get("from_email", SMTP_FROM)
    sender_name = config.get("from_name", SMTP_FROM_NAME)
    rate_per_hour = int(config.get("rate_per_hour", 50))
    rate_per_day = int(config.get("rate_per_day", 500))

    # Rate limiting via Redis
    if not _check_rate_limit(rate_per_hour, rate_per_day):
        logger.warning(f"[mail-direct] ⚠️ Rate limit reached — skipping {to}")
        return {"success": False, "error": "Rate limit alcanzado. Intenta más tarde."}

    # Extract recipient domain
    domain = to.split("@")[-1]

    # MX lookup
    try:
        mx_records = dns.resolver.resolve(domain, "MX")
        mx_host = str(sorted(mx_records, key=lambda r: r.preference)[0].exchange).rstrip(".")
    except Exception as e:
        logger.error(f"[mail-direct] ❌ MX lookup failed for {domain}: {e}")
        return {"success": False, "error": f"No se encontró servidor de correo para {domain}"}

    msg = _build_mime(sender, sender_name, to, subject, html, text)

    # Send in thread pool (smtplib is blocking)
    def _do_send():
        try:
            server = smtplib.SMTP(mx_host, 25, timeout=30)
            server.ehlo(sender.split("@")[-1])  # HELO with our domain
            # Try STARTTLS if available (best effort)
            try:
                server.starttls()
                server.ehlo(sender.split("@")[-1])
            except smtplib.SMTPNotSupportedError:
                pass  # MX server doesn't support TLS — continue without
            server.sendmail(sender, [to], msg.as_string())
            server.quit()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    result = await asyncio.get_event_loop().run_in_executor(None, _do_send)

    if result["success"]:
        _increment_rate_counter()
        logger.info(f"[mail-direct] ✅ Delivered to {to} via MX:{mx_host}")
    else:
        logger.error(f"[mail-direct] ❌ Failed to {to} via MX:{mx_host}: {result['error']}")

    return result


def _check_rate_limit(per_hour: int, per_day: int) -> bool:
    """Check Redis rate counters. Returns True if within limits."""
    try:
        from utils.redis_cache import redis_client
        hour_count = int(redis_client.get("mail:direct:hour") or 0)
        day_count = int(redis_client.get("mail:direct:day") or 0)
        return hour_count < per_hour and day_count < per_day
    except Exception:
        return True  # If Redis fails, allow sending


def _increment_rate_counter():
    """Increment hourly and daily counters in Redis."""
    try:
        from utils.redis_cache import redis_client
        pipe = redis_client.pipeline()
        pipe.incr("mail:direct:hour")
        pipe.expire("mail:direct:hour", 3600)
        pipe.incr("mail:direct:day")
        pipe.expire("mail:direct:day", 86400)
        pipe.execute()
    except Exception:
        pass

