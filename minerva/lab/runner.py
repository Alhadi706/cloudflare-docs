"""
MINERVA Lab — Benchmark Runner
================================
Orchestrates the full pipeline:
  Scenario → Replay → Analysis → Metrics → Result

Usage:
  runner = BenchmarkRunner(minerva_version="13.0.0")
  result = runner.run("WATER_LEAK_TRIPOLI_001")
  print(result.passed, result.detection.f1)

Run all scenarios:
  results = runner.run_all()
"""

from __future__ import annotations

import time
import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any

from minerva.lab.scenario import ScenarioLibrary, BenchmarkScenario
from minerva.lab.replay_eo import EOReplayEngine, ReplaySession, EOFrame
from minerva.lab.metrics import BenchmarkResult, MetricsCalculator

logger = logging.getLogger("minerva.lab.runner")


class BenchmarkRunner:
    """
    Runs a full benchmark: scenario → real EO replay → MINERVA analysis → metrics.
    """

    def __init__(
        self,
        minerva_version: str = "unknown",
        frame_step_days: int = 10,
    ):
        self.minerva_version  = minerva_version
        self.frame_step_days  = frame_step_days
        self.replay_engine    = EOReplayEngine()
        self.metrics_calc     = MetricsCalculator()

    def run(
        self,
        scenario_id: str,
        lab_run_id: Optional[str] = None,
    ) -> BenchmarkResult:
        """Run a single scenario and return BenchmarkResult."""
        scenario = ScenarioLibrary.get(scenario_id)
        if scenario is None:
            raise ValueError(f"Scenario '{scenario_id}' not found in library")

        lab_run_id = lab_run_id or f"RUN-{uuid.uuid4().hex[:8].upper()}"
        logger.info("Starting benchmark run %s for scenario %s", lab_run_id, scenario_id)
        t0 = time.time()

        # Step 1: Build historical replay session
        session = self.replay_engine.build_session(
            scenario        = scenario,
            lab_run_id      = lab_run_id,
            frame_step_days = self.frame_step_days,
        )

        # Step 2: Analyse each frame with MINERVA (no future leakage)
        session = self._analyse_session(session, scenario)

        # Step 3: Compute benchmark metrics
        duration = time.time() - t0
        result = self.metrics_calc.compute(
            session         = session,
            scenario        = scenario,
            lab_run_id      = lab_run_id,
            minerva_version = self.minerva_version,
            duration_s      = duration,
        )

        logger.info(
            "Benchmark %s: passed=%s F1=%.3f delay=%s days",
            lab_run_id,
            result.passed,
            result.detection.f1,
            result.timing.detection_delay_days,
        )
        return result

    def run_all(self) -> List[BenchmarkResult]:
        """Run all registered scenarios."""
        results = []
        for scenario in ScenarioLibrary.list_all():
            try:
                result = self.run(scenario.scenario_id)
                results.append(result)
            except Exception as exc:
                logger.error("Scenario %s failed: %s", scenario.scenario_id, exc)
        return results

    # ── Internal: run MINERVA analysis per frame ──────────────────────────────

    def _analyse_session(
        self,
        session: ReplaySession,
        scenario: BenchmarkScenario,
    ) -> ReplaySession:
        """
        Apply the prediction engine to each frame.
        At frame T, only data from [start, T] is visible.
        """
        from minerva.prediction import TrendAnalyzer, ForecastEngine
        from minerva.targets.mission import MissionTemplates, MissionType

        analyzer = TrendAnalyzer()
        engine   = ForecastEngine(analyzer)

        # Get signal + threshold from mission
        signal, threshold = self._get_mission_config(scenario.mission_type)

        for frame in session.frames:
            if not frame.data_complete:
                frame.analysis_result = {"alerted": False, "reason": "insufficient_data"}
                continue

            # Build series up to this frame (no future leakage)
            series = [
                (o["date"] if hasattr(o["date"], "year")
                 else __import__("datetime").date.fromisoformat(o["date"][:10]),
                 o.get(signal))
                for o in frame.eo_history
                if o.get("source") in ("S2", "MODIS")
                and o.get(signal) is not None
            ]
            series = [(d, v) for d, v in series if v is not None]
            series = sorted(series, key=lambda x: x[0])

            if len(series) < 4:
                frame.analysis_result = {"alerted": False, "reason": "too_few_points"}
                continue

            trend = analyzer.analyze(series, signal)
            alerted = False
            confidence = 0.0
            anomaly_prob = 0.0

            if trend is not None:
                fc = engine.forecast(
                    target_id    = scenario.target_id,
                    signal       = signal,
                    series       = series,
                    horizon_days = 30,
                    threshold    = threshold,
                )
                if fc is not None:
                    anomaly_prob = fc.anomaly_probability
                    confidence   = fc.model_confidence
                    # Alert if P(anomaly) exceeds mission's minimum confidence
                    alerted = anomaly_prob >= scenario.pass_criteria.get("min_confidence", 0.50)

            frame.analysis_result = {
                "alerted":          alerted,
                "anomaly_prob":     round(anomaly_prob, 3),
                "confidence":       round(confidence, 3),
                "signal":           signal,
                "n_obs_used":       len(series),
                "trend_direction":  trend.direction.value if trend else "UNKNOWN",
            }

        return session

    @staticmethod
    def _get_mission_config(mission_type: str) -> tuple:
        """Return (primary_signal, threshold) for a mission type."""
        configs = {
            "WATER_LEAK_DETECTION":  ("NDMI",  -0.080),
            "VEGETATION_HEALTH":     ("NDVI",  +0.100),
            "INFRASTRUCTURE_AGING":  ("NDMI",  -0.080),
            "SUBSIDENCE_MONITORING": ("VV_dB", -3.000),
            "FLOOD_RISK":            ("NDWI",  +0.200),
        }
        return configs.get(mission_type, ("NDMI", -0.080))


