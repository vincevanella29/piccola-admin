"""
dispatch_worker.py — Background worker for delivery order lifecycle.

Two jobs running in the same loop:

1. DISPATCH RETRY (every 60s):
   - Orders with order_type='delivery', no carrier_delivery_id
   - Retries _auto_dispatch up to 5 times
   - Marks dispatch_failed=True after max retries

2. CARRIER STATUS POLL (every 90s):
   - Orders that HAVE carrier_delivery_id but are not delivered/cancelled
   - Polls the carrier API (Uber/PedidosYa/etc) for current status
   - Maps carrier status → internal status via carrier.status_mapping
   - Updates order + pushes to delivery app + broadcasts to KDS
"""
import asyncio
import logging
import httpx
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from utils.web3mongo import db

logger = logging.getLogger("uvicorn.error")

DELIVERY_COLL = db.delivery_orders
CARRIERS_COLL = db.delivery_carriers
LOCATIONS_COLL = db.locations

# ── Config ───────────────────────────────────────────────────────
DISPATCH_INTERVAL = 60             # retry unassigned every 60s
STATUS_POLL_INTERVAL = 30          # poll carrier status every 30s
MAX_RETRIES = 5
MAX_ORDER_AGE_HOURS = 12
RECOVERY_INTERVAL = 120            # recovery loop every 120s
MAX_RECOVERY_ATTEMPTS = 10

CONFIG_COLL = db.delivery_config

def _get_active_status_keys():
    """Read status pipeline from MongoDB — zero hardcoding."""
    try:
        config = CONFIG_COLL.find_one({"_id": "delivery_config"}, {"internal_statuses": 1})
        if config and config.get("internal_statuses"):
            all_keys = [s["key"] for s in config["internal_statuses"]]
            terminal = {"delivered", "cancelled"}
            return {k for k in all_keys if k not in terminal}
    except Exception:
        pass
    # Fallback if config not loaded yet
    return {"pending", "confirmed", "preparing", "ready", "dispatched"}

# Statuses where dispatch retry makes sense (no carrier_delivery_id yet)
RETRY_STATUSES = {"pending", "confirmed", "preparing", "ready"}


# =====================================================================
# Main loop
# =====================================================================

async def _dispatch_worker_loop():
    logger.info("[dispatch-worker] 🚀 Started — dispatch=%ds, status_poll=%ds", DISPATCH_INTERVAL, STATUS_POLL_INTERVAL)

    while True:
        try:
            await _process_unassigned_orders()
        except Exception as e:
            logger.error(f"[dispatch-worker] ❌ Dispatch cycle error: {e}")

        await asyncio.sleep(DISPATCH_INTERVAL)


async def _status_poll_loop():
    logger.info("[status-poll] 🚀 Started — polling every %ds", STATUS_POLL_INTERVAL)

    # Wait 30s before first poll to let startup settle
    await asyncio.sleep(30)

    while True:
        try:
            await _poll_carrier_statuses()
        except Exception as e:
            logger.error(f"[status-poll] ❌ Poll cycle error: {e}")

        await asyncio.sleep(STATUS_POLL_INTERVAL)


# =====================================================================
# Job 3: Process Scheduled Orders
# =====================================================================

async def _scheduled_dispatch_loop():
    logger.info("[scheduled-dispatch] 🚀 Started — polling every 60s")
    await asyncio.sleep(15)  # Offset to avoid running exactly at the same time as Job 1
    while True:
        try:
            await _process_scheduled_orders()
        except Exception as e:
            logger.error(f"[scheduled-dispatch] ❌ Poll cycle error: {e}")
        await asyncio.sleep(60)

