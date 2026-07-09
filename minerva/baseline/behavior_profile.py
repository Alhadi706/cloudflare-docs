"""
Behavior Profile — Conditional Baseline Builder & Query Engine.
هذا هو الابتكار المركزي لـ MINERVA.

يبني ويستعلم عن baseline مشروط بالـ Context.
يدعم الـ Versioning لتتبع التطور.
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from minerva.config import CONFIDENCE_THRESHOLDS


@dataclass
class BehaviorCell:
    """
    خلية سلوكية واحدة: أصل × سياق × إشارة.
    """
    asset_id: str
    context_key: str         # "HOT_DRY|DRY|NORMAL|NORMAL"
    signal_id: str
    mean: float
    std: float
    p05: float
    p95: float
    n_obs: int
    confidence: str          # HIGH / MEDIUM / LOW
    version: str = "v1"
    updated_at: Optional[datetime] = None

    def z_score(self, observed: float) -> float:
        """حساب الانحراف المعياري عن المتوقع."""
        if self.std < 1e-6:
            return 0.0
        return (observed - self.mean) / self.std

    def is_anomalous(self, observed: float, threshold: float = 2.5) -> bool:
        return abs(self.z_score(observed)) >= threshold


@dataclass
class BehaviorProfile:
    """
    الملف السلوكي الكامل لأصل واحد.
    يحتوي على جميع خلايا السياق.
    """
    asset_id: str
    version: str = "v1"
    cells: dict = field(default_factory=dict)   # (context_key, signal_id) → BehaviorCell

    def get_cell(self, context_key: str, signal_id: str) -> Optional[BehaviorCell]:
        return self.cells.get((context_key, signal_id))

    def get_confidence(self, context_key: str, signal_id: str) -> str:
        cell = self.get_cell(context_key, signal_id)
        return cell.confidence if cell else "LOW"


class BehaviorProfileBuilder:
    """
    يبني BehaviorProfile من time series تاريخية.
    """

    def __init__(
        self,
        asset_id: str,
        signals: list[str],
        min_obs_high: int = CONFIDENCE_THRESHOLDS["HIGH"],
        min_obs_medium: int = CONFIDENCE_THRESHOLDS["MEDIUM"],
    ):
        self.asset_id = asset_id
        self.signals = signals
        self.min_obs_high = min_obs_high
        self.min_obs_medium = min_obs_medium

    def _confidence_level(self, n: int) -> str:
        if n >= self.min_obs_high:
            return "HIGH"
        elif n >= self.min_obs_medium:
            return "MEDIUM"
        else:
            return "LOW"

    def build_conditional(self, df: pd.DataFrame, version: str = "v1") -> BehaviorProfile:
        """
        يبني Conditional Baseline من DataFrame.
        df يجب أن يحتوي على: date, signal columns, context_key, is_event_period
        """
        profile = BehaviorProfile(asset_id=self.asset_id, version=version)

        # استبعاد فترات الأحداث (لا تُلوِّث الـ Baseline)
        clean = df[~df["is_event_period"]].copy()

        for signal in self.signals:
            if signal not in clean.columns:
                continue
            for ctx_key, group in clean.groupby("context_key"):
                values = group[signal].dropna().values
                n = len(values)

                if n < 2:
                    continue

                cell = BehaviorCell(
                    asset_id=self.asset_id,
                    context_key=str(ctx_key),
                    signal_id=signal,
                    mean=float(np.mean(values)),
                    std=float(np.std(values, ddof=1)),
                    p05=float(np.percentile(values, 5)),
                    p95=float(np.percentile(values, 95)),
                    n_obs=n,
                    confidence=self._confidence_level(n),
                    version=version,
                    updated_at=datetime.utcnow(),
                )
                profile.cells[(str(ctx_key), signal)] = cell

        return profile

    def build_global(self, df: pd.DataFrame, version: str = "v1_global") -> BehaviorProfile:
        """
        يبني Global Baseline (يتجاهل السياق) — للمقارنة فقط.
        للمقارنة: هل الـ Conditional أفضل؟
        """
        profile = BehaviorProfile(asset_id=self.asset_id, version=version)
        clean = df[~df["is_event_period"]].copy()
        # نُعامل الكل كـ context واحد
        clean = clean.copy()
        clean["context_key"] = "GLOBAL"

        for signal in self.signals:
            if signal not in clean.columns:
                continue
            values = clean[signal].dropna().values
            n = len(values)
            if n < 2:
                continue

            cell = BehaviorCell(
                asset_id=self.asset_id,
                context_key="GLOBAL",
                signal_id=signal,
                mean=float(np.mean(values)),
                std=float(np.std(values, ddof=1)),
                p05=float(np.percentile(values, 5)),
                p95=float(np.percentile(values, 95)),
                n_obs=n,
                confidence=self._confidence_level(n),
                version=version,
                updated_at=datetime.utcnow(),
            )
            profile.cells[("GLOBAL", signal)] = cell

        return profile

    def compute_drift(
        self,
        old_profile: BehaviorProfile,
        new_profile: BehaviorProfile,
    ) -> dict:
        """
        يحسب الانجراف بين إصدارين من الـ Baseline.
        إنجراف > 1.5σ → إنشاء إصدار جديد + تحذير.
        """
        drift_report = {}
        for (ctx_key, signal), old_cell in old_profile.cells.items():
            new_cell = new_profile.cells.get((ctx_key, signal))
            if not new_cell:
                continue
            if old_cell.std < 1e-6:
                continue
            drift_z = abs(new_cell.mean - old_cell.mean) / old_cell.std
            drift_report[(ctx_key, signal)] = {
                "old_mean": old_cell.mean,
                "new_mean": new_cell.mean,
                "drift_z": round(drift_z, 2),
                "significant": drift_z > 1.5,
            }
        return drift_report
