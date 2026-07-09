#!/usr/bin/env python3
"""
MINERVA Phase 2 — Knowledge & Causal Reasoning Proof
=====================================================
يثبت أن MINERVA تحولت من محرك قواعد إلى نظام معرفة حي.

معايير النجاح:
  T1. الـ KG يُعيد علاقات صحيحة ومنطقية
  T2. التحقق الميداني يُغيِّر أوزان العلاقات (Living Graph)
  T3. اكتشاف علاقات جديدة بعد تكرار النمط
  T4. Root Cause Analysis يُعطي تفسيرات منطقية
  T5. Spatial Memory تتذكر وتؤثر على التشخيص
  T6. Asset Network يكتشف Cluster Events
  T7. Prediction Groundwork موجود

تشغيل: python3 demo/phase2_proof.py
"""

import sys
import json
from datetime import date, timedelta, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from minerva.knowledge.graph import LivingKnowledgeGraph
from minerva.knowledge.causal import RootCauseEngine
from minerva.knowledge.spatial_memory import SpatialMemory, encode_geohash
from minerva.knowledge.network import AssetNetwork


def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def run_phase2_proof():
    print("\n" + "█"*60)
    print("  MINERVA Phase 2 — Knowledge & Causal Reasoning")
    print("  Rule Engine → Knowledge-Driven Intelligence")
    print("█"*60)

    results = {}

    # =========================================================================
    # T1: Knowledge Graph — صحة العلاقات الأولية
    # =========================================================================
    print_section("T1: Living Knowledge Graph — Initial Relationships")

    kg = LivingKnowledgeGraph()
    stats = kg.get_knowledge_stats()

    print(f"\n  الـ Knowledge Graph يحتوي على:")
    for node_type, count in stats["nodes_by_type"].items():
        print(f"    {node_type:<20} {count} عقدة")
    print(f"    {'TOTAL EDGES':<20} {stats['total_edges']} علاقة")

    # ما الإشارات التي تدعم WATER_LEAK؟
    supporters = kg.get_event_supporters("WATER_LEAK")
    print(f"\n  إشارات تدعم WATER_LEAK (مرتبة بالقوة):")
    for sig, w in supporters:
        bar = "█" * int(w * 20)
        print(f"    {sig:<25} {w:.3f} {bar}")

    # ما يرفضه
    refuters = kg.get_event_refuters("WATER_LEAK")
    print(f"\n  إشارات تنفي WATER_LEAK:")
    for sig, w in refuters:
        print(f"    {sig:<25} {w:.3f}")

    # التسلسل السببي
    chain = kg.get_causal_chain("WATER_LEAK")
    print(f"\n  التسلسل السببي لـ WATER_LEAK:")
    for step in chain:
        print(f"    {step['signal']:<25} {step['direction']} (بعد {step['lag_days'][0]}-{step['lag_days'][1]} يوم)")

    # مسار الاستدلال
    path = kg.find_reasoning_path("SOIL_MOISTURE", "RC_PIPE_AGING")
    if path:
        print(f"\n  مسار الاستدلال: SOIL_MOISTURE → ... → RC_PIPE_AGING")
        print(f"    {' → '.join(path[0])}")

    t1_pass = (
        len(supporters) >= 3 and
        len(refuters) >= 1 and
        len(chain) >= 3
    )
    results["T1"] = t1_pass
    print(f"\n  {'✓ T1 PASSED' if t1_pass else '✗ T1 FAILED'}")

    # =========================================================================
    # T2: Living Graph — التحديث من التحقق الميداني
    # =========================================================================
    print_section("T2: Living Graph — Field Verification Changes Weights")

    # الوزن قبل التحديث
    before = {sig: w for sig, w in kg.get_event_supporters("WATER_LEAK")}
    print(f"\n  الأوزان قبل التحقق الميداني:")
    for sig, w in list(before.items())[:3]:
        print(f"    {sig:<25} {w:.4f}")

    # محاكاة 5 تحققات ميدانية تؤكد WATER_LEAK مع SOIL_MOISTURE كأقوى دليل
    for i in range(5):
        kg.reinforce("SOIL_MOISTURE", "WATER_LEAK",
                     f"FV-{i+1:03d}: تأكيد تسرب في KM {10+i:.1f}",
                     edge_type="SUPPORTS")

    # الوزن بعد التحديث
    after = {sig: w for sig, w in kg.get_event_supporters("WATER_LEAK")}
    print(f"\n  الأوزان بعد 5 تحققات ميدانية:")
    for sig, w in list(after.items())[:3]:
        delta = w - before.get(sig, w)
        arrow = f"(+{delta:.4f})" if delta > 0 else f"({delta:.4f})"
        print(f"    {sig:<25} {w:.4f} {arrow}")

    # اختبار الضعف (FP)
    before_refute = kg.get_edge_data("PRECIPITATION", "WATER_LEAK", "REFUTES")
    if before_refute:
        w_before = before_refute[0].weight
    else:
        w_before = 0.0

    # محاكاة 3 FP (الطقس كان سببًا لا التسرب)
    for i in range(3):
        kg.weaken("PRECIPITATION", "WATER_LEAK",
                  f"FP-{i+1:03d}: كانت الرطوبة بسبب مطر غير مسجل",
                  edge_type="REFUTES")

    soil_edge_data = kg.get_edge_data("SOIL_MOISTURE", "WATER_LEAK", "SUPPORTS")
    precip_edge_data = kg.get_edge_data("PRECIPITATION", "WATER_LEAK", "REFUTES")

    soil_w = soil_edge_data[0].weight if soil_edge_data else 0
    precip_w = precip_edge_data[0].weight if precip_edge_data else 0

    print(f"\n  بعد 3 FP — PRECIPITATION refutation weakened:")
    if precip_edge_data:
        print(f"    PRECIPITATION → WATER_LEAK (REFUTES): {precip_w:.4f}")
        conf = precip_edge_data[0].confidence
        print(f"    Confidence: {conf:.2%}")

    t2_pass = (
        soil_w > before.get("SOIL_MOISTURE", 0.85) and  # تقوية SOIL_MOISTURE
        len(soil_edge_data) > 0 and
        len(precip_edge_data) > 0
    )
    results["T2"] = t2_pass
    print(f"\n  {'✓ T2 PASSED' if t2_pass else '✗ T2 FAILED'}: "
          f"الأوزان تتطور مع التحقق الميداني")

    # =========================================================================
    # T3: Discovery — اكتشاف علاقة جديدة
    # =========================================================================
    print_section("T3: Relationship Discovery — New Pattern Found")

    # نمط متكرر: SOIL_TEMP مرتبط بـ WATER_LEAK في حالات معينة
    # (علاقة لم تكن في المعرفة الأولية)
    print("\n  محاكاة 3 ملاحظات تكشف علاقة جديدة: SOIL_TEMP ↑ مع WATER_LEAK")

    discoveries = []
    for i in range(3):
        discovered = kg.discover_relationship(
            source="SOIL_TEMP",
            target="WATER_LEAK",
            edge_type="SUPPORTS",
            evidence=f"Case-{i+1}: SOIL_TEMP ارتفع مع التسرب في البيئة الباردة",
            initial_weight=0.30,
        )
        discoveries.append(discovered)

    # المرة الأولى: اكتشاف جديد
    # المرات التالية: تقوية نفس العلاقة
    new_discoveries = kg.get_knowledge_stats()["discovered_edges"]
    print(f"\n  العلاقات المكتشفة: {new_discoveries}")
    print(f"  أول اكتشاف: {discoveries[0]} (True = new, False = reinforced)")

    soil_temp_supports = kg.get_edge_data("SOIL_TEMP", "WATER_LEAK", "SUPPORTS")
    if soil_temp_supports:
        edge = soil_temp_supports[0]
        print(f"  وزن SOIL_TEMP → WATER_LEAK: {edge.weight:.4f} (confirmation={edge.confirmation_count})")

    t3_pass = new_discoveries >= 1
    results["T3"] = t3_pass
    print(f"\n  {'✓ T3 PASSED' if t3_pass else '✗ T3 FAILED'}: "
          f"النظام اكتشف {new_discoveries} علاقة جديدة")

    # =========================================================================
    # T4: Root Cause Analysis
    # =========================================================================
    print_section("T4: Root Cause Engine — Why Did It Happen?")

    rce = RootCauseEngine(kg)

    # أصل قديم بمادة حديد زهر
    asset_metadata_old = {
        "age_years": 22,
        "material": "CI",
        "pressure_bar": 9.5,
        "near_construction": False,
        "last_inspection_days": 730,
    }

    # أصل حديث بـ HDPE
    asset_metadata_new = {
        "age_years": 3,
        "material": "HDPE",
        "pressure_bar": 5.0,
        "near_construction": True,
        "last_inspection_days": 60,
    }

    result_old = rce.analyze("WATER_LEAK", "PIPE-OLD-001", asset_metadata_old)
    result_new = rce.analyze("WATER_LEAK", "PIPE-NEW-001", asset_metadata_new)

    print(f"\n  أصل قديم (22 سنة، حديد زهر، ضغط مرتفع):")
    print(f"  السبب الأرجح: {result_old.most_probable_cause}")
    print(f"  الأسباب مرتبة:")
    for rc in result_old.root_causes[:4]:
        print(f"    {rc.cause_id:<28} {rc.probability:.3f}  {rc.contributing_factors[:1]}")

    print(f"\n  أصل جديد (3 سنوات، HDPE، بناء قريب):")
    print(f"  السبب الأرجح: {result_new.most_probable_cause}")
    print(f"  الأسباب مرتبة:")
    for rc in result_new.root_causes[:4]:
        print(f"    {rc.cause_id:<28} {rc.probability:.3f}  {rc.contributing_factors[:1]}")

    print(f"\n  الأحداث المستقبلية المحتملة بعد WATER_LEAK:")
    for ev in result_old.possible_next_events:
        print(f"    {ev['event']:<20} p={ev['probability']:.2f} في {ev['timeframe_months'][0]}-{ev['timeframe_months'][1]} شهر")

    print(f"\n  توصيات الوقاية (أصل قديم):")
    for hint in result_old.prevention_hints:
        print(f"    → {hint}")

    t4_pass = (
        result_old.most_probable_cause != result_new.most_probable_cause and
        len(result_old.root_causes) >= 3 and
        len(result_old.possible_next_events) >= 2
    )
    results["T4"] = t4_pass
    print(f"\n  {'✓ T4 PASSED' if t4_pass else '✗ T4 FAILED'}: "
          f"Root Cause يختلف بحسب خصائص الأصل")

    # =========================================================================
    # T5: Spatial Memory
    # =========================================================================
    print_section("T5: Spatial Memory — Remembers & Influences Diagnosis")

    sm = SpatialMemory()
    lat, lon = 32.891, 13.207

    # تسجيل تاريخ في هذا الموقع
    sm.record(lat, lon, date(2022, 6, 15), "IRRIGATION_EFFECT", "PIPE-001",
              {"SOIL_MOISTURE": 2.1, "SURFACE_TEMP": -1.2}, confirmed=True)
    sm.record(lat, lon, date(2023, 6, 20), "IRRIGATION_EFFECT", "PIPE-001",
              {"SOIL_MOISTURE": 2.3, "SURFACE_TEMP": -1.5}, confirmed=True)
    sm.record(lat, lon, date(2024, 6, 10), "IRRIGATION_EFFECT", "PIPE-001",
              {"SOIL_MOISTURE": 1.9, "SURFACE_TEMP": -1.0}, confirmed=True)

    # الآن رصدنا شذوذ جديد في نفس المنطقة
    cell = sm.recall(lat, lon)
    prior_adj = sm.get_prior_adjustment(lat, lon, "IRRIGATION_EFFECT")
    prior_adj_leak = sm.get_prior_adjustment(lat, lon, "WATER_LEAK")

    print(f"\n  الموقع: ({lat}, {lon}) | geohash: {encode_geohash(lat, lon, 7)}")
    print(f"  تاريخ الموقع: {len(cell.occurrences)} ملاحظة مؤكدة")
    print(f"  الحدث الأكثر تكرارًا: {cell.most_common_event()}")
    print(f"  درجة التكرار: {cell.recurrence_score:.2f}")
    print(f"\n  تعديل Prior بناءً على التاريخ:")
    print(f"    IRRIGATION_EFFECT: {prior_adj:.2f}x  ← تاريخ قوي")
    print(f"    WATER_LEAK:        {prior_adj_leak:.2f}x  ← لا تاريخ")

    # البحث عن أنماط مشابهة
    current_signature = {"SOIL_MOISTURE": 2.2, "SURFACE_TEMP": -1.3}
    similar = sm.find_similar_patterns(lat, lon, current_signature)
    print(f"\n  أنماط مشابهة في التاريخ: {len(similar)} حالة")

    t5_pass = (
        prior_adj > 1.5 and          # الري له تاريخ قوي هنا
        prior_adj_leak < 1.2 and     # لا تاريخ للتسرب هنا
        len(similar) >= 2             # وجد أنماط مشابهة
    )
    results["T5"] = t5_pass
    print(f"\n  {'✓ T5 PASSED' if t5_pass else '✗ T5 FAILED'}: "
          f"الذاكرة المكانية تؤثر على التشخيص")

    # =========================================================================
    # T6: Asset Network — Cluster Event Detection
    # =========================================================================
    print_section("T6: Asset Network — Cluster Event Detection")

    net = AssetNetwork()

    # بناء شبكة بنية تحتية مياه
    net.register_asset("WELL-01",    "WATER_WELL",    "بئر الإنتاج 01", 0.70, 32.85, 13.18)
    net.register_asset("PUMP-04",    "PUMP_STATION",  "محطة الضخ 04",   0.80, 32.87, 13.19)
    net.register_asset("PIPE-044",   "WATER_PIPELINE","خط النقل الرئيسي", 0.85, 32.89, 13.20)
    net.register_asset("RES-NORTH",  "RESERVOIR",     "خزان الشمال",    0.90, 32.91, 13.21)
    net.register_asset("DIST-ZONE-A","DISTRIBUTION",  "شبكة التوزيع أ", 0.75, 32.93, 13.22)

    net.connect("WELL-01",   "PUMP-04",    "PHYSICAL_FLOW",    flow_type="water")
    net.connect("PUMP-04",   "PIPE-044",   "PHYSICAL_FLOW",    flow_type="water")
    net.connect("PIPE-044",  "RES-NORTH",  "PHYSICAL_FLOW",    flow_type="water")
    net.connect("RES-NORTH", "DIST-ZONE-A","PHYSICAL_FLOW",    flow_type="water")

    # تسجيل شذوذات في فترة زمنية قصيرة (حادثة شبكية)
    net.log_anomaly("PUMP-04",    date(2025, 6, 8),  0.62, "SUBSIDENCE")
    net.log_anomaly("PIPE-044",   date(2025, 6, 10), 0.95, "WATER_LEAK")
    net.log_anomaly("RES-NORTH",  date(2025, 6, 13), 0.71, "WATER_LEVEL_DROP")

    # تحليل الانتشار
    prop = net.analyze_propagation("PIPE-044", 0.95, "WATER_LEAK")

    print(f"\n  شبكة المياه: {net.get_network_summary()['total_assets']} أصل، "
          f"{net.get_network_summary()['total_connections']} اتصال")

    print(f"\n  بعد WATER_LEAK في PIPE-044:")
    print(f"  الأصول التي يجب فحصها:")
    for asset in prop.assets_to_check:
        print(f"    [{asset['priority_score']:.2f}] {asset['asset_id']:<15} "
              f"{asset['connection_type']:<20} {asset['reason'][:45]}")

    print(f"\n  احتمال Cluster Event: {prop.cluster_probability:.2%}")
    print(f"  التوصية: {prop.recommended_action}")

    # اكتشاف Cluster Events
    clusters = net.detect_cluster_events(time_window_days=7)
    print(f"\n  Cluster Events المكتشفة: {len(clusters)}")
    for cl in clusters:
        print(f"    {cl.cluster_id}: {cl.assets}")
        print(f"             انتشار زمني: {cl.temporal_spread_days} يوم")

    t6_pass = (
        len(prop.assets_to_check) >= 2 and
        prop.cluster_probability > 0.20 and
        len(clusters) >= 1
    )
    results["T6"] = t6_pass
    print(f"\n  {'✓ T6 PASSED' if t6_pass else '✗ T6 FAILED'}: "
          f"الشبكة تكتشف الحوادث المترابطة")

    # =========================================================================
    # T7: Prediction Groundwork
    # =========================================================================
    print_section("T7: Prediction Groundwork (Phase 3+ Foundation)")

    print(f"\n  إثبات وجود بنية التنبؤ في Phase 2:")
    print(f"\n  بعد تشخيص WATER_LEAK في أصل بعمر 22 سنة:")
    print(f"  الأحداث المستقبلية المحتملة:")

    for ev in result_old.possible_next_events:
        print(f"    {ev['event']:<20} احتمال={ev['probability']:.0%}  "
              f"خلال {ev['timeframe_months'][0]}-{ev['timeframe_months'][1]} شهر")
        print(f"      السبب: {ev['reason']}")

    print(f"\n  مسارات الاستدلال المتاحة (Reasoning Paths):")
    paths_data = [
        ("SOIL_MOISTURE", "RC_PIPE_AGING"),
        ("SUBSIDENCE",    "RC_SOIL_MOVEMENT"),
    ]
    for src, tgt in paths_data:
        paths = kg.find_reasoning_path(src, tgt)
        if paths:
            print(f"    {src} → {tgt}:")
            print(f"      {' → '.join(paths[0])}")

    t7_pass = len(result_old.possible_next_events) >= 2
    results["T7"] = t7_pass
    print(f"\n  {'✓ T7 PASSED' if t7_pass else '✗ T7 FAILED'}: "
          f"بنية التنبؤ موجودة وقابلة للتوسع")

    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    print_section("PHASE 2 RESULTS SUMMARY")

    tests = [
        ("T1: Knowledge Graph صحيح",           results["T1"]),
        ("T2: Living Graph يتطور",              results["T2"]),
        ("T3: اكتشاف علاقات جديدة",            results["T3"]),
        ("T4: Root Cause Analysis",             results["T4"]),
        ("T5: Spatial Memory تؤثر على التشخيص",results["T5"]),
        ("T6: Asset Network + Cluster Events",  results["T6"]),
        ("T7: Prediction Groundwork",           results["T7"]),
    ]

    all_pass = all(p for _, p in tests)
    print()
    for name, passed in tests:
        print(f"  {'✓' if passed else '✗'} {name}")

    final_stats = kg.get_knowledge_stats()
    print(f"\n  Knowledge Graph النهائي:")
    print(f"    عقد: {final_stats['total_nodes']} | حواف: {final_stats['total_edges']}")
    print(f"    حواف مؤكدة ميدانيًا: {final_stats['confirmed_edges']}")
    print(f"    علاقات مكتشفة: {final_stats['discovered_edges']}")

    print(f"\n  {'★ PHASE 2 PASSED ★' if all_pass else '✗ PHASE 2 NEEDS REVIEW'}")

    if all_pass:
        print("""
  ما حققته Phase 2:
  1. Knowledge Graph حي — يتطور من التحقق الميداني
  2. يكتشف علاقات جديدة لم تكن في المعرفة الأولية
  3. Root Cause مختلف بحسب خصائص الأصل
  4. الذاكرة المكانية تؤثر على التشخيص
  5. الشبكة تكتشف الحوادث المترابطة
  6. بنية التنبؤ موجودة (Phase 3+ جاهز)

  المشروع الآن: Spatial Intelligence Operating System
  وليس مجرد: نظام كشف شذوذات
        """)

    # Save
    output = {
        "phase": "Phase 2 — Knowledge & Causal Reasoning",
        "date": date.today().isoformat(),
        "tests": {name: passed for name, passed in tests},
        "verdict": "PHASE_2_PASSED" if all_pass else "PHASE_2_NEEDS_REVIEW",
        "knowledge_graph_final": kg.get_knowledge_stats(),
        "spatial_memory_stats": sm.get_stats(),
        "asset_network_summary": net.get_network_summary(),
    }

    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "phase2_results.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2)
    )
    print(f"  ✓ النتائج: demo/results/phase2_results.json\n")

    return all_pass


if __name__ == "__main__":
    passed = run_phase2_proof()
    sys.exit(0 if passed else 1)
