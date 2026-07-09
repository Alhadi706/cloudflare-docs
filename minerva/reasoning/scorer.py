"""
Diagnostic Scorer — قلب Phase 1.
يُشغِّل منافسة الفرضيات بطريقة مختلفة جذريًا عن Phase 0:

Phase 0: z-scores فقط → likelihood ratio بسيط
Phase 1: Dynamic Evidence + Physical Facts → تقييم منفصل ومدروس

ADR-010: Evidence Types مفصولة
ADR-011: يعمل مع AssetKnowledge أي
ADR-012: أوزان قابلة للتعديل
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional
from minerva.evidence.types import EvidenceBundle, EvidenceRule, DynamicEvidence, PhysicalFact
from minerva.reasoning.catalogue import AssetKnowledge
from minerva.reasoning.weights import WeightStore


# =============================================================================
# Scoring Result Types
# =============================================================================

@dataclass
class EvidenceEvaluation:
    """تقييم دليل واحد."""
    evidence_id: str
    evidence_type: str
    role: str
    raw_value: float | str | bool
    score_impact: float             # كيف أثّر على الاحتمال (+/-)
    was_present: bool
    explanation_ar: str


@dataclass
class HypothesisEvaluation:
    event_type: str
    prior: float
    posterior: float
    evaluations: list[EvidenceEvaluation] = field(default_factory=list)
    causal_alignment_score: float = 0.0
    missing_evidence: list[str] = field(default_factory=list)
    rejection_reason: Optional[str] = None   # None = not rejected

    @property
    def is_rejected(self) -> bool:
        return self.rejection_reason is not None

    @property
    def supporting_count(self) -> int:
        return sum(1 for e in self.evaluations if e.score_impact > 0.05)

    @property
    def refuting_count(self) -> int:
        return sum(1 for e in self.evaluations if e.score_impact < -0.05)


@dataclass
class DiagnosticScore:
    """نتيجة الكشف الكاملة لحادثة واحدة."""
    asset_id: str
    winner_event: str
    winner_probability: float
    competition_gap: float
    all_hypotheses: list[HypothesisEvaluation]
    evidence_completeness: float
    confidence_level: str
    is_unknown: bool = False
    unknown_reason: Optional[str] = None


# =============================================================================
# Scorer
# =============================================================================

# Impact multipliers for Physical Fact conditions
_IMPACT_MAP = {
    "STRONG_BOOST":   3.0,
    "MODERATE_BOOST": 1.5,
    "NULLIFY":        0.02,
    "HALVE":          0.50,
    "REDUCE_30PCT":   0.70,
    "MODERATE_PENALTY": 0.80,
}


class DiagnosticScorer:
    """
    ADR-011: Generic — يعمل مع أي AssetKnowledge.
    ADR-012: يستخدم WeightStore للأوزان القابلة للتعديل.
    """

    def __init__(self, knowledge: AssetKnowledge, weight_store: Optional[WeightStore] = None):
        self.knowledge = knowledge
        self.weights = weight_store or WeightStore()

    def score_all(
        self,
        bundle: EvidenceBundle,
        biome: str = "ARID",
    ) -> DiagnosticScore:
        """
        يُشغِّل المنافسة الكاملة على جميع الفرضيات الممكنة.
        """
        possible = self.knowledge.get_possible_events(bundle.context)
        impossible = set(self.knowledge.get_impossible_events())

        evaluations: list[HypothesisEvaluation] = []

        for event_type in possible:
            # استبعاد المستحيل فيزيائيًا (Hard Rule)
            if event_type in impossible:
                eval_ = HypothesisEvaluation(
                    event_type=event_type,
                    prior=0.0,
                    posterior=0.0,
                    rejection_reason=f"مستحيل فيزيائيًا لهذا النوع من الأصول",
                )
                evaluations.append(eval_)
                continue

            prior = self.knowledge.get_base_prior(event_type, bundle.context)
            rules = self.knowledge.get_evidence_rules(event_type, biome)

            posterior, ev_evals, missing = self._score_hypothesis(
                event_type, prior, rules, bundle
            )

            # Causal alignment bonus
            causal_score = self._check_causal_alignment(event_type, bundle)

            # تطبيق bonus على الاحتمالية (وليس الـ prior)
            if causal_score > 0.5:
                posterior *= (1 + 0.25 * causal_score)

            eval_ = HypothesisEvaluation(
                event_type=event_type,
                prior=prior,
                posterior=posterior,
                evaluations=ev_evals,
                causal_alignment_score=causal_score,
                missing_evidence=missing,
            )
            evaluations.append(eval_)

        # تطبيع
        total = sum(e.posterior for e in evaluations)
        if total > 1e-9:
            for e in evaluations:
                e.posterior = round(e.posterior / total, 4)

        evaluations.sort(key=lambda e: e.posterior, reverse=True)

        # Winner + Gap
        winner = evaluations[0]
        second = evaluations[1] if len(evaluations) > 1 else HypothesisEvaluation("", 0, 0)
        gap = winner.posterior - second.posterior

        # Evidence Completeness: كم % من الأدلة المثالية موجودة؟
        ideal_signals = set(self.knowledge.get_key_signals())
        present_signals = set(bundle.dynamic.keys())
        ec = len(present_signals & ideal_signals) / max(len(ideal_signals), 1)
        bundle._completeness = round(ec, 2)

        # Confidence
        conf = self._compute_confidence(winner.posterior, gap, ec, bundle)

        # Unknown Pattern?
        is_unknown = (winner.posterior < 0.35 or gap < 0.10) and not winner.is_rejected
        unknown_reason = None
        if is_unknown:
            unknown_reason = (
                f"لا توجد فرضية واضحة: الفائز بـ {winner.posterior:.2f} فقط، "
                f"فارق المنافسة {gap:.2f}"
            )

        return DiagnosticScore(
            asset_id=bundle.asset_id,
            winner_event=winner.event_type,
            winner_probability=winner.posterior,
            competition_gap=gap,
            all_hypotheses=evaluations,
            evidence_completeness=ec,
            confidence_level=conf,
            is_unknown=is_unknown,
            unknown_reason=unknown_reason,
        )

    def _score_hypothesis(
        self,
        event_type: str,
        prior: float,
        rules: list[EvidenceRule],
        bundle: EvidenceBundle,
    ) -> tuple[float, list[EvidenceEvaluation], list[str]]:
        """
        يُقيِّم فرضية واحدة. يُعيد (posterior, evaluations, missing_evidence).
        """
        score = prior
        ev_evals: list[EvidenceEvaluation] = []
        missing: list[str] = []

        for rule in rules:
            # جلب الوزن الفعلي من WeightStore
            effective_weight = self.weights.get(event_type, rule.evidence_id, rule.base_weight)

            if rule.evidence_type == "DYNAMIC":
                dyn = bundle.get_dynamic(rule.evidence_id)
                if dyn is None:
                    missing.append(rule.evidence_id)
                    continue
                score, impact, expl = self._apply_dynamic_rule(score, dyn, rule, effective_weight)

            elif rule.evidence_type == "PHYSICAL_FACT":
                fact = bundle.get_physical(rule.evidence_id)
                if fact is None:
                    missing.append(rule.evidence_id)
                    continue
                score, impact, expl = self._apply_physical_rule(score, fact, rule, effective_weight)
            else:
                continue

            ev_evals.append(EvidenceEvaluation(
                evidence_id=rule.evidence_id,
                evidence_type=rule.evidence_type,
                role=rule.role,
                raw_value=dyn.z_score if rule.evidence_type == "DYNAMIC" else fact.value,
                score_impact=impact,
                was_present=True,
                explanation_ar=expl,
            ))

        return score, ev_evals, missing

    def _apply_dynamic_rule(
        self,
        current_score: float,
        dyn: DynamicEvidence,
        rule: EvidenceRule,
        weight: float,
    ) -> tuple[float, float, str]:
        """
        يُطبِّق قاعدة Dynamic. يُعيد (new_score, impact, explanation).
        """
        # تعديل الوزن بجودة الدليل
        weight *= dyn.effective_weight_multiplier

        cond = rule.condition
        direction_match = (
            cond.get("direction") in ("ANY", dyn.direction)
            or cond.get("direction") is None
        )
        min_z = cond.get("min_z", 1.0)
        z = abs(dyn.z_score)

        if not direction_match or z < min_z:
            # اتجاه معاكس أو ضعيف → خفض بسيط
            penalty = 1.0 - weight * 0.3
            new_score = current_score * max(penalty, 0.5)
            impact = new_score - current_score
            expl = (
                f"{dyn.signal_id}: {dyn.direction} بـ {dyn.z_score:+.1f}σ "
                f"(غير متوافق مع {rule.role.lower()})"
            )
            return new_score, impact, expl

        # متوافق → زيادة بحسب شدة الانحراف
        boost_per_sigma = cond.get("boost_per_sigma", 0.05)
        sigma_multiplier = min(z / max(min_z, 1.0), 4.0)
        boost = 1.0 + weight * boost_per_sigma * sigma_multiplier * 20

        new_score = current_score * boost
        impact = new_score - current_score
        expl = (
            f"{dyn.signal_id} {dyn.direction} بـ {dyn.z_score:+.1f}σ "
            f"(متوقع لـ {rule.role.lower()}: {rule.physical_reason})"
        )
        return new_score, impact, expl

    def _apply_physical_rule(
        self,
        current_score: float,
        fact: PhysicalFact,
        rule: EvidenceRule,
        weight: float,
    ) -> tuple[float, float, str]:
        """
        يُطبِّق قاعدة Physical Fact. يُعيد (new_score, impact, explanation).
        ADR-010: الحقائق الفيزيائية لها تأثير مباشر وصريح.
        """
        cond = rule.condition
        cond_type = cond.get("type", "any")

        multiplier = 1.0
        triggered = False
        effect_label = ""

        if cond_type == "threshold":
            val = float(fact.value) if not isinstance(fact.value, bool) else 0.0
            op = cond.get("operator", ">=")
            threshold = cond.get("value", 0.0)

            condition_met = (
                (op == "<=" and val <= threshold) or
                (op == ">=" and val >= threshold) or
                (op == "<"  and val < threshold) or
                (op == ">"  and val > threshold)
            )

            if condition_met:
                triggered = True
                effect_key = cond.get("if_true", "MODERATE_BOOST")
                multiplier = _IMPACT_MAP.get(effect_key, 1.5)
                effect_label = effect_key
            else:
                effect_key = cond.get("if_false", "")
                if effect_key:
                    multiplier = _IMPACT_MAP.get(effect_key, 1.0)
                    triggered = True
                    effect_label = effect_key

        elif cond_type == "boolean":
            if bool(fact.value):
                triggered = True
                effect_key = cond.get("if_true", "MODERATE_BOOST")
                multiplier = _IMPACT_MAP.get(effect_key, 1.5)
                effect_label = effect_key

        elif cond_type == "any":
            pass  # لا تأثير

        new_score = current_score * multiplier
        impact = new_score - current_score

        if triggered:
            expl = (
                f"{fact.fact_id}={fact.value}{fact.unit}: "
                f"{effect_label} → {rule.physical_reason}"
            )
        else:
            expl = f"{fact.fact_id}={fact.value}{fact.unit}: لا تأثير"

        return new_score, impact, expl

    def _check_causal_alignment(self, event_type: str, bundle: EvidenceBundle) -> float:
        """
        يتحقق من تطابق التسلسل السببي المتوقع مع الأدلة الموجودة.
        يُعيد 0→1 (0=لا تطابق, 1=تطابق كامل).
        """
        chain = self.knowledge.get_causal_chain(event_type)
        if not chain:
            return 0.0

        required_steps = [s for s in chain if s.is_required]
        matched = 0

        for step in required_steps:
            dyn = bundle.get_dynamic(step.signal_id)
            if dyn and dyn.direction == step.direction and abs(dyn.z_score) > 1.0:
                matched += 1

        return matched / max(len(required_steps), 1)

    def _compute_confidence(
        self,
        winner_prob: float,
        gap: float,
        ec: float,
        bundle: EvidenceBundle,
    ) -> str:
        """ADR-006: Confidence ≠ Evidence Completeness."""
        if ec < 0.3:
            return "INSUFFICIENT"
        if winner_prob > 0.70 and gap > 0.30:
            return "HIGH"
        if winner_prob > 0.45 and gap > 0.15:
            return "MEDIUM"
        return "LOW"
