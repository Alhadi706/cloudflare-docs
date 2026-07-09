"""
Open-Meteo Weather Adapter — real weather data, free API.
يُستخدم لحساب Context (موسم + رطوبة) من بيانات حقيقية.
"""
import requests
from datetime import date, timedelta
from typing import Optional
import time


OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"


def fetch_weather_history(
    lat: float,
    lon: float,
    start_date: date,
    end_date: date,
    retries: int = 3,
) -> Optional[dict]:
    """
    جلب بيانات الطقس التاريخية من Open-Meteo.
    Returns dict with 'daily' data: time, temperature_2m_mean, precipitation_sum
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": ["temperature_2m_mean", "precipitation_sum"],
        "timezone": "Africa/Tripoli",
    }

    for attempt in range(retries):
        try:
            resp = requests.get(OPEN_METEO_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if "daily" not in data:
                return None
            return data["daily"]
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"[WeatherAdapter] Failed after {retries} retries: {e}")
                return None
    return None


def compute_30d_precipitation(daily_data: dict, target_date: date) -> float:
    """
    حساب مجموع الهطول في آخر 30 يومًا قبل target_date.
    """
    if not daily_data:
        return 0.0

    times = daily_data.get("time", [])
    precip = daily_data.get("precipitation_sum", [])

    window_start = target_date - timedelta(days=30)
    total = 0.0
    for t_str, p in zip(times, precip):
        if p is None:
            continue
        t = date.fromisoformat(t_str)
        if window_start <= t < target_date:
            total += p
    return total


def compute_monthly_avg_temp(daily_data: dict, target_date: date) -> float:
    """
    حساب متوسط درجة الحرارة في الشهر الذي يقع فيه target_date.
    """
    if not daily_data:
        return 25.0  # default fallback

    times = daily_data.get("time", [])
    temps = daily_data.get("temperature_2m_mean", [])

    month_temps = []
    for t_str, temp in zip(times, temps):
        if temp is None:
            continue
        t = date.fromisoformat(t_str)
        if t.year == target_date.year and t.month == target_date.month:
            month_temps.append(temp)

    return sum(month_temps) / len(month_temps) if month_temps else 25.0