async def _process_scheduled_orders():
    active_slugs = [c["slug"] for c in CARRIERS_COLL.find({"status": "active"}, {"slug": 1})]
    if not active_slugs:
        return

    # Include orders that already failed dispatch — recovery will handle them,
    # but scheduled orders whose time passed should still be attempted here
    query = {
        "order_type": "delivery",
        "status": {"$in": list(RETRY_STATUSES)},
        "carrier_delivery_id": {"$in": [None, ""]},
        "carrier_slug": {"$in": active_slugs},
        "asap": False,
        "$or": [
            # Normal scheduled: not yet failed, under retry limit
            {"dispatch_failed": {"$ne": True}, "dispatch_retries": {"$not": {"$gte": MAX_RETRIES}}},
            # Past-due failed: scheduled time already passed — force re-attempt
            {"dispatch_failed": True},
            # Carrier rejected — needs re-dispatch
            {"carrier_rejected": True},
        ],
    }

    orders = list(DELIVERY_COLL.find(query))
    if not orders:
        return

    from dateutil.parser import parse
    from utils.time_utils import get_chile_time, CHILE_TZ
    now = get_chile_time()

    ready_to_dispatch = []
    for order in orders:
        scheduled_for_str = order.get("scheduled_for")
        if not scheduled_for_str:
            continue
        try:
            scheduled_dt = parse(scheduled_for_str)
            if scheduled_dt.tzinfo is None:
                scheduled_dt = CHILE_TZ.localize(scheduled_dt)

            is_past_due = scheduled_dt <= now
            is_within_window = (scheduled_dt - now).total_seconds() <= 60 * 60
            was_failed = order.get("dispatch_failed") or order.get("carrier_rejected")

            # Dispatch if within 60min window OR if time already passed (past-due recovery)
            if is_within_window or (is_past_due and was_failed):
                ready_to_dispatch.append(order)
        except Exception:
            pass

    if not ready_to_dispatch:
        return

    logger.info(f"[scheduled-dispatch] Found {len(ready_to_dispatch)} scheduled orders ready to dispatch")

    for order in ready_to_dispatch:
        order_id = str(order["_id"])
        retries = order.get("dispatch_retries", 0)
        carrier_slug = order.get("carrier_slug", "auto")

        loc = _resolve_location(order)
        if not loc:
            continue

        logger.info(f"[scheduled-dispatch] Dispatching scheduled order {order_id} (carrier={carrier_slug}, past_failed={order.get('dispatch_failed')})")

        try:
            from apis.delivery.last_mile import create_carrier_delivery

            carrier = CARRIERS_COLL.find_one({"slug": carrier_slug, "status": "active"})
            if not carrier:
                carrier = CARRIERS_COLL.find_one({"status": "active"})
            if not carrier:
                continue

            carrier_delivery_id = await create_carrier_delivery(carrier, order, loc)

            update_now = datetime.now()
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "carrier_slug": carrier["slug"],
                    "carrier_delivery_id": carrier_delivery_id,
                    "carrier_status": "pending",
                    "dispatch_retries": retries + 1,
                    "dispatched_at": update_now,
                    "updated_at": update_now,
                    "asap": True,
                    "dispatch_failed": False,
                    "carrier_rejected": False,
                    "needs_recovery": False,
                    "dispatch_error": None,
                }}
            )
            logger.info(f"[scheduled-dispatch] ✅ Scheduled Order {order_id} dispatched → {carrier['slug']} → {carrier_delivery_id}")

            try:
                from utils.kds_ws import kds_manager
                asyncio.create_task(kds_manager.broadcast(
                    {"type": "dispatch", "order_id": order_id, "carrier_slug": carrier["slug"],
                     "carrier_delivery_id": carrier_delivery_id, "location_id": order.get("location_id")},
                    location_id=order.get("location_id"),
                ))
            except Exception:
                pass

        except Exception as e:
            err_msg = str(e)[:200]
            logger.error(f"[scheduled-dispatch] ❌ Scheduled Order {order_id} attempt {retries + 1}: {err_msg}")
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "dispatch_retries": retries + 1,
                    "last_dispatch_retry": datetime.now(),
                    "dispatch_error": err_msg,
                    "asap": True,
                    "updated_at": datetime.now(),
                }}
            )

        if retries + 1 >= MAX_RETRIES:
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {"dispatch_failed": True, "needs_recovery": True}}
            )


# =====================================================================
# Job 1: Retry dispatch for unassigned orders
# =====================================================================

