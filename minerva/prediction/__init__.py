"""
MINERVA Phase 11 — Prediction Engine Core
==========================================
Predicts future signal values and anomaly probability for a MonitoringTarget.
Uses real EO history + operational events to generate event-aware forecasts.

Architecture:
  PredictionEngine
    ├── TrendAnalyzer    — detect and quantify signal trends
    ├── SeasonalModel    — separate seasonal from structural trend
    ├── ForecastEngine   — generate forecasts with uncertainty bounds
    ├── EventAdjuster    — modify predictions when operational events occur
    ├── WhatIfSimulator  — forecast under alternative scenarios
    └── EarlyWarning     — generate pre-threshold warnings
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta, datetime
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum


# ── Data Types ────────────────────────────────────────────────────────────────

class TrendDirection(str, Enum):
    IMPROVING     = "IMPROVING"
    STABLE        = "STABLE"
    DETERIORATING = "DETERIORATING"
    UNKNOWN       = "UNKNOWN"


class ForecastMethod(str, Enum):
    LINEAR          = "LINEAR"       # خطي بسيط
    SEASONAL_ADJ    = "SEASONAL_ADJ" # خطي مُعدَّل موسمياً
    HOLT_WINTERS    = "HOLT_WINTERS" # Exponential Smoothing مزدوج
    EVENT_AWARE     = "EVENT_AWARE"  # يأخذ الأحداث التشغيلية بعين الاعتبار


@dataclass
class TrendResult:
    """نتيجة تحليل اتجاه إشارة واحدة."""
    signal:             str
    slope_per_day:      float           # معدل التغيير اليومي
    direction:          TrendDirection
    r_squared:          float           # جودة الانحدار (0-1)
    p_value_approx:     float           # دلالة إحصائية تقريبية
    window_days:        int             # طول النافذة المستخدمة
    n_observations:     int
    trend_type:         str             # 'SLOW_DEGRADATION' | 'SEASONAL' | 'STEP_CHANGE' | ...
    confidence:         float           # مدى الثقة في الاتجاه (0-1)
    notes:              List[str] = field(default_factory=list)


@dataclass
class Forecast:
    """
    تنبؤ لإشارة واحدة في أفق زمني محدد.
    يشمل حزمة عدم اليقين ودائمًا.
    """
    target_id:           str
    signal:              str
    mission_id:          Optional[str]
    forecast_date:       date           # يوم توليد التنبؤ
    target_date:         date           # اليوم المتنبأ به
    horizon_days:        int

    predicted_value:     float          # القيمة المركزية
    confidence_low:      float          # P10 (10th percentile)
    confidence_high:     float          # P90 (90th percentile)

    trend_per_day:       float
    trend_direction:     TrendDirection
    seasonality_offset:  float          # التأثير الموسمي في target_date

    anomaly_probability: float          # P(anomaly) عند target_date
    time_to_critical:    Optional[int]  # أيام حتى العتبة الحرجة (إن كانت)

    method:              ForecastMethod
    model_confidence:    float          # ثقة في جودة النموذج (0-1)
    event_adjustments:   List[str] = field(default_factory=list)  # تعديلات بسبب أحداث
    generated_at:        str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class EarlyWarning:
    """إنذار مبكر يُطلَق قبل تجاوز العتبة الحرجة."""
    warning_id:                  str
    target_id:                   str
    mission_id:                  Optional[str]
    generated_date:              date

    signal:                      str
    severity:                    str    # 'WATCH' | 'WARNING' | 'ALERT' | 'CRITICAL'

    current_value:               float
    threshold_value:             float
    gap:                         float  # المسافة الحالية من العتبة

    trend_per_day:               float
    estimated_days_to_threshold: Optional[int]
    estimated_breach_date:       Optional[date]

    confidence:                  float

    most_likely_scenario:        str
    alternative_scenarios:       List[str]
    recommended_actions:         List[str]

    forecast:                    Optional[Forecast] = None


@dataclass
class ScenarioResult:
    """
    نتيجة سيناريو What-If.
    تقارن التنبؤ الأساسي مع تنبؤ بعد تغيير افتراض ما.
    """
    scenario_name:       str
    scenario_type:       str    # 'MAINTENANCE_NOW' | 'DELAY_30D' | 'RAINFALL_+20MM' | ...
    assumption:          str    # وصف الافتراض بالعربية

    baseline_forecast:   Forecast
    scenario_forecast:   Forecast

    # الأثر المقارن
    value_difference:    float   # scenario.predicted - baseline.predicted
    anomaly_prob_delta:  float   # Δ في احتمال الشذوذ
    days_gained_lost:    Optional[int]   # أيام كُسبت/خُسرت حتى العتبة

    # القيمة الاقتصادية
    expected_benefit_usd: Optional[float] = None
    expected_cost_usd:    Optional[float] = None
    net_voi_usd:          Optional[float] = None  # net value of intervention


# ── Trend Analyzer ────────────────────────────────────────────────────────────

class TrendAnalyzer:
    """
    يحلل السلسلة الزمنية لإشارة ما ويكتشف:
    - التدهور البطيء
    - التغيرات الموسمية المتكررة
    - التشوه التدريجي
    - نقاط التحول (Step changes)
    """

    MIN_OBSERVATIONS = 6

    def analyze(
        self,
        series: List[Tuple[date, float]],  # [(date, value), ...]
        signal_name: str,
        window_days: int = 365,
    ) -> Optional[TrendResult]:
        """
        تحليل اتجاه إشارة.
        series: مرتبة زمنياً من الأقدم للأحدث
        """
        if len(series) < self.MIN_OBSERVATIONS:
            return None

        # فلترة النافذة الزمنية
        cutoff = date.today() - timedelta(days=window_days)
        filtered = [(d, v) for d, v in series if d >= cutoff]
        if len(filtered) < self.MIN_OBSERVATIONS:
            filtered = series[-self.MIN_OBSERVATIONS:]

        n = len(filtered)
        dates = [s[0] for s in filtered]
        values = [s[1] for s in filtered]

        # تحويل التواريخ إلى أرقام (أيام من أقدم تاريخ)
        origin = dates[0]
        x = [(d - origin).days for d in dates]
        y = values

        # انحدار خطي بسيط
        slope, intercept, r2 = self._linear_regression(x, y)

        # تحديد الاتجاه
        direction = self._classify_direction(slope, signal_name)

        # تصنيف نوع الاتجاه
        trend_type = self._classify_trend_type(slope, r2, values, signal_name)

        # تقدير الثقة
        confidence = min(0.95, r2 * 0.7 + (n / 50) * 0.3)

        # دلالة إحصائية تقريبية (مبسطة)
        p_value = self._approx_p_value(r2, n)

        notes = []
        if r2 < 0.3:
            notes.append("تباين عالٍ في البيانات — الاتجاه أقل وضوحاً")
        if n < 12:
            notes.append(f"عدد قراءات محدود ({n}) — ثقة أقل")

        return TrendResult(
            signal=signal_name,
            slope_per_day=slope,
            direction=direction,
            r_squared=round(r2, 3),
            p_value_approx=round(p_value, 4),
            window_days=window_days,
            n_observations=n,
            trend_type=trend_type,
            confidence=round(confidence, 3),
            notes=notes,
        )

    def _linear_regression(
        self, x: List[float], y: List[float]
    ) -> Tuple[float, float, float]:
        """Ordinary Least Squares — بدون مكتبات خارجية."""
        n = len(x)
        if n < 2:
            return 0.0, sum(y) / n, 0.0

        x_mean = sum(x) / n
        y_mean = sum(y) / n

        ss_xy = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y))
        ss_xx = sum((xi - x_mean) ** 2 for xi in x)

        if abs(ss_xx) < 1e-12:
            return 0.0, y_mean, 0.0

        slope     = ss_xy / ss_xx
        intercept = y_mean - slope * x_mean

        y_pred = [slope * xi + intercept for xi in x]
        ss_res = sum((yi - yp) ** 2 for yi, yp in zip(y, y_pred))
        ss_tot = sum((yi - y_mean) ** 2 for yi in y)

        r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 1e-12 else 0.0
        return slope, intercept, max(0.0, min(1.0, r2))

    def _classify_direction(self, slope: float, signal: str) -> TrendDirection:
        """تحديد ما إذا كان الاتجاه إيجابياً أم سلبياً لهذه الإشارة."""
        # إشارات حيث الارتفاع = تحسن
        positive_signals = {"NDMI", "NDVI", "NDWI", "NBR"}
        # إشارات حيث الارتفاع = تدهور
        negative_signals = {"LST_C", "VV_dB"}

        threshold = 1e-5  # معدل يومي دال

        if abs(slope) < threshold:
            return TrendDirection.STABLE

        if signal in positive_signals:
            return TrendDirection.IMPROVING if slope > 0 else TrendDirection.DETERIORATING
        elif signal in negative_signals:
            return TrendDirection.DETERIORATING if slope > 0 else TrendDirection.IMPROVING
        else:
            return TrendDirection.IMPROVING if slope > 0 else TrendDirection.DETERIORATING

    def _classify_trend_type(
        self, slope: float, r2: float, values: List[float], signal: str
    ) -> str:
        """تصنيف نوع الاتجاه."""
        daily_change_pct = abs(slope) / (abs(statistics.mean(values)) + 1e-9) * 100

        if daily_change_pct < 0.005:
            return "STABLE"
        if r2 > 0.7 and daily_change_pct > 0.02:
            return "SLOW_DEGRADATION" if slope < 0 else "SLOW_IMPROVEMENT"
        if r2 < 0.3:
            return "HIGH_VARIABILITY"
        return "GRADUAL_TREND"

    def _approx_p_value(self, r2: float, n: int) -> float:
        """تقريب بسيط لـ p-value من R²."""
        if n < 4:
            return 1.0
        t_stat = math.sqrt(r2 * (n - 2) / max(1e-9, 1 - r2))
        # تقريب الجدول t → p-value
        if t_stat > 4.0:
            return 0.001
        if t_stat > 3.0:
            return 0.01
        if t_stat > 2.0:
            return 0.05
        if t_stat > 1.5:
            return 0.15
        return 0.50


# ── Forecast Engine ───────────────────────────────────────────────────────────

class ForecastEngine:
    """
    يولد تنبؤات مستقبلية مع حزمة عدم اليقين.
    الخوارزمية الافتراضية: خطية مُعدَّلة بالموسمية.
    """

    def __init__(self, trend_analyzer: Optional[TrendAnalyzer] = None):
        self.trend_analyzer = trend_analyzer or TrendAnalyzer()

    def forecast(
        self,
        target_id: str,
        signal: str,
        series: List[Tuple[date, float]],
        horizon_days: int,
        threshold: Optional[float] = None,
        seasonal_amplitude: float = 0.0,  # سعة التأثير الموسمي (تقدير مبسط)
        mission_id: Optional[str] = None,
        event_adjustments: Optional[List[str]] = None,
    ) -> Optional[Forecast]:
        """
        توليد تنبؤ واحد.

        seasonal_amplitude: تقدير الانحراف الموسمي الأقصى عن المتوسط
                            مثلاً NDMI = 0.02 (يتغير ±0.02 بين الصيف والشتاء)
        """
        if len(series) < 4:
            return None

        trend = self.trend_analyzer.analyze(series, signal)
        if trend is None:
            return None

        current_value = series[-1][1]
        current_date  = series[-1][0]
        target_date   = current_date + timedelta(days=horizon_days)

        # 1. مكوّن الاتجاه
        trend_contribution = trend.slope_per_day * horizon_days

        # 2. مكوّن الموسمية (مبسط: جيب تمام)
        current_doy = current_date.timetuple().tm_yday
        target_doy  = target_date.timetuple().tm_yday
        seasonality_offset = (
            seasonal_amplitude
            * (math.cos(2 * math.pi * target_doy / 365)
               - math.cos(2 * math.pi * current_doy / 365))
        )

        # 3. القيمة المتنبأ بها
        predicted = current_value + trend_contribution + seasonality_offset

        # 4. حزمة عدم اليقين
        # تتسع بشكل تدريجي مع الأفق الزمني
        residuals = self._compute_residuals(series, trend)
        residual_std = statistics.stdev(residuals) if len(residuals) > 2 else abs(current_value * 0.1)
        uncertainty  = residual_std * math.sqrt(horizon_days / 30.0)
        uncertainty += abs(trend_contribution) * (1 - trend.r_squared)

        confidence_low  = predicted - 1.65 * uncertainty   # P10
        confidence_high = predicted + 1.65 * uncertainty   # P90

        # 5. احتمال الشذوذ
        anomaly_prob = self._compute_anomaly_probability(
            predicted, series, residual_std, threshold
        )

        # 6. الوقت حتى العتبة
        time_to_crit = None
        if threshold is not None and abs(trend.slope_per_day) > 1e-7:
            time_to_crit = self._time_to_threshold(
                current_value, threshold, trend.slope_per_day,
                seasonal_amplitude, current_date
            )

        # 7. ثقة النموذج
        model_confidence = min(0.90,
            trend.r_squared * 0.6
            + min(len(series) / 40, 1.0) * 0.3
            + (1 - min(abs(trend.slope_per_day) / 0.001, 1.0)) * 0.1
        )

        return Forecast(
            target_id=target_id,
            signal=signal,
            mission_id=mission_id,
            forecast_date=current_date,
            target_date=target_date,
            horizon_days=horizon_days,
            predicted_value=round(predicted, 5),
            confidence_low=round(confidence_low, 5),
            confidence_high=round(confidence_high, 5),
            trend_per_day=round(trend.slope_per_day, 7),
            trend_direction=trend.direction,
            seasonality_offset=round(seasonality_offset, 5),
            anomaly_probability=round(anomaly_prob, 3),
            time_to_critical=time_to_crit,
            method=ForecastMethod.SEASONAL_ADJ,
            model_confidence=round(model_confidence, 3),
            event_adjustments=event_adjustments or [],
        )

    def _compute_residuals(
        self,
        series: List[Tuple[date, float]],
        trend: TrendResult,
    ) -> List[float]:
        """حساب البواقي (الفرق بين القيمة الفعلية وخط الاتجاه)."""
        origin = series[0][0]
        residuals = []
        for d, v in series:
            days = (d - origin).days
            expected = v + trend.slope_per_day * (len(series) - 1 - days)
            residuals.append(v - expected)
        return residuals

    def _compute_anomaly_probability(
        self,
        predicted: float,
        series: List[Tuple[date, float]],
        std: float,
        threshold: Optional[float],
    ) -> float:
        """
        تقدير P(anomaly) بناءً على:
        - هل المتنبأ به يتجاوز العتبة؟
        - كيف يقع بالنسبة للبيانات التاريخية؟
        """
        if threshold is None:
            values = [v for _, v in series[-24:]]
            if len(values) < 3:
                return 0.1
            mean = statistics.mean(values)
            hist_std = statistics.stdev(values) if len(values) > 2 else std
            z = abs(predicted - mean) / (hist_std + 1e-9)
            return min(0.95, z / 4.0)

        distance_from_threshold = abs(predicted - threshold)
        if (threshold < series[-1][1] and predicted <= threshold) or \
           (threshold > series[-1][1] and predicted >= threshold):
            return min(0.95, 0.7 + 0.25 * (1 - min(distance_from_threshold / std, 1.0)))

        relative_distance = distance_from_threshold / (std + 1e-9)
        return max(0.05, 0.40 - 0.35 * min(relative_distance / 3, 1.0))

    def _time_to_threshold(
        self,
        current: float,
        threshold: float,
        slope_per_day: float,
        seasonal_amplitude: float,
        current_date: date,
        max_days: int = 365,
    ) -> Optional[int]:
        """
        حل عددي لـ T* حيث:
        current + slope * T* + seasonal(T*) = threshold
        """
        if slope_per_day == 0:
            return None

        # هل الاتجاه نحو العتبة؟
        moving_toward = (slope_per_day < 0 and current > threshold) or \
                        (slope_per_day > 0 and current < threshold)
        if not moving_toward:
            return None

        # بحث ثنائي
        lo, hi = 1, max_days
        current_doy = current_date.timetuple().tm_yday

        for _ in range(20):  # 20 تكرار كافية
            mid = (lo + hi) // 2
            target_doy = (current_doy + mid) % 365
            seasonal = seasonal_amplitude * (
                math.cos(2 * math.pi * target_doy / 365)
                - math.cos(2 * math.pi * current_doy / 365)
            )
            projected = current + slope_per_day * mid + seasonal

            reached = (slope_per_day < 0 and projected <= threshold) or \
                      (slope_per_day > 0 and projected >= threshold)
            if reached:
                hi = mid
            else:
                lo = mid

            if hi - lo <= 1:
                break

        return hi if hi < max_days else None


# ── Event-Aware Adjuster ──────────────────────────────────────────────────────

class EventAwareAdjuster:
    """
    يعدّل التنبؤ بناءً على الأحداث التشغيلية المعروفة.

    الأحداث تُغيّر سلوك الإشارات:
      • صيانة مكتملة  → NDMI يرتفع، trend يتحسن
      • حفريات قريبة  → SAR يتغير، خطر تشوه يرتفع
      • إصلاح تسرب   → NDMI ينخفض، moisture يتراجع
      • ضغط يرتفع    → خطر تعجيل التدهور
    """

    EVENT_IMPACTS = {
        "MAINTENANCE_COMPLETE": {
            "NDMI":  +0.015,   # تحسن مؤقت في الرطوبة
            "NDVI":  +0.010,
            "slope_multiplier": 0.7,   # تراجع معدل التدهور
        },
        "NEARBY_EXCAVATION": {
            "VV_dB": +2.0,     # ارتفاع في الـ SAR
            "confidence_penalty": -0.15,
        },
        "LEAK_REPAIRED": {
            "NDMI":  -0.020,
            "slope_multiplier": 0.5,
        },
        "PRESSURE_INCREASE": {
            "slope_multiplier": 1.3,   # تسريع التدهور
            "anomaly_prob_boost": +0.10,
        },
    }

    def adjust(
        self,
        forecast: Forecast,
        recent_events: List[Dict[str, Any]],
    ) -> Forecast:
        """
        تطبيق تعديلات الأحداث على التنبؤ.
        recent_events: قائمة من {"event_type": str, "days_ago": int}
        """
        adjustments = []
        predicted = forecast.predicted_value
        anomaly_prob = forecast.anomaly_probability
        model_conf   = forecast.model_confidence

        for event in recent_events:
            etype = event.get("event_type", "")
            days_ago = event.get("days_ago", 0)
            impact = self.EVENT_IMPACTS.get(etype)
            if impact is None:
                continue

            # تأثير يتلاشى تدريجياً بمرور الوقت
            decay = math.exp(-days_ago / 30.0)

            # تعديل القيمة المتنبأ بها
            value_delta = impact.get(forecast.signal, 0.0) * decay
            predicted += value_delta

            # تعديل الاحتمال
            anomaly_prob += impact.get("anomaly_prob_boost", 0.0) * decay

            # تعديل الثقة
            model_conf += impact.get("confidence_penalty", 0.0) * decay

            if abs(value_delta) > 1e-6:
                adjustments.append(f"{etype}: {'+' if value_delta>0 else ''}{value_delta:.4f}")

        # قيود فيزيائية
        anomaly_prob = max(0.0, min(0.99, anomaly_prob))
        model_conf   = max(0.1, min(0.99, model_conf))

        # إنشاء نسخة معدّلة
        return Forecast(
            **{**forecast.__dict__,
               "predicted_value": round(predicted, 5),
               "anomaly_probability": round(anomaly_prob, 3),
               "model_confidence": round(model_conf, 3),
               "event_adjustments": forecast.event_adjustments + adjustments,
            }
        )


# ── What-If Simulator ─────────────────────────────────────────────────────────

class WhatIfSimulator:
    """
    يُقدّر نتائج مستقبلية مختلفة بناءً على تغيير افتراضات تشغيلية.

    السيناريوهات:
      MAINTENANCE_NOW     — ماذا لو نفّذنا الصيانة اليوم؟
      DELAY_MAINTENANCE   — ماذا لو أجّلنا الصيانة 30/60/90 يوماً؟
      RAINFALL_INCREASE   — ماذا لو زادت الأمطار 20mm؟
      IMAGERY_CONFIRMED   — ماذا لو أكدت الصور الضرر؟
      NO_INTERVENTION     — ماذا لو تركنا الوضع كما هو؟
      EMERGENCY_REPAIR    — ماذا لو أجرينا إصلاحاً طارئاً فورياً؟
    """

    def __init__(self):
        self.forecast_engine  = ForecastEngine()
        self.event_adjuster   = EventAwareAdjuster()

    def simulate(
        self,
        target_id: str,
        signal: str,
        series: List[Tuple[date, float]],
        horizon_days: int,
        scenarios: List[Dict[str, Any]],
        threshold: Optional[float] = None,
        mission_id: Optional[str] = None,
    ) -> List[ScenarioResult]:
        """
        تشغيل سيناريوهات متعددة ومقارنة نتائجها.

        كل سيناريو هو dict:
          {"name": str, "type": str, "assumption_ar": str, "events": [...], "slope_multiplier": float}
        """
        # التنبؤ الأساسي (no intervention)
        baseline = self.forecast_engine.forecast(
            target_id, signal, series, horizon_days,
            threshold=threshold, mission_id=mission_id
        )
        if baseline is None:
            return []

        results = []
        for scenario in scenarios:
            # تعديل السلسلة الزمنية حسب السيناريو
            modified_series = self._apply_scenario_to_series(series, scenario)

            # تنبؤ السيناريو
            sc_forecast = self.forecast_engine.forecast(
                target_id, signal, modified_series, horizon_days,
                threshold=threshold, mission_id=mission_id
            )
            if sc_forecast is None:
                continue

            # تطبيق الأحداث التشغيلية
            if scenario.get("events"):
                sc_forecast = self.event_adjuster.adjust(sc_forecast, scenario["events"])

            # حساب الأثر
            value_diff  = sc_forecast.predicted_value - baseline.predicted_value
            prob_delta  = sc_forecast.anomaly_probability - baseline.anomaly_probability
            days_gained = None
            if (baseline.time_to_critical is not None and
                    sc_forecast.time_to_critical is not None):
                days_gained = sc_forecast.time_to_critical - baseline.time_to_critical

            results.append(ScenarioResult(
                scenario_name     = scenario["name"],
                scenario_type     = scenario["type"],
                assumption        = scenario.get("assumption_ar", ""),
                baseline_forecast = baseline,
                scenario_forecast = sc_forecast,
                value_difference  = round(value_diff, 5),
                anomaly_prob_delta= round(prob_delta, 3),
                days_gained_lost  = days_gained,
                expected_benefit_usd = scenario.get("expected_benefit_usd"),
                expected_cost_usd    = scenario.get("expected_cost_usd"),
                net_voi_usd = (
                    (scenario.get("expected_benefit_usd", 0) or 0)
                    - (scenario.get("expected_cost_usd", 0) or 0)
                ) or None,
            ))

        return results

    def _apply_scenario_to_series(
        self,
        series: List[Tuple[date, float]],
        scenario: Dict[str, Any],
    ) -> List[Tuple[date, float]]:
        """تعديل السلسلة الزمنية وفق الافتراضات."""
        stype = scenario.get("type", "")
        modified = list(series)

        if stype == "MAINTENANCE_NOW":
            # الصيانة تُحسن القيمة الأخيرة وتبطّئ الاتجاه
            if modified:
                last_d, last_v = modified[-1]
                boost = scenario.get("value_boost", 0.015)
                modified[-1] = (last_d, last_v + boost)

        elif stype == "RAINFALL_INCREASE":
            mm_increase = scenario.get("mm", 20)
            ndmi_boost  = mm_increase * 0.001  # تقدير تجريبي
            modified = [(d, v + ndmi_boost * 0.3) for d, v in modified[-6:]]
            modified = series[:-6] + modified

        elif stype in ("NO_INTERVENTION", "BASELINE"):
            pass  # لا تغيير

        elif stype == "SLOPE_MULTIPLIER":
            mult = scenario.get("multiplier", 1.0)
            # لا يمكن تعديل الميل مباشرة في السلسلة —
            # نُضيف نقاط اصطناعية لإعطاء الانحدار ميلاً مختلفاً
            pass

        return modified
