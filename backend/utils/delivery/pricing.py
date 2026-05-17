def _apply_platform_fee(carrier_fee: float, fee_config: dict, order_total: float = 0) -> dict:
    """Apply platform markup on top of carrier fee."""
    fee_type = fee_config.get("type", "none")
    value = fee_config.get("value", 0)

    # Check free delivery threshold
    free_above = fee_config.get("free_above", 0)
    if free_above and order_total >= free_above:
        return {"carrier_fee": carrier_fee, "platform_fee": 0, "total_fee": 0}

    if fee_type == "percentage":
        platform_fee = round(carrier_fee * value / 100)
    elif fee_type == "fixed":
        platform_fee = round(value)
    else:
        platform_fee = 0

    total = carrier_fee + platform_fee

    # Apply min/max caps
    min_fee = fee_config.get("min_fee", 0)
    max_fee = fee_config.get("max_fee", 0)
    if min_fee and total < min_fee:
        total = min_fee
        platform_fee = total - carrier_fee
    if max_fee and total > max_fee:
        total = max_fee
        platform_fee = total - carrier_fee

    return {
        "carrier_fee": round(carrier_fee),
        "platform_fee": round(max(0, platform_fee)),
        "total_fee": round(max(0, total)),
    }
