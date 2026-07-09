"""
MINERVA Lab — EO Historical Replay Engine
==========================================
Replays real satellite observations chronologically for a scenario.

CRITICAL RULE: Never leak future data.
  At each step T, only observations with date <= T are visible.
  The replay engine enforces this by construction.

This builds on minerva.validation.replay (signal-based) but adds
real EO data from Sentinel-2/1/MODIS instead of synthetic signals.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional, List, Dict, Any, Iterator, Tuple

from minerva.lab.scenario import BenchmarkScenario, GroundTruth

logger = logging.getLogger("minerva.lab.replay_eo")


@dataclass
class EOFrame:
    """
    A single frame in the historical replay.
    Represents MINERVA's state at a specific point in time.
    All observations are from dates <= frame_date.
    """
    frame_date:     date
    step_index:     int

    # Available observations at this point (no future leakage)
    eo_history:     List[Dict[str, Any]]   # chronological, all <= frame_date
    weather_history: List[Dict[str, Any]]

    # Latest values
    latest_eo:      Optional[Dict[str, Any]] = None
    ndmi:           Optional[float] = None
    ndvi:           Optional[float] = None
    vv_db:          Optional[float] = None
    lst_c:          Optional[float] = None

    # Context
    is_event_period:   bool = False   # ground truth: is anomaly active?
    days_since_event:  Optional[int] = None

    # MINERVA analysis result (filled by runner)
    analysis_result:   Optional[Dict[str, Any]] = None

    @property
    def n_eo_obs(self) -> int:
        return len(self.eo_history)

    @property
    def data_complete(self) -> bool:
        """Are enough observations available to run a reliable analysis?"""
        return self.n_eo_obs >= 6


@dataclass
class ReplaySession:
    """
    A complete historical replay session for one scenario.
    Contains all frames + final evaluation.
    """
    scenario_id:    str
    lab_run_id:     str
    target_lat:     float
    target_lon:     float
    start_date:     date
    end_date:       date
    frames:         List[EOFrame] = field(default_factory=list)
    data_sources:   List[str]     = field(default_factory=list)

    @property
    def n_frames(self) -> int:
        return len(self.frames)

    @property
    def signal_series(self) -> Dict[str, List[Tuple[date, float]]]:
        """Extract time-series per signal from all frames."""
        series: Dict[str, List[Tuple[date, float]]] = {
            "NDMI": [], "NDVI": [], "VV_dB": [], "LST_C": []
        }
        for frame in self.frames:
            if frame.ndmi  is not None: series["NDMI"].append((frame.frame_date, frame.ndmi))
            if frame.ndvi  is not None: series["NDVI"].append((frame.frame_date, frame.ndvi))
            if frame.vv_db is not None: series["VV_dB"].append((frame.frame_date, frame.vv_db))
            if frame.lst_c is not None: series["LST_C"].append((frame.frame_date, frame.lst_c))
        return series


class EOReplayEngine:
    """
    Fetches real EO data and presents it chronologically
    without any future leakage.

    Usage:
        engine = EOReplayEngine()
        session = engine.build_session(scenario, lab_run_id="exp-001")
        for frame in session.frames:
            result = run_minerva_on(frame)
    """

    # Step between replay frames (every N days we advance "today")
    FRAME_STEP_DAYS = 10

    def build_session(
        self,
        scenario: BenchmarkScenario,
        lab_run_id: str,
        frame_step_days: int = FRAME_STEP_DAYS,
    ) -> ReplaySession:
        """
        Fetches ALL historical EO data for the scenario window,
        then builds chronological frames (no future leakage).
        """
        logger.info(
            "Building replay session %s for scenario %s",
            lab_run_id, scenario.scenario_id
        )

        session = ReplaySession(
            scenario_id  = scenario.scenario_id,
            lab_run_id   = lab_run_id,
            target_lat   = scenario.target_lat,
            target_lon   = scenario.target_lon,
            start_date   = scenario.observation_start,
            end_date     = scenario.observation_end,
            data_sources = scenario.data_sources,
        )

        # Fetch full EO history (read-only, no future leakage issue here —
        # leakage is prevented when building individual frames below)
        all_s2   = self._fetch_s2(scenario)
        all_s1   = self._fetch_s1(scenario)
        all_modis= self._fetch_modis(scenario)
        all_wx   = self._fetch_weather(scenario)

        logger.info(
            "Fetched: S2=%d, S1=%d, MODIS=%d, WX=%d observations",
            len(all_s2), len(all_s1), len(all_modis), len(all_wx)
        )

        # Build frames chronologically
        current = scenario.observation_start
        step    = 0
        while current <= scenario.observation_end:
            frame = self._build_frame(
                frame_date   = current,
                step_index   = step,
                all_s2       = all_s2,
                all_s1       = all_s1,
                all_modis    = all_modis,
                all_wx       = all_wx,
                ground_truth = scenario.ground_truth,
            )
            session.frames.append(frame)
            current += timedelta(days=frame_step_days)
            step += 1

        logger.info("Session built: %d frames", session.n_frames)
        return session

    # ── Data Fetchers ─────────────────────────────────────────────────────────

    def _fetch_s2(self, scenario: BenchmarkScenario) -> List[Dict[str, Any]]:
        if "sentinel-2-l2a" not in scenario.data_sources:
            return []
        try:
            from minerva.signals.adapters.sentinel2 import Sentinel2Adapter
            adapter = Sentinel2Adapter()
            raw = adapter.time_series(
                lat   = scenario.target_lat,
                lon   = scenario.target_lon,
                start = scenario.observation_start.isoformat(),
                end   = scenario.observation_end.isoformat(),
                max_scenes = 50,
            )
            return [r for r in raw if r.get("NDMI") is not None]
        except Exception as exc:
            logger.warning("S2 fetch failed: %s", exc)
            return []

    def _fetch_s1(self, scenario: BenchmarkScenario) -> List[Dict[str, Any]]:
        if "sentinel-1-rtc" not in scenario.data_sources:
            return []
        try:
            from minerva.signals.adapters.sentinel1 import Sentinel1Adapter
            adapter = Sentinel1Adapter()
            return adapter.time_series(
                lat   = scenario.target_lat,
                lon   = scenario.target_lon,
                start = scenario.observation_start.isoformat(),
                end   = scenario.observation_end.isoformat(),
                max_scenes = 50,
            )
        except Exception as exc:
            logger.warning("S1 fetch failed: %s", exc)
            return []

    def _fetch_modis(self, scenario: BenchmarkScenario) -> List[Dict[str, Any]]:
        if "modis-11A1-061" not in scenario.data_sources:
            return []
        try:
            from minerva.signals.adapters.modis_lst import ModisLSTAdapter
            adapter = ModisLSTAdapter()
            return adapter.time_series(
                lat   = scenario.target_lat,
                lon   = scenario.target_lon,
                start = scenario.observation_start.isoformat(),
                end   = scenario.observation_end.isoformat(),
                max_scenes = 30,
            )
        except Exception as exc:
            logger.warning("MODIS fetch failed: %s", exc)
            return []

    def _fetch_weather(self, scenario: BenchmarkScenario) -> List[Dict[str, Any]]:
        try:
            from minerva.signals.adapters.weather import fetch_weather_history
            from datetime import date as d
            wx = fetch_weather_history(
                scenario.target_lat, scenario.target_lon,
                scenario.observation_start, scenario.observation_end,
            )
            if not wx:
                return []
            times  = wx.get("time", [])
            temps  = wx.get("temperature_2m_mean", [None]*len(times))
            precips= wx.get("precipitation_sum",  [None]*len(times))
            return [
                {"date": t, "temp_c": te, "precip_mm": pr}
                for t, te, pr in zip(times, temps, precips)
            ]
        except Exception as exc:
            logger.warning("Weather fetch failed: %s", exc)
            return []

    # ── Frame Builder (no-leakage) ────────────────────────────────────────────

    def _build_frame(
        self,
        frame_date:   date,
        step_index:   int,
        all_s2:       List[Dict],
        all_s1:       List[Dict],
        all_modis:    List[Dict],
        all_wx:       List[Dict],
        ground_truth: Optional[GroundTruth],
    ) -> EOFrame:
        """
        Build one frame: only include observations with date <= frame_date.
        This enforces the no-future-leakage rule.
        """
        def before(obs_list, key="date"):
            return [
                o for o in obs_list
                if self._parse_date(o.get(key, "")) <= frame_date
            ]

        s2_before  = before(all_s2)
        s1_before  = before(all_s1)
        modis_before = before(all_modis)
        wx_before  = before(all_wx)

        # Merge EO observations (S2 + S1 + MODIS)
        eo_before = sorted(
            [{"source": "S2", **o} for o in s2_before]
            + [{"source": "S1", **o} for o in s1_before]
            + [{"source": "MODIS", **o} for o in modis_before],
            key=lambda x: x.get("date", "")
        )

        # Latest values from each source
        latest_s2 = s2_before[-1] if s2_before else None
        latest_s1 = s1_before[-1] if s1_before else None
        latest_modis = modis_before[-1] if modis_before else None

        ndmi  = latest_s2.get("NDMI")  if latest_s2 else None
        ndvi  = latest_s2.get("NDVI")  if latest_s2 else None
        vv_db = latest_s1.get("VV_dB") if latest_s1 else None
        lst_c = latest_modis.get("LST_C") if latest_modis else None

        # Ground truth: is this an event period?
        is_event = False
        days_since = None
        if ground_truth and ground_truth.event_occurred:
            if ground_truth.event_start_date and frame_date >= ground_truth.event_start_date:
                is_event = True
                days_since = (frame_date - ground_truth.event_start_date).days

        return EOFrame(
            frame_date      = frame_date,
            step_index      = step_index,
            eo_history      = eo_before,
            weather_history = wx_before,
            latest_eo       = eo_before[-1] if eo_before else None,
            ndmi            = ndmi,
            ndvi            = ndvi,
            vv_db           = vv_db,
            lst_c           = lst_c,
            is_event_period = is_event,
            days_since_event= days_since,
        )

    @staticmethod
    def _parse_date(s: Any) -> date:
        try:
            if isinstance(s, date):
                return s
            return date.fromisoformat(str(s)[:10])
        except Exception:
            return date.min
