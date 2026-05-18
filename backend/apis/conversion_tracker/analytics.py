from fastapi import APIRouter, Depends, HTTPException, Query
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    Dimension,
    Metric,
    RunRealtimeReportRequest,
    RunReportRequest,
    DateRange,
)

from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db

router = APIRouter()
logger = logging.getLogger(__name__)

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# ─── Response Models ──────────────────────────────────────────────
class RealtimeRow(BaseModel):
    page: str
    active_users: int

class CountryRow(BaseModel):
    country: str
    active_users: int

class DeviceRow(BaseModel):
    category: str
    active_users: int

class SourceRow(BaseModel):
    source: str
    medium: str
    active_users: int

class LocationRow(BaseModel):
    city: str
    country: str
    active_users: int

class EventRow(BaseModel):
    event_name: str
    active_users: int

class RealtimeResponse(BaseModel):
    provider_id: str
    provider_name: str
    property_id: str
    total_active_users: int
    pages: List[RealtimeRow]
    countries: List[CountryRow]
    devices: List[DeviceRow]
    sources: List[SourceRow]
    locations: List[LocationRow]
    events: List[EventRow]

class AnalyticsProviderInfo(BaseModel):
    id: str
    name: str
    property_id: str
    assigned_providers: List[str]


# ─── Helpers ──────────────────────────────────────────────────────
def get_ga4_provider_by_id(provider_id: str):
    """Find a specific analytics provider by ID."""
    provider = db.conversion_tracker_providers.find_one({
        "company_id": COMPANY_ID,
        "service": "analytics",
        "id": provider_id,
    })
    if not provider:
        raise HTTPException(status_code=404, detail=f"Analytics provider '{provider_id}' not found.")
    return provider

def get_ga4_client_from_provider(provider: dict):
    """Initialize a GA4 client from provider credentials."""
    pid = provider.get("id", "?")
    pname = provider.get("name", "?")
    
    settings = provider.get("analytics_settings", {})
    property_id = settings.get("ga4_property_id")
    if not property_id:
        logger.warning(f"[GA4] ⚠️  Provider '{pname}' ({pid}) missing ga4_property_id in analytics_settings")
        raise HTTPException(status_code=400, detail="Provider missing GA4 Property ID in analytics_settings.")
    
    credentials = provider.get("credentials", {})
    sa_info = credentials.get("service_account")
    sa_path = credentials.get("service_account_path")
    
    if sa_info and isinstance(sa_info, dict):
        try:
            client = BetaAnalyticsDataClient.from_service_account_info(sa_info)
            logger.info(f"[GA4] ✅ Client initialized for '{pname}' from embedded JSON — property={property_id}")
            return client, property_id
        except Exception as e:
            logger.error(f"[GA4] ❌ Failed to initialize client for '{pname}' ({pid}) from embedded JSON: {e}")
            raise HTTPException(status_code=500, detail="Failed to initialize GA4 Client from JSON info.")

    if not sa_path:
        logger.warning(f"[GA4] ⚠️  Provider '{pname}' ({pid}) has no service_account object or path — upload service_account.json first")
        raise HTTPException(status_code=400, detail="Provider missing service_account.json — upload it in the Providers tab.")
        
    if not os.path.exists(sa_path):
        logger.warning(f"[GA4] ⚠️  Provider '{pname}' ({pid}) service_account file not found at: {sa_path}")
        raise HTTPException(status_code=400, detail=f"service_account.json file not found at path: {sa_path}")
    
    try:
        client = BetaAnalyticsDataClient.from_service_account_file(sa_path)
        logger.info(f"[GA4] ✅ Client initialized for '{pname}' from file — property={property_id}")
        return client, property_id
    except Exception as e:
        logger.error(f"[GA4] ❌ Failed to initialize client for '{pname}' ({pid}) from file: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize GA4 Client from file.")


def get_first_active_ga4_provider():
    """Legacy: get the first active analytics provider."""
    provider = db.conversion_tracker_providers.find_one({
        "company_id": COMPANY_ID,
        "service": "analytics",
        "is_active": True
    })
    if not provider:
        raise HTTPException(status_code=404, detail="No active Google Analytics provider found.")
    return provider


