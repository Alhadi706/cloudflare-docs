"""
Evidence Collector — يجمع الأدلة من مصادر مختلفة ويُصنِّفها.

المصادر:
  1. AnomalyResult  → Dynamic Evidence (z-scores)
  2. Context dict   → Physical Facts (season, irrigation, maintenance)
  3. Weather data   → Physical Facts (precipitation)
  4. ERP data       → Physical Facts (maintenance, permits, pressure sensors)
"""
from datetime import datetime
from minerva.evidence.types import (
    DynamicEvidence, PhysicalFact, EvidenceBundle, EvidenceQuality
)
from minerva.anomaly.engine import AnomalyResult


class EvidenceCollector:
    """
    يُحوِّل AnomalyResult + Context + ERP إلى EvidenceBundle.
    """

    def collect(
        self,
        anomaly: AnomalyResult,
        observed_values: dict[str, float],
        expected_values: dict[str, float],
        precipitation_30d: float = 0.0,
        precipitation_7d: float = 0.0,
        erp_data: dict | None = None,
    ) -> EvidenceBundle:
        """
        يبني EvidenceBundle كاملة.

        Args:
            anomaly:            نتيجة الـ Anomaly Engine
            observed_values:    قيم الإشارات الفعلية {signal_id: value}
            expected_values:    قيم الـ Baseline {signal_id: expected}
            precipitation_30d:  هطول مطري في آخر 30 يومًا (mm)
            precipitation_7d:   هطول مطري في آخر 7 أيام (mm)
            erp_data:           بيانات ERP اختيارية
        """
        erp_data = erp_data or {}
        ctx = self._parse_context(anomaly.context_key)

        bundle = EvidenceBundle(
            asset_id=anomaly.asset_id,
            obs_date=anomaly.obs_date,
            context=ctx,
        )

        # ---------------------------------------------------------------
        # 1. Dynamic Evidence من z-scores
        # ---------------------------------------------------------------
        for signal_id, z in anomaly.z_scores.items():
            obs = observed_values.get(signal_id)
            exp = expected_values.get(signal_id)
            if obs is None or exp is None:
                continue

            direction = "INCREASE" if z > 0 else ("DECREASE" if z < 0 else "STABLE")

            # جودة افتراضية — تُحسَّن لاحقًا من Signal Quality metadata
            quality = EvidenceQuality(
                data_quality=0.85,
                temporal_relevance=0.90,
                spatial_coverage=0.80,
                source_reliability=0.85,
                cross_source_consistency=0.75 if len(anomaly.z_scores) > 1 else 0.50,
            )

            bundle.add_dynamic(DynamicEvidence(
                signal_id=signal_id,
                observed_value=round(obs, 4),
                expected_value=round(exp, 4),
                z_score=round(z, 2),
                direction=direction,
                quality=quality,
                source_id=anomaly.baseline_type,
                obs_time=datetime.utcnow(),
            ))

        # ---------------------------------------------------------------
        # 2. Physical Facts — Precipitation
        # ---------------------------------------------------------------
        bundle.add_physical(PhysicalFact(
            fact_id="PRECIPITATION_30D",
            value=round(precipitation_30d, 1),
            unit="mm",
            confidence="HIGH",
            source_id="open_meteo",
        ))
        bundle.add_physical(PhysicalFact(
            fact_id="PRECIPITATION_7D",
            value=round(precipitation_7d, 1),
            unit="mm",
            confidence="HIGH",
            source_id="open_meteo",
        ))

        # ---------------------------------------------------------------
        # 3. Physical Facts — Context (season, ops, vicinity)
        # ---------------------------------------------------------------
        bundle.add_physical(PhysicalFact(
            fact_id="SEASON",
            value=ctx.get("season", "UNKNOWN"),
            confidence="HIGH",
            source_id="context_resolver",
        ))
        bundle.add_physical(PhysicalFact(
            fact_id="POST_MAINTENANCE",
            value=ctx.get("ops") == "POST_MAINT",
            confidence="MEDIUM" if ctx.get("ops") else "LOW",
            source_id="erp",
        ))
        bundle.add_physical(PhysicalFact(
            fact_id="IRRIGATION_NEARBY",
            value=ctx.get("vicinity") == "IRRIGATION_ACTIVE",
            confidence="MEDIUM",
            source_id="context_resolver",
        ))
        bundle.add_physical(PhysicalFact(
            fact_id="NEAR_CONSTRUCTION",
            value=ctx.get("ops") == "NEAR_ACTIVITY",
            confidence="MEDIUM",
            source_id="context_resolver",
        ))

        # ---------------------------------------------------------------
        # 4. Physical Facts — ERP Data
        # ---------------------------------------------------------------
        if "pressure_bar" in erp_data:
            bundle.add_physical(PhysicalFact(
                fact_id="PRESSURE_SENSOR",
                value=erp_data["pressure_bar"],
                unit="bar",
                confidence="HIGH",
                source_id="erp_scada",
            ))
        if "days_since_maintenance" in erp_data:
            bundle.add_physical(PhysicalFact(
                fact_id="DAYS_SINCE_MAINTENANCE",
                value=erp_data["days_since_maintenance"],
                unit="days",
                confidence="HIGH",
                source_id="erp",
            ))
        if "construction_permit_nearby" in erp_data:
            bundle.add_physical(PhysicalFact(
                fact_id="CONSTRUCTION_PERMIT",
                value=erp_data["construction_permit_nearby"],
                confidence="HIGH",
                source_id="erp",
            ))

        return bundle

    @staticmethod
    def _parse_context(context_key: str) -> dict:
        """يُحوِّل "HOT_DRY|DRY|NORMAL|NORMAL" إلى dict."""
        parts = context_key.split("|")
        keys = ["season", "moisture", "ops", "vicinity"]
        if len(parts) == 4:
            return dict(zip(keys, parts))
        return {k: "UNKNOWN" for k in keys}