async def _process_unassigned_orders():
    # Use naive datetime to match DB (stored as local time, not UTC)
    cutoff = datetime.now() - timedelta(hours=MAX_ORDER_AGE_HOURS)

    # Only retry for orders whose carrier_slug matches an active carrier in DB
    active_slugs = [c["slug"] for c in CARRIERS_COLL.find({"status": "active"}, {"slug": 1})]
    if not active_slugs:
        logger.debug("[dispatch-worker] No active carriers configured — skipping")
        return

    query = {
        "order_type": "delivery",
        "status": {"$in": list(RETRY_STATUSES)},
        "carrier_delivery_id": {"$in": [None, ""]},
        "carrier_slug": {"$in": active_slugs},
        "dispatch_retries": {"$not": {"$gte": MAX_RETRIES}},
        "dispatch_failed": {"$ne": True},
        "asap": {"$ne": False},
        "$or": [
            {"created_at": {"$gte": cutoff}},
            {"updated_at": {"$gte": cutoff}}
        ]
    }

    orders = list(DELIVERY_COLL.find(query).sort("created_at", 1).limit(20))
    if not orders:
        logger.info(f"[dispatch-worker] ♻️ No unassigned orders (carriers: {active_slugs}, cutoff: {cutoff.strftime('%H:%M')})")
        return

    logger.info(f"[dispatch-worker] Found {len(orders)} unassigned orders (carriers: {active_slugs})")

    for order in orders:
        order_id = str(order["_id"])
        retries = order.get("dispatch_retries", 0)
        carrier_slug = order.get("carrier_slug", "auto")

        loc = _resolve_location(order)
        if not loc:
            logger.warning(f"[dispatch-worker] Order {order_id}: location not found — skipping")
            continue

        logger.info(f"[dispatch-worker] Dispatching order {order_id} (attempt {retries + 1}/{MAX_RETRIES}, carrier={carrier_slug})")

        try:
            from apis.delivery.last_mile import create_carrier_delivery

            # Resolve carrier
            carrier = CARRIERS_COLL.find_one({"slug": carrier_slug, "status": "active"})
            if not carrier:
                carrier = CARRIERS_COLL.find_one({"status": "active"})
            if not carrier:
                logger.warning(f"[dispatch-worker] No active carrier for {order_id}")
                continue

            # Single path dispatch (raises on failure)
            carrier_delivery_id = await create_carrier_delivery(carrier, order, loc)

            # Success — update order
            now = datetime.now()
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "carrier_slug": carrier["slug"],
                    "carrier_delivery_id": carrier_delivery_id,
                    "carrier_status": "pending",
                    "dispatch_retries": retries + 1,
                    "dispatched_at": now,
                    "updated_at": now,
                }}
            )
            logger.info(f"[dispatch-worker] ✅ Order {order_id} dispatched → {carrier['slug']} → {carrier_delivery_id}")

            # Broadcast to KDS
            try:
                from utils.kds_ws import kds_manager
                asyncio.create_task(kds_manager.broadcast(
                    {"type": "dispatch", "order_id": order_id, "carrier_slug": carrier["slug"],
                     "carrier_delivery_id": carrier_delivery_id, "location_id": order.get("location_id")},
                    location_id=order.get("location_id"),
                ))
            except Exception:
                pass

        except Exception as e:
            err_msg = str(e)[:200]
            logger.error(f"[dispatch-worker] ❌ Order {order_id} attempt {retries + 1}: {err_msg}")
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "dispatch_retries": retries + 1,
                    "last_dispatch_retry": datetime.now(),
                    "dispatch_error": err_msg,
                }}
            )

        if retries + 1 >= MAX_RETRIES:
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {"dispatch_failed": True, "needs_recovery": True}}
            )
            logger.warning(f"[dispatch-worker] 🛑 Order {order_id} marked dispatch_failed + needs_recovery after {MAX_RETRIES} attempts")


# =====================================================================
# Job 2: Poll carrier API for status updates
# =====================================================================

