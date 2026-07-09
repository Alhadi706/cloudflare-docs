"""
Missing Evidence Engine — يُحدِّد الأدلة المفقودة وتأثيرها.

لكل تشخيص بثقة MEDIUM أو LOW:
  - ما الأدلة المثالية للحدث المُشخَّص؟
  - أيها موجود؟ أيها مفقود؟
  - كم سيرتفع الـ Confidence لو أُضيف كل دليل مفقود؟
  - من أين يمكن الحصول عليه؟

هذا يُحوِّل "ثقة منخفضة" من مشكلة إلى فرصة محددة وقابلة للحل.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from minerva.reasoning.catalogue import AssetKnowledge
from minerva.evidence.types import EvidenceBundle


# مصادر البيانات وتكاليفها
EVIDENCE_SOURCES = {
    "SOIL_MOISTURE": [
        {"source": "Sentinel-2 (NDMI)", "cost_usd": 0,   "time_hours": 48,   "quality": 0.80},
        {"source": "Sentinel-1 SAR",    "cost_usd": 0,   "time_hours": 24,   "quality": 0.75},
        {"source": "Commercial Optical","cost_usd": 30,  "time_hours": 6,    "quality": 0.90},
    ],
    "SURFACE_TEMP": [
        {"source": "Landsat-9 (free)",  "cost_usd": 0,   "time_hours": 72,   "quality": 0.75},
        {"source": "Commercial Thermal","cost_usd": 50,  "time_hours": 12,   "quality": 0.88},
        {"source": "MODIS (daily)",     "cost_usd": 0,   "time_hours": 12,   "quality": 0.55},
    ],
    "SAR_BACKSCATTER": [
        {"source": "Sentinel-1 SAR",    "cost_usd": 0,   "time_hours": 48,   "quality": 0.80},
        {"source": "ICEYE (same-day)",  "cost_usd": 150, "time_hours": 6,    "quality": 0.95},
    ],
    "VEGETATION_INDEX": [
        {"source": "Sentinel-2 (free)", "cost_usd": 0,   "time_hours": 48,   "quality": 0.82},
        {"source": "Planet (daily 3m)", "cost_usd": 20,  "time_hours": 6,    "quality": 0.90},
    ],
    "PRECIPITATION_7D": [
        {"source": "Open-Meteo (free)", "cost_usd": 0,   "time_hours": 0.5,  "quality": 0.80},
        {"source": "Local Weather Stn", "cost_usd": 0,   "time_hours": 1,    "quality": 0.95},
    ],
    "POST_MAINTENANCE": [
        {"source": "ERP Query (free)",  "cost_usd": 0,   "time_hours": 0.25, "quality": 0.95},
    ],
    "PRESSURE_SENSOR": [
        {"source": "SCADA System",      "cost_usd": 0,   "time_hours": 0.1,  "quality": 0.99},
        {"source": "Install IoT sensor","cost_usd": 800, "time_hours": 168,  "quality": 0.99},
    ],
    "INSAR_DISPLACEMENT": [
        {"source": "Sentinel-1 InSAR",  "cost_usd": 0,   "time_hours": 72,   "quality": 0.75},
        {"source": "Copernicus SBAS",   "cost_usd": 0,   "time_hours": 168,  "quality": 0.80},
    ],
}


@dataclass
class MissingEvidenceItem:
    evidence_id: str
    expected_confidence_gain: float    # 0→1 كم سيرتفع الـ Confidence
    cheapest_source: str
    cheapest_cost_usd: float
    fastest_source: str
    fastest_time_hours: float
    physical_reason: str               # لماذا هذا الدليل مهم؟


@dataclass
class MissingEvidenceReport:
    current_confidence: float
    current_event: str
    evidence_completeness: float
    missing_items: list[MissingEvidenceItem]    # مرتبة بالأثر تنازليًا
    projected_confidence_if_all_found: float
    total_cost_cheapest_path_usd: float
    total_time_fastest_path_hours: float


class MissingEvidenceEngine:
    """
    يُحدِّد الأدلة المفقودة ويُرتِّبها بحسب تأثيرها.
    """

    def analyze(
        self,
        bundle: EvidenceBundle,
        knowledge: AssetKnowledge,
        diagnosed_event: str,
        current_confidence: float,
        biome: str = "ARID",
    ) -> MissingEvidenceReport:

        rules = knowledge.get_evidence_rules(diagnosed_event, biome)
        key_signals = set(knowledge.get_key_signals())

        missing_items: list[MissingEvidenceItem] = []

        for rule in rules:
            ev_id = rule.evidence_id

            # هل الدليل موجود؟
            if rule.evidence_type == "DYNAMIC":
                present = ev_id in bundle.dynamic
                quality = bundle.dynamic[ev_id].quality.composite_score if present else 0.0
            else:
                present = ev_id in bundle.physical
                quality = 0.90 if present else 0.0

            # هل جودته كافية؟
            insufficient = not present or quality < 0.40

            if not insufficient:
                continue

            # حساب تأثير إضافة هذا الدليل
            expected_gain = self._estimate_confidence_gain(
                rule.base_weight, quality, current_confidence
            )

            # أرخص وأسرع مصدر
            sources = EVIDENCE_SOURCES.get(ev_id, [])
            if sources:
                cheapest = min(sources, key=lambda s: s["cost_usd"])
                fastest  = min(sources, key=lambda s: s["time_hours"])
            else:
                cheapest = {"source": "Field Visit",   "cost_usd": 500, "time_hours": 24}
                fastest  = {"source": "Remote Query",  "cost_usd": 0,   "time_hours": 2}

            missing_items.append(MissingEvidenceItem(
                evidence_id=ev_id,
                expected_confidence_gain=round(expected_gain, 3),
                cheapest_source=cheapest["source"],
                cheapest_cost_usd=cheapest["cost_usd"],
                fastest_source=fastest["source"],
                fastest_time_hours=fastest["time_hours"],
                physical_reason=rule.physical_reason,
            ))

        # ترتيب بالأثر
        missing_items.sort(key=lambda m: m.expected_confidence_gain, reverse=True)

        # تقدير الـ Confidence لو وُجدت كل الأدلة
        total_gain = sum(m.expected_confidence_gain for m in missing_items)
        projected = min(1.0, current_confidence + total_gain * 0.7)

        # أرخص وأسرع مسار
        cheapest_total = sum(
            m.cheapest_cost_usd for m in missing_items
            if m.expected_confidence_gain > 0.05
        )
        fastest_total = max(
            (m.fastest_time_hours for m in missing_items
             if m.expected_confidence_gain > 0.05),
            default=0.0
        )

        ec = len(bundle.dynamic) / max(len(knowledge.get_key_signals()), 1)

        return MissingEvidenceReport(
            current_confidence=current_confidence,
            current_event=diagnosed_event,
            evidence_completeness=round(ec, 2),
            missing_items=missing_items,
            projected_confidence_if_all_found=round(projected, 2),
            total_cost_cheapest_path_usd=cheapest_total,
            total_time_fastest_path_hours=fastest_total,
        )

    @staticmethod
    def _estimate_confidence_gain(
        base_weight: float,
        current_quality: float,
        current_confidence: float,
    ) -> float:
        """
        تقدير كم سيرتفع الـ Confidence إذا أُضيف هذا الدليل.
        يعتمد على:
          - وزن الدليل في Evidence Rules
          - جودته الحالية (إذا موجود بجودة ضعيفة)
          - Confidence الحالي (المكسب يقل كلما ارتفع الـ Confidence)
        """
        missing_quality = 1.0 - current_quality
        room_for_improvement = 1.0 - current_confidence
        return base_weight * missing_quality * room_for_improvement
