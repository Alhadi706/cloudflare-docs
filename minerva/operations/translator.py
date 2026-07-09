"""
MINERVA Phase 12 — Alert Translator
=====================================
Translates scientific MINERVA outputs into plain operational language.

The operator should never see:
  "NDMI = -0.065, σ = 2.3, P(anomaly) = 0.73"

They should see:
  "ارتفاع ملحوظ في رطوبة التربة — احتمال تسرب 73% — يستوجب فحصاً ميدانياً"

This module bridges the scientific engine and the operational UI.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List

from minerva.operations.alert import (
    OperationalAlert, AlertSeverity, AlertStatus,
    AlertLocation, EvidenceSummary
)


# ── Signal → Plain Text Dictionary ───────────────────────────────────────────

SIGNAL_DESCRIPTIONS = {
    "NDMI": {
        "low":   "انخفاض ملحوظ في رطوبة التربة",
        "high":  "ارتفاع ملحوظ في رطوبة التربة",
        "normal":"رطوبة التربة ضمن الحدود الطبيعية",
    },
    "NDVI": {
        "low":   "تراجع الغطاء النباتي",
        "high":  "نمو نباتي أعلى من المعتاد",
        "normal":"الغطاء النباتي طبيعي",
    },
    "VV_dB": {
        "low":   "سطح منعكس بشكل غير طبيعي (قد يشير لمياه)",
        "high":  "تغير غير طبيعي في بنية السطح",
        "normal":"انعكاس الرادار ضمن الحدود الطبيعية",
    },
    "LST_C": {
        "low":   "انخفاض درجة حرارة السطح",
        "high":  "ارتفاع غير طبيعي في حرارة السطح",
        "normal":"درجة حرارة السطح طبيعية",
    },
    "NDWI": {
        "low":   "لا دليل على مياه سطحية",
        "high":  "ظهور مياه سطحية غير مبرر",
        "normal":"لا مؤشرات على مياه سطحية",
    },
}

MISSION_ACTIONS = {
    "WATER_LEAK_DETECTION": {
        "WATCH":    "متابعة دورية للموقع — لا إجراء فوري",
        "WARNING":  "إرسال فريق ميداني لفحص ضغط الخط",
        "ALERT":    "فحص ميداني طارئ — قد يكون هناك تسرب مياه",
        "CRITICAL": "إيقاف الضخ وإجراء إصلاح طارئ فوري",
    },
    "VEGETATION_HEALTH": {
        "WATCH":    "رصد مستمر — راجع خطة الري",
        "WARNING":  "مراجعة خطة الري وتحليل التربة",
        "ALERT":    "تدخل زراعي عاجل — خطر جفاف المحصول",
        "CRITICAL": "حصاد مبكر إن أمكن — خسائر متوقعة",
    },
    "INFRASTRUCTURE_AGING": {
        "WATCH":    "إدراج في خطة الصيانة القادمة",
        "WARNING":  "تقديم موعد الصيانة الدورية",
        "ALERT":    "صيانة مخططة خلال 30 يوماً",
        "CRITICAL": "استبدال أو تأهيل طارئ",
    },
    "DEFAULT": {
        "WATCH":    "متابعة ورصد",
        "WARNING":  "مراجعة الموقع ميدانياً",
        "ALERT":    "تدخل ميداني عاجل",
        "CRITICAL": "إجراء فوري — لا تأخير",
    },
}

RISK_TEXTS = {
    (0.0, 0.30): "احتمال منخفض",
    (0.30, 0.50): "احتمال متوسط",
    (0.50, 0.70): "احتمال عالٍ",
    (0.70, 0.85): "احتمال مرتفع جداً",
    (0.85, 1.01): "شبه مؤكد",
}


class AlertTranslator:
    """
    يترجم مخرجات المحرك العلمي إلى إنذارات تشغيلية مفهومة.
    """

    def from_early_warning(
        self,
        warning: Dict[str, Any],
        mission_name: str,
        target_name: str,
        target_lat: float,
        target_lon: float,
        technical_detail: Optional[Dict] = None,
    ) -> OperationalAlert:
        """
        تحويل EarlyWarning من محرك التنبؤ إلى OperationalAlert.
        """
        severity_str = warning.get("severity", "WARNING")
        severity = AlertSeverity(severity_str)

        # ترجمة الإشارة إلى نص تشغيلي
        signal      = warning.get("signal", "")
        current_val = warning.get("current_value", 0)
        threshold   = warning.get("threshold_value", 0)
        direction   = "high" if current_val > threshold else "low"
        signal_text = SIGNAL_DESCRIPTIONS.get(signal, {}).get(direction, signal)

        # نص الاحتمال
        confidence  = float(warning.get("confidence", 0.5))
        risk_text   = self._confidence_to_text(confidence)

        # نص الوقت
        days = warning.get("estimated_days_to_threshold")
        time_text = f"خلال ~{days} يوم بدون تدخل" if days else "التأثير قريب"

        # التوصية التشغيلية
        mission_type = warning.get("mission_type", "DEFAULT")
        action = MISSION_ACTIONS.get(mission_type, MISSION_ACTIONS["DEFAULT"]).get(
            severity_str, MISSION_ACTIONS["DEFAULT"][severity_str]
        )

        # ملخص الأدلة
        evidence = EvidenceSummary(
            plain_text    = signal_text,
            confidence_pct= int(confidence * 100),
            data_age_days = warning.get("data_age_days", 5),
            signal_count  = warning.get("signal_count", 1),
            technical_ref = f"{signal}={current_val:.4f} (threshold={threshold:.4f})" if signal else None,
        )

        # عنوان الإنذار
        title = self._build_title(severity_str, mission_name, target_name)

        return OperationalAlert(
            alert_id      = f"ALT-{uuid.uuid4().hex[:8].upper()}",
            title         = title,
            description   = f"{signal_text} في {target_name}. {time_text}.",
            mission_id    = warning.get("mission_id", ""),
            mission_name  = mission_name,
            target_id     = warning.get("target_id", ""),
            target_name   = target_name,
            severity      = severity,
            status        = AlertStatus.NEW,
            location      = AlertLocation(lat=target_lat, lon=target_lon),
            evidence      = evidence,
            recommended_action = action,
            action_deadline    = None,
            risk_level_text    = f"{risk_text} ({int(confidence*100)}%)",
            time_to_impact_text= time_text,
            technical_detail   = technical_detail,
        )

    def from_forecast(
        self,
        forecast: Dict[str, Any],
        mission_name: str,
        target_name: str,
        target_lat: float,
        target_lon: float,
    ) -> Optional[OperationalAlert]:
        """
        تحويل Forecast إلى إنذار إذا تجاوز الاحتمال عتبة معينة.
        """
        anomaly_prob = float(forecast.get("anomaly_probability", 0))
        if anomaly_prob < 0.35:
            return None   # لا إنذار للاحتمالات المنخفضة

        severity = self._prob_to_severity(anomaly_prob)
        days = forecast.get("time_to_critical")
        time_text = f"خلال ~{days} يوم" if days else "قريب"

        signal = forecast.get("signal", "")
        direction = "deteriorating" if forecast.get("trend_direction") == "DETERIORATING" else "normal"
        signal_text = f"اتجاه تراجعي في {signal}" if direction == "deteriorating" else f"تغير في {signal}"

        mission_type = forecast.get("mission_type", "DEFAULT")
        severity_str = severity.value
        action = MISSION_ACTIONS.get(mission_type, MISSION_ACTIONS["DEFAULT"]).get(
            severity_str, MISSION_ACTIONS["DEFAULT"][severity_str]
        )

        evidence = EvidenceSummary(
            plain_text    = signal_text,
            confidence_pct= int(float(forecast.get("model_confidence", 0.5)) * 100),
            data_age_days = 5,
            signal_count  = 1,
            technical_ref = (
                f"{signal}: predicted={forecast.get('predicted_value',0):.4f}, "
                f"P(anomaly)={anomaly_prob:.0%}, trend={forecast.get('trend_per_day',0):.6f}/day"
            ),
        )

        return OperationalAlert(
            alert_id      = f"ALT-{uuid.uuid4().hex[:8].upper()}",
            title         = self._build_title(severity_str, mission_name, target_name),
            description   = f"{signal_text} متوقع {time_text}.",
            mission_id    = forecast.get("mission_id", ""),
            mission_name  = mission_name,
            target_id     = forecast.get("target_id", ""),
            target_name   = target_name,
            severity      = severity,
            status        = AlertStatus.NEW,
            location      = AlertLocation(lat=target_lat, lon=target_lon),
            evidence      = evidence,
            recommended_action = action,
            risk_level_text    = self._confidence_to_text(anomaly_prob),
            time_to_impact_text= time_text,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _confidence_to_text(self, prob: float) -> str:
        for (lo, hi), text in RISK_TEXTS.items():
            if lo <= prob < hi:
                return text
        return "احتمال غير محدد"

    def _prob_to_severity(self, prob: float) -> AlertSeverity:
        if prob >= 0.80:
            return AlertSeverity.CRITICAL
        if prob >= 0.65:
            return AlertSeverity.ALERT
        if prob >= 0.45:
            return AlertSeverity.WARNING
        return AlertSeverity.WATCH

    def _build_title(self, severity: str, mission: str, target: str) -> str:
        prefix = {
            "WATCH":    "مراقبة",
            "WARNING":  "تحذير",
            "ALERT":    "إنذار",
            "CRITICAL": "حالة حرجة",
        }.get(severity, "إشعار")
        return f"{prefix}: {mission} — {target}"
