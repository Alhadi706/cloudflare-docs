"""
DSP Benchmark Runner — Step 1 of Scientific Validation
=======================================================
Runs MINERVA benchmark.py against synthetic-but-physics-consistent
time series built from the actual signal statistics in minerva_analyze output.

Signal stats (from runtime 2026-07-22, N=147 observations, asset PIPE-WTR-TEST-001):
  SOIL_MOISTURE  : mean=0.0868, std=0.0481
  SURFACE_TEMP   : mean=30.75,  std=7.28
  SAR_BACKSCATTER: mean=-10.49, std=1.19
  VEGETATION_INDEX: mean=0.050, std=0.039

Event injected: 90 days of simulated leak (water ingress → soil moisture spike).
Ground truth window: 2026-01-01 → 2026-03-31 (event period).
"""

import sys, json
from pathlib import Path
from datetime import date, timedelta
import numpy as np
import pandas as pd

# Make sure project root is on path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from minerva.validation.benchmark import (
    BenchmarkRunner,
    BenchmarkResult,
    GlobalThresholdDetector,
    ConditionalBaselineDetector,
    MultiSignalThresholdDetector,
    MINERVADetector,
)

# ── Signal parameters (from real runtime stats) ─────────────────────────────
SIGNALS = ["SOIL_MOISTURE", "SURFACE_TEMP", "SAR_BACKSCATTER", "VEGETATION_INDEX"]

SIGNAL_PARAMS = {
    "SOIL_MOISTURE":   {"mean": 0.0868, "std": 0.0481},
    "SURFACE_TEMP":    {"mean": 30.75,  "std": 7.28},
    "SAR_BACKSCATTER": {"mean": -10.49, "std": 1.19},
    "VEGETATION_INDEX":{"mean": 0.050,  "std": 0.039},
    "PRECIPITATION":   {"mean": 8.0,    "std": 12.0},
}

ASSET_ID   = "PIPE-WTR-TEST-001"
ASSET_TYPE = "WATER_PIPELINE"

# ── Dataset parameters ───────────────────────────────────────────────────────
TRAIN_START   = date(2023, 1, 1)
TRAIN_END     = date(2025, 12, 31)   # 3 years of "normal"
TEST_START    = date(2026, 1, 1)
TEST_END      = date(2026, 7, 22)
EVENT_START   = date(2026, 1, 15)    # leak starts
EVENT_END     = date(2026, 4, 15)    # leak detected/repaired
LEAK_STRENGTH = 3.5                  # sigma above normal for SOIL_MOISTURE


def make_context_key(row):
    """Assigns a context key based on season and temperature."""
    month = row["date"].month
    temp  = row["SURFACE_TEMP"]
    season = "HOT" if temp > 35 else ("WARM" if temp > 25 else "MILD")
    dry    = "DRY" if row["PRECIPITATION"] < 5 else "MOIST"
    return f"{season}_{dry}|NORMAL|NORMAL"


def generate_dataset(start: date, end: date, inject_event: bool = False) -> pd.DataFrame:
    """Generate a synthetic time-series dataset with known statistical properties."""
    rng  = np.random.default_rng(seed=42)
    rows = []
    d    = start
    while d <= end:
        row = {"date": d}
        is_event = inject_event and EVENT_START <= d <= EVENT_END

        for sig, p in SIGNAL_PARAMS.items():
            noise = rng.normal(0, p["std"])
            val   = p["mean"] + noise
            # Seasonal adjustment for SURFACE_TEMP
            if sig == "SURFACE_TEMP":
                month_offset = 8 * np.sin(2 * np.pi * (d.month - 1) / 12)
                val += month_offset
            # Event injection for SOIL_MOISTURE and VEGETATION_INDEX
            if is_event and sig == "SOIL_MOISTURE":
                val += LEAK_STRENGTH * p["std"]   # leak raises soil moisture
            if is_event and sig == "VEGETATION_INDEX":
                val += 2.0 * SIGNAL_PARAMS["VEGETATION_INDEX"]["std"]
            row[sig] = round(float(val), 4)

        row["is_event_period"] = is_event
        row["context_key"]     = make_context_key(row)
        rows.append(row)
        d += timedelta(days=5)   # 5-day cadence (Sentinel-2 revisit)

    return pd.DataFrame(rows)


def print_result(r: BenchmarkResult):
    print(f"\n  Method  : {r.method_name}")
    print(f"  TP={r.tp}  FP={r.fp}  TN={r.tn}  FN={r.fn}")
    print(f"  Precision : {r.precision:.4f}")
    print(f"  Recall    : {r.recall:.4f}")
    print(f"  F1 Score  : {r.f1:.4f}")
    print(f"  Accuracy  : {(r.tp+r.tn)/max(r.tp+r.fp+r.tn+r.fn,1):.4f}")
    print(f"  FPR       : {r.fpr:.4f}")
    print(f"  FNR       : {1-r.recall:.4f}")
    if r.days_to_detect:
        print(f"  Avg days to detect : {r.avg_days_to_detect:.1f}")
    else:
        print(f"  Avg days to detect : N/A (no detections)")


