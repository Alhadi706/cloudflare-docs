"""
Value of Information Engine — نظرية القرار.

يُجيب على السؤال الأهم في العمليات:
  "هل تستحق تكلفة جمع البيانات الإضافية العائد المتوقع منها؟"

المعادلة الأساسية (Decision Theory):
  VoI(action) = E[utility | take_action] - E[utility | no_action] - cost(action)

إذا VoI > 0: الإجراء يستحق اقتصاديًا.
إذا VoI < 0: لا تفعله.

الوحدات: دولار أمريكي.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class InformationAction:
    action_id: str
    description_ar: str
    cost_usd: float
    time_to_acquire_hours: float
    # الأدلة التي يُوفِّرها هذا الإجراء
    evidence_provided: list[str]
    # رفع Confidence المتوقع (نسبة، 0→1)
    expected_confidence_delta: float
    # هل يُعطي Ground Truth نهائيًا؟
    provides_ground_truth: bool = False


# مكتبة الإجراءات المتاحة
STANDARD_ACTIONS = {
    "ERP_QUERY": InformationAction(
        action_id="ERP_QUERY",
        description_ar="استعلام ERP: تحقق من سجلات الصيانة والتصاريح",
        cost_usd=0.0,
        time_to_acquire_hours=0.5,
        evidence_provided=["POST_MAINTENANCE", "CONSTRUCTION_PERMIT"],
        expected_confidence_delta=0.08,
    ),
    "FREE_SAR": InformationAction(
        action_id="FREE_SAR",
        description_ar="Sentinel-1 SAR جديد (مجاني، انتظار 6-12 يوم)",
        cost_usd=0.0,
        time_to_acquire_hours=144,   # 6 أيام
        evidence_provided=["SAR_BACKSCATTER"],
        expected_confidence_delta=0.10,
    ),
    "FREE_OPTICAL": InformationAction(
        action_id="FREE_OPTICAL",
        description_ar="Sentinel-2 صورة بصرية جديدة (مجانية، انتظار 5-10 أيام)",
        cost_usd=0.0,
        time_to_acquire_hours=120,
        evidence_provided=["SOIL_MOISTURE", "VEGETATION_INDEX"],
        expected_confidence_delta=0.12,
    ),
    "COMMERCIAL_SAR": InformationAction(
        action_id="COMMERCIAL_SAR",
        description_ar="صورة SAR تجارية عالية الدقة (ICEYE/Capella)",
        cost_usd=150.0,
        time_to_acquire_hours=8,
        evidence_provided=["SAR_BACKSCATTER"],
        expected_confidence_delta=0.18,
    ),
    "COMMERCIAL_OPTICAL": InformationAction(
        action_id="COMMERCIAL_OPTICAL",
        description_ar="صورة بصرية تجارية 50cm (Pléiades)",
        cost_usd=50.0,
        time_to_acquire_hours=12,
        evidence_provided=["SOIL_MOISTURE", "VEGETATION_INDEX", "SURFACE_TEMP"],
        expected_confidence_delta=0.14,
    ),
    "DRONE_SURVEY": InformationAction(
        action_id="DRONE_SURVEY",
        description_ar="مسح بطائرة مسيّرة للمنطقة المشتبه بها",
        cost_usd=200.0,
        time_to_acquire_hours=6,
        evidence_provided=["SAR_BACKSCATTER", "SOIL_MOISTURE", "SURFACE_TEMP"],
        expected_confidence_delta=0.22,
    ),
    "FIELD_VISIT": InformationAction(
        action_id="FIELD_VISIT",
        description_ar="زيارة فريق ميداني وتحقق مباشر",
        cost_usd=500.0,
        time_to_acquire_hours=8,
        evidence_provided=["GROUND_TRUTH"],
        expected_confidence_delta=0.39,   # يرفع الثقة بشكل كبير
        provides_ground_truth=True,
    ),
    "PRESSURE_LOG": InformationAction(
        action_id="PRESSURE_LOG",
        description_ar="قراءة سجل ضغط من SCADA/ERP",
        cost_usd=0.0,
        time_to_acquire_hours=0.25,
        evidence_provided=["PRESSURE_SENSOR"],
        expected_confidence_delta=0.15,
    ),
}


@dataclass
class VoIResult:
    action: InformationAction
    voi_usd: float                   # القيمة الصافية (بعد طرح التكلفة)
    expected_savings_usd: float      # الوفورات المتوقعة
    break_even_probability: float    # أقل احتمال تسرب لتبرير هذا الإجراء
    recommendation: str


@dataclass
class VoIAnalysis:
    asset_id: str
    current_probability: float       # P(event)
    current_confidence: str
    daily_damage_usd: float
    action_evaluations: list[VoIResult]
    best_action: str
    best_voi_usd: float
    do_nothing_expected_loss_usd: float


class VoIEngine:
    """
    Value of Information Calculator.

    النموذج المستخدم:
      - يفترض أن القرار الوحيد هو: هل نُرسِّل فريقًا ميدانيًا؟
      - أي معلومة إضافية تُقلِّل قرارات خاطئة (FP + FN)
    """

    def __init__(
        self,
        asset_criticality: float = 0.85,       # 0→1
        cost_of_false_dispatch_usd: float = 500.0,  # تكلفة زيارة ميدانية غير ضرورية
        days_until_next_scheduled_check: int = 30,
    ):
        self.criticality = asset_criticality
        self.cost_fp = cost_of_false_dispatch_usd
        self.days_check = days_until_next_scheduled_check

    def analyze(
        self,
        asset_id: str,
        current_probability: float,    # P(leak) = winner_probability
        current_confidence: str,
        daily_damage_usd: float = 300.0,
        actions: list[InformationAction] | None = None,
    ) -> VoIAnalysis:

        if actions is None:
            actions = list(STANDARD_ACTIONS.values())

        # المتوقع بدون أي إجراء (Do Nothing)
        e_nothing = self._expected_loss_no_action(current_probability, daily_damage_usd)

        results: list[VoIResult] = []
        for action in actions:
            voi_result = self._evaluate_action(
                action, current_probability, daily_damage_usd, e_nothing
            )
            results.append(voi_result)

        results.sort(key=lambda r: r.voi_usd, reverse=True)

        best = results[0] if results else None
        best_action = best.action.action_id if best else "DO_NOTHING"
        best_voi    = best.voi_usd if best else 0.0

        return VoIAnalysis(
            asset_id=asset_id,
            current_probability=current_probability,
            current_confidence=current_confidence,
            daily_damage_usd=daily_damage_usd,
            action_evaluations=results,
            best_action=best_action,
            best_voi_usd=best_voi,
            do_nothing_expected_loss_usd=abs(e_nothing),
        )

    def _expected_loss_no_action(self, p_event: float, daily_damage: float) -> float:
        """
        التكلفة المتوقعة بدون أي إجراء.
        إذا كان الحدث حقيقيًا ولم نتصرف:
          - الخسارة = daily_damage × days_until_check
        إذا أرسلنا بدون تأكيد إضافي:
          - P(FP) × cost_of_false_dispatch
        """
        cost_miss  = p_event * daily_damage * self.days_check
        cost_delay = p_event * daily_damage * 2   # إضافي لتأخير الإصلاح
        return -(cost_miss + cost_delay)

    def _evaluate_action(
        self,
        action: InformationAction,
        p_event: float,
        daily_damage: float,
        e_nothing: float,
    ) -> VoIResult:
        """
        يُقيِّم القيمة الاقتصادية لإجراء معين.
        """
        # Confidence الجديد بعد الإجراء
        new_p = min(0.99, p_event + action.expected_confidence_delta * 0.5)
        # (الدليل يُؤكِّد أو ينفي، لذلك نفترض تحسنًا متوسطًا)

        if action.provides_ground_truth:
            # زيارة ميدانية: تُنهي عدم اليقين تمامًا
            # إذا مؤكد: نُصلِّح فورًا (نوفر بقية daily_damage)
            # إذا مرفوض: نُوفِّر تكلفة إرسال فرق مستقبلية خاطئة
            savings_if_confirmed = p_event * daily_damage * (self.days_check - 1)
            savings_if_denied    = (1 - p_event) * self.cost_fp * 0.5
            expected_savings = savings_if_confirmed + savings_if_denied
        else:
            # معلومة جزئية: تُقلِّل قرارات خاطئة
            decision_improvement = action.expected_confidence_delta
            expected_savings = (
                p_event * daily_damage * self.days_check * decision_improvement * 0.30 +
                (1 - p_event) * self.cost_fp * decision_improvement * 0.40
            )

        net_voi = expected_savings - action.cost_usd

        # Break-even probability
        if expected_savings > 0 and action.cost_usd > 0:
            be_prob = action.cost_usd / (daily_damage * self.days_check + self.cost_fp)
        else:
            be_prob = 0.0

        rec = self._build_recommendation(action, net_voi, p_event, be_prob)

        return VoIResult(
            action=action,
            voi_usd=round(net_voi, 0),
            expected_savings_usd=round(expected_savings, 0),
            break_even_probability=round(be_prob, 3),
            recommendation=rec,
        )

    def _build_recommendation(
        self, action: InformationAction, voi: float, p: float, be_prob: float
    ) -> str:
        if voi <= 0:
            return f"لا يُنصح به اقتصاديًا (VoI سالب)"
        if action.cost_usd == 0:
            return f"يُنصح به فورًا (مجاني ويُحسِّن الثقة)"
        if action.provides_ground_truth and p > be_prob:
            return f"يُنصح به (احتمال الحدث {p:.0%} > break-even {be_prob:.0%})"
        if voi > action.cost_usd * 2:
            return f"يُنصح به بقوة (العائد {voi:.0f}$ = {voi/action.cost_usd:.1f}× التكلفة)"
        return f"يُنصح به (VoI = {voi:.0f}$)"
