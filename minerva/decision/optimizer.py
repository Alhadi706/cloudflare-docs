"""
Recommendation Optimizer — اختر أقل تكلفة تحقق أعلى يقين.

يبني "مسار التحقق" الأمثل:
  مدخل: تشخيص بثقة C
  هدف: الوصول إلى ثقة T (مثلًا 90%) بأقل تكلفة
  مخرج: سلسلة من الإجراءات + التكلفة الكاملة + الوقت

الخوارزمية: Greedy بناءً على نسبة الرفع/التكلفة.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from minerva.decision.voi import InformationAction, STANDARD_ACTIONS


@dataclass
class RecommendationStep:
    step: int
    action: InformationAction
    confidence_before: float
    confidence_after: float
    cumulative_cost_usd: float
    cumulative_time_hours: float
    rationale: str


@dataclass
class OptimizationResult:
    current_confidence: float
    target_confidence: float
    steps: list[RecommendationStep]
    total_cost_usd: float
    total_time_hours: float
    achievable: bool                  # هل الهدف قابل للتحقق؟
    final_confidence: float
    decision_at_target: str           # ماذا نفعل عند بلوغ الهدف؟
    alternative_paths: list[dict]     # مسارات بديلة


class RecommendationOptimizer:
    """
    يُرتِّب الإجراءات بحسب نسبة الفائدة / التكلفة.
    يُنشئ مسار أقل تكلفة للوصول إلى هدف الثقة.

    الخوارزمية الجشعة (Greedy):
      1. احسب value-per-dollar لكل إجراء متاح
      2. اختر الأعلى
      3. حدِّث الـ Confidence
      4. كرِّر حتى تبلغ الهدف أو تنفد الإجراءات
    """

    def __init__(
        self,
        target_confidence: float = 0.85,
        max_cost_usd: float = 2000.0,
        max_time_hours: float = 72.0,
    ):
        self.target = target_confidence
        self.max_cost = max_cost_usd
        self.max_time = max_time_hours

    def optimize(
        self,
        current_confidence: float,
        event_probability: float,
        available_actions: list[InformationAction] | None = None,
        already_taken: set[str] | None = None,
    ) -> OptimizationResult:

        if available_actions is None:
            available_actions = list(STANDARD_ACTIONS.values())
        already_taken = already_taken or set()

        remaining = [a for a in available_actions if a.action_id not in already_taken]

        steps: list[RecommendationStep] = []
        conf = current_confidence
        total_cost = 0.0
        total_time = 0.0
        taken_ids: set[str] = set()

        # خطوة 0: الإجراءات المجانية أولًا
        for action in sorted(remaining, key=lambda a: (a.cost_usd, -a.expected_confidence_delta)):
            if conf >= self.target:
                break
            if total_cost + action.cost_usd > self.max_cost:
                continue
            if total_time + action.time_to_acquire_hours > self.max_time:
                continue
            if action.action_id in taken_ids:
                continue

            conf_before = conf
            conf = min(1.0, conf + action.expected_confidence_delta)
            total_cost += action.cost_usd
            total_time  = max(total_time, action.time_to_acquire_hours)
            taken_ids.add(action.action_id)

            steps.append(RecommendationStep(
                step=len(steps) + 1,
                action=action,
                confidence_before=round(conf_before, 3),
                confidence_after=round(conf, 3),
                cumulative_cost_usd=total_cost,
                cumulative_time_hours=total_time,
                rationale=self._build_rationale(action, conf_before, conf),
            ))

        achievable = conf >= self.target
        decision = self._final_decision(conf, event_probability)

        # مسارات بديلة (للمقارنة)
        alternatives = self._find_alternative_paths(
            current_confidence, available_actions, taken_ids
        )

        return OptimizationResult(
            current_confidence=current_confidence,
            target_confidence=self.target,
            steps=steps,
            total_cost_usd=total_cost,
            total_time_hours=total_time,
            achievable=achievable,
            final_confidence=round(conf, 3),
            decision_at_target=decision,
            alternative_paths=alternatives,
        )

    def _build_rationale(self, action: InformationAction, before: float, after: float) -> str:
        gain = after - before
        if action.cost_usd == 0:
            return f"مجاني، يرفع الثقة +{gain:.0%}"
        roi = gain / max(action.cost_usd / 1000, 1e-6)
        return (
            f"يرفع الثقة +{gain:.0%} بتكلفة ${action.cost_usd:.0f} "
            f"(ROI: {roi:.1f} نقطة ثقة / $1000)"
        )

    def _final_decision(self, confidence: float, p_event: float) -> str:
        if confidence >= 0.90:
            return "إرسال فريق ميداني فورًا — ثقة كافية"
        if confidence >= 0.70:
            return "إرسال فريق ميداني مع تقرير مفصل — ثقة جيدة"
        if confidence >= 0.50:
            return "تحقق في ظرف أسبوع — ثقة متوسطة"
        return "مراقبة مستمرة — ثقة منخفضة، لا إجراء فوري"

    def _find_alternative_paths(
        self,
        start_conf: float,
        all_actions: list[InformationAction],
        primary_path: set[str],
    ) -> list[dict]:
        """
        مسار بديل: الأسرع (بغض النظر عن التكلفة).
        """
        # المسار الأسرع
        sorted_by_speed = sorted(all_actions, key=lambda a: a.time_to_acquire_hours)
        conf = start_conf
        cost = 0.0
        for a in sorted_by_speed:
            if conf >= self.target:
                break
            conf = min(1.0, conf + a.expected_confidence_delta)
            cost += a.cost_usd

        alt1 = {
            "name": "المسار الأسرع",
            "final_confidence": round(conf, 3),
            "total_cost_usd": cost,
            "total_time_hours": sorted_by_speed[0].time_to_acquire_hours if sorted_by_speed else 0,
        }

        # المسار الأوحد (زيارة ميدانية مباشرة)
        field_visit = next((a for a in all_actions if a.provides_ground_truth), None)
        alt2 = {
            "name": "زيارة ميدانية مباشرة",
            "final_confidence": round(start_conf + (field_visit.expected_confidence_delta if field_visit else 0), 3),
            "total_cost_usd": field_visit.cost_usd if field_visit else 500,
            "total_time_hours": field_visit.time_to_acquire_hours if field_visit else 8,
        }

        return [alt1, alt2]
