"""
MINERVA Phase 9 — Real Sentinel-2 EO Adapter
=============================================
Source : Microsoft Planetary Computer STAC API
         https://planetarycomputer.microsoft.com/api/stac/v1
Collection : sentinel-2-l2a  (Level-2A, Bottom-of-Atmosphere)
Signals    : NDMI, NDVI, NDWI, NBR (all real, not simulated)
Coverage   : Global, 5-day revisit

No authentication required for STAC search.
planetary_computer.sign() adds time-limited SAS tokens for COG reads.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional, List, Dict, Any, Tuple

import numpy as np
import requests

logger = logging.getLogger("minerva.sentinel2")

# ─── Constants ───────────────────────────────────────────────────────────────
STAC_URL     = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
COLLECTION   = "sentinel-2-l2a"
MAX_CLOUD    = 15.0          # % — reject scenes cloudier than this
SCALE_FACTOR = 10_000.0      # L2A reflectance is stored as uint16 × 10000
PATCH_M      = 500           # half-side of extraction patch in metres
MIN_VALID_PX = 10            # minimum valid pixels required


class Sentinel2Adapter:
    """
    Extract real spectral indices (NDMI, NDVI, NDWI) for a point location
    from Sentinel-2 L2A imagery via Planetary Computer COG.

    Usage:
        adapter = Sentinel2Adapter()
        ts = adapter.time_series(lat=32.89, lon=13.18,
                                  start="2026-01-01", end="2026-07-09")
        # → [{"date": "2026-07-02", "NDMI": -0.0495, "NDVI": 0.0542, ...}, ...]
    """

    def __init__(self, max_cloud: float = MAX_CLOUD):
        self.max_cloud = max_cloud
        self._pc_available = self._check_pc()

    # ── Public API ────────────────────────────────────────────────────────────

    def time_series(
        self,
        lat: float,
        lon: float,
        start: str,   # "YYYY-MM-DD"
        end: str,     # "YYYY-MM-DD"
        max_scenes: int = 12,
    ) -> List[Dict[str, Any]]:
        """
        Return a time-series of spectral indices for a point.
        Each entry: {"date": str, "NDMI": float|None, "NDVI": float|None,
                      "NDWI": float|None, "cloud_pct": float, "scene_id": str}
        """
        scenes = self._search(lat, lon, start, end, max_scenes)
        results = []
        for scene in scenes:
            rec = self._extract_indices(scene, lat, lon)
            if rec:
                results.append(rec)
        logger.info("Sentinel-2 time_series: %d records for (%.4f, %.4f)",
                    len(results), lat, lon)
        return results

    def latest(
        self,
        lat: float,
        lon: float,
        lookback_days: int = 90,
    ) -> Optional[Dict[str, Any]]:
        """Return the most recent valid observation."""
        end   = date.today().isoformat()
        start = (date.today() - timedelta(days=lookback_days)).isoformat()
        ts = self.time_series(lat, lon, start, end, max_scenes=5)
        return ts[0] if ts else None

    def is_available(self) -> bool:
        return self._pc_available

    # ── Internal ──────────────────────────────────────────────────────────────

    def _check_pc(self) -> bool:
        try:
            r = requests.get(
                "https://planetarycomputer.microsoft.com/api/stac/v1",
                timeout=5,
            )
            return r.ok
        except Exception:
            return False

    def _search(
        self,
        lat: float,
        lon: float,
        start: str,
        end: str,
        limit: int,
    ) -> List[Dict]:
        buf = 0.05          # ~5 km bounding box
        payload = {
            "collections": [COLLECTION],
            "bbox":        [lon - buf, lat - buf, lon + buf, lat + buf],
            "datetime":    f"{start}/{end}",
            "query":       {"eo:cloud_cover": {"lt": self.max_cloud}},
            "sortby":      [{"field": "properties.datetime", "direction": "desc"}],
            "limit":       limit,
        }
        try:
            r = requests.post(STAC_URL, json=payload, timeout=20,
                              headers={"User-Agent": "MINERVA/1.0"})
            r.raise_for_status()
            return r.json().get("features", [])
        except Exception as exc:
            logger.warning("STAC search failed: %s", exc)
            return []

    def _sign_item(self, item: Dict) -> Optional[Dict]:
        """Add SAS tokens to asset hrefs using planetary_computer."""
        try:
            import planetary_computer as pc   # soft dependency
            return pc.sign(item)
        except ImportError:
            logger.warning("planetary_computer package not installed — "
                           "COG reads will likely fail for auth-protected assets.")
            return item
        except Exception as exc:
            logger.warning("pc.sign failed: %s", exc)
            return None

    def _read_band(
        self,
        url: str,
        lat: float,
        lon: float,
        patch_m: float = PATCH_M,
    ) -> Optional[float]:
        """
        Read a single band value (median of patch) from a COG url.
        Returns surface reflectance (0..1 scale) or None on failure.
        """
        try:
            import rasterio
            from rasterio.windows import from_bounds
            from pyproj import Transformer

            with rasterio.open(url) as src:
                crs_code = src.crs.to_epsg()
                if crs_code:
                    tr = Transformer.from_crs(
                        "EPSG:4326", crs_code, always_xy=True
                    )
                    cx, cy = tr.transform(lon, lat)
                else:
                    cx, cy = lon, lat

                bounds = (cx - patch_m, cy - patch_m,
                          cx + patch_m, cy + patch_m)
                win = from_bounds(*bounds, transform=src.transform)

                if win.width < 1 or win.height < 1:
                    return None

                data = src.read(1, window=win).astype(float) / SCALE_FACTOR
                valid = data[(data > 0) & (data < 1.5)]
                if len(valid) < MIN_VALID_PX:
                    return None
                return float(np.median(valid))
        except Exception as exc:
            logger.debug("COG read failed for %s: %s", url[:60], exc)
            return None

    def _extract_indices(
        self,
        item: Dict,
        lat: float,
        lon: float,
    ) -> Optional[Dict[str, Any]]:
        """Sign the item, read required bands, compute indices."""
        signed = self._sign_item(item)
        if signed is None:
            return None

        assets = signed.get("assets", {})
        props  = item.get("properties", {})

        # band → url mapping
        band_urls: Dict[str, str] = {}
        for b in ("B03", "B04", "B08", "B11", "B12"):
            if b in assets:
                href = assets[b].get("href") or assets[b].get("alternate", {}).get("download", {}).get("href")
                if href:
                    band_urls[b] = href

        # read reflectance values
        r_vals: Dict[str, float] = {}
        for bname, url in band_urls.items():
            v = self._read_band(url, lat, lon)
            if v is not None:
                r_vals[bname] = v

        if len(r_vals) < 2:
            return None

        def _idx(a: str, b: str) -> Optional[float]:
            if a in r_vals and b in r_vals:
                denom = r_vals[a] + r_vals[b] + 1e-9
                return round((r_vals[a] - r_vals[b]) / denom, 5)
            return None

        return {
            "date":       props.get("datetime", "")[:10],
            "scene_id":   item.get("id", ""),
            "platform":   props.get("platform", ""),
            "cloud_pct":  props.get("eo:cloud_cover", None),
            # indices (NDMI uses NIR=B08, SWIR1=B11)
            "NDMI":  _idx("B08", "B11"),    # moisture  ↑ = more water/moisture
            "NDVI":  _idx("B08", "B04"),    # vegetation ↑ = healthier plants
            "NDWI":  _idx("B03", "B08"),    # open water ↑ = surface water
            "NBR":   _idx("B08", "B12"),    # burn ratio ↑ = vegetation
            # raw reflectance for downstream computation
            "_bands": r_vals,
        }