# ─── Endpoints ────────────────────────────────────────────────────

@router.get("/conversion_tracker/analytics/providers", response_model=List[AnalyticsProviderInfo])
async def list_analytics_providers(user: dict = Depends(verify_session)):
    """List all GA4 analytics providers with their property IDs."""
    require_admin_level(user, "admin")
    
    providers = list(db.conversion_tracker_providers.find({
        "company_id": COMPANY_ID,
        "service": "analytics",
    }))
    
    result = []
    for p in providers:
        settings = p.get("analytics_settings", {})
        prop_id = settings.get("ga4_property_id", "")
        result.append(AnalyticsProviderInfo(
            id=p.get("id", ""),
            name=p.get("name", "Analytics"),
            property_id=prop_id,
            assigned_providers=p.get("assigned_providers", []),
        ))
    
    return result


@router.get("/conversion_tracker/analytics/realtime", response_model=RealtimeResponse)
async def get_realtime_analytics(
    provider_id: Optional[str] = Query(None, description="Specific analytics provider ID"),
    user: dict = Depends(verify_session),
):
    """
    Get real-time analytics from GA4 Data API.
    If provider_id is specified, use that provider. Otherwise, use the first active one.
    Returns: active users, top pages, countries, devices, and traffic sources.
    """
    require_admin_level(user, "admin")
    
    if provider_id:
        provider = get_ga4_provider_by_id(provider_id)
    else:
        provider = get_first_active_ga4_provider()
    
    client, property_id = get_ga4_client_from_provider(provider)
    
    try:
        # ─── Pages Report ────────────────────────────────────
        pages_request = RunRealtimeReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="unifiedScreenName")],
            metrics=[Metric(name="activeUsers")],
        )
        pages_response = client.run_realtime_report(pages_request)
        
        pages = []
        total_users = 0
        for row in pages_response.rows:
            page = row.dimension_values[0].value
            try:
                users = int(row.metric_values[0].value)
            except ValueError:
                users = 0
            total_users += users
            if page == "(not set)":
                page = "Unknown Page"
            pages.append(RealtimeRow(page=page, active_users=users))
        pages.sort(key=lambda x: x.active_users, reverse=True)
        
        # ─── Countries Report ────────────────────────────────
        countries = []
        try:
            countries_request = RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                dimensions=[Dimension(name="country")],
                metrics=[Metric(name="activeUsers")],
            )
            countries_response = client.run_realtime_report(countries_request)
            for row in countries_response.rows:
                country = row.dimension_values[0].value
                try:
                    users = int(row.metric_values[0].value)
                except ValueError:
                    users = 0
                if country and country != "(not set)":
                    countries.append(CountryRow(country=country, active_users=users))
            countries.sort(key=lambda x: x.active_users, reverse=True)
        except Exception as e:
            logger.warning(f"Failed to fetch countries: {e}")
        
        # ─── Devices Report ──────────────────────────────────
        devices = []
        try:
            devices_request = RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                dimensions=[Dimension(name="deviceCategory")],
                metrics=[Metric(name="activeUsers")],
            )
            devices_response = client.run_realtime_report(devices_request)
            for row in devices_response.rows:
                category = row.dimension_values[0].value
                try:
                    users = int(row.metric_values[0].value)
                except ValueError:
                    users = 0
                if category and category != "(not set)":
                    devices.append(DeviceRow(category=category, active_users=users))
            devices.sort(key=lambda x: x.active_users, reverse=True)
        except Exception as e:
            logger.warning(f"Failed to fetch devices: {e}")
        
        # ─── Traffic Sources Report ──────────────────────────
        sources = []
        try:
            sources_request = RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                dimensions=[
                    Dimension(name="source"),
                    Dimension(name="medium"),
                ],
                metrics=[Metric(name="activeUsers")],
            )
            sources_response = client.run_realtime_report(sources_request)
            for row in sources_response.rows:
                source = row.dimension_values[0].value or "(direct)"
                medium = row.dimension_values[1].value or "(none)"
                try:
                    users = int(row.metric_values[0].value)
                except ValueError:
                    users = 0
                sources.append(SourceRow(source=source, medium=medium, active_users=users))
            sources.sort(key=lambda x: x.active_users, reverse=True)
        except Exception as e:
            logger.warning(f"Failed to fetch sources: {e}")
        
        # ─── Locations Report (City + Country) ───────────────
        locations = []
        try:
            locs_request = RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                dimensions=[Dimension(name="city"), Dimension(name="country")],
                metrics=[Metric(name="activeUsers")],
            )
            locs_response = client.run_realtime_report(locs_request)
            for row in locs_response.rows:
                city = row.dimension_values[0].value or "(not set)"
                country = row.dimension_values[1].value or "(not set)"
                try:
                    users = int(row.metric_values[0].value)
                except ValueError:
                    users = 0
                if city != "(not set)":
                    locations.append(LocationRow(city=city, country=country, active_users=users))
            locations.sort(key=lambda x: x.active_users, reverse=True)
        except Exception as e:
            logger.warning(f"Failed to fetch locations: {e}")

        # ─── Events Report ───────────────────────────────────
        events = []
        try:
            events_request = RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                dimensions=[Dimension(name="eventName")],
                metrics=[Metric(name="eventCount")],
            )
            events_response = client.run_realtime_report(events_request)
            for row in events_response.rows:
                event_name = row.dimension_values[0].value
                try:
                    count = int(row.metric_values[0].value)
                except ValueError:
                    count = 0
                events.append(EventRow(event_name=event_name, active_users=count))
            events.sort(key=lambda x: x.active_users, reverse=True)
        except Exception as e:
            logger.warning(f"Failed to fetch events: {e}")

        return RealtimeResponse(
            provider_id=provider.get("id", ""),
            provider_name=provider.get("name", "Analytics"),
            property_id=property_id,
            total_active_users=total_users,
            pages=pages,
            countries=countries,
            devices=devices,
            sources=sources,
            locations=locations,
            events=events,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching GA4 realtime report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Historical Models & Endpoints ─────────────────────────────────

class HistoricalRow(BaseModel):
    dimension: str
    active_users: int

class HistoricalResponse(BaseModel):
    provider_id: str
    provider_name: str
    property_id: str
    users_by_date: List[HistoricalRow]
    users_by_source: List[HistoricalRow]

@router.get("/conversion_tracker/analytics/historical", response_model=HistoricalResponse)
async def get_historical_analytics(
    provider_id: str = Query(..., description="The ID of the GA4 provider to query"),
    days: int = Query(7, description="Number of days to look back"),
    user: dict = Depends(verify_session)
):
    """Fetch historical data from GA4."""
    require_admin_level(user, "admin")
    provider = get_ga4_provider_by_id(provider_id)
    client, property_id = get_ga4_client_from_provider(provider)

    try:
        # Users by date
        date_request = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="date")],
            metrics=[Metric(name="activeUsers")],
            date_ranges=[DateRange(start_date=f"{days}daysAgo", end_date="today")],
        )
        date_response = client.run_report(date_request)
        
        users_by_date = []
        for row in date_response.rows:
            date_val = row.dimension_values[0].value
            try:
                users = int(row.metric_values[0].value)
            except ValueError:
                users = 0
            users_by_date.append(HistoricalRow(dimension=date_val, active_users=users))
        users_by_date.sort(key=lambda x: x.dimension)
        
        # Users by source
        source_request = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name="sessionSource")],
            metrics=[Metric(name="activeUsers")],
            date_ranges=[DateRange(start_date=f"{days}daysAgo", end_date="today")],
        )
        source_response = client.run_report(source_request)
        
        users_by_source = []
        for row in source_response.rows:
            source_val = row.dimension_values[0].value or "(direct)"
            try:
                users = int(row.metric_values[0].value)
            except ValueError:
                users = 0
            users_by_source.append(HistoricalRow(dimension=source_val, active_users=users))
        users_by_source.sort(key=lambda x: x.active_users, reverse=True)

        return HistoricalResponse(
            provider_id=provider_id,
            provider_name=provider.get("name", "Analytics"),
            property_id=property_id,
            users_by_date=users_by_date,
            users_by_source=users_by_source
        )
    except Exception as e:
        logger.error(f"Error fetching GA4 historical report: {e}")
        raise HTTPException(status_code=500, detail=str(e))
