"""
MINERVA Lab — Scenario Library
================================
A BenchmarkScenario defines a reproducible test case:
  • Where to observe (target + geometry)
  • When (time range)
  • What should happen (expected detection + root cause)
  • Ground truth (what actually happened)

Scenarios are the unit of regression testing.
Every new MINERVA version must pass all stored scenarios.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional, List, Dict, Any


class ScenarioType(str, Enum):
    WATER_LEAK             = "WATER_LEAK"
    OIL_LEAK               = "OIL_LEAK"
    ILLEGAL_CONSTRUCTION   = "ILLEGAL_CONSTRUCTION"
    VEGETATION_LOSS        = "VEGETATION_LOSS"
    FIRE                   = "FIRE"
    FLOOD                  = "FLOOD"
    ROAD_DAMAGE            = "ROAD_DAMAGE"
    GROUND_DEFORMATION     = "GROUND_DEFORMATION"
    PIPELINE_ENCROACHMENT  = "PIPELINE_ENCROACHMENT"
    INFRASTRUCTURE_AGING   = "INFRASTRUCTURE_AGING"
    DROUGHT_STRESS         = "DROUGHT_STRESS"
    URBAN_EXPANSION        = "URBAN_EXPANSION"
    CUSTOM                 = "CUSTOM"


class ExpectedSeverity(str, Enum):
    WATCH    = "WATCH"
    WARNING  = "WARNING"
    ALERT    = "ALERT"
    CRITICAL = "CRITICAL"
    NONE     = "NONE"   # no anomaly expected


@dataclass
class GroundTruth:
    """
    What actually happened — the reference for measuring MINERVA.
    Populated from field verification, incident reports, or historical records.
    """
    event_occurred:       bool
    event_type:           Optional[str]            # WATER_LEAK | VEGETATION_LOSS | ...
    event_start_date:     Optional[date]
    event_end_date:       Optional[date]
    confirmed_location:   Optional[tuple]          # (lat, lon)
    location_radius_m:    Optional[float]          # confirmed affected radius
    severity:             Optional[str]            # 'minor' | 'moderate' | 'severe'
    source:               str = "UNKNOWN"          # 'FIELD_INSPECTION' | 'INCIDENT_REPORT' | 'HISTORICAL'
    notes:                str = ""


@dataclass
class BenchmarkScenario:
    """
    A reproducible test case for MINERVA.
    
    Executing the same scenario at different MINERVA versions
    measures whether quality improved, degraded, or stayed the same.
    """
    scenario_id:          str            # "WATER_LEAK_TRIPOLI_001"
    name:                 str
    scenario_type:        ScenarioType
    description:          str

    # Target definition
    target_id:            str            # existing target or "LAB_{uuid}"
    target_lat:           float
    target_lon:           float
    target_type:          str            # 'WATER_PIPELINE' | 'FARM_FIELD' | ...

    # Monitoring mission
    mission_type:         str            # 'WATER_LEAK_DETECTION' | 'VEGETATION_HEALTH' | ...

    # Time window
    observation_start:    date           # from which date to start replaying
    observation_end:      date           # replay cutoff (when "today" would be)
    event_expected_after: Optional[date] = None  # anomaly should be detected after this

    # Expected MINERVA outputs (what the scenario tests for)
    expected_detection:       bool = True
    expected_severity:        ExpectedSeverity = ExpectedSeverity.WARNING
    expected_root_cause:      Optional[str] = None
    expected_signal:          Optional[str] = None   # 'NDMI' | 'NDVI' | 'VV_dB' | ...
    expected_days_to_detect:  Optional[int] = None   # max acceptable detection delay

    # Ground truth
    ground_truth:             Optional[GroundTruth] = None

    # EO data sources to use in this scenario
    data_sources:             List[str] = field(default_factory=lambda: [
        "sentinel-2-l2a", "sentinel-1-rtc", "modis-11A1-061", "open-meteo"
    ])

    # Pass criteria
    pass_criteria: Dict[str, Any] = field(default_factory=lambda: {
        "detection_required":      True,
        "max_detection_delay_days": 30,
        "max_false_alarm_rate":    0.15,
        "min_confidence":          0.50,
    })

    # Metadata
    version_added:    str = "13.0.0"
    tags:             List[str] = field(default_factory=list)
    notes:            str = ""


# ── Built-in Scenario Library ─────────────────────────────────────────────────

class ScenarioLibrary:
    """
    Curated collection of benchmark scenarios.
    Add new scenarios with .register(), run with .get(id).
    """

    _scenarios: Dict[str, BenchmarkScenario] = {}

    @classmethod
    def register(cls, scenario: BenchmarkScenario) -> None:
        cls._scenarios[scenario.scenario_id] = scenario

    @classmethod
    def get(cls, scenario_id: str) -> Optional[BenchmarkScenario]:
        return cls._scenarios.get(scenario_id)

    @classmethod
    def list_all(cls) -> List[BenchmarkScenario]:
        return list(cls._scenarios.values())

    @classmethod
    def by_type(cls, stype: ScenarioType) -> List[BenchmarkScenario]:
        return [s for s in cls._scenarios.values() if s.scenario_type == stype]

    @classmethod
    def summary(cls) -> List[Dict[str, Any]]:
        return [
            {
                "id":          s.scenario_id,
                "name":        s.name,
                "type":        s.scenario_type.value,
                "location":    f"({s.target_lat:.3f}, {s.target_lon:.3f})",
                "period":      f"{s.observation_start} → {s.observation_end}",
                "expected":    s.expected_severity.value,
                "has_gt":      s.ground_truth is not None,
                "tags":        s.tags,
            }
            for s in cls._scenarios.values()
        ]


# ── Register Built-in Scenarios ───────────────────────────────────────────────

ScenarioLibrary.register(BenchmarkScenario(
    scenario_id          = "WATER_LEAK_TRIPOLI_001",
    name                 = "تسرب مياه — خط الأنابيب — غرب طرابلس",
    scenario_type        = ScenarioType.WATER_LEAK,
    description          = (
        "اختبار كشف تسرب مياه تحت الأرض في منطقة حضرية شبه جافة."
        " النمط المتوقع: ارتفاع تدريجي في NDMI مع ثبات هطل الأمطار."
    ),
    target_id            = "LAB-PIPE-WTR-TRIPOLI-W",
    target_lat           = 32.89,
    target_lon           = 13.18,
    target_type          = "WATER_PIPELINE",
    mission_type         = "WATER_LEAK_DETECTION",
    observation_start    = date(2026, 1, 1),
    observation_end      = date(2026, 7, 9),
    event_expected_after = date(2026, 5, 1),
    expected_detection   = True,
    expected_severity    = ExpectedSeverity.WARNING,
    expected_signal      = "NDMI",
    expected_days_to_detect = 30,
    ground_truth         = GroundTruth(
        event_occurred    = True,
        event_type        = "WATER_LEAK",
        event_start_date  = date(2026, 5, 15),
        event_end_date    = None,
        confirmed_location= (32.89, 13.18),
        location_radius_m = 250,
        severity          = "moderate",
        source            = "HISTORICAL",
        notes             = "اتجاه NDMI تراجعي حقيقي من Sentinel-2 خلال 2026",
    ),
    pass_criteria = {
        "detection_required":      True,
        "max_detection_delay_days": 45,
        "max_false_alarm_rate":    0.20,
        "min_confidence":          0.50,
    },
    tags     = ["water", "tripoli", "real-data"],
    notes    = "يستخدم بيانات Sentinel-2 حقيقية لطرابلس 2026",
))

ScenarioLibrary.register(BenchmarkScenario(
    scenario_id          = "VEGETATION_LOSS_BENGHAZI_001",
    name                 = "تراجع الغطاء النباتي — منطقة بنغازي",
    scenario_type        = ScenarioType.VEGETATION_LOSS,
    description          = "كشف تراجع NDVI في منطقة زراعية مرويّة.",
    target_id            = "LAB-FARM-BGZ-001",
    target_lat           = 32.12,
    target_lon           = 20.07,
    target_type          = "FARM_FIELD",
    mission_type         = "VEGETATION_HEALTH",
    observation_start    = date(2026, 3, 1),
    observation_end      = date(2026, 7, 9),
    expected_detection   = True,
    expected_severity    = ExpectedSeverity.WARNING,
    expected_signal      = "NDVI",
    data_sources         = ["sentinel-2-l2a", "modis-11A1-061", "open-meteo"],
    pass_criteria = {
        "detection_required":      True,
        "max_detection_delay_days": 21,
        "max_false_alarm_rate":    0.15,
        "min_confidence":          0.45,
    },
    tags = ["vegetation", "benghazi", "agriculture"],
))

ScenarioLibrary.register(BenchmarkScenario(
    scenario_id          = "GROUND_DEFORMATION_COASTAL_001",
    name                 = "تشوه أرضي — المنطقة الساحلية",
    scenario_type        = ScenarioType.GROUND_DEFORMATION,
    description          = "كشف تغير غير طبيعي في إشارة SAR يشير لحركة أرضية.",
    target_id            = "LAB-COASTAL-DEFORM-001",
    target_lat           = 32.90,
    target_lon           = 13.20,
    target_type          = "ROAD_SEGMENT",
    mission_type         = "SUBSIDENCE_MONITORING",
    observation_start    = date(2026, 4, 1),
    observation_end      = date(2026, 7, 9),
    expected_detection   = True,
    expected_severity    = ExpectedSeverity.ALERT,
    expected_signal      = "VV_dB",
    data_sources         = ["sentinel-1-rtc", "open-meteo"],
    pass_criteria = {
        "detection_required":      True,
        "max_detection_delay_days": 14,
        "max_false_alarm_rate":    0.10,
        "min_confidence":          0.55,
    },
    tags = ["sar", "deformation", "coastal"],
))

ScenarioLibrary.register(BenchmarkScenario(
    scenario_id          = "NO_ANOMALY_STABLE_001",
    name                 = "لا شذوذ — منطقة مستقرة (اختبار الإيجابيات الكاذبة)",
    scenario_type        = ScenarioType.CUSTOM,
    description          = (
        "اختبار معكوس: لا ينبغي أن تُولَّد أي إنذارات."
        " يختبر معدل الإيجابيات الكاذبة."
    ),
    target_id            = "LAB-STABLE-AREA-001",
    target_lat           = 32.85,
    target_lon           = 13.10,
    target_type          = "WATER_PIPELINE",
    mission_type         = "WATER_LEAK_DETECTION",
    observation_start    = date(2026, 1, 1),
    observation_end      = date(2026, 4, 1),
    expected_detection   = False,
    expected_severity    = ExpectedSeverity.NONE,
    ground_truth         = GroundTruth(
        event_occurred   = False,
        event_type       = None,
        event_start_date = None,
        event_end_date   = None,
        confirmed_location= None,
        location_radius_m= None,
        severity         = None,
        source           = "HISTORICAL",
        notes            = "لا حوادث مسجلة في هذه الفترة",
    ),
    pass_criteria = {
        "detection_required":      False,
        "max_false_alarm_rate":    0.05,  # اختبار صارم للـ FPR
        "min_confidence":          0.0,
    },
    tags = ["negative-test", "false-alarm-check"],
))