async def _poll_carrier_statuses():
    """
    Find orders with carrier_delivery_id that are still active.
    Poll each carrier's get_delivery endpoint for current status.
    If status changed, update order + notify delivery app + broadcast KDS.
    """
    active_statuses = _get_active_status_keys()
    cutoff = datetime.now() - timedelta(hours=MAX_ORDER_AGE_HOURS)

    query = {
        "order_type": "delivery",
        "status": {"$in": list(active_statuses)},
        "carrier_delivery_id": {"$nin": [None, ""]},
        "created_at": {"$gte": cutoff},
    }

    orders = list(DELIVERY_COLL.find(query).sort("updated_at", 1).limit(30))
    if not orders:
        logger.info("[status-poll] ♻️ No active orders with carrier_delivery_id to poll")
        return

    # Cache carriers to avoid repeated DB lookups
    carrier_cache = {}

    changed_count = 0
    for order in orders:
        order_id = str(order["_id"])
        carrier_slug = order.get("carrier_slug", "")
        delivery_id = order.get("carrier_delivery_id", "")

        if not carrier_slug or not delivery_id:
            continue

        # Get carrier config (cached)
        if carrier_slug not in carrier_cache:
            carrier = CARRIERS_COLL.find_one({"slug": carrier_slug, "status": "active"})
            carrier_cache[carrier_slug] = carrier
        carrier = carrier_cache.get(carrier_slug)

        if not carrier:
            continue

        try:
            carrier_data = await _fetch_carrier_status(carrier, delivery_id)
            if not carrier_data:
                continue
            new_status = carrier_data.get("status", "")

            carrier_terminal = {"cancelled", "canceled", "rejected", "returned", "failed"}
            is_rejection = new_status and new_status.lower() in carrier_terminal

            if is_rejection:
                internal = order.get("status", "")
                if internal not in {"delivered", "cancelled"}:
                    DELIVERY_COLL.update_one(
                        {"_id": order["_id"]},
                        {"$set": {
                            "carrier_rejected": True,
                            "carrier_rejection_reason": new_status,
                            "carrier_delivery_id": "",
                            "carrier_status": "",
                            "needs_recovery": True,
                            "dispatch_failed": False,
                            "dispatch_retries": 0,
                            "updated_at": datetime.now(timezone.utc),
                        }}
                    )
                    logger.warning(f"[status-poll] ⚠️ Carrier rejected order {order_id} ({new_status}) — marked for recovery")
                    changed_count += 1
                    
                    try:
                        from utils.kds_ws import kds_manager
                        asyncio.create_task(kds_manager.broadcast(
                            {"type": "status_change", "order_id": order_id, "status": internal,
                             "carrier_status": "", "location_id": order.get("location_id")},
                            location_id=order.get("location_id"),
                        ))
                    except Exception:
                        pass
                    
                    continue

            status_changed = new_status and new_status != order.get("carrier_status")

            if status_changed:
                await _apply_carrier_status(order, carrier, new_status, carrier_data)
                changed_count += 1
            else:
                # Status unchanged but courier may have moved — update position
                await _update_courier_position(order, carrier_data)

            # Detect carrier acceptance: courier assigned for the first time
            courier = carrier_data.get("courier") or carrier_data.get("data", {}).get("courier")
            if courier and not order.get("carrier_accepted"):
                DELIVERY_COLL.update_one(
                    {"_id": order["_id"]},
                    {"$set": {"carrier_accepted": True, "carrier_accepted_at": datetime.now(timezone.utc)}}
                )
                logger.info(f"[status-poll] ✅ Carrier accepted order {order_id} (courier: {courier.get('name', '?')})")

        except Exception as e:
            logger.warning(f"[status-poll] Order {order_id}: poll failed — {e}")

    if changed_count:
        logger.info(f"[status-poll] Updated {changed_count}/{len(orders)} orders from carrier APIs")