def main():
    print("=" * 65)
    print("DSP BENCHMARK — Scientific Accuracy Validation (Step 1)")
    print(f"Asset : {ASSET_ID} ({ASSET_TYPE})")
    print(f"Train : {TRAIN_START} → {TRAIN_END}  (3 years normal baseline)")
    print(f"Test  : {TEST_START} → {TEST_END}")
    print(f"Event : {EVENT_START} → {EVENT_END}  (water leak, +{LEAK_STRENGTH}σ)")
    print(f"Signal stats source: MINERVA runtime 2026-07-22, N=147 obs")
    print("=" * 65)

    print("\n[1/4] Generating datasets...")
    df_train = generate_dataset(TRAIN_START, TRAIN_END, inject_event=False)
    df_test  = generate_dataset(TEST_START,  TEST_END,  inject_event=True)
    n_event  = df_test["is_event_period"].sum()
    n_normal = (~df_test["is_event_period"]).sum()
    print(f"  Train rows : {len(df_train)}")
    print(f"  Test rows  : {len(df_test)} ({n_event} event, {n_normal} normal)")

    print("\n[2/4] Building precipitation lookup...")
    precip_lookup = {
        row["date"]: row["PRECIPITATION"]
        for _, row in df_train.iterrows()
    }
    precip_lookup.update({
        row["date"]: row["PRECIPITATION"]
        for _, row in df_test.iterrows()
    })

    print("\n[3/4] Running detectors...")
    detectors = [
        GlobalThresholdDetector(primary_signal="SOIL_MOISTURE"),
        ConditionalBaselineDetector(asset_type=ASSET_TYPE),
        MultiSignalThresholdDetector(min_anomalous_signals=2),
        MINERVADetector(asset_type=ASSET_TYPE, precipitation_lookup=precip_lookup),
    ]

    runner  = BenchmarkRunner()
    results = runner.run(
        detectors=detectors,
        df_train=df_train,
        df_test=df_test,
        asset_id=ASSET_ID,
        signals=SIGNALS,
        event_start=EVENT_START,
        event_end=EVENT_END,
    )

    print("\n[4/4] Results:")
    print("=" * 65)
    best_f1 = max(results, key=lambda r: r.f1)

    for r in results:
        marker = " ← BEST F1" if r.method_name == best_f1.method_name else ""
        print_result(r)
        print(f"  {'★ WINNER' if marker else ''}{marker}")

    # ── Summary table ────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("SUMMARY TABLE")
    print(f"{'Method':<35} {'Prec':>6} {'Rec':>6} {'F1':>6} {'Acc':>6} {'FPR':>6}")
    print("-" * 65)
    for r in results:
        acc = (r.tp + r.tn) / max(r.tp + r.fp + r.tn + r.fn, 1)
        print(f"{r.method_name:<35} {r.precision:>6.3f} {r.recall:>6.3f} {r.f1:>6.3f} {acc:>6.3f} {r.fpr:>6.3f}")

    # ── JSON output for report ────────────────────────────────────────────────
    output = {
        "run_date": str(date.today()),
        "asset_id": ASSET_ID,
        "asset_type": ASSET_TYPE,
        "dataset": {
            "train_rows": len(df_train),
            "test_rows": len(df_test),
            "event_rows": int(n_event),
            "normal_rows": int(n_normal),
            "event_start": str(EVENT_START),
            "event_end": str(EVENT_END),
            "signal_stats_source": "MINERVA runtime 2026-07-22, N=147"
        },
        "results": [
            {
                "method": r.method_name,
                "tp": r.tp, "fp": r.fp, "tn": r.tn, "fn": r.fn,
                "precision": round(r.precision, 4),
                "recall": round(r.recall, 4),
                "f1": round(r.f1, 4),
                "accuracy": round((r.tp+r.tn)/max(r.tp+r.fp+r.tn+r.fn,1), 4),
                "fpr": round(r.fpr, 4),
                "fnr": round(1-r.recall, 4),
                "avg_days_to_detect": round(r.avg_days_to_detect, 1),
            }
            for r in results
        ],
        "best_f1_method": best_f1.method_name,
    }

    out_path = PROJECT_ROOT / "docs" / "benchmark_results_2026-07-22.json"
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"\n✓ Results saved to: {out_path}")
    print("=" * 65)


if __name__ == "__main__":
    main()
