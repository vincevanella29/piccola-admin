import logging
import requests
import os
from datetime import datetime, timedelta
from dateutil.parser import parse
import calendar
import sys
from dotenv import load_dotenv
from utils.web3mongo import db

load_dotenv()

FORECAST_API_BASE_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_API_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def fetch_weather(lat, lng, start_date, end_date, api_url):
    """
    Fetches historical or forecast daily weather data from the specified Open-Meteo API for the given location and date range.
    Returns a list of daily weather dictionaries.
    """
    start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
    end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
    today = datetime.today().date()
    daily_vars = "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,rain_sum,snowfall_sum"
    
    if "archive" in api_url:
        params = {
            "latitude": lat,
            "longitude": lng,
            "start_date": start_date,
            "end_date": end_date,
            "daily": daily_vars,
            "timezone": "auto"
        }
    else:  # forecast
        past_days = min(92, max(0, (today - start_dt).days)) if start_dt < today else 0
        forecast_days = min(16, max(0, (end_dt - today).days + 1)) if end_dt >= today else 0
        params = {
            "latitude": lat,
            "longitude": lng,
            "daily": daily_vars,
            "timezone": "auto",
            "past_days": past_days,
            "forecast_days": forecast_days
        }
    
    try:
        logger.info(f"Fetching weather from {api_url} for lat={lat}, lng={lng}, from {start_date} to {end_date}")
        resp = requests.get(api_url, params=params, timeout=15)
        resp.raise_for_status()
        result = resp.json()
        logger.debug(f"Response for weather: {result}")
        if "daily" not in result:
            logger.warning(f"No daily data in response for {lat},{lng}")
            return []
        daily = result["daily"]
        dates = daily.get("time", [])
        weather_days = []
        for i in range(len(dates)):
            date_obj = parse(dates[i]).date()
            if start_dt <= date_obj <= end_dt:
                day_data = {
                    "date": date_obj,
                    "temp_max": daily["temperature_2m_max"][i],
                    "temp_min": daily["temperature_2m_min"][i],
                    "temp_mean": daily["temperature_2m_mean"][i],
                    "precipitation_sum": daily["precipitation_sum"][i],
                    "rain_sum": daily["rain_sum"][i],
                    "snowfall_sum": daily["snowfall_sum"][i]
                }
                # Handle None values (e.g., for unavailable dates)
                for key in day_data:
                    if day_data[key] is None and key != "date":
                        day_data[key] = 0.0
                weather_days.append(day_data)
        logger.info(f"Fetched {len(weather_days)} days of weather data.")
        return weather_days
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch weather for {lat},{lng}: {str(e)}")
        return []
    except ValueError as e:
        logger.error(f"Invalid JSON response for weather: {str(e)}")
        return []