async def _fetch_carrier_status(carrier, delivery_id):
    """
    Hit the carrier's get_delivery API and return the full response dict.
    Returns None on failure.
    """
    from apis.delivery.last_mile import _get_carrier_token

    auth = carrier.get("auth", {})
    base_url = carrier.get("endpoints", {}).get("base_url", "")
    slug = carrier["slug"]

    if auth.get("type") == "api_key":
        token = auth.get("api_key", "")
    else:
        token = await _get_carrier_token(carrier)

    use_bearer = auth.get("bearer_prefix", True)
    headers = {
        "Authorization": f"Bearer {token}" if use_bearer else token,
        "Content-Type": "application/json",
    }

    if slug == "pedidosya":
        url = f"{base_url}/v2/shippings/{delivery_id}"
    elif slug == "uber_direct":
        customer_id = auth.get("customer_id", "")
        url = f"{base_url}/v1/customers/{customer_id}/deliveries/{delivery_id}"
    else:
        get_endpoint = carrier.get("endpoints", {}).get("get_delivery", "")
        if not get_endpoint:
            return None
        url = f"{base_url}{get_endpoint.replace('{id}', delivery_id)}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def _apply_carrier_status(order, carrier, new_carrier_status, carrier_data=None):
    """
    Apply a new carrier status to an order. Mirrors the webhook handler logic.
    Extracts courier info from carrier_data if available.
    """
    status_mapping = carrier.get("status_mapping", {})
    internal_status = status_mapping.get(new_carrier_status)

    now = datetime.now(timezone.utc)
    update_fields = {
        "carrier_status": new_carrier_status,
        "updated_at": now,
        "last_status_poll": now,
    }

    if internal_status:
        update_fields["status"] = internal_status
        if internal_status == "delivered":
            update_fields["delivered_at"] = now

    # Extract courier info from carrier response
    if carrier_data:
        courier = carrier_data.get("courier") or carrier_data.get("data", {}).get("courier")
        if courier:
            update_fields["courier_info"] = {
                "name": courier.get("name") or courier.get("first_name", ""),
                "phone": courier.get("phone") or courier.get("phone_number", ""),
                "vehicle": courier.get("vehicle", {}).get("type", "") if isinstance(courier.get("vehicle"), dict) else courier.get("vehicle_type", ""),
                "photo_url": courier.get("img_href") or courier.get("photo_url", ""),
                "lat": courier.get("location", {}).get("lat") if isinstance(courier.get("location"), dict) else None,
                "lng": courier.get("location", {}).get("lng") if isinstance(courier.get("location"), dict) else None,
            }
        # Tracking URL (Uber Direct provides this)
        tracking_url = carrier_data.get("tracking_url")
        if tracking_url:
            update_fields["tracking_url"] = tracking_url

    DELIVERY_COLL.update_one(
        {"_id": order["_id"]},
        {"$set": update_fields}
    )

    order_id = str(order["_id"])
    logger.info(f"[status-poll] Order {order_id}: {order.get('carrier_status')} → {new_carrier_status} (internal: {internal_status or 'unchanged'})")

    # Push to delivery app (fire-and-forget)
    if internal_status:
        try:
            from apis.delivery.orders import _notify_delivery_provider
            order_updated = {**order, **update_fields}
            asyncio.create_task(_notify_delivery_provider(
                order_updated, internal_status,
                carrier_status=new_carrier_status,
                courier_info=update_fields.get("courier_info") or order.get("courier_info"),
            ))
        except Exception as e:
            logger.warning(f"[status-poll] Notify delivery failed for {order_id}: {e}")

    # Broadcast to KDS
    try:
        from utils.kds_ws import kds_manager
        asyncio.create_task(kds_manager.broadcast(
            {"type": "status_change", "order_id": order_id, "status": internal_status or order.get("status"),
             "carrier_status": new_carrier_status, "location_id": order.get("location_id")},
            location_id=order.get("location_id"),
        ))
    except Exception as e:
        logger.warning(f"[status-poll] KDS broadcast failed for {order_id}: {e}")

    # Trigger email automations
    if internal_status:
        try:
            from apis.mailing.automations import check_automations
            check_automations(order, internal_status)
        except Exception as e:
            logger.warning(f"[status-poll] Automation check failed for {order_id}: {e}")


