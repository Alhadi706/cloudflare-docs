"""
Evidence Types — Core data model for Phase 1.
ADR-010: Dynamic Evidence vs Physical Facts.

Dynamic Evidence  → z-score from Behavior Profile (NDMI, LST, SAR...)
Physical Facts    → direct values from context/ERP (precipitation, maintenance, season...)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, Literal


EvidenceType = Literal["DYNAMIC", "PHYSICAL_FACT"]
EvidenceRole = Literal["CONFIRMING", "REFUTING", "DIFFERENTIATING", "NEUTRAL"]


# =============================================================================
# Evidence Quality (5-factor scoring)
# =============================================================================

@dataclass
class EvidenceQuality:
    data_quality: float          # جودة البيانات الخام (cloud cover, noise...)
    temporal_relevance: float    # حداثة الملاحظة نسبةً للحدث
    spatial_coverage: float      # نسبة منطقة الشذوذ المغطاة
    source_reliability: float    # موثوقية المصدر (calibration, track record)
    cross_source_consistency: float  # اتفاق مع مصادر أخرى تقيس نفس الشيء

    # أوزان العوامل الخمسة
    _WEIGHTS = (0.25, 0.25, 0.20, 0.15, 0.15)

    @property
    def composite_score(self) -> float:
        vals = (
            self.data_quality,
            self.temporal_relevance,
            self.spatial_coverage,
            self.source_reliability,
            self.cross_source_consistency,
        )
        return round(sum(w * v for w, v in zip(self._WEIGHTS, vals)), 3)

    @property
    def tier(self) -> str:
        s = self.composite_score
        if s >= 0.7:  return "HIGH"
        if s >= 0.4:  return "MEDIUM"
        if s >= 0.25: return "LOW"
        return "INSUFFICIENT"

    @classmethod
    def good(cls) -> "EvidenceQuality":
        """جودة جيدة — للاستخدام في الاختبارات والبيانات التركيبية."""
        return cls(0.90, 0.90, 0.85, 0.90, 0.85)

    @classmethod
    def fair(cls) -> "EvidenceQuality":
        return cls(0.70, 0.75, 0.65, 0.70, 0.60)


# =============================================================================
# Core Evidence Items
# =============================================================================

@dataclass
class DynamicEvidence:
    """
    دليل مبني على انحراف عن الـ Baseline.
    مصدر: Anomaly Engine.
    """
    signal_id: str                   # "SOIL_MOISTURE", "SURFACE_TEMP"...
    observed_value: float
    expected_value: float            # من الـ Behavior Profile
    z_score: float                   # (observed - expected) / std
    direction: str                   # "INCREASE" | "DECREASE" | "STABLE"
    quality: EvidenceQuality
    source_id: str = "unknown"
    obs_time: Optional[datetime] = None

    @property
    def magnitude(self) -> str:
        az = abs(self.z_score)
        if az >= 4:   return "EXTREME"
        if az >= 2.5: return "HIGH"
        if az >= 1.5: return "MEDIUM"
        return "LOW"

    @property
    def effective_weight_multiplier(self) -> float:
        """جودة الدليل تُعدِّل وزنه الفعلي."""
        q = self.quality.composite_score
        if q < 0.25:  return 0.0   # مستبعد
        if q < 0.40:  return 0.40
        if q < 0.70:  return 0.75
        return 1.0


@dataclass
class PhysicalFact:
    """
    حقيقة فيزيائية مباشرة — لا تحتاج baseline.
    مصدر: Context Resolver, ERP, Weather API.
    """
    fact_id: str                     # "PRECIPITATION_30D", "POST_MAINTENANCE", "SEASON"
    value: float | str | bool        # قيمة مباشرة
    unit: str = ""                   # "mm", "days", ""
    confidence: str = "HIGH"         # الحقائق المباشرة عادةً ثقتها عالية
    source_id: str = "context"
    obs_time: Optional[datetime] = None

    def is_high_confidence(self) -> bool:
        return self.confidence in ("HIGH", "MEDIUM")


# =============================================================================
# Evidence Bundle — مجموعة الأدلة لحادثة واحدة
# =============================================================================

@dataclass
class EvidenceBundle:
    """
    مجموعة الأدلة الكاملة لحادثة/أصل في لحظة معينة.
    تُغذَّى للـ Diagnostic Scorer.
    """
    asset_id: str
    obs_date: date
    context: dict                               # {season, moisture, ops, vicinity}
    dynamic: dict[str, DynamicEvidence] = field(default_factory=dict)
    physical: dict[str, PhysicalFact] = field(default_factory=dict)

    def add_dynamic(self, ev: DynamicEvidence):
        self.dynamic[ev.signal_id] = ev

    def add_physical(self, fact: PhysicalFact):
        self.physical[fact.fact_id] = fact

    def get_dynamic(self, signal_id: str) -> Optional[DynamicEvidence]:
        return self.dynamic.get(signal_id)

    def get_physical(self, fact_id: str) -> Optional[PhysicalFact]:
        return self.physical.get(fact_id)

    def get_precipitation_30d(self) -> float:
        p = self.physical.get("PRECIPITATION_30D")
        return float(p.value) if p else 0.0

    def get_precipitation_7d(self) -> float:
        p = self.physical.get("PRECIPITATION_7D")
        return float(p.value) if p else 0.0

    def is_post_maintenance(self) -> bool:
        p = self.physical.get("POST_MAINTENANCE")
        return bool(p.value) if p else False

    def is_irrigation_active(self) -> bool:
        return self.context.get("vicinity") == "IRRIGATION_ACTIVE"

    @property
    def n_dynamic_signals(self) -> int:
        return len(self.dynamic)

    @property
    def n_physical_facts(self) -> int:
        return len(self.physical)

    @property
    def evidence_completeness(self) -> float:
        """
        يُحسب لاحقًا مقارنةً بالـ Ideal Evidence Set للحدث المُستنتج.
        يُعاد تعيينه من الـ Scorer.
        """
        return getattr(self, "_completeness", 1.0)


# =============================================================================
# Evidence Rule — يعرّف كيف يرتبط دليل بفرضية
# =============================================================================

@dataclass
class EvidenceRule:
    """
    قاعدة تصف العلاقة بين دليل وفرضية.
    ADR-010: نوع الدليل يحدد طريقة تقييمه.
    """
    evidence_id: str
    evidence_type: EvidenceType        # "DYNAMIC" | "PHYSICAL_FACT"
    role: EvidenceRole                 # "CONFIRMING" | "REFUTING" | "DIFFERENTIATING"
    base_weight: float                 # يُعدَّل من WeightStore
    physical_reason: str
    condition: dict = field(default_factory=dict)
    temporal_lag_days: Optional[tuple] = None   # (min_days, max_days) بعد بداية الحدث

    def __post_init__(self):
        if not (0.0 <= self.base_weight <= 1.0):
            raise ValueError(f"weight must be 0-1, got {self.base_weight}")
