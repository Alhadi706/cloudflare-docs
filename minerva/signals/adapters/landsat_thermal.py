"""
MINERVA Phase 9 — Real Landsat Thermal Adapter (LST)
=====================================================
Source     : Microsoft Planetary Computer STAC API
Collection : landsat-c2-l2  (Collection 2 Level-2, Surface Temp)
Signal     : Land Surface Temperature (LST) in Kelvin and Celsius
Band       : ST_B10 — Landsat 8/9 TIRS Band 10 (10.6–11.19 µm)

Algorithm:
  1.  Search Landsat C2 L2 for scenes with cloud < 30%
  2.  Read ST_B10 COG patch around target point
  3.  Apply USGS scale/offset:  LST_K = raw × 0.00341802 + 149.0
  4.  Convert to Celsius: LST_C = LST_K - 273.15

Landsat 8/9 revisit: 16 days (combined: ~8 days).
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

import numpy as np
import requests

logger = logging.getLogger("minerva.landsat_thermal")

STAC_URL     = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
COLLECTION   = "landsat-c2-l2"
PATCH_M      = 500
# USGS Band-10 ST scale factors (Landsat C2 L2 specification)
ST_SCALE     = 0.00341802
ST_OFFSET    = 149.0          # Kelvin
KELVIN_ZERO  = 273.15


class LandsatThermalAdapter:
    """
    Extract real Land Surface Temperature (LST) from Landsat 8/9 TIRS.

    Typical value ranges (Celsius):
      • Desert/bare rock  : 40–65 °C
      • Urban surfaces    : 30–55 °C
      • Vegetated land    : 20–40 °C
      • Water bodies      : 15–30 °C

    Usage:
        adapter = LandsatThermalAdapter()
        ts = adapter.time_series(lat=32.89, lon=13.18,
                                  start="2026-01-01", end="2026-07-09")
    """

    def time_series(
        self,
        lat: float,
        lon: float,
        start: str,
        end: str,
        max_scenes: int = 10,
    ) -> List[Dict[str, Any]]:
        scenes = self._search(lat, lon, start, end, max_scenes)
        results = []
        for scene in scenes:
            rec = self._extract(scene, lat, lon)
            if rec:
                results.append(rec)
        logger.info("Landsat LST time_series: %d records", len(results))
        return results

    def latest(
        self,
        lat: float,
        lon: float,
        lookback_days: int = 90,
    ) -> Optional[Dict[str, Any]]:
        end   = date.today().isoformat()
        start = (date.today() - timedelta(days=lookback_days)).isoformat()
        ts = self.time_series(lat, lon, start, end, max_scenes=3)
        return ts[0] if ts else None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _search(
        self, lat: float, lon: float, start: str, end: str, limit: int
    ) -> List[Dict]:
        buf = 0.1
        payload = {
            "collections": [COLLECTION],
            "bbox":        [lon - buf, lat - buf, lon + buf, lat + buf],
            "datetime":    f"{start}/{end}",
            "query":       {"eo:cloud_cover": {"lt": 30}},
            "sortby":      [{"field": "properties.datetime", "direction": "desc"}],
            "limit":       limit,
        }
        try:
            r = requests.post(STAC_URL, json=payload, timeout=20,
                              headers={"User-Agent": "MINERVA/1.0"})
            r.raise_for_status()
            items = r.json().get("features", [])
            # Only keep items that have the ST_B10 band
            return [it for it in items if "ST_B10" in it.get("assets", {})]
        except Exception as exc:
            logger.warning("Landsat STAC search failed: %s", exc)
            return []

    def _sign(self, item: Dict) -> Optional[Dict]:
        try:
            import planetary_computer as pc
            return pc.sign(item)
        except Exception as exc:
            logger.debug("pc.sign: %s", exc)
            return item

    def _read_lst(
        self, url: str, lat: float, lon: float, patch_m: float = PATCH_M
    ) -> Optional[float]:
        """
        Read raw DN from ST_B10, apply USGS scale/offset → LST in Celsius.
        Raw DN=0 means fill/no-data; valid range is ~7500–17500.
        """
        try:
            import rasterio
            from rasterio.windows import from_bounds
            from pyproj import Transformer

            with rasterio.open(url) as src:
                crs_code = src.crs.to_epsg()
                if crs_code:
                    tr = Transformer.from_crs("EPSG:4326", crs_code, always_xy=True)
                    cx, cy = tr.transform(lon, lat)
                else:
                    cx, cy = lon, lat

                win = from_bounds(
                    cx - patch_m, cy - patch_m, cx + patch_m, cy + patch_m,
                    transform=src.transform,
                )
                if win.width < 1 or win.height < 1:
                    return None

                raw = src.read(1, window=win).astype(float)
                # nodata / fill values
                valid = raw[(raw > 1000) & (raw < 65535)]
                if len(valid) < 5:
                    return None

                lst_k = valid * ST_SCALE + ST_OFFSET
                lst_c = lst_k - KELVIN_ZERO

                # Sanity check: discard physical impossibilities
                lst_c = lst_c[(lst_c > -50) & (lst_c < 90)]
                return float(np.median(lst_c)) if len(lst_c) > 0 else None
        except Exception as exc:
            logger.debug("LST COG read failed: %s", exc)
            return None

    def _extract(self, item: Dict, lat: float, lon: float) -> Optional[Dict]:
        signed = self._sign(item)
        if signed is None:
            return None

        assets = signed.get("assets", {})
        props  = item.get("properties", {})

        st_url = assets.get("ST_B10", {}).get("href")
        if not st_url:
            return None

        lst_c = self._read_lst(st_url, lat, lon)
        if lst_c is None:
            return None

        return {
            "date":       props.get("datetime", "")[:10],
            "scene_id":   item.get("id", ""),
            "platform":   props.get("platform", ""),
            "cloud_pct":  props.get("eo:cloud_cover", None),
            "LST_C":      round(lst_c, 2),
            "LST_K":      round(lst_c + KELVIN_ZERO, 2),
        }