async def _update_courier_position(order, carrier_data):
    """
    Update only courier position from carrier response (no status change).
    Called every poll cycle to keep the dispatch map showing live location.
    """
    if not carrier_data:
        return

    courier = carrier_data.get("courier") or carrier_data.get("data", {}).get("courier")
    if not courier:
        return

    lat = courier.get("location", {}).get("lat") if isinstance(courier.get("location"), dict) else None
    lng = courier.get("location", {}).get("lng") if isinstance(courier.get("location"), dict) else None

    if not lat or not lng:
        return

    order_id = str(order["_id"])
    existing_ci = order.get("courier_info") or {}

    # Only update if position actually changed
    if existing_ci.get("lat") == lat and existing_ci.get("lng") == lng:
        return

    update_fields = {
        "courier_info": {
            **existing_ci,
            "name": courier.get("name") or courier.get("first_name") or existing_ci.get("name", ""),
            "phone": courier.get("phone") or courier.get("phone_number") or existing_ci.get("phone", ""),
            "vehicle": courier.get("vehicle", {}).get("type", "") if isinstance(courier.get("vehicle"), dict) else courier.get("vehicle_type") or existing_ci.get("vehicle", ""),
            "photo_url": courier.get("img_href") or courier.get("photo_url") or existing_ci.get("photo_url", ""),
            "lat": lat,
            "lng": lng,
        },
        "updated_at": datetime.now(timezone.utc),
    }

    # Tracking URL
    tracking_url = carrier_data.get("tracking_url")
    if tracking_url:
        update_fields["tracking_url"] = tracking_url

    DELIVERY_COLL.update_one({"_id": order["_id"]}, {"$set": update_fields})
    logger.info(f"[status-poll] 📍 Courier position updated for {order_id}: ({lat:.5f}, {lng:.5f})")

    # Broadcast position to KDS so DispatchMap refreshes
    try:
        from utils.kds_ws import kds_manager
        asyncio.create_task(kds_manager.broadcast(
            {"type": "courier_position", "order_id": order_id,
             "courier_info": update_fields["courier_info"],
             "location_id": order.get("location_id")},
            location_id=order.get("location_id"),
        ))
    except Exception:
        pass


# =====================================================================
# Helpers
# =====================================================================

def _resolve_location(order):
    loc = None
    location_id = order.get("location_id")
    if location_id:
        try:
            loc = LOCATIONS_COLL.find_one({"_id": ObjectId(location_id)}) if ObjectId.is_valid(location_id) else None
        except Exception:
            pass
        if not loc:
            loc = LOCATIONS_COLL.find_one({"permalink_slug": order.get("location_slug")})
    return loc


# =====================================================================
# Entry point
# =====================================================================

# =====================================================================
# Job 4: Recovery loop for orphaned/failed/rejected orders
# =====================================================================

async def _recovery_loop():
    logger.info("[recovery] 🚀 Started — polling every %ds", RECOVERY_INTERVAL)
    await asyncio.sleep(45)  # Offset from other loops
    while True:
        try:
            await _process_recovery_orders()
        except Exception as e:
            logger.error(f"[recovery] ❌ Recovery cycle error: {e}")
        await asyncio.sleep(RECOVERY_INTERVAL)


