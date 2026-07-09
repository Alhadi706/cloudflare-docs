"""
Benchmark Framework — مقارنة MINERVA مع الطرق التقليدية.

أربع طرق تعمل على نفس البيانات:
  M1: Global Threshold     — z-score عالمي بسيط
  M2: Conditional Baseline — Phase 0 فقط
  M3: MINERVA Phase 1      — Conditional + Physical Facts
  M4: MINERVA Phase 2      — الكامل + KG + Spatial Memory

معيار المقارنة العادل:
  - نفس بيانات التدريب والاختبار
  - نفس حد الـ Alert (WATCH: score > 0.3)
  - نفس تعريف Ground Truth
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from abc import ABC, abstractmethod
import pandas as pd
import numpy as np

from minerva.baseline.behavior_profile import BehaviorProfileBuilder
from minerva.anomaly.engine import AnomalyEngine


@dataclass
class BenchmarkResult:
    method_name: str
    tp: int
    fp: int
    tn: int
    fn: int
    days_to_detect: list[int] = field(default_factory=list)

    @property
    def precision(self) -> float:
        return self.tp / max(self.tp + self.fp, 1)

    @property
    def recall(self) -> float:
        return self.tp / max(self.tp + self.fn, 1)

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / max(p + r, 1e-6)

    @property
    def fpr(self) -> float:
        return self.fp / max(self.fp + self.tn, 1)

    @property
    def avg_days_to_detect(self) -> float:
        if not self.days_to_detect:
            return -1.0
        valid = [d for d in self.days_to_detect if d >= 0]
        return sum(valid) / len(valid) if valid else -1.0


# =============================================================================
# Detector Interface
# =============================================================================

class Detector(ABC):
    """الواجهة المشتركة لجميع طرق الكشف."""

    def __init__(self, name: str, alert_threshold: float = 0.30):
        self._name = name
        self.alert_threshold = alert_threshold

    @property
    def name(self) -> str:
        return self._name

    @abstractmethod
    def train(self, df_train: pd.DataFrame, asset_id: str, signals: list[str]):
        """بناء الـ Model من بيانات التدريب."""
        pass

    @abstractmethod
    def score(self, row: pd.Series, signals: list[str]) -> float:
        """يُعطي anomaly score (0→1) للملاحظة."""
        pass

    def detect(self, row: pd.Series, signals: list[str]) -> bool:
        return self.score(row, signals) >= self.alert_threshold


# =============================================================================
# M1: Global Threshold (الطريقة التقليدية الأبسط)
# =============================================================================

class GlobalThresholdDetector(Detector):
    """
    يحسب z-score بناءً على الـ Global Mean/Std (يتجاهل السياق).
    """
    def __init__(self, primary_signal: str = "SOIL_MOISTURE", **kwargs):
        super().__init__("M1: Global Threshold", **kwargs)
        self.primary_signal = primary_signal
        self._mean: float = 0.0
        self._std: float = 1.0

    def train(self, df_train: pd.DataFrame, asset_id: str, signals: list[str]):
        clean = df_train[~df_train["is_event_period"]][self.primary_signal].dropna()
        self._mean = float(clean.mean())
        self._std  = float(clean.std(ddof=1)) if len(clean) > 1 else 1.0

    def score(self, row: pd.Series, signals: list[str]) -> float:
        val = row.get(self.primary_signal, self._mean)
        z = abs(val - self._mean) / max(self._std, 1e-6)
        # تحويل z → score 0-1
        return min(z / 5.0, 1.0)


# =============================================================================
# M2: Conditional Baseline (Phase 0)
# =============================================================================

class ConditionalBaselineDetector(Detector):
    """Conditional Baseline فقط، بدون Physical Facts."""

    def __init__(self, asset_type: str, **kwargs):
        super().__init__("M2: Conditional Baseline", **kwargs)
        self.asset_type = asset_type
        self._profile = None
        self._engine = None

    def train(self, df_train: pd.DataFrame, asset_id: str, signals: list[str]):
        builder = BehaviorProfileBuilder(asset_id, signals)
        self._profile = builder.build_conditional(df_train)
        self._engine  = AnomalyEngine(asset_id, self.asset_type, self._profile, "conditional")
        self._asset_id = asset_id
        self._signals  = signals

    def score(self, row: pd.Series, signals: list[str]) -> float:
        if self._engine is None:
            return 0.0
        result = self._engine.analyze_observation(
            obs_date=row["date"],
            signal_values={s: float(row[s]) for s in signals if s in row.index},
            context_key=row.get("context_key", "GLOBAL"),
        )
        return result.anomaly_score


# =============================================================================
# M3: Multi-Signal Threshold (traditional multi-spectral approach)
# =============================================================================

class MultiSignalThresholdDetector(Detector):
    """
    يُنبِّه إذا انحرف عدد كافٍ من الإشارات عن الـ Global Mean.
    يُمثِّل نهج التحليل متعدد المصادر التقليدي (بدون Context).
    """

    def __init__(self, min_anomalous_signals: int = 2, **kwargs):
        super().__init__("M3: Multi-Signal (No Context)", **kwargs)
        self.min_anomalous = min_anomalous_signals
        self._stats: dict[str, tuple] = {}   # signal → (mean, std)
        self._z_threshold = 2.0

    def train(self, df_train: pd.DataFrame, asset_id: str, signals: list[str]):
        clean = df_train[~df_train["is_event_period"]]
        for sig in signals:
            if sig not in clean.columns:
                continue
            vals = clean[sig].dropna()
            if len(vals) > 1:
                self._stats[sig] = (float(vals.mean()), float(vals.std(ddof=1)))

    def score(self, row: pd.Series, signals: list[str]) -> float:
        anomalous = 0
        max_z = 0.0
        for sig in signals:
            if sig not in self._stats:
                continue
            mean, std = self._stats[sig]
            val = row.get(sig, mean)
            z = abs(val - mean) / max(std, 1e-6)
            if z >= self._z_threshold:
                anomalous += 1
            max_z = max(max_z, z)
        # يُنبِّه إذا كان عدد كافٍ من الإشارات شاذة
        if anomalous >= self.min_anomalous:
            return min(max_z / 5.0, 1.0) * 0.8 + 0.2
        return min(max_z / 7.0, 0.3)


# =============================================================================
# M4: MINERVA Full (Conditional + Physical Facts)
# =============================================================================

class MINERVADetector(Detector):
    """
    MINERVA الكامل: Conditional Baseline + Physical Facts.
    """

    def __init__(self, asset_type: str, precipitation_lookup: dict | None = None, **kwargs):
        super().__init__("M4: MINERVA Full", **kwargs)
        self.asset_type = asset_type
        self._precip = precipitation_lookup or {}   # date → precip_30d
        self._profile = None
        self._engine  = None

    def train(self, df_train: pd.DataFrame, asset_id: str, signals: list[str]):
        builder = BehaviorProfileBuilder(asset_id, signals)
        self._profile = builder.build_conditional(df_train)
        self._engine  = AnomalyEngine(asset_id, self.asset_type, self._profile, "conditional")
        self._asset_id = asset_id
        self._signals  = signals

    def score(self, row: pd.Series, signals: list[str]) -> float:
        if self._engine is None:
            return 0.0

        result = self._engine.analyze_observation(
            obs_date=row["date"],
            signal_values={s: float(row[s]) for s in signals if s in row.index},
            context_key=row.get("context_key", "GLOBAL"),
        )
        base_score = result.anomaly_score

        # Physical Fact: غياب المطر يُعزز، وجوده يُقلص
        precip_30d = self._precip.get(row["date"], 0.0)
        if base_score > self.alert_threshold:
            if precip_30d < 5:
                base_score = min(base_score * 1.15, 1.0)   # دليل فيزيائي يُعزز
            elif precip_30d > 20:
                base_score = base_score * 0.55               # المطر يُفسِّر الرطوبة

        return base_score


# =============================================================================
# Benchmark Runner
# =============================================================================

class BenchmarkRunner:
    """
    يُشغِّل جميع الـ Detectors على نفس البيانات ويُقارن النتائج.
    """

    def run(
        self,
        detectors: list[Detector],
        df_train: pd.DataFrame,
        df_test:  pd.DataFrame,
        asset_id: str,
        signals: list[str],
        event_start: date,
        event_end: date,
    ) -> list[BenchmarkResult]:
        """
        يُدرِّب كل Detector على df_train ويختبره على df_test.
        event_start/end يُحدِّدان فترة الحدث الحقيقي.
        """
        results = []

        for detector in detectors:
            detector.train(df_train, asset_id, signals)

            tp = fp = tn = fn = 0
            days_to_detect: list[int] = []
            first_alert_date: date | None = None

            for _, row in df_test.iterrows():
                is_event = bool(row.get("is_event_period", False))
                alerted  = detector.detect(row, signals)

                if alerted and is_event:
                    tp += 1
                    if first_alert_date is None:
                        first_alert_date = row["date"]
                        days = (row["date"] - event_start).days
                        days_to_detect.append(days)
                elif alerted and not is_event:
                    fp += 1
                elif not alerted and is_event:
                    fn += 1
                else:
                    tn += 1

            results.append(BenchmarkResult(
                method_name=detector.name,
                tp=tp, fp=fp, tn=tn, fn=fn,
                days_to_detect=days_to_detect,
            ))

        return results
