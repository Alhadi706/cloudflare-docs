"""
MINERVA Core — MonitoringTarget (replaces "Asset" concept)
===========================================================

A MonitoringTarget is the universal entity in MINERVA Phase 10+.
It can represent ANY geographic feature:
  • Infrastructure asset (pipeline, pump, bridge, dam)
  • Agricultural area (farm field, crop zone, orchard)
  • Natural area (forest, wetland, watershed)
  • Urban area (city sector, district, building block)
  • Resource site (oil field, quarry, mining zone)
  • User-defined polygon (custom boundary)
  • Administrative region

The Digital Twin is built around the entity lifecycle,
NOT around satellite data availability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple


# ── Target Type Taxonomy ──────────────────────────────────────────────────────

class TargetType(str, Enum):
    # Infrastructure
    PIPELINE         = "PIPELINE"
    PUMP_STATION     = "PUMP_STATION"
    WATER_RESERVOIR  = "WATER_RESERVOIR"
    BRIDGE           = "BRIDGE"
    ROAD_SEGMENT     = "ROAD_SEGMENT"
    BUILDING         = "BUILDING"
    POWER_LINE       = "POWER_LINE"
    SUBSTATION       = "SUBSTATION"
    # Natural / Agricultural
    FARM_FIELD       = "FARM_FIELD"
    FOREST_PATCH     = "FOREST_PATCH"
    WETLAND          = "WETLAND"
    WATERSHED        = "WATERSHED"
    # Resource / Industrial
    OIL_FIELD        = "OIL_FIELD"
    QUARRY           = "QUARRY"
    DAM              = "DAM"
    # Geographic
    CITY_SECTOR      = "CITY_SECTOR"
    ADMIN_REGION     = "ADMIN_REGION"
    CUSTOM_POLYGON   = "CUSTOM_POLYGON"
    # Generic
    UNKNOWN          = "UNKNOWN"


class GeometryType(str, Enum):
    POINT   = "POINT"
    POLYGON = "POLYGON"
    LINE    = "LINE"


# ── Geometry ──────────────────────────────────────────────────────────────────

@dataclass
class TargetGeometry:
    """Geographic representation of a monitoring target."""
    type:        GeometryType
    lat:         float           # centroid latitude
    lon:         float           # centroid longitude
    wkt:         Optional[str] = None     # WKT polygon/linestring
    bbox:        Optional[Tuple[float, float, float, float]] = None

    @property
    def centroid(self) -> Tuple[float, float]:
        return (self.lat, self.lon)


# ── Lifecycle Events ──────────────────────────────────────────────────────────

@dataclass
class LifecycleEvent:
    """A single event in the operational history of a target."""
    event_id:    str
    event_date:  date
    event_type:  str    # 'INSTALLATION' | 'MAINTENANCE' | 'REPAIR' | 'INSPECTION' | 'INCIDENT' | 'UPGRADE' | 'DECOMMISSION'
    description: str
    performed_by: Optional[str] = None
    cost_usd:    Optional[float] = None
    source:      str = "ERP"   # 'ERP' | 'MANUAL' | 'MINERVA'
    notes:       Optional[str] = None


# ── EO Observation ───────────────────────────────────────────────────────────

@dataclass
class EOObservation:
    """A single Earth Observation reading for the target."""
    obs_date:    date
    source:      str      # 'sentinel-2-l2a' | 'sentinel-1-rtc' | 'modis-11A1-061' | 'planet'
    scene_id:    str
    # Optical spectral indices
    NDMI:        Optional[float] = None
    NDVI:        Optional[float] = None
    NDWI:        Optional[float] = None
    NBR:         Optional[float] = None
    # SAR
    VV_dB:       Optional[float] = None
    VH_dB:       Optional[float] = None
    # Thermal
    LST_C:       Optional[float] = None
    # Quality
    cloud_pct:   Optional[float] = None
    platform:    Optional[str]   = None
    raw:         Optional[Dict[str, Any]] = None


# ── Weather Snapshot ──────────────────────────────────────────────────────────

@dataclass
class DailyWeather:
    date:         date
    precip_mm:    float
    temp_c_mean:  float
    temp_c_max:   Optional[float] = None
    temp_c_min:   Optional[float] = None


# ── Alert Record ─────────────────────────────────────────────────────────────

@dataclass
class AlertRecord:
    alert_id:       str
    alert_date:     date
    severity:       str   # 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    event_type:     str   # 'WATER_LEAK' | 'SOIL_SATURATION' | ...
    probability:    float
    confidence:     str
    validated:      Optional[bool]  = None   # None = not yet validated
    validation_date: Optional[date] = None
    notes:          Optional[str]   = None


# ── The Digital Twin ──────────────────────────────────────────────────────────

@dataclass
class MonitoringTarget:
    """
    The central entity in MINERVA Phase 10+.

    Replaces the 'Asset' concept with a universal, geometry-aware,
    lifecycle-complete monitoring entity.

    Key invariant:
        The lifecycle begins at `lifecycle_start`, which is the actual
        installation / establishment date — NOT when satellite data starts.
        EO observations are a LAYER of knowledge about this entity, not
        the foundation of its existence.

    Two independent timelines are always maintained:
        1. Operational Timeline: lifecycle_events (ERP, maintenance, incidents)
        2. EO Timeline:          eo_observations  (satellite data)

    The health_score and predictions use BOTH timelines combined.
    """
    target_id:        str
    target_type:      TargetType
    name:             str
    geometry:         TargetGeometry

    # ── Lifecycle ──────────────────────────────────────────────────────────
    lifecycle_start:  date             # actual install / establish date
    design_life_years: Optional[int] = None
    decommission_date: Optional[date] = None

    # ── Operational history ────────────────────────────────────────────────
    lifecycle_events: List[LifecycleEvent] = field(default_factory=list)

    # ── EO Layer ───────────────────────────────────────────────────────────
    eo_observations:  List[EOObservation] = field(default_factory=list)
    weather_record:   List[DailyWeather]  = field(default_factory=list)

    # ── Intelligence state ─────────────────────────────────────────────────
    alert_history:    List[AlertRecord]   = field(default_factory=list)

    # ── Metadata ───────────────────────────────────────────────────────────
    material:         Optional[str]   = None
    operational_pressure_bar: Optional[float] = None
    operator:         Optional[str]   = None
    tags:             List[str]        = field(default_factory=list)
    metadata:         Dict[str, Any]   = field(default_factory=dict)

    # ── Computed properties ────────────────────────────────────────────────

    @property
    def age_years(self) -> float:
        """True age from lifecycle_start, regardless of EO data availability."""
        delta = date.today() - self.lifecycle_start
        return delta.days / 365.25

    @property
    def eo_span_years(self) -> float:
        """How many years of EO data are available."""
        if not self.eo_observations:
            return 0.0
        dates = [o.obs_date for o in self.eo_observations]
        return (max(dates) - min(dates)).days / 365.25

    @property
    def operational_gap_years(self) -> float:
        """
        Years of operational history before EO data starts.
        This is the period where asset lifecycle matters but no satellite
        data exists — health assessment must rely on lifecycle_events alone.
        """
        if not self.eo_observations:
            return self.age_years
        earliest_eo = min(o.obs_date for o in self.eo_observations)
        gap = (earliest_eo - self.lifecycle_start).days / 365.25
        return max(0.0, gap)

    @property
    def last_maintenance_days_ago(self) -> Optional[int]:
        maintenance = [
            e for e in self.lifecycle_events
            if e.event_type in ('MAINTENANCE', 'REPAIR', 'INSPECTION')
        ]
        if not maintenance:
            return None
        last = max(maintenance, key=lambda e: e.event_date)
        return (date.today() - last.event_date).days

    @property
    def latest_eo(self) -> Optional[EOObservation]:
        if not self.eo_observations:
            return None
        return max(self.eo_observations, key=lambda o: o.obs_date)

    def get_eo_series(
        self,
        signal: str,
        start: Optional[date] = None,
        end: Optional[date] = None,
    ) -> List[Tuple[date, float]]:
        """
        Return time-series of a single EO signal: [(date, value), ...]
        Sorted chronologically. Filters by date range if provided.
        """
        series = []
        for obs in self.eo_observations:
            val = getattr(obs, signal, None)
            if val is None:
                continue
            if start and obs.obs_date < start:
                continue
            if end and obs.obs_date > end:
                continue
            series.append((obs.obs_date, val))
        return sorted(series, key=lambda x: x[0])

    def unified_timeline(self) -> List[Dict[str, Any]]:
        """
        Returns a single chronological list merging ALL events:
        ERP events, EO observations, weather extremes, alerts.
        This is the 'complete operational memory' of the target.
        """
        events = []

        # Lifecycle events
        for ev in self.lifecycle_events:
            events.append({
                "date":   ev.event_date.isoformat(),
                "type":   "LIFECYCLE",
                "subtype": ev.event_type,
                "description": ev.description,
                "source": ev.source,
            })

        # EO observations (summary only)
        for obs in self.eo_observations:
            events.append({
                "date":   obs.obs_date.isoformat(),
                "type":   "EO_OBSERVATION",
                "source": obs.source,
                "NDMI":   obs.NDMI,
                "NDVI":   obs.NDVI,
                "VV_dB":  obs.VV_dB,
                "LST_C":  obs.LST_C,
            })

        # Alerts
        for al in self.alert_history:
            events.append({
                "date":       al.alert_date.isoformat(),
                "type":       "ALERT",
                "severity":   al.severity,
                "event_type": al.event_type,
                "probability": al.probability,
                "validated":  al.validated,
            })

        # Sort chronologically
        return sorted(events, key=lambda x: x["date"])

    def to_summary(self) -> Dict[str, Any]:
        return {
            "target_id":        self.target_id,
            "target_type":      self.target_type.value,
            "name":             self.name,
            "location":         {"lat": self.geometry.lat, "lon": self.geometry.lon},
            "lifecycle_start":  self.lifecycle_start.isoformat(),
            "age_years":        round(self.age_years, 1),
            "eo_observations":  len(self.eo_observations),
            "eo_span_years":    round(self.eo_span_years, 1),
            "operational_gap_years": round(self.operational_gap_years, 1),
            "lifecycle_events": len(self.lifecycle_events),
            "latest_eo":        self.latest_eo.obs_date.isoformat() if self.latest_eo else None,
            "last_maintenance_days_ago": self.last_maintenance_days_ago,
        }
