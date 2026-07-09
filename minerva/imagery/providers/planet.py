"""
Planet Labs Provider — Concrete implementation of ImageryProvider.
ADR-013: All Planet-specific logic is ISOLATED here.
The reasoning engine never imports this file directly.
"""
from __future__ import annotations
import json
import os
import requests
from datetime import date, timedelta
from typing import Optional
from minerva.imagery.providers.base import ImageryProvider, SceneMetadata, ProviderCapability

PLANET_API_BASE = "https://api.planet.com/data/v1"
ARCHIVE_DIR      = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))),
    ".data", "planet-archive", "metadata"
)


class PlanetProvider(ImageryProvider):
    """
    Planet Labs PlanetScope (PSScene) provider.
    Priority 1: local archive (free, fast)
    Priority 2: live Planet API (requires key, rate-limited)
    """

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or os.getenv("PLANET_API_KEY", "")
        self._archive_index: Optional[list] = None

    @property
    def capability(self) -> ProviderCapability:
        return ProviderCapability(
            provider_id="planet",
            provider_name="Planet Labs PlanetScope",
            typical_resolution_m=3.0,
            typical_revisit_days=1.0,
            archive_depth_years=10.0,
            cost_per_scene_usd=0.0,    # developer account = free
            is_free=True,
            supports_live_search=bool(self._api_key),
            supports_tasking=False,
            is_configured=bool(self._api_key),
        )

    def is_available(self) -> bool:
        if not self._api_key:
            return False
        try:
            r = requests.get(
                f"{PLANET_API_BASE}/item-types",
                auth=(self._api_key, ""),
                timeout=5,
            )
            return r.status_code == 200
        except Exception:
            return False

    def search(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        max_cloud_cover: float = 30.0,
        max_results: int = 20,
    ) -> list[SceneMetadata]:
        """
        Search: local archive first, then Planet API if configured.
        ADR-015: Archive first → API only when justified.
        """
        results: list[SceneMetadata] = []

        # ── 1. Local archive ──────────────────────────────────────────────────
        archive_scenes = self._search_archive(lat, lon, start_date, end_date, max_cloud_cover)
        results.extend(archive_scenes)

        # ── 2. Live API if few local results ──────────────────────────────────
        if len(results) < 3 and self._api_key:
            api_scenes = self._search_api(lat, lon, start_date, end_date, max_cloud_cover, max_results)
            # De-duplicate
            existing_ids = {s.scene_id for s in results}
            for s in api_scenes:
                if s.scene_id not in existing_ids:
                    results.append(s)

        # Sort by quality
        results.sort(key=lambda s: s.quality_score, reverse=True)
        return results[:max_results]

    # ─── Private: Archive search ─────────────────────────────────────────────

    def _load_archive_index(self) -> list[dict]:
        if self._archive_index is not None:
            return self._archive_index
        if not os.path.isdir(ARCHIVE_DIR):
            self._archive_index = []
            return []
        index = []
        for fname in os.listdir(ARCHIVE_DIR):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(ARCHIVE_DIR, fname)) as f:
                    d = json.load(f)
                    index.append(d)
            except Exception:
                continue
        self._archive_index = index
        return index

    def _scene_near_bbox(self, scene: dict, lat: float, lon: float, radius_deg: float = 0.3) -> bool:
        geom = scene.get("geometry", {})
        coords = geom.get("coordinates", [[]])[0] if geom.get("type") == "Polygon" else []
        if not coords:
            return True   # assume nearby if no geometry
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        if not lons:
            return True
        center_lon = (min(lons) + max(lons)) / 2
        center_lat = (min(lats) + max(lats)) / 2
        return abs(center_lon - lon) < radius_deg and abs(center_lat - lat) < radius_deg

    def _search_archive(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        max_cloud_cover: float,
    ) -> list[SceneMetadata]:
        index = self._load_archive_index()
        results = []

        for scene in index:
            try:
                acq_date = date.fromisoformat(scene["acquisition_date"])
                if not (start_date <= acq_date <= end_date):
                    continue
                cloud = float(scene.get("cloud_cover_pct", 100))
                if cloud > max_cloud_cover:
                    continue
                if not self._scene_near_bbox(scene, lat, lon):
                    continue

                geom  = scene.get("geometry", {})
                coords = geom.get("coordinates", [[]])[0] if geom else []
                if coords:
                    lons = [c[0] for c in coords]; lats = [c[1] for c in coords]
                    bbox = (min(lons), min(lats), max(lons), max(lats))
                else:
                    bbox = (lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1)

                # Check thumbnail
                thumb_path = None
                thumb_dir = os.path.join(os.path.dirname(ARCHIVE_DIR), "thumbnails")
                scene_id = scene.get("scene_uid", "")
                tp = os.path.join(thumb_dir, f"{scene_id}.jpg")
                if os.path.isfile(tp):
                    thumb_path = tp

                results.append(SceneMetadata(
                    scene_id=scene_id,
                    provider="planet",
                    acquisition_date=acq_date,
                    acquisition_time=scene.get("acquisition_time"),
                    bbox=bbox,
                    cloud_cover_pct=cloud,
                    resolution_m=float(scene.get("pixel_resolution_m", 3.0)),
                    area_key=scene.get("area_key"),
                    thumbnail_path=thumb_path,
                    thumbnail_url=None,
                    cost_usd=0.0,          # already in archive = free
                    available_locally=True,
                    metadata=scene,
                ))
            except Exception:
                continue

        return results

    # ─── Private: API search ─────────────────────────────────────────────────

    def _search_api(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        max_cloud_cover: float,
        max_results: int,
    ) -> list[SceneMetadata]:
        if not self._api_key:
            return []
        try:
            payload = {
                "item_types": ["PSScene"],
                "_page_size": min(max_results, 50),
                "filter": {
                    "type": "AndFilter",
                    "config": [
                        {
                            "type": "GeometryFilter",
                            "field_name": "geometry",
                            "config": {
                                "type": "Point",
                                "coordinates": [lon, lat],
                            },
                        },
                        {
                            "type": "DateRangeFilter",
                            "field_name": "acquired",
                            "config": {
                                "gte": start_date.isoformat() + "T00:00:00Z",
                                "lte": end_date.isoformat()   + "T23:59:59Z",
                            },
                        },
                        {
                            "type": "RangeFilter",
                            "field_name": "cloud_cover",
                            "config": {"lte": max_cloud_cover / 100.0},
                        },
                    ],
                },
            }
            r = requests.post(
                f"{PLANET_API_BASE}/quick-search",
                auth=(self._api_key, ""),
                json=payload,
                timeout=15,
            )
            if r.status_code != 200:
                return []

            features = r.json().get("features", [])
            results = []
            for feat in features:
                props = feat.get("properties", {})
                geom  = feat.get("geometry", {})
                coords = geom.get("coordinates", [[]])[0] if geom.get("type") == "Polygon" else []
                if coords:
                    lons = [c[0] for c in coords]; lats = [c[1] for c in coords]
                    bbox = (min(lons), min(lats), max(lons), max(lats))
                else:
                    bbox = (lon-0.05, lat-0.05, lon+0.05, lat+0.05)

                acq_str = props.get("acquired", "")[:10]
                try: acq_date = date.fromisoformat(acq_str)
                except: continue

                results.append(SceneMetadata(
                    scene_id=feat.get("id", ""),
                    provider="planet",
                    acquisition_date=acq_date,
                    acquisition_time=props.get("acquired", "")[11:19] or None,
                    bbox=bbox,
                    cloud_cover_pct=round(props.get("cloud_cover", 1.0) * 100, 1),
                    resolution_m=float(props.get("pixel_resolution", 3.0)),
                    area_key=None,
                    thumbnail_path=None,
                    thumbnail_url=props.get("thumbnail") or None,
                    cost_usd=None,          # developer tier
                    available_locally=False,
                    metadata=props,
                ))
            return results
        except Exception:
            return []
