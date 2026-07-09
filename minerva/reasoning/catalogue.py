"""
Asset Knowledge — Generic Framework (ADR-011).
Engine vs. Knowledge separation.

كل نوع أصل يُعرِّف:
  - الأحداث الممكنة والمستحيلة
  - قواعد الأدلة (Evidence Rules)
  - قواعد الاستحالة الفيزيائية (Hard Rules)
  - سلاسل السببية (Causal Chains)

الـ DiagnosticEngine لا يعرف شيئًا عن "مياه" أو "نفط".
يعرف فقط AssetKnowledge.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from minerva.evidence.types import EvidenceRule


# =============================================================================
# Causal Chain Step
# =============================================================================

@dataclass
class CausalStep:
    step: int
    signal_id: str
    direction: str          # "INCREASE" | "DECREASE"
    lag_min_days: int
    lag_max_days: int
    is_required: bool = True


# =============================================================================
# Abstract Base
# =============================================================================

class AssetKnowledge(ABC):
    """
    القاعدة المجردة لمعرفة نوع الأصل.
    ADR-011: الـ Engine لا يعرف سوى هذه الواجهة.
    """

    @property
    @abstractmethod
    def asset_type(self) -> str: ...

    @abstractmethod
    def get_possible_events(self, context: dict | None = None) -> list[str]: ...

    @abstractmethod
    def get_impossible_events(self) -> list[str]: ...

    @abstractmethod
    def get_evidence_rules(self, event_type: str, biome: str = "ARID") -> list[EvidenceRule]: ...

    @abstractmethod
    def get_causal_chain(self, event_type: str) -> list[CausalStep]: ...

    @abstractmethod
    def get_base_prior(self, event_type: str, context: dict | None = None) -> float: ...

    @abstractmethod
    def get_key_signals(self) -> list[str]: ...

    @abstractmethod
    def get_feature_weights(self) -> dict[str, float]: ...


# =============================================================================
# Water Pipeline Knowledge
# =============================================================================

class WaterPipelineKnowledge(AssetKnowledge):

    @property
    def asset_type(self) -> str:
        return "WATER_PIPELINE"

    def get_key_signals(self) -> list[str]:
        return ["SOIL_MOISTURE", "SURFACE_TEMP", "SAR_BACKSCATTER", "VEGETATION_INDEX"]

    def get_feature_weights(self) -> dict[str, float]:
        return {
            "SOIL_MOISTURE":    0.35,
            "SURFACE_TEMP":     0.25,
            "SAR_BACKSCATTER":  0.20,
            "VEGETATION_INDEX": 0.10,
            "PRECIPITATION":    0.10,
        }

    def get_possible_events(self, context: dict | None = None) -> list[str]:
        events = [
            "WATER_LEAK",
            "SUBSIDENCE",
            "EXCAVATION_DAMAGE",
            "ENCROACHMENT",
            "CONSTRUCTION_NEARBY",
            "IRRIGATION_EFFECT",
            "MAINTENANCE_SPILLAGE",
            "NATURAL_RAIN_EFFECT",
            "DATA_ERROR",
        ]
        return events

    def get_impossible_events(self) -> list[str]:
        return ["OIL_SPILL", "GAS_LEAK", "FIRE_FROM_PIPE"]

    def get_base_prior(self, event_type: str, context: dict | None = None) -> float:
        priors = {
            "WATER_LEAK":          0.20,
            "IRRIGATION_EFFECT":   0.25,
            "NATURAL_RAIN_EFFECT": 0.15,
            "MAINTENANCE_SPILLAGE":0.10,
            "SUBSIDENCE":          0.05,
            "EXCAVATION_DAMAGE":   0.05,
            "ENCROACHMENT":        0.05,
            "CONSTRUCTION_NEARBY": 0.05,
            "DATA_ERROR":          0.10,
        }
        base = priors.get(event_type, 0.05)
        # تعديل Prior بناءً على السياق
        if context:
            if event_type == "IRRIGATION_EFFECT" and context.get("vicinity") == "IRRIGATION_ACTIVE":
                base *= 2.0   # الري نشط → أكثر احتمالًا
            if event_type == "MAINTENANCE_SPILLAGE" and context.get("ops") == "POST_MAINT":
                base *= 2.5
            if event_type == "NATURAL_RAIN_EFFECT" and context.get("moisture") == "WET":
                base *= 2.0
        return min(base, 0.80)

    def get_evidence_rules(self, event_type: str, biome: str = "ARID") -> list[EvidenceRule]:
        rules_map = {
            "WATER_LEAK": self._water_leak_rules(biome),
            "IRRIGATION_EFFECT": self._irrigation_rules(),
            "NATURAL_RAIN_EFFECT": self._rain_rules(),
            "MAINTENANCE_SPILLAGE": self._maintenance_rules(),
            "SUBSIDENCE": self._subsidence_rules(),
            "DATA_ERROR": self._data_error_rules(),
        }
        return rules_map.get(event_type, [])

    def get_causal_chain(self, event_type: str) -> list[CausalStep]:
        chains = {
            "WATER_LEAK": [
                CausalStep(1, "SOIL_MOISTURE",    "INCREASE", 0, 5,  True),
                CausalStep(2, "SURFACE_TEMP",     "DECREASE", 1, 10, True),
                CausalStep(3, "SAR_BACKSCATTER",  "DECREASE", 0, 10, False),
                CausalStep(4, "VEGETATION_INDEX", "INCREASE", 14, 35, False),
            ],
            "NATURAL_RAIN_EFFECT": [
                CausalStep(1, "SOIL_MOISTURE",    "INCREASE", 0, 2,  True),
                CausalStep(2, "SURFACE_TEMP",     "DECREASE", 0, 3,  False),
                CausalStep(3, "SAR_BACKSCATTER",  "INCREASE", 0, 5,  False),  # ← DIFFERENT from leak
            ],
        }
        return chains.get(event_type, [])

    # --- Private Evidence Rule Builders ---

    def _water_leak_rules(self, biome: str) -> list[EvidenceRule]:
        return [
            # ---- DYNAMIC: اكتشاف الشذوذ ----
            EvidenceRule(
                evidence_id="SOIL_MOISTURE",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.32,
                physical_reason="تسرب الماء يرفع رطوبة التربة تدريجيًا",
                condition={"direction": "INCREASE", "min_z": 2.0, "boost_per_sigma": 0.10},
                temporal_lag_days=(0, 7),
            ),
            EvidenceRule(
                evidence_id="SURFACE_TEMP",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.24,
                physical_reason="التبخر يُبرِّد السطح — ميزة حصرية في المناطق الجافة",
                condition={"direction": "DECREASE", "min_z": 1.5, "boost_per_sigma": 0.08},
                temporal_lag_days=(1, 10),
            ),
            EvidenceRule(
                evidence_id="SAR_BACKSCATTER",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.18,
                physical_reason="التربة الرطبة تمتص الإشارة الرادارية",
                condition={"direction": "DECREASE", "min_z": 1.2, "boost_per_sigma": 0.06},
                temporal_lag_days=(0, 10),
            ),
            EvidenceRule(
                evidence_id="VEGETATION_INDEX",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.08,
                physical_reason="النبات الانتهازي يستجيب للرطوبة بعد 2-4 أسابيع",
                condition={"direction": "INCREASE", "min_z": 1.0, "boost_per_sigma": 0.04},
                temporal_lag_days=(14, 35),
            ),
            # ---- PHYSICAL FACTS: المُحدِّدات الفارقة ----
            EvidenceRule(
                evidence_id="PRECIPITATION_30D",
                evidence_type="PHYSICAL_FACT",
                role="DIFFERENTIATING",
                base_weight=0.18,
                physical_reason="غياب المطر يُثبت أن الرطوبة مصدرها اصطناعي",
                condition={"type": "threshold", "operator": "<=", "value": 5.0, "unit": "mm",
                          "if_true": "STRONG_BOOST", "if_false": "MODERATE_PENALTY"},
            ),
            EvidenceRule(
                evidence_id="PRECIPITATION_7D",
                evidence_type="PHYSICAL_FACT",
                role="REFUTING",
                base_weight=0.20,
                physical_reason="مطر حديث (< 7 أيام) يُفسِّر الرطوبة بشكل طبيعي",
                condition={"type": "threshold", "operator": ">=", "value": 20.0, "unit": "mm",
                          "if_true": "NULLIFY"},
            ),
            EvidenceRule(
                evidence_id="POST_MAINTENANCE",
                evidence_type="PHYSICAL_FACT",
                role="REFUTING",
                base_weight=0.10,
                physical_reason="الصيانة تشمل رش وغسيل عادةً",
                condition={"type": "boolean", "if_true": "HALVE"},
            ),
            EvidenceRule(
                evidence_id="IRRIGATION_NEARBY",
                evidence_type="PHYSICAL_FACT",
                role="REFUTING",
                base_weight=0.12,
                physical_reason="الري القريب قد يُفسِّر الرطوبة جزئيًا",
                condition={"type": "boolean", "if_true": "REDUCE_30PCT"},
            ),
        ]

    def _irrigation_rules(self) -> list[EvidenceRule]:
        return [
            EvidenceRule(
                evidence_id="SOIL_MOISTURE",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.30,
                physical_reason="الري يرفع رطوبة التربة على مساحة واسعة",
                condition={"direction": "INCREASE", "min_z": 1.0, "boost_per_sigma": 0.08},
            ),
            EvidenceRule(
                evidence_id="IRRIGATION_NEARBY",
                evidence_type="PHYSICAL_FACT",
                role="CONFIRMING",
                base_weight=0.50,
                physical_reason="السياق يؤكد وجود ري نشط",
                condition={"type": "boolean", "if_true": "STRONG_BOOST",
                           "if_false": "NULLIFY"},
            ),
            EvidenceRule(
                evidence_id="PRECIPITATION_7D",
                evidence_type="PHYSICAL_FACT",
                role="NEUTRAL",
                base_weight=0.05,
                physical_reason="المطر الأخير لا يستبعد الري",
                condition={"type": "any"},
            ),
        ]

    def _rain_rules(self) -> list[EvidenceRule]:
        return [
            EvidenceRule(
                evidence_id="PRECIPITATION_7D",
                evidence_type="PHYSICAL_FACT",
                role="CONFIRMING",
                base_weight=0.60,
                physical_reason="وجود مطر حديث هو الدليل الأقوى لتأثير المطر",
                condition={"type": "threshold", "operator": ">=", "value": 10.0, "unit": "mm",
                          "if_true": "STRONG_BOOST", "if_false": "NULLIFY"},
            ),
            EvidenceRule(
                evidence_id="SOIL_MOISTURE",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.25,
                physical_reason="المطر يرفع رطوبة التربة على مساحة واسعة",
                condition={"direction": "INCREASE", "min_z": 1.0},
            ),
            EvidenceRule(
                evidence_id="PRECIPITATION_30D",
                evidence_type="PHYSICAL_FACT",
                role="NEUTRAL",
                base_weight=0.10,
                physical_reason="هطول الـ 30 يوم يعطي سياقًا",
                condition={"type": "any"},
            ),
        ]

    def _maintenance_rules(self) -> list[EvidenceRule]:
        return [
            EvidenceRule(
                evidence_id="POST_MAINTENANCE",
                evidence_type="PHYSICAL_FACT",
                role="CONFIRMING",
                base_weight=0.55,
                physical_reason="الصيانة الحديثة تشمل رش وغسيل",
                condition={"type": "boolean", "if_true": "STRONG_BOOST", "if_false": "NULLIFY"},
            ),
            EvidenceRule(
                evidence_id="SOIL_MOISTURE",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.30,
                physical_reason="مياه الصيانة في التربة",
                condition={"direction": "INCREASE", "min_z": 1.0},
                temporal_lag_days=(0, 14),
            ),
        ]

    def _subsidence_rules(self) -> list[EvidenceRule]:
        return [
            EvidenceRule(
                evidence_id="SAR_BACKSCATTER",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.40,
                physical_reason="هبوط الأرض يغير خصائص السطح الرادارية",
                condition={"direction": "DECREASE", "min_z": 2.0},
            ),
            EvidenceRule(
                evidence_id="SOIL_MOISTURE",
                evidence_type="DYNAMIC",
                role="NEUTRAL",
                base_weight=0.10,
                physical_reason="هبوط الأرض لا يؤثر مباشرة على الرطوبة السطحية",
                condition={"direction": "ANY"},
            ),
        ]

    def _data_error_rules(self) -> list[EvidenceRule]:
        return [
            EvidenceRule(
                evidence_id="SOIL_MOISTURE",
                evidence_type="DYNAMIC",
                role="CONFIRMING",
                base_weight=0.30,
                physical_reason="شذوذ في مصدر واحد فقط قد يكون خطأ",
                condition={"direction": "ANY", "single_source_only": True},
            ),
        ]


# =============================================================================
# Oil Pipeline Knowledge
# =============================================================================

class OilPipelineKnowledge(AssetKnowledge):
    """مثال على Framework الجنيس — نفس المحرك، معرفة مختلفة."""

    @property
    def asset_type(self) -> str:
        return "OIL_PIPELINE"

    def get_key_signals(self) -> list[str]:
        return ["SAR_BACKSCATTER", "SURFACE_TEMP", "VEGETATION_INDEX", "SOIL_MOISTURE"]

    def get_feature_weights(self) -> dict[str, float]:
        return {
            "SAR_BACKSCATTER":  0.35,
            "SURFACE_TEMP":     0.30,
            "VEGETATION_INDEX": 0.20,
            "SOIL_MOISTURE":    0.15,
        }

    def get_possible_events(self, context: dict | None = None) -> list[str]:
        return ["OIL_SPILL", "FIRE", "SUBSIDENCE", "EXCAVATION_DAMAGE",
                "ENCROACHMENT", "DATA_ERROR"]

    def get_impossible_events(self) -> list[str]:
        return ["WATER_LEAK", "IRRIGATION_EFFECT"]

    def get_base_prior(self, event_type: str, context: dict | None = None) -> float:
        priors = {
            "OIL_SPILL":        0.20,
            "SUBSIDENCE":       0.10,
            "FIRE":             0.10,
            "EXCAVATION_DAMAGE":0.10,
            "ENCROACHMENT":     0.10,
            "DATA_ERROR":       0.10,
        }
        return priors.get(event_type, 0.05)

    def get_evidence_rules(self, event_type: str, biome: str = "ARID") -> list[EvidenceRule]:
        if event_type == "OIL_SPILL":
            return [
                EvidenceRule(
                    evidence_id="SAR_BACKSCATTER",
                    evidence_type="DYNAMIC",
                    role="CONFIRMING",
                    base_weight=0.40,
                    physical_reason="النفط يغير خصائص السطح الرادارية بشكل مميز",
                    condition={"direction": "DECREASE", "min_z": 2.0},
                ),
                EvidenceRule(
                    evidence_id="SURFACE_TEMP",
                    evidence_type="DYNAMIC",
                    role="CONFIRMING",
                    base_weight=0.30,
                    physical_reason="النفط يرفع درجة حرارة السطح (امتصاص أشعة الشمس)",
                    condition={"direction": "INCREASE", "min_z": 1.5},
                ),
                EvidenceRule(
                    evidence_id="VEGETATION_INDEX",
                    evidence_type="DYNAMIC",
                    role="CONFIRMING",
                    base_weight=0.20,
                    physical_reason="النفط يُدمِّر الغطاء النباتي",
                    condition={"direction": "DECREASE", "min_z": 1.5},
                ),
            ]
        return []

    def get_causal_chain(self, event_type: str) -> list[CausalStep]:
        if event_type == "OIL_SPILL":
            return [
                CausalStep(1, "SAR_BACKSCATTER",  "DECREASE", 0, 3,  True),
                CausalStep(2, "SURFACE_TEMP",     "INCREASE", 0, 5,  True),
                CausalStep(3, "VEGETATION_INDEX", "DECREASE", 3, 14, False),
            ]
        return []


# =============================================================================
# Knowledge Registry — يربط asset_type بالـ Knowledge Class
# =============================================================================

_KNOWLEDGE_REGISTRY: dict[str, AssetKnowledge] = {
    "WATER_PIPELINE": WaterPipelineKnowledge(),
    "OIL_PIPELINE":   OilPipelineKnowledge(),
}


def get_knowledge(asset_type: str) -> AssetKnowledge:
    """يُعيد AssetKnowledge المناسب. يرمي خطأ إذا لم يكن مُسجَّلًا."""
    knowledge = _KNOWLEDGE_REGISTRY.get(asset_type)
    if not knowledge:
        raise ValueError(
            f"No knowledge registered for asset type: '{asset_type}'. "
            f"Available: {list(_KNOWLEDGE_REGISTRY.keys())}"
        )
    return knowledge


def register_knowledge(knowledge: AssetKnowledge):
    """يُسجِّل نوع أصل جديد في وقت التشغيل (Runtime Extension)."""
    _KNOWLEDGE_REGISTRY[knowledge.asset_type] = knowledge
