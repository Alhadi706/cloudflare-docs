"""
Adjustable Weight Store — ADR-012.
أوزان قابلة للتعديل مع حفظ التاريخ الكامل.
"""
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WeightUpdate:
    event_type: str
    evidence_id: str
    old_weight: float
    new_weight: float
    reason: str
    updated_by: str
    timestamp: str


class WeightStore:
    """
    Phase 0-1: أوزان يدوية مبنية على الفيزياء.
    Phase 4+: تُحدَّث من Ground Truth Feedback.
    """

    def __init__(self, version: str = "v1.0"):
        self.version = version
        self._weights: dict[tuple, float] = {}
        self._history: list[WeightUpdate] = []

    def get(self, event_type: str, evidence_id: str, default: float) -> float:
        return self._weights.get((event_type, evidence_id), default)

    def set(self, event_type: str, evidence_id: str, weight: float,
            reason: str, updated_by: str = "system"):
        key = (event_type, evidence_id)
        old = self._weights.get(key, weight)
        self._weights[key] = weight
        self._history.append(WeightUpdate(
            event_type=event_type,
            evidence_id=evidence_id,
            old_weight=old,
            new_weight=weight,
            reason=reason,
            updated_by=updated_by,
            timestamp=datetime.utcnow().isoformat(),
        ))

    def history(self) -> list[WeightUpdate]:
        return list(self._history)
