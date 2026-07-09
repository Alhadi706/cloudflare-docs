"""
False Alarm Analysis Engine.
يُحلِّل كل إنذار كاذب ويُجيب على:
  - أي إشارة كانت المسؤولة؟
  - لماذا أخطأ النظام؟
  - ما الأنماط المتكررة في الإنذارات الخاطئة؟
  - كيف يمكن تحسين المحرك؟
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from collections import Counter
from typing import Optional


@dataclass
class FalseAlarmCase:
    obs_date: date
    anomaly_score: float
    context_key: str
    z_scores: dict[str, float]
    diagnosed_event: Optional[str]
    actual_cause: str      # ما الذي كان فعلًا؟ (من التحقق الميداني)
    primary_signal: str    # الإشارة التي دفعت النظام للتنبيه


@dataclass
class FalseAlarmPattern:
    pattern_name: str
    count: int
    description: str
    trigger_signal: str
    typical_context: str
    improvement_suggestion: str


@dataclass
class FalseAlarmReport:
    total_fp: int
    patterns: list[FalseAlarmPattern]
    top_culprit_signal: str
    top_culprit_context: str
    improvement_suggestions: list[str]
    estimated_fp_reduction: float    # % إذا طُبِّقت التحسينات


class FalseAlarmAnalyzer:

    def analyze(self, cases: list[FalseAlarmCase]) -> FalseAlarmReport:
        if not cases:
            return FalseAlarmReport(0, [], "none", "none", [], 0.0)

        # تحليل أكثر الإشارات مسؤولة
        signal_counts: Counter = Counter()
        context_counts: Counter = Counter()
        actual_cause_counts: Counter = Counter()

        for case in cases:
            # الإشارة التي كان لها أعلى z-score
            if case.z_scores:
                top_sig = max(case.z_scores, key=lambda s: abs(case.z_scores[s]))
                signal_counts[top_sig] += 1
            ctx_short = "|".join(case.context_key.split("|")[:2])
            context_counts[ctx_short] += 1
            actual_cause_counts[case.actual_cause] += 1

        top_signal  = signal_counts.most_common(1)[0][0] if signal_counts else "unknown"
        top_context = context_counts.most_common(1)[0][0] if context_counts else "unknown"
        top_actual  = actual_cause_counts.most_common(1)[0][0] if actual_cause_counts else "unknown"

        # اكتشاف الأنماط
        patterns = self._identify_patterns(cases, actual_cause_counts)

        # اقتراحات تحسين
        suggestions = self._build_suggestions(patterns, top_signal, top_context)

        # تقدير نسبة الخفض إذا طُبِّقت التحسينات
        estimated_reduction = min(0.70, len(patterns) * 0.25)

        return FalseAlarmReport(
            total_fp=len(cases),
            patterns=patterns,
            top_culprit_signal=top_signal,
            top_culprit_context=top_context,
            improvement_suggestions=suggestions,
            estimated_fp_reduction=estimated_reduction,
        )

    def _identify_patterns(
        self, cases: list[FalseAlarmCase], cause_counts: Counter
    ) -> list[FalseAlarmPattern]:
        patterns = []

        # نمط 1: تأثير الري (الأكثر شيوعًا في البيئات الجافة)
        irr_cases = [c for c in cases if c.actual_cause in ("IRRIGATION_EFFECT", "IRRIGATION")]
        if irr_cases:
            patterns.append(FalseAlarmPattern(
                pattern_name="IRRIGATION_CONFUSION",
                count=len(irr_cases),
                description="النظام يخلط بين الري الزراعي القريب وتسرب المياه",
                trigger_signal="SOIL_MOISTURE",
                typical_context="|".join(irr_cases[0].context_key.split("|")[:2]),
                improvement_suggestion=(
                    "تفعيل IRRIGATION_NEARBY Physical Fact من مصادر خارجية. "
                    "التحقق من بيانات الري الزراعي المتاحة (FAO + NDVI الزراعي)"
                ),
            ))

        # نمط 2: مطر غير موثق
        rain_cases = [c for c in cases if c.actual_cause in ("NATURAL_RAIN", "RAIN_EFFECT")]
        if rain_cases:
            patterns.append(FalseAlarmPattern(
                pattern_name="UNRECORDED_RAIN",
                count=len(rain_cases),
                description="هطول مطري محلي لم يُسجَّل في بيانات الطقس",
                trigger_signal="SOIL_MOISTURE",
                typical_context="MILD_DRY|DRY",
                improvement_suggestion=(
                    "رفع دقة بيانات الطقس (ERA5 أو station-based) من 30km إلى 1-5km. "
                    "النظر في إضافة NDVI الزراعي كـ proxy للمطر المحلي"
                ),
            ))

        # نمط 3: ضوضاء SAR
        sar_cases = [c for c in cases
                     if c.z_scores.get("SAR_BACKSCATTER", 0) > 2.0
                     and c.actual_cause == "SENSOR_NOISE"]
        if sar_cases:
            patterns.append(FalseAlarmPattern(
                pattern_name="SAR_NOISE",
                count=len(sar_cases),
                description="ضوضاء في بيانات SAR (رياح شديدة، زاوية إطار، RFI)",
                trigger_signal="SAR_BACKSCATTER",
                typical_context="any",
                improvement_suggestion=(
                    "إضافة فحص Wind Speed من بيانات الطقس. "
                    "استبعاد SAR observations مع incidence angle > 40°"
                ),
            ))

        # نمط عام: كل الأسباب الأخرى
        other_cases = [c for c in cases
                       if c.actual_cause not in
                       ("IRRIGATION_EFFECT", "IRRIGATION", "NATURAL_RAIN", "RAIN_EFFECT", "SENSOR_NOISE")]
        if other_cases:
            causes = Counter(c.actual_cause for c in other_cases)
            most_common = causes.most_common(1)[0][0] if causes else "OTHER"
            patterns.append(FalseAlarmPattern(
                pattern_name="UNCLASSIFIED_VARIATION",
                count=len(other_cases),
                description=f"تغيرات طبيعية لم يتعرف عليها النظام (أكثرها: {most_common})",
                trigger_signal="SOIL_MOISTURE",
                typical_context="various",
                improvement_suggestion=(
                    "إضافة هذه الحالات للـ Behavior Profile كـ benign variations. "
                    "توسيع Spatial Memory لتشمل هذه المواقع."
                ),
            ))

        return patterns

    def _build_suggestions(
        self,
        patterns: list[FalseAlarmPattern],
        top_signal: str,
        top_context: str,
    ) -> list[str]:
        suggestions = []

        for p in patterns:
            suggestions.append(p.improvement_suggestion)

        # توصيات عامة بناءً على الإشارة الأكثر مشكلة
        if top_signal == "SOIL_MOISTURE":
            suggestions.append(
                f"تضييق نافذة السياق في '{top_context}': "
                "إضافة بُعد خامس للسياق (intensity of recent precipitation)"
            )
        elif top_signal == "SAR_BACKSCATTER":
            suggestions.append(
                "SAR هو المحرض الرئيسي للإنذارات الخاطئة → "
                "خفض وزنه النسبي في periods عالية الرياح"
            )

        return list(dict.fromkeys(suggestions))   # إزالة المكررات
