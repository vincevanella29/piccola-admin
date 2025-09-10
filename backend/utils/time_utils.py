from datetime import datetime
import pytz

# Set Chile timezone
CHILE_TZ = pytz.timezone('America/Santiago')

def get_chile_time() -> datetime:
    """Get current time in Chile timezone"""
    return datetime.now(CHILE_TZ)

def to_chile_time(dt: datetime) -> datetime:
    """Convert a datetime to Chile timezone"""
    if dt.tzinfo is None:
        # If datetime is naive, assume it's in UTC
        dt = pytz.utc.localize(dt)
    return dt.astimezone(CHILE_TZ)

def format_chile_time(dt: datetime, format_str: str = '%Y-%m-%d %H:%M:%S %Z') -> str:
    """Format a datetime in Chile timezone"""
    return to_chile_time(dt).strftime(format_str)
