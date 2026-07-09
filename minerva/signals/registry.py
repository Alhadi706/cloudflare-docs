"""
Signal Abstraction Layer — core data model.
المبدأ: Observation يحمل Physical Signal ID، ليس اسم المصدر.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class SignalObservation:
    """
    وحدة البيانات الأساسية في MINERVA.
    لا تحمل اسم القمر الصناعي، بل المعنى الفيزيائي للإشارة.
    """
    asset_id: str
    signal_id: str             # من PHYSICAL_SIGNALS في config.py
    value: float
    obs_time: datetime
    source_id: str             # sentinel2_ndmi, synthetic_ndmi, open_meteo...
    quality_score: float       # Evidence Quality 0→1 (يُحسب من quality.py)

    # Spatial context
    lat: Optional[float] = None
    lon: Optional[float] = None
    spatial_coverage_pct: float = 1.0   # كم % من منطقة الأصل تغطيها هذه الملاحظة

    # Metadata
    cloud_cover_pct: float = 0.0        # للبصري فقط
    is_event_period: bool = False        # هل هذه فترة حدث مؤكد؟ (لا تُضاف للـ Baseline)

    def __post_init__(self):
        if not (0.0 <= self.quality_score <= 1.0):
            raise ValueError(f"quality_score must be 0-1, got {self.quality_score}")


@dataclass
class ObservationBundle:
    """
    مجموعة ملاحظات في نفس الوقت التقريبي لأصل واحد.
    هذا هو المدخل للـ Anomaly Engine.
    """
    asset_id: str
    bundle_time: datetime
    observations: list[SignalObservation] = field(default_factory=list)
    context: Optional[dict] = None      # يُملأ من Context Resolver

    @property
    def signal_values(self) -> dict[str, float]:
        """قاموس: signal_id → value"""
        return {obs.signal_id: obs.value for obs in self.observations}

    @property
    def signal_qualities(self) -> dict[str, float]:
        """قاموس: signal_id → quality_score"""
        return {obs.signal_id: obs.quality_score for obs in self.observations}

    @property
    def available_signals(self) -> list[str]:
        return [obs.signal_id for obs in self.observations if obs.quality_score >= 0.3]
