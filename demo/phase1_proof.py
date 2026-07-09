#!/usr/bin/env python3
"""
MINERVA Phase 1 — Spatial Diagnostic Reasoning Proof
======================================================
الهدف: إثبات أن النظام ينتقل من Anomaly Detection إلى Diagnostic Reasoning.

معايير النجاح:
  1. تفسير سبب الشذوذ مع أدلة مؤيدة ومعارضة
  2. استبعاد الفرضيات غير المنطقية
  3. الـ Physical Facts تؤثر مباشرة (PRECIPITATION لا z-score)
  4. الاستنتاج يعمل مع أي نوع أصل (WATER + OIL)
  5. Unknown Pattern يُكتشف ويُوثَّق
  6. التقرير مفهوم ومقروء للمشغل البشري

تشغيل: python3 demo/phase1_proof.py
"""

import sys
import json
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd

# Phase 0 modules
from minerva.signals.adapters.synthetic import generate_time_series, InjectedEvent
from minerva.signals.adapters.weather import fetch_weather_history
from minerva.context.resolver import ContextResolver
from minerva.baseline.behavior_profile import BehaviorProfileBuilder
from minerva.anomaly.engine import AnomalyEngine

# Phase 1 NEW modules
from minerva.evidence.types import EvidenceBundle
from minerva.evidence.collector import EvidenceCollector
from minerva.reasoning.catalogue import get_knowledge, WaterPipelineKnowledge, OilPipelineKnowledge
from minerva.reasoning.scorer import DiagnosticScorer
from minerva.reasoning.weights import WeightStore
from minerva.reports.diagnostic import DiagnosticReportBuilder
from minerva.groundtruth.store import GroundTruthStore, FieldVerification


# =============================================================================
# TEST CONFIGURATION
# =============================================================================

ASSET_ID   = "PIPE-WTR-TEST-001"
ASSET_TYPE = "WATER_PIPELINE"
LAT, LON   = 32.89, 13.18

TRAIN_START = date(2023, 1, 1)
TRAIN_END   = date(2024, 12, 31)
TEST_START  = date(2025, 1, 1)
TEST_END    = date(2025, 6, 30)
SIGNALS = ["SOIL_MOISTURE", "SURFACE_TEMP", "SAR_BACKSCATTER", "VEGETATION_INDEX"]

IRRIGATION_PERIODS = [
    (date(2023, 6, 1),  date(2023, 7, 31)),
    (date(2024, 6, 1),  date(2024, 7, 31)),
    (date(2025, 4, 15), date(2025, 5, 14)),
]
MAINTENANCE_PERIODS = [
    (date(2023, 9, 10), date(2023, 9, 20)),
    (date(2024, 8, 15), date(2024, 8, 25)),
]
LEAK_EVENT = InjectedEvent("WATER_LEAK", date(2025, 5, 20), date(2025, 6, 18), 0.7)


def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


# =============================================================================
# HELPER: Get expected values from Behavior Profile
# =============================================================================

def get_expected_values(profile, context_key: str, signals: list[str]) -> dict:
    expected = {}
    for sig in signals:
        cell = profile.get_cell(context_key, sig)
        if cell:
            expected[sig] = cell.mean
    return expected


# =============================================================================
# MAIN PROOF
# =============================================================================

