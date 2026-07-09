"""
Synthetic Satellite Data Generator.
يُنشئ بيانات واقعية الفيزياء لاختبار الخوارزميات.

النموذج الفيزيائي:
  NDMI = base_mean(context) + seasonal_component + noise + [leak_effect]
  LST  = base_mean(context) - 4 × NDMI_anomaly + noise
  SAR  = base_mean(context) - 3 × NDMI_anomaly + noise  (رطوبة تُقلل الـ backscatter)
  NDVI = base_mean(context) + [delayed vegetation response to moisture]

الـ context يغير الـ base_mean — هذا هو جوهر الـ Conditional Baseline.
"""
import numpy as np
from datetime import date, timedelta
from typing import Optional
import pandas as pd

# ستروكتشر لتعريف حدث مُحقَن
from dataclasses import dataclass


@dataclass
class InjectedEvent:
    event_type: str
    start_date: date
    end_date: date
    magnitude: float = 1.0    # ضعف التأثير


# =============================================================================
# Context-dependent base values (ARID biome, WATER_PIPELINE)
# =============================================================================
# الري الزراعي في المناطق الجافة يرفع NDMI من 0.04 إلى 0.16-0.18 بشكل حقيقي
# (مياه الري = نفس تأثير التسرب لكن أوسع مساحةً وأكثر تنبؤًا)

# NDMI base values per context cell
NDMI_BASE = {
    ("HOT_DRY",  "DRY",   "NORMAL",      "NORMAL"):            0.040,
    ("HOT_DRY",  "DRY",   "NORMAL",      "IRRIGATION_ACTIVE"): 0.165,  # ري صيفي مكثف
    ("HOT_DRY",  "DRY",   "POST_MAINT",  "NORMAL"):            0.075,
    ("HOT_DRY",  "MOIST", "NORMAL",      "NORMAL"):            0.070,
    ("HOT_DRY",  "WET",   "NORMAL",      "NORMAL"):            0.110,
    ("MILD_DRY", "DRY",   "NORMAL",      "NORMAL"):            0.050,
    ("MILD_DRY", "DRY",   "NORMAL",      "IRRIGATION_ACTIVE"): 0.145,  # ري ربيعي مكثف
    ("MILD_DRY", "MOIST", "NORMAL",      "NORMAL"):            0.080,
    ("MILD_DRY", "WET",   "NORMAL",      "NORMAL"):            0.130,
    ("COOL_WET", "DRY",   "NORMAL",      "NORMAL"):            0.060,
    ("COOL_WET", "MOIST", "NORMAL",      "NORMAL"):            0.100,
    ("COOL_WET", "WET",   "NORMAL",      "NORMAL"):            0.160,
}

# LST base values per context (inverse of NDMI roughly)
LST_BASE = {
    ("HOT_DRY",  "DRY",   "NORMAL",      "NORMAL"):            42.0,
    ("HOT_DRY",  "DRY",   "NORMAL",      "IRRIGATION_ACTIVE"): 38.5,
    ("HOT_DRY",  "DRY",   "POST_MAINT",  "NORMAL"):            40.0,
    ("HOT_DRY",  "MOIST", "NORMAL",      "NORMAL"):            39.0,
    ("HOT_DRY",  "WET",   "NORMAL",      "NORMAL"):            36.0,
    ("MILD_DRY", "DRY",   "NORMAL",      "NORMAL"):            32.0,
    ("MILD_DRY", "DRY",   "NORMAL",      "IRRIGATION_ACTIVE"): 29.0,
    ("MILD_DRY", "MOIST", "NORMAL",      "NORMAL"):            30.0,
    ("MILD_DRY", "WET",   "NORMAL",      "NORMAL"):            27.0,
    ("COOL_WET", "DRY",   "NORMAL",      "NORMAL"):            22.0,
    ("COOL_WET", "MOIST", "NORMAL",      "NORMAL"):            20.0,
    ("COOL_WET", "WET",   "NORMAL",      "NORMAL"):            18.0,
}

