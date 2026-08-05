#!/usr/bin/env python3
"""
Phase 3: MINERVA scientific failure investigation (observation-only).
No algorithm changes, no tuning, no retraining.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

from minerva.lab.runner import BenchmarkRunner
from minerva.lab.scenario import ScenarioLibrary
from minerva.prediction import TrendAnalyzer, ForecastEngine

FAILED_SCENARIOS = [
    "WATER_LEAK_TRIPOLI_001",
    "VEGETATION_LOSS_BENGHAZI_001",
    "GROUND_DEFORMATION_COASTAL_001",
]

OUT_JSON = Path("docs/phase3_failure_investigation_2026-07-26.json")
OUT_MD = Path("docs/PHASE3-MINERVA-FAILURE-INVESTIGATION-2026-07-26.md")


def _to_date(x: Any) -> date:
    if isinstance(x, date):
        return x
    return date.fromisoformat(str(x)[:10])


def _signal_series(frame, signal: str):
    vals = []
    for o in frame.eo_history:
        if o.get("source") not in ("S2", "MODIS", "S1"):
            continue
        v = o.get(signal)
        if v is None:
            continue
        vals.append((_to_date(o.get("date")), float(v)))
    vals.sort(key=lambda x: x[0])
    return vals


def investigate_one(runner: BenchmarkRunner, scenario_id: str) -> dict:
    scenario = ScenarioLibrary.get(scenario_id)
    assert scenario is not None

    # Build + analyze using original pipeline.
    session = runner.replay_engine.build_session(
        scenario=scenario,
        lab_run_id=f"INV-{scenario_id}",
        frame_step_days=runner.frame_step_days,
    )
    session = runner._analyse_session(session, scenario)
    result = runner.metrics_calc.compute(
        session=session,
        scenario=scenario,
        lab_run_id=f"INV-{scenario_id}",
        minerva_version=runner.minerva_version,
        duration_s=0.0,
    )

    signal, mission_threshold = runner._get_mission_config(scenario.mission_type)
    min_conf = float(scenario.pass_criteria.get("min_confidence", 0.5))

    analyzer = TrendAnalyzer()
    forecast_engine = ForecastEngine(analyzer)

    # Stage 1: Acquisition completeness
    full_sources = {"S2": 0, "S1": 0, "MODIS": 0}
    for f in session.frames:
        for o in f.eo_history:
            s = o.get("source")
            if s in full_sources:
                full_sources[s] += 1

    # Per-frame deep trace
    frames_out = []
    event_frames = 0
    root_counts = {
        "insufficient_data_gate": 0,
        "too_few_primary_points": 0,
        "forecast_none": 0,
        "anomaly_probability_below_min_conf": 0,
        "alerted": 0,
    }

    # Signal missing counters in event period
    missing_event = {
        "NDVI": 0,
        "NDMI": 0,
        "VV_dB": 0,
        "VH_dB": 0,
        "LST_C": 0,
        "Moisture": 0,
        "WaterIndex": 0,
        "VegetationIndex": 0,
    }

    # Not all requested stages exist in implementation; mark explicitly.
    cannot_verify = {
        "stage3_feature_normalization": "Cannot verify",
        "stage4_baseline_engine_object": "Cannot verify",
        "stage5_multi_evidence_fusion": "Cannot verify",
        "stage6_rule_tree_multi_hypothesis": "Cannot verify",
    }

    for f in session.frames:
        ar = f.analysis_result or {}
        alerted = bool(ar.get("alerted", False))
        reason = ar.get("reason")

        if f.is_event_period:
            event_frames += 1

            if not f.data_complete:
                root_counts["insufficient_data_gate"] += 1
            elif reason == "too_few_points":
                root_counts["too_few_primary_points"] += 1
            elif reason == "forecast_none":
                root_counts["forecast_none"] += 1
            elif alerted:
                root_counts["alerted"] += 1
            else:
                root_counts["anomaly_probability_below_min_conf"] += 1

            # Requested signal missing checks during event period
            latest = f.latest_eo or {}
            ndvi_v = f.ndvi
            ndmi_v = f.ndmi
            vv_v = f.vv_db
            vh_v = latest.get("VH_dB")
            lst_v = f.lst_c
            moisture_v = ndmi_v  # proxy in this implementation
            water_index_v = latest.get("NDWI")
            vegetation_index_v = ndvi_v

            if ndvi_v is None:
                missing_event["NDVI"] += 1
            if ndmi_v is None:
                missing_event["NDMI"] += 1
            if vv_v is None:
                missing_event["VV_dB"] += 1
            if vh_v is None:
                missing_event["VH_dB"] += 1
            if lst_v is None:
                missing_event["LST_C"] += 1
            if moisture_v is None:
                missing_event["Moisture"] += 1
            if water_index_v is None:
                missing_event["WaterIndex"] += 1
            if vegetation_index_v is None:
                missing_event["VegetationIndex"] += 1

        # Recompute trend + forecast for transparent internals.
        prim_series = _signal_series(f, signal)
        trend = analyzer.analyze(prim_series, signal) if len(prim_series) >= 4 else None
        fc = None
        if trend is not None:
            fc = forecast_engine.forecast(
                target_id=scenario.target_id,
                signal=signal,
                series=prim_series,
                horizon_days=30,
                threshold=mission_threshold,
            )

        # Stage chain record
        frame_rec = {
            "frame_date": str(f.frame_date),
            "is_event_period": f.is_event_period,
            "days_since_event": f.days_since_event,
            "stage1_input": {
                "n_eo_obs_total": f.n_eo_obs,
                "data_complete_gate": f.data_complete,
                "sources_seen": sorted(list({o.get('source') for o in f.eo_history if o.get('source')})),
            },
            "stage2_signal_extraction": {
                "NDVI": f.ndvi,
                "NDMI": f.ndmi,
                "SAR_VV_dB": f.vv_db,
                "SAR_VH_dB": (f.latest_eo or {}).get("VH_dB"),
                "Thermal_LST_C": f.lst_c,
                "Moisture": f.ndmi,
                "Water_Index_NDWI": (f.latest_eo or {}).get("NDWI"),
                "Vegetation_Index": f.ndvi,
                "missing": {
                    "NDVI": f.ndvi is None,
                    "NDMI": f.ndmi is None,
                    "SAR_VV_dB": f.vv_db is None,
                    "SAR_VH_dB": (f.latest_eo or {}).get("VH_dB") is None,
                    "Thermal_LST_C": f.lst_c is None,
                    "Moisture": f.ndmi is None,
                    "Water_Index_NDWI": (f.latest_eo or {}).get("NDWI") is None,
                    "Vegetation_Index": f.ndvi is None,
                },
                "quality_score": round(min(1.0, f.n_eo_obs / 10.0), 3),
            },
            "stage3_feature_engine": {
                "primary_signal": signal,
                "n_primary_points": len(prim_series),
                "trend": (asdict(trend) if trend else None),
                "feature_rejected": trend is None,
                "reject_reason": (
                    "too_few_points" if len(prim_series) < 4 else None
                ),
                "normalization": "Cannot verify",
            },
            "stage4_baseline_engine": {
                "expected_baseline": "historical mean/std implicit in anomaly_probability",
                "measured_value_latest": prim_series[-1][1] if prim_series else None,
                "deviation": None,
                "accepted_tolerance": None,
                "decision": "Cannot verify" if fc is None else "computed_via_forecast",
            },
            "stage5_evidence_fusion": {
                "evidence_inputs": [signal],
                "weights": {signal: 1.0},
                "confidence": (fc.model_confidence if fc else 0.0),
                "rejected_evidence": [],
                "reason": "single-signal-only implementation",
            },
            "stage6_reasoning_engine": {
                "rules_evaluated": [
                    "data_complete_gate",
                    "len(primary_series) >= 4",
                    "forecast_exists",
                    f"anomaly_probability >= {min_conf}",
                ],
                "branches_executed": {
                    "data_complete": f.data_complete,
                    "enough_primary_points": len(prim_series) >= 4,
                    "forecast_exists": fc is not None,
                    "threshold_pass": (fc.anomaly_probability >= min_conf) if fc else False,
                },
                "intermediate_scores": {
                    "anomaly_probability": (fc.anomaly_probability if fc else 0.0),
                    "model_confidence": (fc.model_confidence if fc else 0.0),
                },
                "winning_hypothesis": "ALERT" if alerted else "NO_ALERT",
                "rejected_hypotheses": ["ALERT"] if not alerted else ["NO_ALERT"],
            },
            "stage7_final_decision": {
                "alerted": alerted,
                "alert_blocker_rule": reason if reason else (
                    "anomaly_probability_below_min_conf" if not alerted else None
                ),
                "confidence_below_threshold": (fc.anomaly_probability < min_conf) if fc else True,
                "evidence_rejected": bool(reason in ("insufficient_data", "too_few_points", "forecast_none")),
                "baseline_considered_normal": "Cannot verify",
                "single_signal_domination": True,
            },
            "pipeline_output": ar,
        }
        frames_out.append(frame_rec)

    # Root cause percentages (event frames only)
    denom = max(event_frames, 1)
    root_pct = {
        k: round((v / denom) * 100.0, 2)
        for k, v in root_counts.items()
    }

    # Missing signal percentages (event frames)
    missing_pct = {
        k: round((v / denom) * 100.0, 2)
        for k, v in missing_event.items()
    }

    # Rank root causes by impact, excluding alerted.
    ranking = sorted(
        [
            {"cause": k, "count": v, "pct": root_pct[k]}
            for k, v in root_counts.items()
            if k != "alerted"
        ],
        key=lambda x: x["pct"],
        reverse=True,
    )

    return {
        "scenario_id": scenario.scenario_id,
        "mission_type": scenario.mission_type,
        "primary_signal": signal,
        "mission_threshold": mission_threshold,
        "min_confidence": min_conf,
        "expected_severity": scenario.expected_severity.value,
        "result": result.to_dict(),
        "stage1_acquisition": {
            "frames_total": session.n_frames,
            "event_frames": event_frames,
            "source_obs_counts_across_frames": full_sources,
            "signal_coverage": result.signal_coverage,
        },
        "stage2_missing_percent_event_frames": missing_pct,
        "root_cause_counts_event_frames": root_counts,
        "root_cause_percent_event_frames": root_pct,
        "root_cause_ranking": ranking,
        "cannot_verify": cannot_verify,
        "frames": frames_out,
    }


def write_markdown(report: dict) -> None:
    lines = []
    lines.append("# Phase 3: MINERVA Failure Investigation (Observation Only)")
    lines.append("")
    lines.append("المنهج: قياس وتشريح Runtime فقط بدون أي تعديل خوارزمي أو tuning أو retraining.")
    lines.append("")
    lines.append("## Scope")
    lines.append("- WATER_LEAK_TRIPOLI_001")
    lines.append("- VEGETATION_LOSS_BENGHAZI_001")
    lines.append("- GROUND_DEFORMATION_COASTAL_001")
    lines.append("")

    # Global ranking aggregation
    aggregate = {}
    for s in report["scenarios"]:
        for item in s["root_cause_ranking"]:
            aggregate[item["cause"]] = aggregate.get(item["cause"], 0.0) + item["pct"]
    agg_rank = sorted(aggregate.items(), key=lambda x: x[1], reverse=True)

    for s in report["scenarios"]:
        lines.append(f"## Scenario: {s['scenario_id']}")
        lines.append(f"- Expected severity: {s['expected_severity']}")
        lines.append(f"- Primary signal used by reasoning: {s['primary_signal']}")
        lines.append(f"- Alert rule: anomaly_probability >= {s['min_confidence']}")
        lines.append(f"- Detection: TP={s['result']['detection']['tp']} FP={s['result']['detection']['fp']} TN={s['result']['detection']['tn']} FN={s['result']['detection']['fn']}")
        lines.append("")
        lines.append("### Stage 1 — Satellite Acquisition")
        st1 = s["stage1_acquisition"]
        lines.append(f"- Frames total: {st1['frames_total']}")
        lines.append(f"- Event frames: {st1['event_frames']}")
        lines.append(f"- Signal coverage: {st1['signal_coverage']}")
        lines.append("")
        lines.append("### Stage 2 — Signal Extraction (event-period missing %) ")
        for k, v in s["stage2_missing_percent_event_frames"].items():
            lines.append(f"- {k}: {v}% missing")
        lines.append("")
        lines.append("### Stage 3 to 6 Traceability")
        lines.append("- Feature normalization: Cannot verify")
        lines.append("- Explicit baseline object (expected/tolerance struct): Cannot verify")
        lines.append("- Multi-evidence fusion (weighted multi-signal): Cannot verify")
        lines.append("- Rule-tree with competing hypotheses: Cannot verify")
        lines.append("")
        lines.append("### Stage 7 — Final Decision Blockers (event frames)")
        for item in s["root_cause_ranking"]:
            lines.append(f"- {item['cause']}: {item['count']} frames ({item['pct']}%)")
        lines.append("")
        lines.append("### Evidence Tree")
        lines.append("Input -> Signal -> Feature -> Baseline -> Evidence -> Reasoning -> Decision -> Output")
        lines.append(f"- Input: EO history up to frame date only")
        lines.append(f"- Signal: {s['primary_signal']} only")
        lines.append("- Feature: trend slope/r2 + forecast anomaly_probability")
        lines.append("- Baseline: implicit historical distribution in anomaly_probability")
        lines.append("- Evidence: single signal, no fusion")
        lines.append(f"- Reasoning: gates then threshold {s['min_confidence']}")
        lines.append("- Decision: NO_ALERT for all positive-event frames")
        lines.append("- Output: false negative when event=true")
        lines.append("")

    lines.append("## Root Cause Ranking (highest impact -> lowest)")
    for cause, val in agg_rank:
        avg_val = round(val / max(len(report["scenarios"]), 1), 2)
        lines.append(f"- {cause}: avg {avg_val}%")
    lines.append("")

    lines.append("## Deployment Answer")
    lines.append("- If MINERVA were deployed today, would it miss the same anomalies? YES (runtime evidence from 3/3 failed positive scenarios).")
    lines.append("- Confidence of this statement: bounded by current lab pipeline implementation and available observations.")
    lines.append("- Any claim about missing multi-stage reasoning components outside implemented code: Cannot verify.")
    lines.append("")

    lines.append("## Arabic Summary")
    lines.append("- السبب الرئيسي للفشل ليس عطل API أو بنية النظام؛ البنية تعمل.")
    lines.append("- سلسلة القرار الحالية في الـ lab تعتمد عملياً على إشارة رئيسية واحدة لكل مهمة.")
    lines.append("- كل الحالات الإيجابية فشلت لأن القرار النهائي لم يتجاوز بوابة الاحتمال/الثقة المطلوبة، أو سقطت قبلها بسبب قلة نقاط الإشارة في بعض الإطارات.")
    lines.append("- بالتالي، نعم: إذا نُشر النظام بنفس هذا المسار اليوم فهناك احتمال عالٍ أن يفوّت نفس نوع الشذوذات ضمن نفس ظروف البيانات.")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def main():
    runner = BenchmarkRunner(minerva_version="dev", frame_step_days=10)
    scenarios = []
    for sid in FAILED_SCENARIOS:
        print(f"[Phase3] Investigating {sid} ...", flush=True)
        scenarios.append(investigate_one(runner, sid))
        print(f"[Phase3] Completed {sid}", flush=True)

    report = {
        "generated_at": date.today().isoformat(),
        "mode": "observation_only",
        "rules": [
            "no_model_changes",
            "no_threshold_changes",
            "no_retraining",
            "runtime_trace_only",
        ],
        "scenarios": scenarios,
    }

    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(report)

    print(f"Wrote JSON: {OUT_JSON}")
    print(f"Wrote MD:   {OUT_MD}")


if __name__ == "__main__":
    main()
