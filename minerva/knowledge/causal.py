"""
Causal Reasoning Engine — Phase 2.

يُميِّز بين:
  Diagnosis:  "ما الذي يحدث الآن؟"       ← Phase 1
  Root Cause: "لماذا يحدث؟"              ← Phase 2
  Prediction: "ماذا سيحدث بعد ذلك؟"     ← Phase 3+ (groundwork هنا)

Root Cause Analysis:
  يأخذ الحدث المُشخَّص + metadata الأصل
  → يُقيِّم كل سبب جذري بناءً على:
     - الاحتمال الإحصائي الأساسي (من الـ KG)
     - خصائص الأصل (عمر، مادة، ضغط...)
     - السياق التشغيلي
  → يُنتج ترتيبًا للأسباب مع التفسير
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from minerva.knowledge.graph import LivingKnowledgeGraph


@dataclass
class RootCauseScore:
    cause_id: str
    description: str
    probability: float
    contributing_factors: list[str]    # لماذا رجّح النظام هذا السبب؟
    evidence_needed: list[str]         # ما البيانات الإضافية المطلوبة للتأكيد؟


@dataclass
class CausalAnalysisResult:
    diagnosed_event: str
    asset_id: str
    root_causes: list[RootCauseScore]  # مرتبة تنازليًا
    most_probable_cause: str
    confidence: str
    prevention_hints: list[str]        # كيف تمنع تكرار الحدث؟

    # Groundwork للتنبؤ (Phase 3+)
    possible_next_events: list[dict]   # {event, probability, timeframe}


class RootCauseEngine:
    """
    يُجري تحليل الأسباب الجذرية بعد التشخيص.
    يستخدم الـ KG للحصول على الأسباب الممكنة.
    يُعدِّلها بناءً على خصائص الأصل.
    """

    def __init__(self, kg: LivingKnowledgeGraph):
        self.kg = kg

        # وصف الأسباب الجذرية (يجب أن تكون في الـ KG، لكن نحتفظ بها هنا للوضوح)
        self._cause_descriptions = {
            "RC_PIPE_AGING":         "تقادم الأنبوب — تراكم الإجهاد على مدى سنوات",
            "RC_CORROSION":          "تآكل كيميائي — تفاعل المادة مع التربة/المياه",
            "RC_THIRD_PARTY_DMG":    "ضرر طرف ثالث — حفر أو أعمال قريبة",
            "RC_HIGH_PRESSURE":      "ضغط تشغيل مرتفع — تجاوز حد التصميم",
            "RC_SOIL_MOVEMENT":      "حركة التربة — انكماش/تمدد موسمي",
            "RC_MANUFACTURING_DEFECT":"عيب تصنيعي — ضعف في نقطة محددة",
            "RC_SEISMIC":            "نشاط زلزالي أو اهتزاز",
            "RC_OVERLOAD":           "حمل ميكانيكي زائد",
            "RC_DROUGHT_STRESS":     "إجهاد جفاف — دورات تمدد وانكماش",
            "RC_VEGETATION_ROOTS":   "جذور النباتات الغازية",
        }

        # عوامل تُعدِّل الاحتمال بناءً على خصائص الأصل
        self._asset_modifiers = {
            "RC_PIPE_AGING": self._modifier_pipe_age,
            "RC_CORROSION":  self._modifier_material,
            "RC_HIGH_PRESSURE": self._modifier_pressure,
            "RC_THIRD_PARTY_DMG": self._modifier_construction,
        }

        # ما يُنبئ بأحداث مستقبلية (Groundwork للـ Phase 3+)
        self._event_propagation = {
            "WATER_LEAK": [
                {"event": "SUBSIDENCE", "probability": 0.25, "timeframe_months": (6, 24),
                 "reason": "فقدان تماسك التربة تحت الأنبوب"},
                {"event": "PIPE_BREAK", "probability": 0.40, "timeframe_months": (1, 6),
                 "reason": "إذا لم تُعالَج، يتطور الى انكسار كامل"},
                {"event": "EROSION",    "probability": 0.20, "timeframe_months": (3, 12),
                 "reason": "الماء المتسرب يُجرِّف التربة المحيطة"},
            ],
            "SUBSIDENCE": [
                {"event": "PIPE_BREAK",  "probability": 0.35, "timeframe_months": (1, 12),
                 "reason": "هبوط الأرض يُشكِّل إجهادًا انثنائيًا"},
                {"event": "WATER_LEAK",  "probability": 0.25, "timeframe_months": (2, 8),
                 "reason": "الإجهاد يُسبِّب تشققات في الأنبوب"},
            ],
        }

    def analyze(
        self,
        diagnosed_event: str,
        asset_id: str,
        asset_metadata: dict,
    ) -> CausalAnalysisResult:
        """
        تحليل الأسباب الجذرية للحدث المُشخَّص.

        asset_metadata يجب أن يحتوي (اختياريًا):
          - age_years: عمر الأنبوب
          - material: نوع المادة (HDPE, PVC, Steel, CI...)
          - pressure_bar: ضغط التشغيل
          - near_construction: هل هناك بناء قريب؟
          - last_inspection_days: أيام منذ آخر فحص
        """
        # جلب الأسباب من الـ KG
        raw_causes = self.kg.get_root_causes(diagnosed_event)

        if not raw_causes:
            return CausalAnalysisResult(
                diagnosed_event=diagnosed_event,
                asset_id=asset_id,
                root_causes=[],
                most_probable_cause="UNKNOWN",
                confidence="INSUFFICIENT",
                prevention_hints=[],
                possible_next_events=[],
            )

        # تقييم وتعديل الاحتمالات
        scored_causes = []
        for cause_id, base_prob in raw_causes:
            adjusted_prob, factors = self._adjust_probability(
                cause_id, base_prob, asset_metadata
            )
            scored_causes.append(RootCauseScore(
                cause_id=cause_id,
                description=self._cause_descriptions.get(cause_id, cause_id),
                probability=adjusted_prob,
                contributing_factors=factors,
                evidence_needed=self._evidence_needed(cause_id, asset_metadata),
            ))

        # تطبيع
        total = sum(c.probability for c in scored_causes)
        for c in scored_causes:
            c.probability = round(c.probability / max(total, 1e-6), 3)

        scored_causes.sort(key=lambda c: c.probability, reverse=True)

        # الأحداث المستقبلية المحتملة
        next_events = self._event_propagation.get(diagnosed_event, [])

        # خطوط الوقاية
        prevention = self._get_prevention_hints(scored_causes[0].cause_id if scored_causes else "")

        confidence = "HIGH" if scored_causes and scored_causes[0].probability > 0.50 else "MEDIUM"

        return CausalAnalysisResult(
            diagnosed_event=diagnosed_event,
            asset_id=asset_id,
            root_causes=scored_causes,
            most_probable_cause=scored_causes[0].cause_id if scored_causes else "UNKNOWN",
            confidence=confidence,
            prevention_hints=prevention,
            possible_next_events=next_events,
        )

    def _adjust_probability(
        self, cause_id: str, base_prob: float, meta: dict
    ) -> tuple[float, list[str]]:
        modifier_fn = self._asset_modifiers.get(cause_id)
        if modifier_fn:
            return modifier_fn(base_prob, meta)
        return base_prob, []

    def _modifier_pipe_age(self, base: float, meta: dict) -> tuple[float, list[str]]:
        age = meta.get("age_years", 0)
        factors = []
        if age > 20:
            base *= 2.5
            factors.append(f"عمر الأنبوب {age} سنة (أكثر من 20) — خطر تقادم مرتفع")
        elif age > 10:
            base *= 1.5
            factors.append(f"عمر الأنبوب {age} سنة — تقادم معتدل")
        elif age < 5:
            base *= 0.4
            factors.append(f"عمر الأنبوب {age} سنة — جديد نسبيًا")
        return base, factors

    def _modifier_material(self, base: float, meta: dict) -> tuple[float, list[str]]:
        mat = meta.get("material", "")
        factors = []
        if mat == "CI":    # Cast Iron
            base *= 2.0
            factors.append("حديد زهر — عالي التآكل")
        elif mat == "STEEL":
            base *= 1.5
            factors.append("فولاذ — معرض للصدأ بدون حماية كافية")
        elif mat in ("HDPE", "PVC"):
            base *= 0.5
            factors.append(f"{mat} — مقاوم للتآكل نسبيًا")
        return base, factors

    def _modifier_pressure(self, base: float, meta: dict) -> tuple[float, list[str]]:
        pressure = meta.get("pressure_bar", 0)
        factors = []
        if pressure > 10:
            base *= 1.8
            factors.append(f"ضغط تشغيل {pressure} bar — مرتفع")
        elif pressure > 6:
            base *= 1.2
            factors.append(f"ضغط تشغيل {pressure} bar — متوسط")
        return base, factors

    def _modifier_construction(self, base: float, meta: dict) -> tuple[float, list[str]]:
        if meta.get("near_construction", False):
            return base * 3.0, ["أعمال إنشائية قريبة مسجلة في ERP"]
        return base, []

    def _evidence_needed(self, cause_id: str, meta: dict) -> list[str]:
        needed = {
            "RC_PIPE_AGING":     ["فحص جدران الأنبوب بالموجات فوق الصوتية",
                                  "سجل فحوصات الصيانة التاريخية"],
            "RC_CORROSION":      ["عينة تربة من المنطقة",
                                  "قياس التدرج الكهركيميائي"],
            "RC_THIRD_PARTY_DMG":["صور الطائرة المسيّرة على المنطقة",
                                  "مقارنة مع سجلات تصاريح الحفر"],
            "RC_HIGH_PRESSURE":  ["تسجيل بيانات الضغط من SCADA",
                                  "مراجعة حوادث water hammer"],
            "RC_SOIL_MOVEMENT":  ["قراءات InSAR للمنطقة",
                                  "فحص التربة بالمسح الجيوفيزيائي"],
        }
        return needed.get(cause_id, ["فحص ميداني مباشر"])

    def _get_prevention_hints(self, most_probable_cause: str) -> list[str]:
        hints = {
            "RC_PIPE_AGING":     ["جدولة فحص تفصيلي لكامل القسم",
                                  "تقييم استبدال المقاطع الأقدم من 20 سنة"],
            "RC_CORROSION":      ["مراجعة نظام الحماية الكاثودية",
                                  "فحص عزل الأنبوب في المناطق الرطبة"],
            "RC_THIRD_PARTY_DMG":["تعزيز الرقابة على تصاريح الحفر القريبة",
                                  "وضع علامات تحديد واضحة لمسار الأنبوب"],
            "RC_HIGH_PRESSURE":  ["مراجعة إعدادات صمامات التخفيف",
                                  "فحص نقاط water hammer المحتملة"],
            "RC_SOIL_MOVEMENT":  ["مراقبة InSAR دورية للمنطقة",
                                  "تعزيز أساسات الأنبوب في مناطق التربة غير المستقرة"],
        }
        return hints.get(most_probable_cause, ["مراجعة ميدانية شاملة مطلوبة"])