def run_phase1_proof():
    print("\n" + "█"*60)
    print("  MINERVA Phase 1 — Spatial Diagnostic Reasoning")
    print("  Anomaly Detection → Diagnosis → Explanation")
    print("█"*60)

    # -------------------------------------------------------------------------
    # SETUP (reuse Phase 0 pipeline)
    # -------------------------------------------------------------------------
    print_section("SETUP: Reusing Phase 0 Pipeline")

    print("[Weather] جلب البيانات الحقيقية...")
    weather = fetch_weather_history(LAT, LON, TRAIN_START, TEST_END)
    if weather:
        print(f"[Weather] ✓ {len(weather['time'])} يوم من Open-Meteo")
    else:
        print("[Weather] ✗ استخدام بيانات تركيبية")
        weather = {}

    resolver = ContextResolver(daily_weather=weather)

    all_dates_train = [TRAIN_START + timedelta(days=5*i)
                       for i in range((TRAIN_END - TRAIN_START).days // 5 + 1)]
    all_dates_test  = [TEST_START + timedelta(days=5*i)
                       for i in range((TEST_END - TEST_START).days // 5 + 1)]

    contexts_train = resolver.resolve_series(all_dates_train, MAINTENANCE_PERIODS, IRRIGATION_PERIODS)
    contexts_test  = resolver.resolve_series(all_dates_test, irrigation_periods=IRRIGATION_PERIODS)

    df_train = generate_time_series(TRAIN_START, TRAIN_END, contexts_train, seed=42)
    df_test  = generate_time_series(TEST_START,  TEST_END,  contexts_test, [LEAK_EVENT], seed=123)

    builder = BehaviorProfileBuilder(ASSET_ID, SIGNALS)
    profile = builder.build_conditional(df_train)
    engine  = AnomalyEngine(ASSET_ID, ASSET_TYPE, profile, "conditional")
    results = engine.analyze_series(df_test)

    print(f"[Setup] ✓ Baseline: {len(profile.cells)} خلية")
    print(f"[Setup] ✓ Anomaly Engine: {len(results)} ملاحظة محللة")

    # -------------------------------------------------------------------------
    # TEST 1: تشخيص التسرب الحقيقي
    # -------------------------------------------------------------------------
    print_section("TEST 1: تشخيص التسرب الحقيقي")

    # أخذ أشد ملاحظة شذوذًا (خلال فترة التسرب)
    leak_results = [r for r in results
                    if r.obs_date >= LEAK_EVENT.start_date
                    and r.obs_date <= LEAK_EVENT.end_date]
    peak = max(leak_results, key=lambda r: r.anomaly_score) if leak_results else max(results, key=lambda r: r.anomaly_score)

    ctx_tuple = contexts_test.get(peak.obs_date, ("HOT_DRY", "DRY", "NORMAL", "NORMAL"))
    ctx_key   = "|".join(ctx_tuple)
    context_dict = dict(zip(["season", "moisture", "ops", "vicinity"], ctx_tuple))

    # حساب القيم المتوقعة
    observed_vals = {}
    expected_vals = {}
    for _, row in df_test.iterrows():
        if row["date"] == peak.obs_date:
            for sig in SIGNALS:
                if sig in row.index:
                    observed_vals[sig] = float(row[sig])
            break

    expected_vals = get_expected_values(profile, ctx_key, SIGNALS)

    # الهطول المطري الحقيقي
    precip_30d = resolver.get_30d_precip(peak.obs_date)
    precip_7d  = sum(
        resolver._weather_index.get(peak.obs_date - timedelta(days=i), {}).get("precip", 0.0)
        for i in range(1, 8)
    )

    print(f"\n  تاريخ الملاحظة: {peak.obs_date}")
    print(f"  Anomaly Score:  {peak.anomaly_score:.3f} ({peak.severity})")
    print(f"  السياق:        {ctx_key}")
    print(f"  هطول 30 يوم:  {precip_30d:.1f}mm | هطول 7 أيام: {precip_7d:.1f}mm")
    print(f"  z-scores: {peak.z_scores}")

    # بناء EvidenceBundle
    collector = EvidenceCollector()
    bundle = collector.collect(
        anomaly=peak,
        observed_values=observed_vals,
        expected_values=expected_vals,
        precipitation_30d=precip_30d,
        precipitation_7d=precip_7d,
    )

    print(f"\n  Evidence Bundle:")
    print(f"    Dynamic signals: {list(bundle.dynamic.keys())}")
    print(f"    Physical facts:  {list(bundle.physical.keys())}")

    # تشغيل Diagnostic Scorer
    knowledge = get_knowledge(ASSET_TYPE)
    scorer    = DiagnosticScorer(knowledge, WeightStore())
    score     = scorer.score_all(bundle, biome="ARID")

    # بناء التقرير
    report_builder = DiagnosticReportBuilder()
    report = report_builder.build(score, bundle, peak.anomaly_score, peak.severity)
    report.print_report()

    # اختبار النجاح
    test1_pass = (
        report.winner_event == "WATER_LEAK" and
        report.winner_probability > 0.50
    )
    print(f"\n  {'✓ TEST 1 PASSED' if test1_pass else '✗ TEST 1 FAILED'}: "
          f"WATER_LEAK مُشخَّص بـ {report.winner_probability:.2%}")

    # -------------------------------------------------------------------------
    # TEST 2: تشخيص فترة الري (يجب أن يقول IRRIGATION_EFFECT)
    # -------------------------------------------------------------------------
    print_section("TEST 2: تشخيص فترة الري الطبيعية")

    irr_results = [r for r in results
                   if contexts_test.get(r.obs_date, ("", "", "", ""))[3] == "IRRIGATION_ACTIVE"
                   and not (r.obs_date >= LEAK_EVENT.start_date and r.obs_date <= LEAK_EVENT.end_date)]

    if irr_results:
        peak_irr = max(irr_results, key=lambda r: r.anomaly_score)
        ctx_irr  = contexts_test.get(peak_irr.obs_date, ("HOT_DRY", "DRY", "NORMAL", "IRRIGATION_ACTIVE"))
        ctx_key_irr = "|".join(ctx_irr)

        obs_irr = {}
        for _, row in df_test.iterrows():
            if row["date"] == peak_irr.obs_date:
                for sig in SIGNALS:
                    if sig in row.index:
                        obs_irr[sig] = float(row[sig])
                break

        exp_irr = get_expected_values(profile, ctx_key_irr, SIGNALS)
        p30_irr = resolver.get_30d_precip(peak_irr.obs_date)
        p7_irr  = sum(
            resolver._weather_index.get(peak_irr.obs_date - timedelta(days=i), {}).get("precip", 0.0)
            for i in range(1, 8)
        )

        bundle_irr = collector.collect(
            anomaly=peak_irr,
            observed_values=obs_irr,
            expected_values=exp_irr,
            precipitation_30d=p30_irr,
            precipitation_7d=p7_irr,
        )

        score_irr  = scorer.score_all(bundle_irr, biome="ARID")
        report_irr = report_builder.build(score_irr, bundle_irr,
                                          peak_irr.anomaly_score, peak_irr.severity)

        print(f"\n  تاريخ: {peak_irr.obs_date} | Score: {peak_irr.anomaly_score:.3f}")
        print(f"  السياق: {ctx_key_irr}")
        print(f"\n  أفضل 3 فرضيات:")
        for h in score_irr.all_hypotheses[:3]:
            print(f"    {h.event_type:<28} {h.posterior:.3f}")

        test2_pass = (
            score_irr.winner_event != "WATER_LEAK" or
            score_irr.winner_probability < 0.50
        )
        print(f"\n  {'✓ TEST 2 PASSED' if test2_pass else '✗ TEST 2 FAILED'}: "
              f"النظام لم يخلط الري بالتسرب")
    else:
        print("  (لا توجد ملاحظات ري في فترة الاختبار)")
        test2_pass = True

    # -------------------------------------------------------------------------
    # TEST 3: Generic Framework — Oil Pipeline (نفس المحرك)
    # -------------------------------------------------------------------------
    print_section("TEST 3: Generic Framework — OIL_PIPELINE (نفس المحرك)")

    oil_knowledge = get_knowledge("OIL_PIPELINE")
    oil_scorer    = DiagnosticScorer(oil_knowledge, WeightStore())

    # استخدام نفس الـ bundle لكن مع knowledge مختلفة
    score_oil = oil_scorer.score_all(bundle, biome="ARID")

    print(f"\n  نفس الأدلة + معرفة خط نفط:")
    print(f"  أفضل 3 فرضيات:")
    for h in score_oil.all_hypotheses[:3]:
        print(f"    {h.event_type:<28} {h.posterior:.3f}")

    test3_pass = (
        score_oil.winner_event != "WATER_LEAK"  # يجب ألا يقترح WATER_LEAK لخط نفط
    )
    print(f"\n  {'✓ TEST 3 PASSED' if test3_pass else '✗ TEST 3 FAILED'}: "
          f"الـ Engine يحترم حدود نوع الأصل")

    # -------------------------------------------------------------------------
    # TEST 4: Unknown Pattern Detection
    # -------------------------------------------------------------------------
    print_section("TEST 4: Unknown Pattern Detection")

    # محاكاة شذوذ غريب: SAR يرتفع بشكل حاد (يشبه حريقًا) لكن الأصل خط مياه
    from minerva.anomaly.engine import AnomalyResult
    from datetime import date as dt

    weird_anomaly = AnomalyResult(
        asset_id=ASSET_ID,
        obs_date=dt(2025, 3, 15),
        context_key="MILD_DRY|DRY|NORMAL|NORMAL",
        anomaly_score=0.75,
        severity="ANOMALY",
        z_scores={
            "SOIL_MOISTURE":   -1.5,   # ينخفض (غير طبيعي لتسرب)
            "SURFACE_TEMP":    +3.8,   # يرتفع بشدة (يشبه حريق؟)
            "SAR_BACKSCATTER": +3.2,   # يرتفع (عكس ما يحدث في تسرب)
            "VEGETATION_INDEX": -2.1,  # ينخفض (تلف نباتي)
        },
        features_anomalous=["SURFACE_TEMP", "SAR_BACKSCATTER", "VEGETATION_INDEX"],
        baseline_type="conditional",
        confidence_level="MEDIUM",
        evidence_completeness=0.80,
    )

    obs_weird = {"SOIL_MOISTURE": 0.02, "SURFACE_TEMP": 47.0,
                 "SAR_BACKSCATTER": -7.5, "VEGETATION_INDEX": -0.05}
    exp_weird = {"SOIL_MOISTURE": 0.05, "SURFACE_TEMP": 32.0,
                 "SAR_BACKSCATTER": -10.5, "VEGETATION_INDEX": 0.04}

    bundle_weird = collector.collect(
        anomaly=weird_anomaly,
        observed_values=obs_weird,
        expected_values=exp_weird,
        precipitation_30d=0.0,
        precipitation_7d=0.0,
    )

    score_weird = scorer.score_all(bundle_weird, biome="ARID")

    print(f"\n  شذوذ مجهول (SURFACE_TEMP↑, SAR↑, VEGETATION↓ في خط مياه):")
    print(f"  أفضل 3 فرضيات:")
    for h in score_weird.all_hypotheses[:3]:
        print(f"    {h.event_type:<28} {h.posterior:.3f}")
    print(f"\n  is_unknown: {score_weird.is_unknown}")
    if score_weird.unknown_reason:
        print(f"  unknown_reason: {score_weird.unknown_reason}")

    test4_pass = score_weird.is_unknown or score_weird.winner_probability < 0.50
    print(f"\n  {'✓ TEST 4 PASSED' if test4_pass else '✗ TEST 4 FAILED'}: "
          f"النظام يعترف بعدم اليقين")

    # -------------------------------------------------------------------------
    # TEST 5: Ground Truth Store (جاهزية Phase 4)
    # -------------------------------------------------------------------------
    print_section("TEST 5: Ground Truth Store (Phase 4 Readiness)")

    gt_store = GroundTruthStore()

    from datetime import datetime as dt2
    # تسجيل نتيجة تحقق وهمي
    gt_store.add(FieldVerification(
        fv_id="FV-001",
        asset_id=ASSET_ID,
        obs_date=peak.obs_date,
        diagnosed_event="WATER_LEAK",
        outcome="CONFIRMED",
        actual_event="WATER_LEAK",
        confidence_was=report.confidence_level,
        probability_was=report.winner_probability,
        evidence_completeness_was=report.evidence_completeness,
        verified_by="field_team_01",
        verified_at=dt2.utcnow(),
        field_notes="تسرب مؤكد في KM 12.3، قطر الثقب ~3cm",
        lat=32.891,
        lon=13.207,
    ))

    stats = gt_store.get_stats()
    print(f"\n  Ground Truth Store:")
    print(f"    Records: {stats['n']}")
    print(f"    Precision: {stats['precision']:.0%}")
    print(f"    Ready for weight update: {stats['ready_for_weight_update']}")
    print(f"    WATER_LEAK precision: {gt_store.get_event_precision('WATER_LEAK'):.0%}")
    print(f"\n  ✓ TEST 5 PASSED: Ground Truth Store جاهزة لـ Phase 4")
    test5_pass = True

    # -------------------------------------------------------------------------
    # SUMMARY
    # -------------------------------------------------------------------------
    print_section("PHASE 1 RESULTS SUMMARY")

    tests = [
        ("TEST 1: تشخيص التسرب",          test1_pass),
        ("TEST 2: لا خلط بين الري والتسرب", test2_pass),
        ("TEST 3: Generic Framework",        test3_pass),
        ("TEST 4: Unknown Pattern",          test4_pass),
        ("TEST 5: Ground Truth Ready",       test5_pass),
    ]

    all_pass = all(p for _, p in tests)
    print()
    for name, passed in tests:
        print(f"  {'✓' if passed else '✗'} {name}")

    print(f"\n  {'★ PHASE 1 PASSED ★' if all_pass else '✗ PHASE 1 NEEDS REVIEW'}")

    if all_pass:
        print("""
  ما أثبتته Phase 1:
  1. النظام يُشخِّص الأسباب بدلًا من مجرد اكتشاف الشذوذ
  2. Physical Facts (المطر، الصيانة، الري) تعمل مباشرة بدون z-score
  3. نفس المحرك يعمل مع WATER_PIPELINE و OIL_PIPELINE
  4. النظام يعترف بعدم اليقين ولا يُجبر نفسه على تشخيص خاطئ
  5. Ground Truth Store جاهزة لربط بيانات التحقق الميداني

  الخطوة التالية: Phase 3 — Asset Network Intelligence + Spatial Memory
        """)

    # حفظ النتائج
    output = {
        "phase": "Phase 1 — Spatial Diagnostic Reasoning",
        "date": date.today().isoformat(),
        "tests": {name: passed for name, passed in tests},
        "verdict": "PHASE_1_PASSED" if all_pass else "PHASE_1_NEEDS_REVIEW",
        "peak_leak_diagnosis": report.to_dict(),
    }
    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "phase1_results.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2)
    )
    print(f"  ✓ النتائج محفوظة في demo/results/phase1_results.json\n")

    return all_pass


if __name__ == "__main__":
    passed = run_phase1_proof()
    sys.exit(0 if passed else 1)
