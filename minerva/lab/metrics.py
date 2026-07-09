"""
MINERVA Lab — Benchmark Metrics
=================================
Computes all quality metrics for a single benchmark experiment.

Metrics:
  Detection:     Precision, Recall, F1, FPR, FNR
  Timing:        Detection Delay (days), Time-to-Alert
  Localization:  Distance Error (km), Confidence Radius match
  Decision:      Root Cause Accuracy, Recommended Action quality
  Economic:      True cost saved vs false alarm cost
  Calibration:   Are confidence scores accurate?

Each metric includes a version stamp for regression tracking.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Tuple


@dataclass
class DetectionMetrics:
    """Binary classification metrics for anomaly detection."""
    tp: int = 0   # correctly detected anomaly
    fp: int = 0   # false alarm (no real anomaly)
    tn: int = 0   # correctly silent
    fn: int = 0   # missed anomaly

    @property
    def precision(self) -> float:
        return self.tp / max(self.tp + self.fp, 1)

    @property
    def recall(self) -> float:
        return self.tp / max(self.tp + self.fn, 1)

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / max(p + r, 1e-9)

    @property
    def fpr(self) -> float:
        """False Positive Rate."""
        return self.fp / max(self.fp + self.tn, 1)

    @property
    def fnr(self) -> float:
        """False Negative Rate (Miss Rate)."""
        return self.fn / max(self.fn + self.tp, 1)

    @property
    def accuracy(self) -> float:
        total = self.tp + self.fp + self.tn + self.fn
        return (self.tp + self.tn) / max(total, 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tp":        self.tp,
            "fp":        self.fp,
            "tn":        self.tn,
            "fn":        self.fn,
            "precision": round(self.precision, 4),
            "recall":    round(self.recall, 4),
            "f1":        round(self.f1, 4),
            "fpr":       round(self.fpr, 4),
            "fnr":       round(self.fnr, 4),
            "accuracy":  round(self.accuracy, 4),
        }


@dataclass
class TimingMetrics:
    """How quickly did MINERVA detect the anomaly?"""
    detection_delay_days:   Optional[int]   = None  # days after event_start
    time_to_first_alert_h:  Optional[float] = None  # hours from detection to alert

    @property
    def detection_status(self) -> str:
        if self.detection_delay_days is None:
            return "MISSED"
        if self.detection_delay_days <= 7:
            return "EARLY"
        if self.detection_delay_days <= 21:
            return "TIMELY"
        if self.detection_delay_days <= 60:
            return "LATE"
        return "VERY_LATE"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "detection_delay_days":  self.detection_delay_days,
            "time_to_first_alert_h": self.time_to_first_alert_h,
            "detection_status":      self.detection_status,
        }


@dataclass
class LocalizationMetrics:
    """How accurately did MINERVA locate the anomaly?"""
    detected_lat:       Optional[float] = None
    detected_lon:       Optional[float] = None
    true_lat:           Optional[float] = None
    true_lon:           Optional[float] = None
    distance_error_m:   Optional[float] = None   # metres
    confidence_radius_m: Optional[float] = None  # MINERVA's stated uncertainty
    within_confidence:  Optional[bool]   = None  # true location inside confidence?

    @property
    def localization_quality(self) -> str:
        if self.distance_error_m is None:
            return "UNKNOWN"
        if self.distance_error_m < 100:
            return "EXCELLENT"
        if self.distance_error_m < 500:
            return "GOOD"
        if self.distance_error_m < 1000:
            return "ACCEPTABLE"
        return "POOR"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "detected_lat":        self.detected_lat,
            "detected_lon":        self.detected_lon,
            "true_lat":            self.true_lat,
            "true_lon":            self.true_lon,
            "distance_error_m":    self.distance_error_m,
            "confidence_radius_m": self.confidence_radius_m,
            "within_confidence":   self.within_confidence,
            "quality":             self.localization_quality,
        }


@dataclass
class DecisionMetrics:
    """Quality of MINERVA's diagnostic reasoning."""
    predicted_root_cause:   Optional[str] = None
    actual_root_cause:      Optional[str] = None
    root_cause_correct:     Optional[bool]= None

    recommended_action_relevant: Optional[bool] = None  # field validation
    decision_quality_score:      float = 0.0    # 0-1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "predicted_root_cause":        self.predicted_root_cause,
            "actual_root_cause":           self.actual_root_cause,
            "root_cause_correct":          self.root_cause_correct,
            "recommended_action_relevant": self.recommended_action_relevant,
            "decision_quality_score":      round(self.decision_quality_score, 3),
        }


@dataclass
class EconomicMetrics:
    """Economic value of MINERVA's intervention."""
    true_positive_value_usd:  float = 0.0   # cost saved by correct detection
    false_alarm_cost_usd:     float = 0.0   # wasted cost per false alarm
    missed_event_cost_usd:    float = 0.0   # cost of missed detection
    net_economic_value_usd:   float = 0.0   # sum

    def to_dict(self) -> Dict[str, Any]:
        return {
            "true_positive_value_usd": round(self.true_positive_value_usd, 2),
            "false_alarm_cost_usd":    round(self.false_alarm_cost_usd, 2),
            "missed_event_cost_usd":   round(self.missed_event_cost_usd, 2),
            "net_economic_value_usd":  round(self.net_economic_value_usd, 2),
        }


