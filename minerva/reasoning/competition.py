"""
Hypothesis Competition Engine — Bayesian Abductive Reasoning.
يُجري منافسة بين الفرضيات الممكنة ويختار أفضل تفسير.

ADR-004: Bayesian بدون ML في Phase 0.
ADR-005: DATA_ERROR دائمًا في المنافسة.
ADR-006: Confidence و Evidence Completeness مقياسان مستقلان.
"""
import math
from dataclasses import dataclass, field
from typing import Optional
from minerva.anomaly.engine import AnomalyResult
from minerva.config import EVIDENCE_FILES, ASSET_TYPES


@dataclass
class HypothesisScore:
    event_type: str
    prior: float
    posterior: float
    evidence_support: list = field(default_factory=list)   # أدلة مؤيدة
    evidence_refuting: list = field(default_factory=list)  # أدلة رافضة
    causal_alignment: float = 0.0     # 0→1 مدى تطابق التسلسل السببي


@dataclass
class CompetitionResult:
    asset_id: str
    anomaly: AnomalyResult
    hypotheses: list[HypothesisScore]
    winner: str
    winner_probability: float
    competition_gap: float         # الفارق عن الثاني
    confidence_level: str
    evidence_completeness: float
    counterfactual: str            # ما الذي سيغير النتيجة؟
    recommendation: str


def _get_evidence_file(event_type: str, asset_type: str, biome: str = "ARID") -> Optional[dict]:
    return EVIDENCE_FILES.get((event_type, asset_type, biome))


def _bayesian_update(prior: float, likelihood_ratio: float) -> float:
    """
    Bayes: Posterior ∝ Prior × Likelihood
    نستخدم likelihood_ratio = P(evidence | hypothesis) / P(evidence | ~hypothesis)
    """
    if prior <= 0:
        return 0.0
    if prior >= 1:
        return 1.0
    # Odds form
    prior_odds = prior / (1 - prior)
    posterior_odds = prior_odds * max(likelihood_ratio, 1e-6)
    return posterior_odds / (1 + posterior_odds)


def _compute_likelihood_ratio(event_type: str, evidence_file: dict, anomaly: AnomalyResult, context: dict) -> tuple[float, list, list]:
    """
    يحسب نسبة الاحتمالية لفرضية معينة بناءً على الأدلة.
    Returns: (likelihood_ratio, support_evidence, refuting_evidence)
    """
    lr = 1.0
    support = []
    refuting = []

    # --- الأدلة المؤيدة ---
    for ev in evidence_file.get("confirming", []):
        signal = ev.get("signal")
        direction = ev.get("direction")
        min_z = ev.get("min_zscore", 1.5)
        weight = ev.get("weight", 0.1)

        if signal and signal in anomaly.z_scores:
            z = anomaly.z_scores[signal]
            if direction == "INCREASE" and z >= min_z:
                boost = 1.0 + weight * min(abs(z) / min_z, 3.0)
                lr *= boost
                support.append(f"{signal} ارتفع بـ {z:.1f}σ (متوقع لـ {event_type})")
            elif direction == "DECREASE" and z <= -min_z:
                boost = 1.0 + weight * min(abs(z) / min_z, 3.0)
                lr *= boost
                support.append(f"{signal} انخفض بـ {abs(z):.1f}σ (متوقع لـ {event_type})")
            elif direction == "NEAR_ZERO":
                max_val = ev.get("max_value_mm", 10)
                # يُفحص من قيمة الإشارة مباشرة
        elif "context_dimension" in ev:
            dim = ev["context_dimension"]
            condition = ev.get("condition")
            if context.get(dim) == condition:
                boost = 1.0 + weight * 2
                lr *= boost
                support.append(f"السياق [{dim}={condition}] يدعم {event_type}")

    # --- الأدلة الرافضة ---
    for ev in evidence_file.get("refuting", []):
        signal = ev.get("signal")
        condition = ev.get("condition")
        effect = ev.get("effect", "REDUCES_50PCT")
        reason = ev.get("reason", "")

        triggered = False
        if signal and signal == "PRECIPITATION":
            # يُفحص من الـ context moisture
            if condition == "HIGH" and context.get("moisture") == "WET":
                triggered = True
            elif condition == "NEAR_ZERO" and context.get("moisture") == "DRY":
                triggered = True
        elif "context_dimension" in ev:
            dim = ev["context_dimension"]
            cond = ev.get("condition")
            if context.get(dim) == cond:
                triggered = True

        if triggered:
            refuting.append(f"رافض: {reason}")
            if effect == "NULLIFIES":
                lr *= 0.02      # تقريبًا يُلغي الفرضية
            elif effect == "REDUCES_50PCT":
                lr *= 0.50
            elif effect == "REDUCES_40PCT":
                lr *= 0.60
            elif effect == "REDUCES_70PCT":
                lr *= 0.30

    return lr, support, refuting


