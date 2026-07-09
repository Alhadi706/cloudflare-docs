#!/usr/bin/env python3
"""
MINERVA Analysis Script — يُستدعى من Next.js API Route.
المدخلات: JSON من stdin
المخرجات: JSON إلى stdout
"""
import sys
import json
import os
from datetime import date, timedelta

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_analysis(params: dict) -> dict:
    from minerva.signals.adapters.synthetic import generate_time_series, InjectedEvent
    from minerva.signals.adapters.weather import fetch_weather_history
    from minerva.context.resolver import ContextResolver
    from minerva.baseline.behavior_profile import BehaviorProfileBuilder
    from minerva.anomaly.engine import AnomalyEngine
    from minerva.evidence.collector import EvidenceCollector
    from minerva.reasoning.catalogue import get_knowledge
    from minerva.reasoning.scorer import DiagnosticScorer
    from minerva.reasoning.weights import WeightStore
    from minerva.reports.diagnostic import DiagnosticReportBuilder
    from minerva.knowledge.graph import LivingKnowledgeGraph
    from minerva.knowledge.causal import RootCauseEngine
    from minerva.decision.voi import VoIEngine
    from minerva.decision.missing_evidence import MissingEvidenceEngine

    ASSET_ID   = params.get('asset_id', 'PIPE-WTR-TEST-001')
    ASSET_TYPE = params.get('asset_type', 'WATER_PIPELINE')
    LAT = params.get('lat', 32.89)
    LON = params.get('lon', 13.18)
    SIGNALS = ['SOIL_MOISTURE', 'SURFACE_TEMP', 'SAR_BACKSCATTER', 'VEGETATION_INDEX']

    TRAIN_START = date(2023, 1, 1)
    TRAIN_END   = date(2024, 12, 31)
    TEST_START  = date(2025, 1, 1)
    TEST_END    = date(2025, 6, 30)

    IRRIGATION_PERIODS = [
        (date(2023,6,1),  date(2023,7,31)),
        (date(2024,6,1),  date(2024,7,31)),
        (date(2025,4,15), date(2025,5,14)),
    ]
    MAINTENANCE_PERIODS = [
        (date(2023,9,10), date(2023,9,20)),
        (date(2024,8,15), date(2024,8,25)),
    ]
    LEAK_EVENT = InjectedEvent('WATER_LEAK', date(2025,5,20), date(2025,6,18), 0.7)

    # Weather
    weather = fetch_weather_history(LAT, LON, TRAIN_START, TEST_END) or {}
    resolver = ContextResolver(daily_weather=weather)

    all_dates = [TRAIN_START + timedelta(days=5*i)
                 for i in range((TEST_END - TRAIN_START).days // 5 + 1)]
    contexts = resolver.resolve_series(all_dates, MAINTENANCE_PERIODS, IRRIGATION_PERIODS)

    df_full  = generate_time_series(TRAIN_START, TEST_END, contexts, [LEAK_EVENT], seed=42)
    df_train = df_full[df_full['date'] <= TRAIN_END].copy()
    df_test  = df_full[df_full['date'] >= TEST_START].copy()

    # Baseline + Anomaly Engine
    builder = BehaviorProfileBuilder(ASSET_ID, SIGNALS)
    profile  = builder.build_conditional(df_train)
    engine   = AnomalyEngine(ASSET_ID, ASSET_TYPE, profile, 'conditional')
    results  = engine.analyze_series(df_test)

    # Peak anomaly
    peak = max(results, key=lambda r: r.anomaly_score)
    ctx_tuple = contexts.get(peak.obs_date, ('HOT_DRY','DRY','NORMAL','NORMAL'))
    ctx_key   = '|'.join(ctx_tuple)

    obs_vals = {}
    for _, row in df_test.iterrows():
        if row['date'] == peak.obs_date:
            obs_vals = {s: float(row[s]) for s in SIGNALS if s in row.index}
            break

    exp_vals = {}
    for s in SIGNALS:
        cell = profile.get_cell(ctx_key, s)
        if cell:
            exp_vals[s] = cell.mean

    p30 = resolver.get_30d_precip(peak.obs_date)
    p7  = sum(
        resolver._weather_index.get(peak.obs_date - timedelta(days=i), {}).get('precip', 0.0)
        for i in range(1, 8)
    )

    # Evidence + Diagnosis
    collector = EvidenceCollector()
    bundle    = collector.collect(peak, obs_vals, exp_vals, p30, p7)
    knowledge = get_knowledge(ASSET_TYPE)
    scorer    = DiagnosticScorer(knowledge, WeightStore())
    score     = scorer.score_all(bundle)
    report    = DiagnosticReportBuilder().build(score, bundle, peak.anomaly_score, peak.severity)

    # Flatten diagnosis for clean API response
    rep = report.to_dict()
    flat_diagnosis = {
        'winner_event':          rep['diagnosis']['event'],
        'winner_probability':    rep['diagnosis']['probability'],
        'confidence_level':      rep['diagnosis']['confidence'],
        'evidence_completeness': rep['diagnosis']['evidence_completeness'],
        'causal_alignment':      rep['diagnosis']['causal_alignment'],
        'is_unknown':            rep['diagnosis']['is_unknown'],
        'supporting_evidence':   rep['explanation']['supporting'],
        'refuting_evidence':     rep['explanation']['refuting'],
        'missing_evidence':      rep['explanation']['missing'],
        'rejected_hypotheses':   rep['explanation']['rejected'],
        'all_hypotheses':        rep['all_hypotheses'],
        'counterfactual':        rep['counterfactual'],
        'recommendation':        rep['recommendation'],
        'field_priority':        rep['field_priority'],
    }
    kg  = LivingKnowledgeGraph()
    rce = RootCauseEngine(kg)
    rc  = rce.analyze(score.winner_event, ASSET_ID, {
        'age_years': 12, 'material': 'HDPE',
        'pressure_bar': 8.5, 'near_construction': False,
    })

    # VoI
    voi_engine = VoIEngine(asset_criticality=0.85, days_until_next_scheduled_check=30)
    voi = voi_engine.analyze(ASSET_ID, score.winner_probability, score.confidence_level, daily_damage_usd=300)

    # Missing Evidence
    me_engine = MissingEvidenceEngine()
    me_report = me_engine.analyze(bundle, knowledge, score.winner_event, score.evidence_completeness)

    # Timeline
    # نستخدم df_test لمعرفة is_event_period لكل تاريخ
    event_dates = set()
    for _, row in df_test.iterrows():
        if row.get('is_event_period', False):
            event_dates.add(row['date'])

    timeline = []
    for r in results:
        timeline.append({
            'date': r.obs_date.isoformat(),
            'score': round(r.anomaly_score, 3),
            'severity': r.severity,
            'is_event': r.obs_date in event_dates,
            'z_scores': r.z_scores,
        })

    # Context distribution
    ctx_dist = {}
    for d, ctx in contexts.items():
        if TEST_START <= d <= TEST_END:
            k = ctx[0] + '|' + ctx[1]
            ctx_dist[k] = ctx_dist.get(k, 0) + 1

    # Signal stats from training
    sig_stats = {}
    for sig in SIGNALS:
        if sig not in df_train.columns:
            continue
        col = df_train[sig].dropna()
        if len(col) > 0:
            sig_stats[sig] = {
                'mean': round(float(col.mean()), 4),
                'std':  round(float(col.std()), 4),
                'min':  round(float(col.min()), 4),
                'max':  round(float(col.max()), 4),
            }

    return {
        'ok': True,
        'asset_id': ASSET_ID,
        'asset_type': ASSET_TYPE,
        'analysis_date': str(date.today()),
        'peak': {
            'date': peak.obs_date.isoformat(),
            'anomaly_score': peak.anomaly_score,
            'severity': peak.severity,
            'z_scores': peak.z_scores,
            'context': ctx_key,
            'precipitation_30d': round(p30, 1),
            'precipitation_7d':  round(p7,  1),
        },
        'diagnosis': flat_diagnosis,
        'hypothesis_competition': [
            {
                'event': h.event_type,
                'probability': h.posterior,
                'prior': h.prior,
                'supporting': h.supporting_count,
                'refuting': h.refuting_count,
                'causal_alignment': h.causal_alignment_score,
            }
            for h in score.all_hypotheses[:8]
        ],
        'root_cause': {
            'most_probable': rc.most_probable_cause,
            'confidence': rc.confidence,
            'causes': [
                {'id': c.cause_id, 'description': c.description,
                 'probability': c.probability, 'factors': c.contributing_factors[:2]}
                for c in rc.root_causes[:5]
            ],
            'next_events': rc.possible_next_events,
            'prevention': rc.prevention_hints,
        },
        'decision': {
            'do_nothing_loss_usd': voi.do_nothing_expected_loss_usd,
            'best_action': voi.best_action,
            'best_voi_usd': voi.best_voi_usd,
            'actions': [
                {
                    'id': r.action.action_id,
                    'description': r.action.description_ar,
                    'cost_usd': r.action.cost_usd,
                    'voi_usd': r.voi_usd,
                    'confidence_gain': r.action.expected_confidence_delta,
                    'recommendation': r.recommendation,
                }
                for r in voi.action_evaluations[:7]
            ],
        },
        'missing_evidence': {
            'items': [
                {
                    'evidence_id': m.evidence_id,
                    'gain': m.expected_confidence_gain,
                    'cheapest_source': m.cheapest_source,
                    'cost_usd': m.cheapest_cost_usd,
                    'reason': m.physical_reason,
                }
                for m in me_report.missing_items[:5]
            ],
            'projected_confidence': me_report.projected_confidence_if_all_found,
        },
        'timeline': timeline,
        'context_distribution': ctx_dist,
        'signal_stats': sig_stats,
        'baseline_cells': len(profile.cells),
        'training_observations': len(df_train),
    }


if __name__ == '__main__':
    try:
        raw = sys.stdin.read().strip()
        params = json.loads(raw) if raw else {}
        result = run_analysis(params)
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        import traceback
        print(json.dumps({'ok': False, 'error': str(e), 'traceback': traceback.format_exc()},
                         ensure_ascii=False), file=sys.stdout)
        sys.exit(1)
