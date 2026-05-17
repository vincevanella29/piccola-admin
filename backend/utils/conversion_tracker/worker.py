import logging
from typing import Dict, Any, List
import datetime
import os

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)

from utils.web3mongo import db

logger = logging.getLogger(__name__)
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

def run_sync() -> Dict[str, Any]:
    """
    Called by the worker engine. Fetches previous day's data from GA4
    and stores it in the local MongoDB for historical backup.
    """
    logger.info("Starting worker_conversion_analytics sync...")
    
    provider = db.conversion_tracker_providers.find_one({
        "company_id": COMPANY_ID,
        "service": "analytics",
        "is_active": True
    })
    
    if not provider:
        return {"status": "skipped", "reason": "No active Google Analytics provider found."}
        
    settings = provider.get("analytics_settings", {})
    property_id = settings.get("ga4_property_id")
    enable_backup = settings.get("enable_local_backup", False)
    
    if not enable_backup:
        return {"status": "skipped", "reason": "Local backup is disabled in provider settings."}
        
    if not property_id:
        return {"status": "error", "reason": "Google Analytics Provider missing GA4 Property ID."}
        
    credentials = provider.get("credentials", {})
    sa_path = credentials.get("service_account_path")
    if not sa_path or not os.path.exists(sa_path):
        return {"status": "error", "reason": "Google Analytics Provider missing valid service_account.json."}
        
    try:
        client = BetaAnalyticsDataClient.from_service_account_file(sa_path)
    except Exception as e:
        logger.error(f"Failed to initialize GA4 client: {e}")
        return {"status": "error", "reason": f"Failed to initialize GA4 Client: {e}"}

    # Fetch data for yesterday
    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[
            Dimension(name="unifiedScreenName"),
            Dimension(name="deviceCategory")
        ],
        metrics=[
            Metric(name="activeUsers"),
            Metric(name="screenPageViews"),
            Metric(name="eventCount")
        ],
        date_ranges=[DateRange(start_date="yesterday", end_date="yesterday")],
    )
    
    try:
        response = client.run_report(request)
        
        # Save historical snapshot
        snapshot = {
            "company_id": COMPANY_ID,
            "property_id": property_id,
            "date": datetime.date.today() - datetime.timedelta(days=1),
            "rows": [],
            "sync_time": datetime.datetime.utcnow()
        }
        
        total_rows = 0
        for row in response.rows:
            snapshot["rows"].append({
                "page": row.dimension_values[0].value,
                "device": row.dimension_values[1].value,
                "active_users": int(row.metric_values[0].value),
                "page_views": int(row.metric_values[1].value),
                "events": int(row.metric_values[2].value),
            })
            total_rows += 1
            
        # Insert into historical DB
        db.conversion_tracker_analytics_backup.insert_one(snapshot)
        
        return {
            "status": "success",
            "message": f"Saved {total_rows} rows from yesterday's GA4 data."
        }
    except Exception as e:
        logger.error(f"Error fetching GA4 report for backup: {e}")
        return {"status": "error", "reason": str(e)}

if __name__ == "__main__":
    run_sync()