class HypothesisCompetition:
    """
    يُجري منافسة بين فرضيات ممكنة لأصل ونوع محدد.
    """

    def __init__(self, asset_type: str, biome: str = "ARID"):
        self.asset_type = asset_type
        self.biome = biome
        self.possible_events = ASSET_TYPES.get(asset_type, {}).get("possible_events", [])

    def compete(
        self,
        anomaly: AnomalyResult,
        context: dict,             # {season, moisture, ops, vicinity}
    ) -> CompetitionResult:
        """
        يُشغِّل المنافسة ويُعيد CompetitionResult.
        """
        scores: list[HypothesisScore] = []

        for event_type in self.possible_events:
            ev_file = _get_evidence_file(event_type, self.asset_type, self.biome)
            if ev_file is None:
                # فرضية بدون ملف دليل → prior منخفض جدًا
                scores.append(HypothesisScore(
                    event_type=event_type,
                    prior=0.05,
                    posterior=0.05,
                ))
                continue

            prior = ev_file.get("base_prior", 0.10)
            lr, support, refuting_ev = _compute_likelihood_ratio(
                event_type, ev_file, anomaly, context
            )

            posterior = _bayesian_update(prior, lr)

            scores.append(HypothesisScore(
                event_type=event_type,
                prior=prior,
                posterior=posterior,
                evidence_support=support,
                evidence_refuting=refuting_ev,
            ))

        # Normalize
        total = sum(s.posterior for s in scores)
        if total > 0:
            for s in scores:
                s.posterior = round(s.posterior / total, 4)

        # ترتيب تنازلي
        scores.sort(key=lambda s: s.posterior, reverse=True)

        winner = scores[0]
        second = scores[1] if len(scores) > 1 else HypothesisScore("", 0, 0)
        gap = winner.posterior - second.posterior

        # Confidence level
        if anomaly.confidence_level == "INSUFFICIENT":
            conf = "INSUFFICIENT"
        elif winner.posterior > 0.75 and gap > 0.30:
            conf = "HIGH"
        elif winner.posterior > 0.50 and gap > 0.15:
            conf = "MEDIUM"
        else:
            conf = "LOW"

        # Counterfactual
        cf = self._build_counterfactual(winner.event_type, scores, context)

        # Recommendation
        rec = self._build_recommendation(conf, winner.event_type, anomaly)

        return CompetitionResult(
            asset_id=anomaly.asset_id,
            anomaly=anomaly,
            hypotheses=scores,
            winner=winner.event_type,
            winner_probability=winner.posterior,
            competition_gap=round(gap, 4),
            confidence_level=conf,
            evidence_completeness=anomaly.evidence_completeness,
            counterfactual=cf,
            recommendation=rec,
        )

    def _build_counterfactual(self, winner: str, scores: list, context: dict) -> str:
        parts = []
        if winner == "WATER_LEAK":
            parts.append("سيتغير الاستنتاج إذا:")
            if context.get("moisture") != "WET":
                parts.append("• تبيّن وجود أمطار غير مسجلة في بيانات الطقس")
            if context.get("ops") != "POST_MAINT":
                parts.append("• أكد ERP وجود صيانة غير مسجلة في هذه المنطقة")
            parts.append("• أظهر الفحص الميداني أن الشذوذ يبعد > 20m عن محور الأنبوب")
        else:
            parts.append(f"الاستنتاج ({winner}) سيتغير إذا أُزيل الدليل الرئيسي المؤيد له")
        return " | ".join(parts)

    def _build_recommendation(self, conf: str, winner: str, anomaly: AnomalyResult) -> str:
        if conf == "INSUFFICIENT":
            return "جمع بيانات إضافية قبل اتخاذ أي قرار"
        if conf == "HIGH":
            return f"تحقق ميداني عاجل خلال 48 ساعة — {winner} محتمل بثقة عالية"
        if conf == "MEDIUM":
            return f"مراقبة مكثفة + تحقق ميداني خلال أسبوع — {winner} محتمل"
        return "مراقبة يومية — الصورة غير واضحة، انتظر بيانات إضافية"
