"""
MINERVA Phase 9 — Real Sentinel-1 SAR Adapter
==============================================
Source     : Microsoft Planetary Computer STAC API
Collection : sentinel-1-rtc  (Radiometric Terrain Corrected)
Signal     : SAR Backscatter σ° (VV, VH) in linear power scale
Use-case   : Surface change detection, soil moisture, water mapping

Sentinel-1C provides C-band SAR every 6-12 days.
sentinel-1-rtc collection is publicly available without authentication.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

import numpy as np
import requests

logger = logging.getLogger("minerva.sentinel1")

STAC_URL   = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
COLLECTION = "sentinel-1-rtc"
PATCH_M    = 500
MIN_VALID  = 10
DB_FLOOR   = -35.0   # dB lower bound for valid SAR


class Sentinel1Adapter:
    """
    Extract real SAR backscatter (VV/VH) time-series from Sentinel-1 RTC.

    Backscatter values are returned in dB:
      • Dry bare soil  : VV ≈ -12 to -8 dB
      • Wet soil       : VV ≈ -8  to -3 dB
      • Open water     : VV < -20 dB  (specular reflection)
      • Urban          : VV > -5  dB  (double-bounce)

    Usage:
        adapter = Sentinel1Adapter()
        ts = adapter.time_series(lat=32.89, lon=13.18, start="2026-01-01", end="2026-07-09")
    """

    def time_series(
        self,
        lat: float,
        lon: float,
        start: str,
        end: str,
        max_scenes: int = 12,
    ) -> List[Dict[str, Any]]:
        scenes = self._search(lat, lon, start, end, max_scenes)
        results = []
        for scene in scenes:
            rec = self._extract(scene, lat, lon)
            if rec:
                results.append(rec)
        logger.info("Sentinel-1 SAR time_series: %d records", len(results))
        return results

    def latest(
        self,
        lat: float,
        lon: float,
        lookback_days: int = 60,
    ) -> Optional[Dict[str, Any]]:
        end   = date.today().isoformat()
        start = (date.today() - timedelta(days=lookback_days)).isoformat()
        ts = self.time_series(lat, lon, start, end, max_scenes=3)
        return ts[0] if ts else None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _search(
        self, lat: float, lon: float, start: str, end: str, limit: int
    ) -> List[Dict]:
        buf = 0.05
        payload = {
            "collections": [COLLECTION],
            "bbox":        [lon - buf, lat - buf, lon + buf, lat + buf],
            "datetime":    f"{start}/{end}",
            "sortby":      [{"field": "properties.datetime", "direction": "desc"}],
            "limit":       limit,
        }
        try:
            r = requests.post(STAC_URL, json=payload, timeout=20,
                              headers={"User-Agent": "MINERVA/1.0"})
            r.raise_for_status()
            return r.json().get("features", [])
        except Exception as exc:
            logger.warning("S1 STAC search failed: %s", exc)
            return []

    def _sign(self, item: Dict) -> Optional[Dict]:
        try:
            import planetary_computer as pc
            return pc.sign(item)
        except Exception as exc:
            logger.debug("pc.sign: %s", exc)
            return item   # try unsigned

    def _read_sar_band(
        self, url: str, lat: float, lon: float, patch_m: float = PATCH_M
    ) -> Optional[float]:
        """
        Read linear backscatter and convert to dB.
        Sentinel-1 RTC COGs store γ° in linear power scale (float32).
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

                data = src.read(1, window=win).astype(float)
                valid = data[data > 0]   # linear > 0
                if len(valid) < MIN_VALID:
                    return None

                # convert to dB: 10 * log10(linear)
                db_vals = 10.0 * np.log10(valid + 1e-15)
                db_vals = db_vals[db_vals > DB_FLOOR]  # drop noise floor
                return float(np.median(db_vals)) if len(db_vals) > 0 else None
        except Exception as exc:
            logger.debug("SAR COG read failed: %s", exc)
            return None

    def _extract(self, item: Dict, lat: float, lon: float) -> Optional[Dict]:
        signed = self._sign(item)
        if signed is None:
            return None

        assets = signed.get("assets", {})
        props  = item.get("properties", {})

        vv_url = assets.get("vv", {}).get("href")
        vh_url = assets.get("vh", {}).get("href")

        vv_db = self._read_sar_band(vv_url, lat, lon) if vv_url else None
        vh_db = self._read_sar_band(vh_url, lat, lon) if vh_url else None

        if vv_db is None and vh_db is None:
            return None

        # Cross-Ratio VH/VV (sensitive to vegetation/soil moisture)
        cr = round(vh_db - vv_db, 4) if (vh_db and vv_db) else None

        return {
            "date":      props.get("datetime", "")[:10],
            "scene_id":  item.get("id", ""),
            "platform":  props.get("platform", "Sentinel-1"),
            "orbit":     props.get("sat:orbit_state", ""),
            "VV_dB":     round(vv_db, 3) if vv_db else None,
            "VH_dB":     round(vh_db, 3) if vh_db else None,
            "CR_dB":     cr,            # VH - VV: moisture/vegetation indicator
        }
