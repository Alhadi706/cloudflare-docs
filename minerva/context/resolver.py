"""
Context Resolver — يُحوِّل بيانات الطقس + ERP إلى 4-dimensional Context.
ADR-003: 4 أبعاد × 3 قيم = 27 خلية.
"""
from datetime import date, timedelta
from typing import Optional
from minerva.config import SEASON_THRESHOLDS, MOISTURE_THRESHOLDS_MM_30D


def resolve_season(avg_temp_c: float, precip_mm_monthly: float) -> str:
    """
    البعد الأول: الموسم الحراري.
    """
    if avg_temp_c >= SEASON_THRESHOLDS["HOT_DRY"]["min_temp"] and \
       precip_mm_monthly <= SEASON_THRESHOLDS["HOT_DRY"]["max_precip_monthly"]:
        return "HOT_DRY"
    elif avg_temp_c >= SEASON_THRESHOLDS["MILD_DRY"]["min_temp"] and \
         precip_mm_monthly <= SEASON_THRESHOLDS["MILD_DRY"]["max_precip_monthly"]:
        return "MILD_DRY"
    else:
        return "COOL_WET"


def resolve_moisture(precip_30d_mm: float) -> str:
    """
    البعد الثاني: حالة الرطوبة الأخيرة.
    """
    if precip_30d_mm < MOISTURE_THRESHOLDS_MM_30D["DRY"]:
        return "DRY"
    elif precip_30d_mm <= MOISTURE_THRESHOLDS_MM_30D["MOIST"]:
        return "MOIST"
    else:
        return "WET"


def resolve_ops(
    last_maintenance_date: Optional[date],
    construction_nearby: bool,
    target_date: date,
) -> str:
    """
    البعد الثالث: الحالة التشغيلية.
    """
    if construction_nearby:
        return "NEAR_ACTIVITY"
    if last_maintenance_date and (target_date - last_maintenance_date).days <= 60:
        return "POST_MAINT"
    return "NORMAL"


def resolve_vicinity(
    irrigation_active: bool,
    heavy_machinery_nearby: bool,
) -> str:
    """
    البعد الرابع: حالة المنطقة المحيطة.
    """
    if irrigation_active:
        return "IRRIGATION_ACTIVE"
    if heavy_machinery_nearby:
        return "HIGH_TRAFFIC"
    return "NORMAL"


class ContextResolver:
    """
    يحل الـ Context لأي تاريخ بناءً على بيانات الطقس والتشغيل.
    """

    def __init__(self, daily_weather: Optional[dict] = None):
        """
        daily_weather: ناتج weather adapter (dict with 'time', 'temperature_2m_mean', 'precipitation_sum')
        """
        self.daily_weather = daily_weather or {}
        self._weather_index: dict[date, dict] = {}
        self._build_index()

    def _build_index(self):
        times = self.daily_weather.get("time", [])
        temps = self.daily_weather.get("temperature_2m_mean", [])
        precips = self.daily_weather.get("precipitation_sum", [])

        for t_str, temp, precip in zip(times, temps, precips):
            d = date.fromisoformat(t_str)
            self._weather_index[d] = {
                "temp": temp or 25.0,
                "precip": precip or 0.0,
            }

    def get_30d_precip(self, target_date: date) -> float:
        total = 0.0
        for delta in range(1, 31):
            d = target_date - timedelta(days=delta)
            total += self._weather_index.get(d, {}).get("precip", 0.0)
        return total

    def get_monthly_avg_temp(self, target_date: date) -> float:
        temps = []
        for d, v in self._weather_index.items():
            if d.year == target_date.year and d.month == target_date.month:
                temps.append(v["temp"])
        return sum(temps) / len(temps) if temps else 25.0

    def get_monthly_precip(self, target_date: date) -> float:
        total = 0.0
        for d, v in self._weather_index.items():
            if d.year == target_date.year and d.month == target_date.month:
                total += v["precip"]
        return total

    def resolve(
        self,
        target_date: date,
        last_maintenance_date: Optional[date] = None,
        construction_nearby: bool = False,
        irrigation_active: bool = False,
        heavy_machinery_nearby: bool = False,
    ) -> tuple[str, str, str, str]:
        """
        يُعيد (season, moisture, ops, vicinity) للتاريخ المعطى.
        """
        avg_temp = self.get_monthly_avg_temp(target_date)
        monthly_precip = self.get_monthly_precip(target_date)
        precip_30d = self.get_30d_precip(target_date)

        season = resolve_season(avg_temp, monthly_precip)
        moisture = resolve_moisture(precip_30d)
        ops = resolve_ops(last_maintenance_date, construction_nearby, target_date)
        vicinity = resolve_vicinity(irrigation_active, heavy_machinery_nearby)

        return (season, moisture, ops, vicinity)

    def resolve_series(
        self,
        dates: list[date],
        maintenance_periods: Optional[list[tuple[date, date]]] = None,
        irrigation_periods: Optional[list[tuple[date, date]]] = None,
    ) -> dict[date, tuple]:
        """
        يحل الـ Context لسلسلة زمنية كاملة.
        maintenance_periods: قائمة من (start, end) تواريخ الصيانة
        irrigation_periods: قائمة من (start, end) تواريخ الري
        """
        result = {}

        def in_period(d: date, periods: Optional[list]) -> bool:
            if not periods:
                return False
            return any(s <= d <= e for s, e in periods)

        for d in dates:
            # آخر تاريخ صيانة قبل هذا التاريخ
            last_maint = None
            if maintenance_periods:
                past_maints = [e for s, e in maintenance_periods if s <= d]
                if past_maints:
                    last_maint = max(past_maints)

            irrigation = in_period(d, irrigation_periods)
            ctx = self.resolve(
                target_date=d,
                last_maintenance_date=last_maint,
                irrigation_active=irrigation,
            )
            result[d] = ctx

        return result
