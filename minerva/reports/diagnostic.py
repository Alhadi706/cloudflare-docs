"""
Diagnostic Report — Explainability Layer.
كل تشخيص يُجيب على 6 أسئلة:
  1. ما الذي رصدته؟
  2. ما الذي قارنته؟
  3. ما التفسيرات؟
  4. لماذا اخترت هذا؟
  5. ما الأدلة المفقودة؟
  6. ما الذي سيغير رأيي؟ (Counterfactual)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from minerva.evidence.types import EvidenceBundle
from minerva.reasoning.scorer import DiagnosticScore, HypothesisEvaluation


@dataclass
class DiagnosticReport:
    """التقرير الكامل لحادثة واحدة."""
    asset_id: str
    obs_date: date

    # ما رُصد
    anomaly_score: float
    anomaly_severity: str

    # نتيجة التشخيص
    winner_event: str
    winner_probability: float
    confidence_level: str
    evidence_completeness: float
    is_unknown: bool

    # الشرح
    supporting_evidence: list[str]
    refuting_evidence: list[str]
    missing_evidence: list[str]
    rejected_hypotheses: list[dict]        # {event, reason}
    all_hypotheses_ranked: list[dict]      # {event, probability}
    causal_alignment: float

    # التوصية
    counterfactual: str
    recommendation: str
    field_priority: str                    # CRITICAL / HIGH / MEDIUM / LOW / WATCH

    def to_dict(self) -> dict:
        return {
            "asset_id": self.asset_id,
            "obs_date": str(self.obs_date),
            "anomaly": {
                "score": self.anomaly_score,
                "severity": self.anomaly_severity,
            },
            "diagnosis": {
                "event": self.winner_event,
                "probability": self.winner_probability,
                "confidence": self.confidence_level,
                "evidence_completeness": self.evidence_completeness,
                "is_unknown": self.is_unknown,
                "causal_alignment": self.causal_alignment,
            },
            "explanation": {
                "supporting": self.supporting_evidence,
                "refuting": self.refuting_evidence,
                "missing": self.missing_evidence,
                "rejected": self.rejected_hypotheses,
            },
            "all_hypotheses": self.all_hypotheses_ranked,
            "counterfactual": self.counterfactual,
            "recommendation": self.recommendation,
            "field_priority": self.field_priority,
        }

    def print_report(self):
        """طباعة التقرير بشكل مقروء."""
        sep = "─" * 55
        print(f"\n{sep}")
        print(f"  MINERVA Diagnostic Report")
        print(f"  Asset: {self.asset_id} | Date: {self.obs_date}")
        print(sep)
        print(f"  Anomaly Score: {self.anomaly_score:.3f} ({self.anomaly_severity})")
        print(sep)
        print(f"  DIAGNOSIS: {self.winner_event}")
        print(f"  Probability:          {self.winner_probability:.2%}")
        print(f"  Confidence:           {self.confidence_level}")
        print(f"  Evidence Completeness:{self.evidence_completeness:.0%}")
        print(f"  Causal Alignment:     {self.causal_alignment:.0%}")
        if self.is_unknown:
            print(f"\n  ⚠ UNKNOWN PATTERN — تشخيص غير مؤكد")
        print(f"\n  الأدلة المؤيدة:")
        for ev in self.supporting_evidence:
            print(f"    (+) {ev}")
        if self.refuting_evidence:
            print(f"\n  الأدلة المعارضة:")
            for ev in self.refuting_evidence:
                print(f"    (-) {ev}")
        if self.missing_evidence:
            print(f"\n  الأدلة المفقودة:")
            for ev in self.missing_evidence:
                print(f"    (?) {ev}")
        if self.rejected_hypotheses:
            print(f"\n  الفرضيات المُستبعدة:")
            for r in self.rejected_hypotheses:
                print(f"    ✗ {r['event']}: {r['reason']}")
        print(f"\n  جميع الفرضيات:")
        for h in self.all_hypotheses_ranked[:6]:
            bar = "█" * int(h["probability"] * 30)
            marker = " ←" if h["event"] == self.winner_event else ""
            print(f"    {h['event']:<28} {h['probability']:.3f} {bar}{marker}")
        print(f"\n  Counterfactual:")
        for line in self.counterfactual.split("\n"):
            print(f"    {line}")
        print(f"\n  التوصية [{self.field_priority}]:")
        print(f"    {self.recommendation}")
        print(sep)


class DiagnosticReportBuilder:
    """يبني DiagnosticReport من DiagnosticScore + EvidenceBundle."""

    def build(
        self,
        score: DiagnosticScore,
        bundle: EvidenceBundle,
        anomaly_score: float,
        anomaly_severity: str,
    ) -> DiagnosticReport:

        winner = score.all_hypotheses[0]

        # جمع الأدلة المؤيدة والمعارضة
        supporting = [
            e.explanation_ar
            for e in winner.evaluations
            if e.score_impact > 0.05
        ]
        refuting = [
            e.explanation_ar
            for e in winner.evaluations
            if e.score_impact < -0.05
        ]
        missing = winner.missing_evidence

        # الفرضيات المُستبعدة
        rejected = [
            {"event": h.event_type, "reason": h.rejection_reason}
            for h in score.all_hypotheses
            if h.is_rejected
        ]

        # ترتيب جميع الفرضيات
        all_ranked = [
            {"event": h.event_type, "probability": h.posterior}
            for h in score.all_hypotheses
        ]

        # Counterfactual
        cf = self._build_counterfactual(winner, bundle)

        # Recommendation + Priority
        rec, priority = self._build_recommendation(score)

        return DiagnosticReport(
            asset_id=bundle.asset_id,
            obs_date=bundle.obs_date,
            anomaly_score=anomaly_score,
            anomaly_severity=anomaly_severity,
            winner_event=score.winner_event,
            winner_probability=score.winner_probability,
            confidence_level=score.confidence_level,
            evidence_completeness=score.evidence_completeness,
            is_unknown=score.is_unknown,
            supporting_evidence=supporting,
            refuting_evidence=refuting,
            missing_evidence=missing,
            rejected_hypotheses=rejected,
            all_hypotheses_ranked=all_ranked,
            causal_alignment=winner.causal_alignment_score,
            counterfactual=cf,
            recommendation=rec,
            field_priority=priority,
        )

    def _build_counterfactual(self, winner: HypothesisEvaluation, bundle: EvidenceBundle) -> str:
        lines = ["سيتغير التشخيص إذا:"]

        if winner.event_type == "WATER_LEAK":
            p7 = bundle.get_precipitation_7d()
            if p7 < 10:
                lines.append("• تبيّن وجود هطول مطري غير مسجل في آخر 7 أيام (> 20mm)")
            if not bundle.is_post_maintenance():
                lines.append("• أكد ERP وجود صيانة غير مسجلة في المنطقة")
            lines.append("• أظهر الفحص الميداني أن الشذوذ يبعد > 20m عن محور الأنبوب")
            lines.append("• تبيّن أن قراءات الضغط في خط الأنابيب طبيعية تمامًا")

        elif winner.event_type == "IRRIGATION_EFFECT":
            lines.append("• تأكد أن لا ري نشط في المنطقة المحيطة")
            lines.append("• أظهرت الصور الجوية أن النمط مقتصر على محور الأنبوب (وليس الحقول)")

        else:
            lines.append(f"• زُيلت الأدلة المؤيدة الرئيسية لـ {winner.event_type}")

        return "\n".join(lines)

    def _build_recommendation(self, score: DiagnosticScore) -> tuple[str, str]:
        conf = score.confidence_level
        event = score.winner_event
        ec = score.evidence_completeness

        if score.is_unknown:
            return (
                "نمط مجهول — يحتاج تحقيقًا ميدانيًا فوريًا وجمع بيانات إضافية",
                "HIGH"
            )
        if conf == "INSUFFICIENT":
            return (
                f"بيانات غير كافية ({ec:.0%} من المثالي) — جمع بيانات إضافية قبل أي قرار",
                "WATCH"
            )
        if conf == "HIGH":
            return (
                f"تحقق ميداني عاجل خلال 48 ساعة — {event} محتمل بثقة عالية",
                "CRITICAL"
            )
        if conf == "MEDIUM":
            return (
                f"مراقبة مكثفة + تحقق ميداني خلال أسبوع — {event} محتمل",
                "HIGH"
            )
        return (
            "مراقبة يومية — الصورة غير واضحة، انتظر بيانات إضافية",
            "MEDIUM"
        )