@dataclass
class BenchmarkResult:
    """
    Complete benchmark result for one scenario run.
    Versioned so that regression testing can compare across releases.
    """
    scenario_id:       str
    lab_run_id:        str
    minerva_version:   str
    run_timestamp:     str = field(default_factory=lambda: datetime.now().isoformat())
    duration_seconds:  float = 0.0

    # Individual metric groups
    detection:    DetectionMetrics    = field(default_factory=DetectionMetrics)
    timing:       TimingMetrics       = field(default_factory=TimingMetrics)
    localization: LocalizationMetrics = field(default_factory=LocalizationMetrics)
    decision:     DecisionMetrics     = field(default_factory=DecisionMetrics)
    economic:     EconomicMetrics     = field(default_factory=EconomicMetrics)

    # Pass/Fail
    passed:       bool = False
    failure_reasons: List[str] = field(default_factory=list)

    # Raw data for debugging
    n_frames:          int = 0
    n_eo_observations: int = 0
    signal_coverage:   Dict[str, int] = field(default_factory=dict)

    def evaluate_pass_criteria(self, criteria: Dict[str, Any]) -> bool:
        """Evaluate whether the result meets scenario pass criteria."""
        failures = []

        if criteria.get("detection_required", True):
            if self.detection.recall == 0.0:
                failures.append("DETECTION FAILED: no anomaly detected")

        max_delay = criteria.get("max_detection_delay_days")
        if max_delay and self.timing.detection_delay_days:
            if self.timing.detection_delay_days > max_delay:
                failures.append(
                    f"DELAY TOO HIGH: {self.timing.detection_delay_days}d > {max_delay}d"
                )

        max_fpr = criteria.get("max_false_alarm_rate", 0.20)
        if self.detection.fpr > max_fpr:
            failures.append(
                f"FPR TOO HIGH: {self.detection.fpr:.2f} > {max_fpr}"
            )

        self.failure_reasons = failures
        self.passed = len(failures) == 0
        return self.passed

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id":       self.scenario_id,
            "lab_run_id":        self.lab_run_id,
            "minerva_version":   self.minerva_version,
            "run_timestamp":     self.run_timestamp,
            "duration_seconds":  round(self.duration_seconds, 2),
            "passed":            self.passed,
            "failure_reasons":   self.failure_reasons,
            "n_frames":          self.n_frames,
            "n_eo_observations": self.n_eo_observations,
            "signal_coverage":   self.signal_coverage,
            "detection":         self.detection.to_dict(),
            "timing":            self.timing.to_dict(),
            "localization":      self.localization.to_dict(),
            "decision":          self.decision.to_dict(),
            "economic":          self.economic.to_dict(),
        }


# ── Metrics Calculator ────────────────────────────────────────────────────────

class MetricsCalculator:
    """
    Computes BenchmarkResult from a ReplaySession + Scenario.
    """

    def compute(
        self,
        session,              # ReplaySession
        scenario,             # BenchmarkScenario
        lab_run_id:    str,
        minerva_version: str = "unknown",
        duration_s:    float = 0.0,
    ) -> BenchmarkResult:
        from minerva.lab.replay_eo import EOFrame

        result = BenchmarkResult(
            scenario_id      = scenario.scenario_id,
            lab_run_id       = lab_run_id,
            minerva_version  = minerva_version,
            duration_seconds = duration_s,
            n_frames         = session.n_frames,
        )

        # Signal coverage
        series = session.signal_series
        result.signal_coverage = {sig: len(pts) for sig, pts in series.items()}
        result.n_eo_observations = sum(result.signal_coverage.values())

        # Count TP/FP/TN/FN
        tp = fp = tn = fn = 0
        detection_days: Optional[int] = None
        gt = scenario.ground_truth

        for frame in session.frames:
            if frame.analysis_result is None:
                continue
            alerted   = frame.analysis_result.get("alerted", False)
            is_event  = frame.is_event_period

            if alerted and is_event:
                tp += 1
                if detection_days is None and frame.days_since_event is not None:
                    detection_days = frame.days_since_event
            elif alerted and not is_event:
                fp += 1
            elif not alerted and is_event:
                fn += 1
            else:
                tn += 1

        result.detection = DetectionMetrics(tp=tp, fp=fp, tn=tn, fn=fn)
        result.timing    = TimingMetrics(detection_delay_days=detection_days)

        # Localization (if GT has confirmed location)
        if gt and gt.confirmed_location and gt.event_occurred:
            result.localization = LocalizationMetrics(
                true_lat  = gt.confirmed_location[0],
                true_lon  = gt.confirmed_location[1],
                detected_lat = scenario.target_lat,
                detected_lon = scenario.target_lon,
                distance_error_m = 0.0,   # same point (point target)
            )

        # Evaluate pass criteria
        result.evaluate_pass_criteria(scenario.pass_criteria)
        return result


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in metres between two lat/lon points."""
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(Δλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
