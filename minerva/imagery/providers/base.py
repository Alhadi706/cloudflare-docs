"""
Imagery Provider Base — Provider Abstraction Layer
ADR-013: Planet is just one provider. Never hard-code provider logic in the engine.

Every provider exposes the same interface.
Adding Maxar, Airbus, ICEYE = adding a new Provider class. Zero engine changes.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class SceneMetadata:
    """
    Universal scene representation.
    Provider-agnostic. Works for Planet, Maxar, Airbus, Sentinel — all the same.
    """
    scene_id: str
    provider: str                        # "planet", "maxar", "sentinel2", "airbus"
    acquisition_date: date
    acquisition_time: Optional[str]
    bbox: tuple[float, float, float, float]   # (minLon, minLat, maxLon, maxLat)
    cloud_cover_pct: float               # 0–100
    resolution_m: float
    area_key: Optional[str]              # logical area name from our archive
    thumbnail_path: Optional[str]        # local file path if cached
    thumbnail_url: Optional[str]         # remote URL
    cost_usd: Optional[float]            # None or 0 = free / already paid
    available_locally: bool              # is it in local archive?
    metadata: dict = field(default_factory=dict)

    @property
    def age_days(self) -> int:
        return (date.today() - self.acquisition_date).days

    @property
    def is_free(self) -> bool:
        return (self.cost_usd is None) or (self.cost_usd == 0.0)

    @property
    def quality_score(self) -> float:
        """0→1 综合质量分数 (cloud_cover + resolution + recency)"""
        cloud_ok  = 1.0 - self.cloud_cover_pct / 100.0
        res_ok    = min(1.0, 10.0 / max(self.resolution_m, 0.5))
        recency   = max(0.1, 1.0 - self.age_days / 180.0)
        return round(cloud_ok * 0.40 + res_ok * 0.35 + recency * 0.25, 3)

    def to_dict(self) -> dict:
        return {
            "scene_id":        self.scene_id,
            "provider":        self.provider,
            "acquisition_date": str(self.acquisition_date),
            "acquisition_time": self.acquisition_time,
            "cloud_cover_pct":  self.cloud_cover_pct,
            "resolution_m":     self.resolution_m,
            "area_key":         self.area_key,
            "thumbnail_path":   self.thumbnail_path,
            "thumbnail_url":    self.thumbnail_url,
            "cost_usd":         self.cost_usd,
            "available_locally": self.available_locally,
            "age_days":         self.age_days,
            "quality_score":    self.quality_score,
            "is_free":          self.is_free,
        }


@dataclass
class ProviderCapability:
    """Static capabilities of a provider."""
    provider_id: str
    provider_name: str
    typical_resolution_m: float
    typical_revisit_days: float
    archive_depth_years: float
    cost_per_scene_usd: float           # approximate
    is_free: bool
    supports_live_search: bool          # can query API right now
    supports_tasking: bool              # can request new acquisition
    is_configured: bool                 # has valid credentials


class ImageryProvider(ABC):
    """
    Abstract base for all imagery providers.
    ADR-013: The reasoning engine ONLY knows this interface.
    """

    @property
    @abstractmethod
    def capability(self) -> ProviderCapability: ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is reachable and credentials are valid."""
        ...

    @abstractmethod
    def search(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        max_cloud_cover: float = 30.0,
        max_results: int = 20,
    ) -> list[SceneMetadata]:
        """Search for available scenes. Returns sorted by quality."""
        ...

    def get_best_scene(
        self,
        lat: float,
        lon: float,
        max_age_days: int = 90,
        max_cloud_cover: float = 25.0,
    ) -> Optional[SceneMetadata]:
        """Convenience: return the single best available scene."""
        end = date.today()
        start = date.fromordinal(end.toordinal() - max_age_days)
        scenes = self.search(lat, lon, start, end, max_cloud_cover, max_results=5)
        if not scenes:
            return None
        return max(scenes, key=lambda s: s.quality_score)
