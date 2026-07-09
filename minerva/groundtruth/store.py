"""
Ground Truth Store — بنية بيانات لتخزين نتائج التحقق الميداني.
جاهزة لـ Phase 4 (Ground Truth Loop) دون ML الآن.
ADR-012: الأوزان ستُحدَّث من هنا لاحقًا.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, Literal
import json
from pathlib import Path


VerificationOutcome = Literal[
    "CONFIRMED",        # التنبيه كان صحيحًا، الحدث مؤكد
    "FALSE_POSITIVE",   # التنبيه كان خاطئًا
    "MISCLASSIFIED",    # الحدث صحيح لكن نوعه مختلف
    "NO_ACCESS",        # المنطقة غير وصولة
]


@dataclass
class FieldVerification:
    """نتيجة تحقق ميداني واحد."""
    fv_id: str
    asset_id: str
    obs_date: date
    diagnosed_event: str               # ما قاله النظام
    outcome: VerificationOutcome
    actual_event: Optional[str]        # الحدث الحقيقي (عند CONFIRMED أو MISCLASSIFIED)
    confidence_was: str                # ثقة النظام عند التشخيص
    probability_was: float
    evidence_completeness_was: float
    verified_by: str
    verified_at: datetime
    field_notes: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None

    # ما يجب تحديثه في النظام بعد هذا التحقق
    @property
    def weight_update_needed(self) -> bool:
        return self.outcome in ("FALSE_POSITIVE", "MISCLASSIFIED")

    @property
    def baseline_update_safe(self) -> bool:
        """هل يمكن إضافة هذه الملاحظة للـ Baseline؟"""
        return self.outcome in ("FALSE_POSITIVE",)  # إنذار خاطئ = ملاحظة طبيعية


class GroundTruthStore:
    """
    مخزن بيانات التحقق الميداني.
    Phase 1: تخزين + إحصاءات فقط.
    Phase 4: يُطلق Weight Updates + Baseline Updates.
    """

    def __init__(self, store_path: Optional[Path] = None):
        self.records: list[FieldVerification] = []
        self.store_path = store_path

    def add(self, record: FieldVerification):
        self.records.append(record)
        if self.store_path:
            self._persist()

    def get_stats(self) -> dict:
        if not self.records:
            return {"n": 0}

        outcomes = [r.outcome for r in self.records]
        n = len(outcomes)
        confirmed = outcomes.count("CONFIRMED")
        fp = outcomes.count("FALSE_POSITIVE")
        misclassified = outcomes.count("MISCLASSIFIED")

        return {
            "n": n,
            "confirmed": confirmed,
            "false_positive": fp,
            "misclassified": misclassified,
            "no_access": outcomes.count("NO_ACCESS"),
            "precision": round(confirmed / max(n - outcomes.count("NO_ACCESS"), 1), 3),
            "ready_for_weight_update": sum(1 for r in self.records if r.weight_update_needed),
        }

    def get_event_precision(self, event_type: str) -> float:
        """دقة النظام لحدث معين بناءً على التحقق الميداني."""
        relevant = [r for r in self.records if r.diagnosed_event == event_type]
        if not relevant:
            return 0.0
        confirmed = sum(1 for r in relevant if r.outcome == "CONFIRMED")
        return round(confirmed / len(relevant), 3)

    def _persist(self):
        if self.store_path:
            data = [
                {
                    "fv_id": r.fv_id,
                    "asset_id": r.asset_id,
                    "obs_date": str(r.obs_date),
                    "diagnosed_event": r.diagnosed_event,
                    "outcome": r.outcome,
                    "actual_event": r.actual_event,
                    "verified_by": r.verified_by,
                    "verified_at": r.verified_at.isoformat(),
                }
                for r in self.records
            ]
            self.store_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
