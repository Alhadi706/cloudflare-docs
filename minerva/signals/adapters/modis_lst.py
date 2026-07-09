"""
MINERVA Phase 10 — MODIS Land Surface Temperature Adapter
==========================================================
Source     : Microsoft Planetary Computer STAC API
Collection : modis-11A1-061  (MOD11A1 — Terra MODIS Daily LST, 1km)
Band       : LST_Day_1km  — daytime LST
Scale      : 0.02 K/DN  (store DN > 0 as valid, fill = 0)
Projection : Sinusoidal (MODIS SIN) — handled via WKT CRS

Why MODIS over Landsat?
  • Daily revisit (vs 16-day Landsat)
  • Available since 2000 (25+ years of history)
  • Global coverage, consistent quality
  • Free via Planetary Computer (COG, no auth)

Typical values for Libya (summer):
  • Urban surface : 40–55 °C  (concrete, asphalt)
  • Desert sand   : 50–65 °C  (dry, high emissivity)
  • Vegetation    : 25–40 °C
  • Coast/water   : 20–30 °C

Usage:
    adapter = ModisLSTAdapter()
    ts = adapter.time_series(lat=32.89, lon=13.18, start="2026-01-01", end="2026-07-09")
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

import numpy as np
import requests

logger = logging.getLogger("minerva.modis_lst")

COLLECTION  = "modis-11A1-061"
BAND        = "LST_Day_1km"
STAC_URL    = "https://planetarycomputer.microsoft.com/api/stac/v1"
SCALE_FACTOR = 0.02    # K per DN
KELVIN_ZERO  = 273.15
PATCH_M      = 5_000   # 5 km patch (MODIS 1km native)
DN_MIN       = 7500    # 7500 × 0.02 = 150K  (valid physical minimum)
DN_MAX       = 20_000  # 20000 × 0.02 = 400K − 273 = 127°C (valid maximum)


class ModisLSTAdapter:
    """
    Extract real Land Surface Temperature from MODIS MOD11A1 daily product.
    Uses pystac_client + planetary_computer for authenticated COG access.
    """

    def __init__(self):
        self._catalog = self._open_catalog()

    # ── Public API ────────────────────────────────────────────────────────────

    def time_series(
        self,
        lat: float,
        lon: float,
        start: str,
        end: str,
        max_scenes: int = 16,
    ) -> List[Dict[str, Any]]:
        """
        Return daily LST observations.
        Each entry: {"date": str, "LST_C": float, "LST_K": float, "scene_id": str}
        """
        if self._catalog is None:
            return []
        results = []
        for item in self._search(lat, lon, start, end, max_scenes):
            rec = self._extract(item, lat, lon)
            if rec:
                results.append(rec)
        logger.info("MODIS LST time_series: %d records for (%.4f, %.4f)",
                    len(results), lat, lon)
        return results

    def latest(
        self,
        lat: float,
        lon: float,
        lookback_days: int = 30,
    ) -> Optional[Dict[str, Any]]:
        end   = date.today().isoformat()
        start = (date.today() - timedelta(days=lookback_days)).isoformat()
        ts = self.time_series(lat, lon, start, end, max_scenes=5)
        return ts[0] if ts else None

    def is_available(self) -> bool:
        return self._catalog is not None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _open_catalog(self):
        try:
            import pystac_client
            import planetary_computer as pc
            return pystac_client.Client.open(
                f"{STAC_URL}",
                modifier=pc.sign_inplace,
            )
        except Exception as exc:
            logger.warning("Could not open Planetary Computer catalog: %s", exc)
            return None

    def _search(
        self, lat: float, lon: float, start: str, end: str, limit: int
    ):
        buf = 1.0   # MODIS 1km tiles cover large areas
        try:
            search = self._catalog.search(
                collections=[COLLECTION],
                bbox=[lon - buf, lat - buf, lon + buf, lat + buf],
                datetime=f"{start}/{end}",
                max_items=limit,
                sortby=[{"field": "properties.datetime", "direction": "desc"}],
            )
            return list(search.items())
        except Exception as exc:
            logger.warning("MODIS STAC search failed: %s", exc)
            return []

    def _extract(self, item, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        lst_asset = item.assets.get(BAND)
        if lst_asset is None:
            return None
        lst_c = self._read_lst(lst_asset.href, lat, lon)
        if lst_c is None:
            return None

        # Parse date from properties
        dt_raw = item.properties.get("start_datetime") or item.properties.get("datetime")
        obs_date = str(dt_raw)[:10] if dt_raw else item.id[9:16]

        return {
            "date":       obs_date,
            "scene_id":   item.id,
            "platform":   item.properties.get("platform", "Terra"),
            "LST_C":      round(lst_c, 2),
            "LST_K":      round(lst_c + KELVIN_ZERO, 2),
        }

    def _read_lst(self, url: str, lat: float, lon: float) -> Optional[float]:
        """Read MODIS LST_Day_1km from COG using Sinusoidal projection."""
        try:
            import rasterio
            from rasterio.windows import from_bounds
            from pyproj import CRS, Transformer

            with rasterio.open(url) as src:
                crs_4326 = CRS.from_epsg(4326)
                crs_src  = CRS.from_wkt(src.crs.to_wkt())
                tr = Transformer.from_crs(crs_4326, crs_src, always_xy=True)
                cx, cy = tr.transform(lon, lat)

                win = from_bounds(
                    cx - PATCH_M, cy - PATCH_M, cx + PATCH_M, cy + PATCH_M,
                    transform=src.transform,
                )
                if win.width < 1 or win.height < 1:
                    return None

                raw = src.read(1, window=win).astype(float)
                valid = raw[(raw > 0) & (raw < 65535)]
                if len(valid) == 0:
                    return None

                lst_k = np.median(valid) * SCALE_FACTOR
                lst_c = lst_k - KELVIN_ZERO

                # Sanity check
                if lst_c < -50 or lst_c > 90:
                    return None
                return float(lst_c)
        except Exception as exc:
            logger.debug("MODIS LST COG read failed: %s", exc)
            return None