async def _process_recovery_orders():
    """Pick up orders that are stuck: dispatch_failed, carrier_rejected, or needs_recovery.
    Reset their flags and re-attempt dispatch. After MAX_RECOVERY_ATTEMPTS, cancel."""

    active_slugs = [c["slug"] for c in CARRIERS_COLL.find({"status": "active"}, {"slug": 1})]
    if not active_slugs:
        return

    query = {
        "order_type": "delivery",
        "status": {"$in": list(RETRY_STATUSES)},
        "carrier_delivery_id": {"$in": [None, ""]},
        "$or": [
            {"dispatch_failed": True},
            {"carrier_rejected": True},
            {"needs_recovery": True},
        ],
    }

    orders = list(DELIVERY_COLL.find(query).sort("updated_at", 1).limit(15))
    if not orders:
        return

    logger.info(f"[recovery] Found {len(orders)} orders needing recovery")

    for order in orders:
        order_id = str(order["_id"])
        recovery_attempts = order.get("recovery_attempts", 0)

        # Exhausted recovery — cancel the order
        if recovery_attempts >= MAX_RECOVERY_ATTEMPTS:
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "status": "cancelled",
                    "cancel_reason": "dispatch_recovery_exhausted",
                    "needs_recovery": False,
                    "updated_at": datetime.now(),
                }}
            )
            logger.warning(f"[recovery] 🛑 Order {order_id} CANCELLED after {recovery_attempts} recovery attempts")

            # Notify delivery provider about cancellation
            try:
                from apis.delivery.orders import _notify_delivery_provider
                order_updated = {**order, "status": "cancelled"}
                asyncio.create_task(_notify_delivery_provider(order_updated, "cancelled"))
            except Exception:
                pass

            # Broadcast to KDS
            try:
                from utils.kds_ws import kds_manager
                asyncio.create_task(kds_manager.broadcast(
                    {"type": "status_change", "order_id": order_id, "status": "cancelled",
                     "cancel_reason": "dispatch_recovery_exhausted", "location_id": order.get("location_id")},
                    location_id=order.get("location_id"),
                ))
            except Exception:
                pass
            continue

        # Reset flags and re-attempt dispatch
        carrier_slug = order.get("carrier_slug", "auto")
        loc = _resolve_location(order)
        if not loc:
            logger.warning(f"[recovery] Order {order_id}: location not found — skipping")
            continue

        logger.info(f"[recovery] Re-dispatching order {order_id} (recovery attempt {recovery_attempts + 1}/{MAX_RECOVERY_ATTEMPTS})")

        try:
            from apis.delivery.last_mile import create_carrier_delivery

            carrier = CARRIERS_COLL.find_one({"slug": carrier_slug, "status": "active"})
            if not carrier:
                carrier = CARRIERS_COLL.find_one({"status": "active"})
            if not carrier:
                logger.warning(f"[recovery] No active carrier for {order_id}")
                continue

            carrier_delivery_id = await create_carrier_delivery(carrier, order, loc)

            now = datetime.now()
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "carrier_slug": carrier["slug"],
                    "carrier_delivery_id": carrier_delivery_id,
                    "carrier_status": "pending",
                    "dispatched_at": now,
                    "updated_at": now,
                    "dispatch_failed": False,
                    "carrier_rejected": False,
                    "needs_recovery": False,
                    "dispatch_retries": 0,
                    "dispatch_error": None,
                    "recovery_attempts": recovery_attempts + 1,
                    "carrier_accepted": False,
                }}
            )
            logger.info(f"[recovery] ✅ Order {order_id} recovered → {carrier['slug']} → {carrier_delivery_id}")

            try:
                from utils.kds_ws import kds_manager
                asyncio.create_task(kds_manager.broadcast(
                    {"type": "dispatch", "order_id": order_id, "carrier_slug": carrier["slug"],
                     "carrier_delivery_id": carrier_delivery_id, "location_id": order.get("location_id")},
                    location_id=order.get("location_id"),
                ))
            except Exception:
                pass

        except Exception as e:
            err_msg = str(e)[:200]
            logger.error(f"[recovery] ❌ Order {order_id} recovery attempt {recovery_attempts + 1}: {err_msg}")
            DELIVERY_COLL.update_one(
                {"_id": order["_id"]},
                {"$set": {
                    "recovery_attempts": recovery_attempts + 1,
                    "dispatch_error": err_msg,
                    "updated_at": datetime.now(),
                }}
            )


def start_dispatch_worker():
    """
    Start all background tasks. Call from async lifespan startup.
    Uses ensure_future which works in Python 3.9 within a running loop.
    """
    asyncio.ensure_future(_dispatch_worker_loop())
    asyncio.ensure_future(_status_poll_loop())
    asyncio.ensure_future(_scheduled_dispatch_loop())
    asyncio.ensure_future(_recovery_loop())
    logger.info("[dispatch-worker] ✅ Background tasks scheduled (dispatch + status poll + scheduled + recovery)")
