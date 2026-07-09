"""
Historical Replay Engine — Phase 3.

يُشغِّل النظام على بيانات تاريخية دون معرفة المستقبل.
في كل خطوة زمنية T:
  - الـ Baseline مبني فقط من البيانات قبل T (window lookback)
  - لا معرفة بما سيحدث بعد T

هذا هو الاختبار الحقيقي: كيف كان سيتصرف النظام لو كان يعمل فعلًا؟

الفرق عن Phase 0:
  Phase 0: train 2023-2024, test 2025 (naive split)
  Phase 3: sliding window في كل خطوة → يُحاكي الواقع التشغيلي الفعلي
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional
import pandas as pd
import numpy as np
from minerva.baseline.behavior_profile import BehaviorProfileBuilder, BehaviorProfile
from minerva.anomaly.engine import AnomalyEngine


@dataclass
class ReplayDecision:
    """قرار النظام في لحظة تاريخية."""
    obs_date: date
    anomaly_score: float
    severity: str
    would_alert: bool
    context_key: str
    z_scores: dict
    n_training_obs: int        # كم ملاحظة كانت متاحة لبناء الـ Baseline
    baseline_confidence: str   # HIGH/MEDIUM/LOW
    is_event_period: bool      # Ground Truth (نعرفه لأن البيانات تاريخية)

    # يُملأ لاحقًا من الـ diagnosis
    diagnosed_event: Optional[str] = None
    diagnosis_confidence: Optional[str] = None


@dataclass
class ReplayResult:
    asset_id: str
    replay_period: tuple[date, date]
    lookback_days: int
    decisions: list[ReplayDecision]

    # Statistics
    @property
    def tp(self) -> int:
        return sum(1 for d in self.decisions if d.would_alert and d.is_event_period)

    @property
    def fp(self) -> int:
        return sum(1 for d in self.decisions if d.would_alert and not d.is_event_period)

    @property
    def fn(self) -> int:
        return sum(1 for d in self.decisions if not d.would_alert and d.is_event_period)

    @property
    def tn(self) -> int:
        return sum(1 for d in self.decisions if not d.would_alert and not d.is_event_period)

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
    def days_to_first_detection(self) -> Optional[int]:
        """كم يومًا قبل Ground Truth صدر أول تنبيه؟"""
        event_start = next((d.obs_date for d in self.decisions if d.is_event_period), None)
        first_alert  = next((d.obs_date for d in self.decisions if d.would_alert and d.is_event_period), None)
        if event_start and first_alert:
            return (first_alert - event_start).days
        return None


class HistoricalReplayEngine:
    """
    يُعيد تشغيل MINERVA على بيانات تاريخية باستخدام Sliding Window.
    في كل نقطة زمنية: يبني الـ Baseline فقط من الماضي.
    """

    def __init__(
        self,
        asset_id: str,
        asset_type: str,
        signals: list[str],
        lookback_days: int = 365,        # نافذة بناء الـ Baseline
        alert_threshold: float = 0.30,   # حد الـ WATCH
        min_train_obs: int = 15,         # حد أدنى لتشغيل التحليل
    ):
        self.asset_id = asset_id
        self.asset_type = asset_type
        self.signals = signals
        self.lookback_days = lookback_days
        self.alert_threshold = alert_threshold
        self.min_train_obs = min_train_obs

    def replay(
        self,
        df_full: pd.DataFrame,           # البيانات الكاملة (train + test)
        replay_start: date,
        replay_end: date,
    ) -> ReplayResult:
        """
        يُشغِّل الـ Replay على الفترة [replay_start, replay_end].
        في كل خطوة: يبني Baseline من [obs_date - lookback_days, obs_date).
        """
        decisions = []
        replay_rows = df_full[
            (df_full["date"] >= replay_start) &
            (df_full["date"] <= replay_end)
        ].copy()

        for _, row in replay_rows.iterrows():
            obs_date = row["date"]
            window_start = obs_date - timedelta(days=self.lookback_days)

            # بيانات التدريب: فقط ما قبل obs_date
            train_data = df_full[
                (df_full["date"] >= window_start) &
                (df_full["date"] < obs_date) &
                (~df_full["is_event_period"])   # لا تُلوِّث الـ Baseline بفترات الحوادث
            ].copy()

            n_train = len(train_data)
            if n_train < self.min_train_obs:
                # بيانات غير كافية → لا قرار
                decisions.append(ReplayDecision(
                    obs_date=obs_date,
                    anomaly_score=0.0,
                    severity="INSUFFICIENT_DATA",
                    would_alert=False,
                    context_key=row.get("context_key", "UNKNOWN"),
                    z_scores={},
                    n_training_obs=n_train,
                    baseline_confidence="LOW",
                    is_event_period=bool(row.get("is_event_period", False)),
                ))
                continue

            # بناء Conditional Baseline من نافذة الماضي
            builder = BehaviorProfileBuilder(self.asset_id, self.signals)
            profile  = builder.build_conditional(train_data)
            engine   = AnomalyEngine(self.asset_id, self.asset_type, profile, "conditional")

            # تحليل اللحظة الحالية (row واحد)
            result = engine.analyze_observation(
                obs_date=obs_date,
                signal_values={s: float(row[s]) for s in self.signals if s in row.index},
                context_key=row.get("context_key", "GLOBAL"),
            )

            # الثقة في الـ Baseline
            baseline_conf = "LOW"
            for sig in self.signals[:1]:
                cell = profile.get_cell(row.get("context_key", ""), sig)
                if cell:
                    baseline_conf = cell.confidence
                    break

            decisions.append(ReplayDecision(
                obs_date=obs_date,
                anomaly_score=result.anomaly_score,
                severity=result.severity,
                would_alert=result.anomaly_score > self.alert_threshold,
                context_key=result.context_key,
                z_scores=result.z_scores,
                n_training_obs=n_train,
                baseline_confidence=baseline_conf,
                is_event_period=bool(row.get("is_event_period", False)),
            ))

        return ReplayResult(
            asset_id=self.asset_id,
            replay_period=(replay_start, replay_end),
            lookback_days=self.lookback_days,
            decisions=decisions,
        )