# ── Regression Comparator ─────────────────────────────────────────────────────

@dataclass
class RegressionComparison:
    """Compares two BenchmarkResults (version A vs B)."""
    scenario_id:    str
    version_a:      str
    version_b:      str
    # Detection delta
    f1_delta:       float  = 0.0   # B.f1 - A.f1
    precision_delta: float = 0.0
    recall_delta:   float  = 0.0
    fpr_delta:      float  = 0.0
    # Timing
    delay_delta:    Optional[int] = None  # days (negative = faster)
    # Verdict
    verdict:        str = "UNCHANGED"   # "IMPROVED" | "UNCHANGED" | "REGRESSED"
    regressions:    List[str] = field(default_factory=list)

    @classmethod
    def compare(
        cls,
        result_a: BenchmarkResult,
        result_b: BenchmarkResult,
        regression_threshold: float = 0.02,
    ) -> "RegressionComparison":
        comp = cls(
            scenario_id = result_a.scenario_id,
            version_a   = result_a.minerva_version,
            version_b   = result_b.minerva_version,
        )
        comp.f1_delta        = result_b.detection.f1        - result_a.detection.f1
        comp.precision_delta = result_b.detection.precision - result_a.detection.precision
        comp.recall_delta    = result_b.detection.recall    - result_a.detection.recall
        comp.fpr_delta       = result_b.detection.fpr       - result_a.detection.fpr

        if result_a.timing.detection_delay_days and result_b.timing.detection_delay_days:
            comp.delay_delta = result_b.timing.detection_delay_days - result_a.timing.detection_delay_days

        regressions = []
        if comp.f1_delta < -regression_threshold:
            regressions.append(f"F1 regressed: {result_a.detection.f1:.3f} → {result_b.detection.f1:.3f}")
        if comp.fpr_delta > regression_threshold:
            regressions.append(f"FPR increased: {result_a.detection.fpr:.3f} → {result_b.detection.fpr:.3f}")
        if comp.delay_delta and comp.delay_delta > 7:
            regressions.append(f"Detection delay increased: +{comp.delay_delta} days")

        comp.regressions = regressions
        if regressions:
            comp.verdict = "REGRESSED"
        elif comp.f1_delta > regression_threshold:
            comp.verdict = "IMPROVED"
        else:
            comp.verdict = "UNCHANGED"

        return comp

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id":    self.scenario_id,
            "version_a":      self.version_a,
            "version_b":      self.version_b,
            "verdict":        self.verdict,
            "f1_delta":       round(self.f1_delta, 4),
            "precision_delta":round(self.precision_delta, 4),
            "recall_delta":   round(self.recall_delta, 4),
            "fpr_delta":      round(self.fpr_delta, 4),
            "delay_delta":    self.delay_delta,
            "regressions":    self.regressions,
        }
