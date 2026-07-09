#!/usr/bin/env python3
"""
MINERVA Imagery Analysis Script — Phase 5
يُستدعى من Next.js API Route.
المدخلات: JSON من stdin
المخرجات: JSON إلى stdout

يُنفِّذ:
1. قراءة الأرشيف المحلي لـ Planet
2. البحث في Planet API (لو متاح)
3. حساب VoI لكل مشهد
4. إصدار توصية MINERVA
"""
import sys
import json
import os
from datetime import date, timedelta

# Add project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def run_imagery_analysis(params: dict) -> dict:
    from minerva.imagery.providers.planet import PlanetProvider
    from minerva.imagery.recommendation import ImageryRecommendationEngine

    lat         = params.get("lat", 32.89)
    lon         = params.get("lon", 13.18)
    confidence  = params.get("current_confidence", 0.60)
    anomaly     = params.get("anomaly_score", 0.75)
    criticality = params.get("asset_criticality", 0.85)
    ec          = params.get("evidence_completeness", 0.80)
    daily_dmg   = params.get("daily_damage_usd", 300.0)

    # Planet key from env or params
    planet_key = params.get("planet_key") or os.getenv("PLANET_API_KEY", "PLAKaab2adfefe7642c9a878aecdded5c1f8")

    # Build providers
    planet = PlanetProvider(api_key=planet_key)
    providers = [planet]

    # Engine (all thresholds configurable)
    engine = ImageryRecommendationEngine(
        confidence_threshold=0.80,
        archive_max_age_days=45,
        min_voi_ratio=1.5,
        daily_damage_usd=daily_dmg,
        days_until_next_check=30,
    )

    # Get recommendation
    rec = engine.recommend(
        lat=lat, lon=lon,
        current_confidence=confidence,
        current_anomaly_score=anomaly,
        asset_criticality=criticality,
        evidence_completeness=ec,
        providers=providers,
    )

    # Archive timeline (for chart)
    all_scenes_dicts = [e.to_dict() for e in rec.scenes_evaluated]
    timeline = sorted(
        [{"date": s["acquisition_date"], "cloud": s["cloud_cover_pct"],
          "resolution": s["resolution_m"], "provider": s["provider"],
          "quality": s["quality_score"], "available": s["available_locally"],
          "voi": s["voi_usd"]}
         for s in all_scenes_dicts
         if s.get("acquisition_date")],
        key=lambda x: x["date"],
    )

    # Provider capabilities
    cap = planet.capability
    provider_info = {
        "planet": {
            "name":        cap.provider_name,
            "resolution_m": cap.typical_resolution_m,
            "revisit_days": cap.typical_revisit_days,
            "is_configured": cap.is_configured,
            "is_free":      cap.is_free,
            "archive_depth_years": cap.archive_depth_years,
        }
    }

    return {
        "ok": True,
        "analysis_date": str(date.today()),
        "location": {"lat": lat, "lon": lon},
        "current_state": {
            "confidence": confidence,
            "anomaly_score": anomaly,
            "evidence_completeness": ec,
            "asset_criticality": criticality,
        },
        "recommendation": rec.to_dict(),
        "timeline": timeline,
        "providers": provider_info,
        "archive_summary": {
            "total_scenes": rec.archive_total,
            "latest_date": str(rec.archive_latest_date) if rec.archive_latest_date else None,
            "avg_cloud_cover": rec.archive_cloud_cover_avg,
            "years_covered": sorted(set(t["date"][:4] for t in timeline if t.get("date"))) if timeline else [],
        },
    }


if __name__ == "__main__":
    try:
        raw = sys.stdin.read().strip()
        params = json.loads(raw) if raw else {}
        result = run_imagery_analysis(params)
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        import traceback
        print(json.dumps(
            {"ok": False, "error": str(e), "traceback": traceback.format_exc()},
            ensure_ascii=False
        ))
        sys.exit(1)