# Standard deviations
NDMI_STD = 0.018
LST_STD  = 1.8
SAR_STD  = 1.2
NDVI_STD = 0.020

# Water leak effect on signals
LEAK_EFFECT = {
    "NDMI": +0.18,    # NDMI يرتفع بشكل حاد
    "LST":  -6.5,     # LST ينخفض (تبخر)
    "SAR":  -4.0,     # SAR ينخفض (امتصاص)
    "NDVI": +0.07,    # NDVI يرتفع ببطء (تأخر 14-21 يوم)
}


def _get_base(lookup: dict, context: tuple, default: float) -> float:
    return lookup.get(context, default)


def generate_time_series(
    start_date: date,
    end_date: date,
    contexts_by_date: dict[date, tuple],   # date → (season, moisture, ops, vicinity)
    injected_events: Optional[list[InjectedEvent]] = None,
    seed: int = 42,
) -> pd.DataFrame:
    """
    يُنشئ time series كاملة للإشارات الأربع.
    كل قيمة تعتمد على Context في ذلك اليوم.

    Returns DataFrame with columns: date, SOIL_MOISTURE, SURFACE_TEMP, 
                                     SAR_BACKSCATTER, VEGETATION_INDEX,
                                     context_key, is_event_period
    """
    rng = np.random.default_rng(seed)
    records = []

    # كل 5 أيام (تكرار Sentinel-2 التقريبي)
    current = start_date
    while current <= end_date:
        ctx = contexts_by_date.get(current, ("HOT_DRY", "DRY", "NORMAL", "NORMAL"))
        season, moisture, ops, vicinity = ctx
        ctx_key = f"{season}|{moisture}|{ops}|{vicinity}"

        # قيم أساسية
        ndmi_base = _get_base(NDMI_BASE, ctx, 0.05)
        lst_base  = _get_base(LST_BASE,  ctx, 35.0)
        sar_base  = -10.5   # ثابت تقريبًا، يتغير مع الرطوبة
        ndvi_base = ndmi_base * 0.8 - 0.02   # علاقة تقريبية

        # إضافة ضجيج
        ndmi = ndmi_base + rng.normal(0, NDMI_STD)
        lst  = lst_base  + rng.normal(0, LST_STD)
        sar  = sar_base  + rng.normal(0, SAR_STD)
        ndvi = ndvi_base + rng.normal(0, NDVI_STD)

        is_event = False

        # تطبيق الأحداث المُحقَنة
        if injected_events:
            for event in injected_events:
                if event.start_date <= current <= event.end_date:
                    is_event = True
                    days_into_event = (current - event.start_date).days
                    magnitude = event.magnitude

                    if event.event_type == "WATER_LEAK":
                        # التطور التدريجي (peak بعد أسبوع)
                        ramp = min(1.0, days_into_event / 7.0)
                        ndmi += LEAK_EFFECT["NDMI"] * magnitude * ramp
                        lst  += LEAK_EFFECT["LST"]  * magnitude * ramp
                        sar  += LEAK_EFFECT["SAR"]  * magnitude * ramp
                        # NDVI تأخير 14-21 يوم
                        ndvi_delay = max(0, days_into_event - 14) / 10.0
                        ndvi += LEAK_EFFECT["NDVI"] * magnitude * min(1.0, ndvi_delay)

        records.append({
            "date":            current,
            "SOIL_MOISTURE":   round(ndmi, 4),
            "SURFACE_TEMP":    round(lst, 2),
            "SAR_BACKSCATTER": round(sar, 2),
            "VEGETATION_INDEX": round(ndvi, 4),
            "context_key":     ctx_key,
            "season":          season,
            "moisture":        moisture,
            "ops":             ops,
            "vicinity":        vicinity,
            "is_event_period": is_event,
        })

        current += timedelta(days=5)

    return pd.DataFrame(records)
