"""
Anomaly Engine — يكتشف الشذوذ بدون معرفة نوع الحدث.
يعمل على Conditional Baseline أو Global Baseline.
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from minerva.baseline.behavior_profile import BehaviorProfile
from minerva.config import ASSET_TYPES


@dataclass
class AnomalyResult:
    asset_id: str
    obs_date: date
    context_key: str
    anomaly_score: float         # 0→1
    severity: str                # NORMAL / WATCH / ANOMALY / SEVERE
    z_scores: dict               # signal → z_score
    features_anomalous: list     # signals with |z| > threshold
    baseline_type: str           # "conditional" or "global"
    confidence_level: str        # HIGH / MEDIUM / LOW / INSUFFICIENT
    evidence_completeness: float # 0→1 (ADR-006)

    @property
    def is_anomalous(self) -> bool:
        return self.severity in ("ANOMALY", "SEVERE")


SEVERITY_THRESHOLDS = {
    "NORMAL": (0.0, 0.3),
    "WATCH":  (0.3, 0.6),
    "ANOMALY":(0.6, 0.8),
    "SEVERE": (0.8, 1.0),
}

Z_ANOMALY_THRESHOLD = 2.5   # |z| > 2.5 → الإشارة شاذة


def _classify_severity(score: float) -> str:
    for name, (lo, hi) in SEVERITY_THRESHOLDS.items():
        if lo <= score < hi:
            return name
    return "SEVERE" if score >= 0.8 else "NORMAL"


def _normalize_z(z: float, max_z: float = 5.0) -> float:
    """يُحوِّل z-score إلى نطاق 0→1."""
    return min(abs(z) / max_z, 1.0)


class AnomalyEngine:
    """
    يُشغِّل الكشف عن الشذوذ على سلسلة زمنية.
    """

    def __init__(
        self,
        asset_id: str,
        asset_type: str,
        profile: BehaviorProfile,
        baseline_type: str = "conditional",
    ):
        self.asset_id = asset_id
        self.asset_type = asset_type
        self.profile = profile
        self.baseline_type = baseline_type
        self.feature_weights = ASSET_TYPES.get(asset_type, {}).get("feature_weights", {})
        self.key_signals = ASSET_TYPES.get(asset_type, {}).get("key_signals", [])

    def analyze_observation(
        self,
        obs_date: date,
        signal_values: dict[str, float],
        context_key: str,
    ) -> AnomalyResult:
        """
        يُحلِّل ملاحظة واحدة ويُعيد AnomalyResult.
        """
        z_scores = {}
        available_signals = []
        anomalous_signals = []
        weighted_score = 0.0
        total_weight = 0.0
        confidence_levels = []

        for signal, value in signal_values.items():
            if signal not in self.key_signals:
                continue

            # جلب الـ cell المناسبة
            if self.baseline_type == "conditional":
                cell = self.profile.get_cell(context_key, signal)
            else:
                cell = self.profile.get_cell("GLOBAL", signal)

            if cell is None or cell.confidence == "LOW":
                continue

            available_signals.append(signal)
            confidence_levels.append(cell.confidence)

            z = cell.z_score(value)
            z_scores[signal] = round(z, 2)

            if abs(z) >= Z_ANOMALY_THRESHOLD:
                anomalous_signals.append(signal)

            w = self.feature_weights.get(signal, 1.0 / len(self.key_signals))
            weighted_score += w * _normalize_z(z)
            total_weight += w

        # Coherence Multiplier: كلما تضافرت المؤشرات زادت الثقة
        n_anom = len(anomalous_signals)
        coherence = 1.0 + 0.3 * max(0, n_anom - 1)

        raw_score = (weighted_score / total_weight) if total_weight > 0 else 0.0
        final_score = min(raw_score * coherence, 1.0)

        # Evidence Completeness (ADR-006)
        ec = len(available_signals) / max(len(self.key_signals), 1)

        # Confidence level (أضعف مستوى بين الإشارات المتاحة)
        conf = "INSUFFICIENT"
        if confidence_levels:
            if "HIGH" in confidence_levels:
                conf = "HIGH"
            elif "MEDIUM" in confidence_levels:
                conf = "MEDIUM"
            else:
                conf = "LOW"

        if ec < 0.3:
            conf = "INSUFFICIENT"

        return AnomalyResult(
            asset_id=self.asset_id,
            obs_date=obs_date,
            context_key=context_key,
            anomaly_score=round(final_score, 3),
            severity=_classify_severity(final_score),
            z_scores=z_scores,
            features_anomalous=anomalous_signals,
            baseline_type=self.baseline_type,
            confidence_level=conf,
            evidence_completeness=round(ec, 2),
        )

    def analyze_series(self, df: pd.DataFrame) -> list[AnomalyResult]:
        """
        يُحلِّل سلسلة زمنية كاملة.
        df يجب أن يحتوي على: date, SOIL_MOISTURE, SURFACE_TEMP,
                             SAR_BACKSCATTER, VEGETATION_INDEX, context_key
        """
        results = []
        for _, row in df.iterrows():
            signal_values = {
                s: row[s] for s in self.key_signals
                if s in row.index and not pd.isna(row[s])
            }
            ctx_key = row.get("context_key", "GLOBAL") if self.baseline_type == "conditional" else "GLOBAL"

            result = self.analyze_observation(
                obs_date=row["date"],
                signal_values=signal_values,
                context_key=ctx_key,
            )
            results.append(result)
        return results


def evaluate_detection_performance(
    results: list[AnomalyResult],
    df: pd.DataFrame,
) -> dict:
    """
    يقيس أداء الكشف مقارنةً بالـ Ground Truth في df.
    df يجب أن يحتوي على: date, is_event_period

    Returns: TP, FP, TN, FN, TPR, FPR, Precision
    """
    ground_truth = {
        row["date"]: row["is_event_period"]
        for _, row in df.iterrows()
    }

    tp = fp = tn = fn = 0

    for r in results:
        gt = ground_truth.get(r.obs_date, False)
        predicted_positive = r.is_anomalous

        if predicted_positive and gt:
            tp += 1
        elif predicted_positive and not gt:
            fp += 1
        elif not predicted_positive and not gt:
            tn += 1
        else:
            fn += 1

    tpr = tp / max(tp + fn, 1)     # True Positive Rate (Recall)
    fpr = fp / max(fp + tn, 1)     # False Positive Rate
    precision = tp / max(tp + fp, 1)

    return {
        "TP": tp, "FP": fp, "TN": tn, "FN": fn,
        "TPR": round(tpr, 3),
        "FPR": round(fpr, 3),
        "Precision": round(precision, 3),
        "F1": round(2 * tpr * precision / max(tpr + precision, 1e-6), 3),
    }
