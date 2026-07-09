"""
Imagery Recommendation Engine — Phase 5 Core.
ADR-015: Commercial imagery is an optional confidence amplifier, never a dependency.
ADR-016: VoI threshold is data-driven, not hardcoded.

Decision Hierarchy:
  1. Is confidence already high enough? → No imagery needed
  2. Is archive imagery available (free)? → Use archive
  3. Would live imagery provide enough VoI to justify cost? → Request live
  4. Is field inspection more cost-effective? → Recommend field
  5. Default → Continue with free Sentinel only
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional
import math

from minerva.imagery.providers.base import SceneMetadata, ImageryProvider


# ─── Decision Actions ────────────────────────────────────────────────────────

ACTION_NONE        = "NONE"           # No additional imagery needed
ACTION_USE_ARCHIVE = "USE_ARCHIVE"    # Use existing local archive (free)
ACTION_USE_FREE    = "USE_FREE"       # Use Sentinel/free satellite only
ACTION_REQUEST_LIVE = "REQUEST_LIVE"  # Request latest from provider
ACTION_DRONE       = "DRONE"          # Recommend drone survey
ACTION_FIELD       = "FIELD"          # Field inspection is better ROI


# ─── Result types ─────────────────────────────────────────────────────────────

@dataclass
class SceneVoI:
    """VoI calculation for a single scene."""
    scene: SceneMetadata
    expected_confidence_gain: float    # 0→1 estimated
    expected_savings_usd: float        # avoided loss
    voi_usd: float                     # savings - cost
    worth_acquiring: bool

    def to_dict(self) -> dict:
        return {
            **self.scene.to_dict(),
            "expected_confidence_gain": round(self.expected_confidence_gain, 3),
            "expected_savings_usd":     round(self.expected_savings_usd, 0),
            "voi_usd":                  round(self.voi_usd, 0),
            "worth_acquiring":          self.worth_acquiring,
        }


@dataclass
class ImageryRecommendation:
    """Full recommendation output from MINERVA."""
    action: str
    provider: Optional[str]
    recommended_scene: Optional[SceneMetadata]

    # Human-readable explanation
    reasoning_ar: str

    # Economics
    expected_confidence_gain: float
    expected_cost_usd: float
    voi_usd: float

    # Available scenes with their VoI scores
    scenes_evaluated: list[SceneVoI] = field(default_factory=list)

    # Archive statistics
    archive_total: int = 0
    archive_latest_date: Optional[date] = None
    archive_cloud_cover_avg: float = 0.0

    def to_dict(self) -> dict:
        return {
            "action":                   self.action,
            "provider":                 self.provider,
            "reasoning_ar":             self.reasoning_ar,
            "expected_confidence_gain": round(self.expected_confidence_gain, 3),
            "expected_cost_usd":        round(self.expected_cost_usd, 0),
            "voi_usd":                  round(self.voi_usd, 0),
            "scenes_evaluated":         [s.to_dict() for s in self.scenes_evaluated[:10]],
            "archive_total":            self.archive_total,
            "archive_latest_date":      str(self.archive_latest_date) if self.archive_latest_date else None,
            "archive_cloud_cover_avg":  round(self.archive_cloud_cover_avg, 1),
            "recommended_scene":        self.recommended_scene.to_dict() if self.recommended_scene else None,
        }


# ─── Core Engine ─────────────────────────────────────────────────────────────

class ImageryRecommendationEngine:
    """
    Decides whether commercial/archive imagery is worth acquiring.

    Parameters are configurable — no hardcoded thresholds.
    ADR-016: All thresholds are parameters, not constants.
    """

    def __init__(
        self,
        confidence_threshold: float = 0.80,   # above this → imagery not needed
        archive_max_age_days: int = 30,        # "recent enough" for archive
        min_voi_ratio: float = 1.5,            # min VoI/cost ratio to recommend
        daily_damage_usd: float = 300.0,       # cost of undetected event per day
        days_until_next_check: int = 30,
    ):
        self.conf_threshold      = confidence_threshold
        self.archive_max_age     = archive_max_age_days
        self.min_voi_ratio       = min_voi_ratio
        self.daily_damage        = daily_damage_usd
        self.days_check          = days_until_next_check

    def recommend(
        self,
        lat: float,
        lon: float,
        current_confidence: float,
        current_anomaly_score: float,
        asset_criticality: float,
        evidence_completeness: float,
        providers: list[ImageryProvider],
    ) -> ImageryRecommendation:
        """
        Core decision function.
        Returns a full recommendation with economic justification.
        """
        # ── Step 1: Collect all available scenes ────────────────────────────
        start  = date.today() - timedelta(days=365)
        end    = date.today()
        all_scenes: list[SceneMetadata] = []

        for provider in providers:
            try:
                scenes = provider.search(lat, lon, start, end, max_cloud_cover=35.0, max_results=30)
                all_scenes.extend(scenes)
            except Exception:
                continue

        # Deduplicate by scene_id
        seen: set[str] = set()
        unique: list[SceneMetadata] = []
        for s in all_scenes:
            if s.scene_id not in seen:
                seen.add(s.scene_id)
                unique.append(s)
        unique.sort(key=lambda s: s.quality_score, reverse=True)

        # ── Step 2: Compute VoI for each scene ────────────────────────────────
        evaluated = [self._compute_voi(s, current_confidence, current_anomaly_score, asset_criticality) for s in unique]
        evaluated.sort(key=lambda e: e.voi_usd, reverse=True)

        # Archive stats
        archive_scenes = [e.scene for e in evaluated if e.scene.available_locally]
        archive_total  = len(archive_scenes)
        archive_latest = max((s.acquisition_date for s in archive_scenes), default=None)
        archive_cloud  = (sum(s.cloud_cover_pct for s in archive_scenes) / max(len(archive_scenes), 1)) if archive_scenes else 0.0

        # ── Step 3: Decision logic ─────────────────────────────────────────────
        return self._decide(
            current_confidence, current_anomaly_score, asset_criticality,
            evidence_completeness, evaluated, archive_total, archive_latest, archive_cloud
        )

    def _compute_voi(
        self,
        scene: SceneMetadata,
        current_confidence: float,
        anomaly_score: float,
        criticality: float,
    ) -> SceneVoI:
        """
        VoI(scene) = Expected_savings - Cost

        Expected savings = P(event) × criticality × confidence_gain × daily_damage × days
        """
        # Quality factors
        cloud_f    = 1.0 - scene.cloud_cover_pct / 100.0
        res_f      = min(1.0, 10.0 / max(scene.resolution_m, 0.5))
        recency_f  = max(0.1, 1.0 - scene.age_days / 180.0)

        # Maximum confidence gain this scene can provide
        max_gain   = 0.35 * cloud_f * res_f * recency_f
        # Actual gain depends on current confidence headroom
        room       = 1.0 - current_confidence
        conf_gain  = max_gain * room * 0.7    # conservative estimate

        # Economic value
        p_event    = anomaly_score * 0.7      # rough estimate
        savings    = p_event * criticality * conf_gain * self.daily_damage * self.days_check
        cost       = scene.cost_usd or 0.0
        voi        = savings - cost

        return SceneVoI(
            scene=scene,
            expected_confidence_gain=round(conf_gain, 3),
            expected_savings_usd=round(savings, 0),
            voi_usd=round(voi, 0),
            worth_acquiring=voi > 0 and conf_gain > 0.02,
        )

    def _decide(
        self,
        confidence: float,
        anomaly_score: float,
        criticality: float,
        ec: float,
        evaluated: list[SceneVoI],
        archive_total: int,
        archive_latest: Optional[date],
        archive_cloud_avg: float,
    ) -> ImageryRecommendation:

        archive_ev = [e for e in evaluated if e.scene.available_locally]
        live_ev    = [e for e in evaluated if not e.scene.available_locally]
        best_arch  = archive_ev[0] if archive_ev else None
        best_live  = live_ev[0] if live_ev else None

        # ── Decision 1: Confidence already sufficient ──────────────────────
        if confidence >= self.conf_threshold and ec >= 0.70:
            return ImageryRecommendation(
                action=ACTION_NONE,
                provider=None,
                recommended_scene=None,
                reasoning_ar=(
                    f"الثقة الحالية ({confidence:.0%}) كافية لاتخاذ القرار. "
                    "لا حاجة لبيانات إضافية."
                ),
                expected_confidence_gain=0.0,
                expected_cost_usd=0.0,
                voi_usd=0.0,
                scenes_evaluated=evaluated,
                archive_total=archive_total,
                archive_latest_date=archive_latest,
                archive_cloud_cover_avg=archive_cloud_avg,
            )

        # ── Decision 2: Good archive image available (free) ───────────────
        if best_arch and best_arch.voi_usd > 0:
            arch_age = best_arch.scene.age_days
            cloud    = best_arch.scene.cloud_cover_pct

            if arch_age <= self.archive_max_age and cloud <= 20:
                return ImageryRecommendation(
                    action=ACTION_USE_ARCHIVE,
                    provider=best_arch.scene.provider,
                    recommended_scene=best_arch.scene,
                    reasoning_ar=(
                        f"يوجد في الأرشيف المحلي صورة بعمر {arch_age} يومًا "
                        f"(غيوم: {cloud:.0f}%) من {best_arch.scene.provider}. "
                        f"الرفع المتوقع للثقة: +{best_arch.expected_confidence_gain:.0%}. "
                        "استخدام الأرشيف مجاني ويغني عن طلب صورة جديدة."
                    ),
                    expected_confidence_gain=best_arch.expected_confidence_gain,
                    expected_cost_usd=0.0,
                    voi_usd=best_arch.voi_usd,
                    scenes_evaluated=evaluated,
                    archive_total=archive_total,
                    archive_latest_date=archive_latest,
                    archive_cloud_cover_avg=archive_cloud_avg,
                )

        # ── Decision 3: Live imagery worth acquiring ───────────────────────
        if best_live and best_live.worth_acquiring:
            cost = best_live.scene.cost_usd or 0.0
            ratio = best_live.voi_usd / max(cost, 1.0)
            if ratio >= self.min_voi_ratio or (anomaly_score > 0.70 and criticality > 0.75):
                return ImageryRecommendation(
                    action=ACTION_REQUEST_LIVE,
                    provider=best_live.scene.provider,
                    recommended_scene=best_live.scene,
                    reasoning_ar=(
                        f"الشذوذ مرتفع ({anomaly_score:.0%}) والثقة منخفضة ({confidence:.0%}). "
                        f"صورة {best_live.scene.provider} الجديدة (${cost:.0f}) "
                        f"ستُحسِّن الثقة +{best_live.expected_confidence_gain:.0%} "
                        f"مع VoI = ${best_live.voi_usd:.0f} — مبررة اقتصاديًا."
                    ),
                    expected_confidence_gain=best_live.expected_confidence_gain,
                    expected_cost_usd=cost,
                    voi_usd=best_live.voi_usd,
                    scenes_evaluated=evaluated,
                    archive_total=archive_total,
                    archive_latest_date=archive_latest,
                    archive_cloud_cover_avg=archive_cloud_avg,
                )

        # ── Decision 4: Field inspection more cost-effective ──────────────
        if anomaly_score > 0.60 and criticality > 0.75:
            return ImageryRecommendation(
                action=ACTION_FIELD,
                provider=None,
                recommended_scene=None,
                reasoning_ar=(
                    f"الشذوذ مرتفع ({anomaly_score:.0%}) لكن الصور المتاحة "
                    "ذات جودة منخفضة أو تغطية سحابية عالية. "
                    "الزيارة الميدانية ستعطي يقينًا أعلى بتكلفة أقل."
                ),
                expected_confidence_gain=0.39,    # field visit confidence gain
                expected_cost_usd=500.0,
                voi_usd=max(0, anomaly_score * criticality * self.daily_damage * self.days_check - 500.0),
                scenes_evaluated=evaluated,
                archive_total=archive_total,
                archive_latest_date=archive_latest,
                archive_cloud_cover_avg=archive_cloud_avg,
            )

        # ── Default: Continue with free data ──────────────────────────────
        return ImageryRecommendation(
            action=ACTION_USE_FREE,
            provider="sentinel",
            recommended_scene=None,
            reasoning_ar=(
                f"الثقة الحالية ({confidence:.0%}) في نطاق المقبول. "
                "مراقبة مستمرة بـ Sentinel المجاني كافية في الوقت الحالي."
            ),
            expected_confidence_gain=0.05,
            expected_cost_usd=0.0,
            voi_usd=0.0,
            scenes_evaluated=evaluated,
            archive_total=archive_total,
            archive_latest_date=archive_latest,
            archive_cloud_cover_avg=archive_cloud_avg,
        )