def normalize_and_upsert_weather(start_date, end_date):
    logger.info(f"Processing weather data from {start_date} to {end_date}...")
    today = datetime.today().date()
    start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
    end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Full reload: delete all weather_daily docs for all locations in the date range
    delete_start = datetime.combine(start_dt, datetime.min.time())
    delete_end = datetime.combine(end_dt, datetime.max.time())
    delete_result = db.weather_daily.delete_many({
        "date": {"$gte": delete_start, "$lte": delete_end}
    })
    logger.info(f"Deleted {delete_result.deleted_count} weather_daily documents in range {start_dt} to {end_dt}.")

    locations = list(db.locations.find({}, {"_id": 1, "nombre": 1, "lat": 1, "lng": 1, "permalink_slug": 1}))
    logger.info(f"Found {len(locations)} locations in DB.")

    archive_max_end = today - timedelta(days=5)
    forecast_min_start = today - timedelta(days=92)
    forecast_max_end = today + timedelta(days=16)

    for loc in locations:
        loc_id = loc.get("_id")
        loc_name = loc.get("nombre", "Unknown")
        lat = loc.get("lat")
        lng = loc.get("lng")
        permalink_slug = loc.get("permalink_slug")
        if not lat or not lng:
            logger.warning(f"Skipping location {loc_id} ({loc_name}): Missing lat/lng.")
            continue

        all_weather_days = []
        # --- Archive API for deep past ---
        archive_start_dt = start_dt
        archive_end_dt = min(end_dt, archive_max_end)
        if archive_start_dt <= archive_end_dt:
            # Avoid overlap with forecast
            if archive_end_dt >= forecast_min_start:
                archive_end_dt = forecast_min_start - timedelta(days=1)
            if archive_start_dt <= archive_end_dt:
                archive_days = fetch_weather(lat, lng, archive_start_dt.isoformat(), archive_end_dt.isoformat(), ARCHIVE_API_BASE_URL)
                all_weather_days.extend(archive_days)

        # --- Forecast API for recent past, today, and future ---
        forecast_start_dt = max(start_dt, forecast_min_start)
        forecast_end_dt = min(end_dt, forecast_max_end)
        if forecast_start_dt <= forecast_end_dt:
            forecast_days = fetch_weather(lat, lng, forecast_start_dt.isoformat(), forecast_end_dt.isoformat(), FORECAST_API_BASE_URL)
            all_weather_days.extend(forecast_days)

        for day in all_weather_days:
            doc_id = f"{loc_id}_{day['date'].isoformat()}"
            new_doc = {
                "_id": doc_id,
                "location_id": loc_id,
                "location_name": loc_name,
                "permalink_slug": permalink_slug,
                "date": datetime(day["date"].year, day["date"].month, day["date"].day),
                "temp_max": day["temp_max"],
                "temp_min": day["temp_min"],
                "temp_mean": day["temp_mean"],
                "precipitation_sum": day["precipitation_sum"],
                "rain_sum": day["rain_sum"],
                "snowfall_sum": day["snowfall_sum"],
                "was_raining": day["rain_sum"] > 0,
                "was_snowing": day["snowfall_sum"] > 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = db.weather_daily.replace_one({"_id": doc_id}, new_doc, upsert=True)
            action = 'Updated' if result.modified_count else 'Inserted' if result.upserted_id else 'Unchanged'
            logger.info(f"Weather for location {loc_id} on {day['date']}: {action}")
    logger.info("Weather upsert operation completed successfully.")

def run_worker(period=None):
    logger.info("Starting weather data worker...")
    try:
        if period is None:
            if len(sys.argv) > 1:
                period = sys.argv[1]
            else:
                period = input("Enter period (YYYYMM or YYYY, e.g., 202508 or 2025): ")

        today = datetime.today().date()
        max_future = today + timedelta(days=16)
        # Accept YYYYMM or YYYY
        if len(period) == 6 and period.isdigit():
            # YYYYMM
            year = int(period[:4])
            month = int(period[4:])
            if not (1 <= month <= 12):
                logger.error(f"Invalid month {month} in period {period}.")
                return
            start_date = f"{year}-{month:02d}-01"
            _, last_day = calendar.monthrange(year, month)
            end_date = f"{year}-{month:02d}-{last_day:02d}"
            if year > today.year or (year == today.year and month > today.month):
                logger.error(f"Period {period} is in the future. Aborting.")
                return
            if year == today.year and month == today.month:
                end_date = max_future.isoformat()
        elif len(period) == 4 and period.isdigit():
            # YYYY
            year = int(period)
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            if year > today.year:
                logger.error(f"Year {year} is in the future. Aborting.")
                return
            if year == today.year:
                end_date = max_future.isoformat()
        else:
            logger.error(f"Invalid period format: {period}. Use YYYYMM or YYYY.")
            return
        normalize_and_upsert_weather(start_date, end_date)
        logger.info("Weather data worker finished successfully.")
    except Exception as e:
        logger.error(f"Error in weather data worker: {str(e)}")
        raise

if __name__ == "__main__":
    run_worker()