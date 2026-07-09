"""
Living Knowledge Graph — قلب Phase 2.

المبدأ الأساسي: الـ Graph ليس قاعدة بيانات ثابتة.
هو محرك حي يُحدِّث نفسه من نتائج التحقق الميداني.

كل حافة (edge) في الـ Graph تحمل:
  - وزن أولي: مبني على الفيزياء (خبرة بشرية)
  - سجل تحديث: كل تحقق ميداني يُثبت أو ينفي
  - قوة العلاقة: تتطور تلقائيًا

بعد سنة من التحقق الميداني:
  - الحواف الصحيحة تصبح قوية جدًا
  - الحواف الخاطئة تضعف وتختفي
  - حواف جديدة تُكتشف من الأنماط المتكررة

ADR-011: Generic — يعمل مع أي domain
ADR-012: Adjustable weights من نتائج الميدان
"""
from __future__ import annotations
import networkx as nx
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Literal
import json

# =============================================================================
# Node و Edge Types
# =============================================================================

NodeType = Literal[
    "SIGNAL",         # إشارة فيزيائية قابلة للقياس
    "EVENT",          # حدث يمكن أن يقع
    "ROOT_CAUSE",     # سبب جذري
    "ASSET_TYPE",     # نوع الأصل
    "CONTEXT",        # سياق (موسم/رطوبة/...)
    "PATTERN",        # نمط معروف
    "UNKNOWN_PATTERN",# نمط مجهول قيد التحقيق
    "CAUSAL_STEP",    # خطوة في تسلسل سببي
]

EdgeType = Literal[
    "SUPPORTS",         # إشارة تدعم حدثًا
    "REFUTES",          # إشارة ترفض حدثًا
    "CAUSED_BY",        # حدث ناتج عن سبب جذري
    "PRECEDES",         # إشارة تسبق إشارة أخرى زمنيًا (في سياق حدث)
    "MAY_CAUSE",        # حدث قد يُسبِّب حدثًا آخر (تسلسل)
    "EVOLVED_FROM",     # نمط معروف نشأ من نمط مجهول
    "CONFIRMED_BY",     # علاقة قُوِّيت بتحقق ميداني
    "DISPROVED_BY",     # علاقة ضُعِّفت بتحقق ميداني
    "CONTEXT_MODIFIER", # سياق يُعدِّل احتمال حدث
]


# =============================================================================
# Edge Data — حامل المعرفة الحية
# =============================================================================

@dataclass
class KGEdge:
    """
    كل حافة تحمل تاريخها الكامل.
    weight = القوة الحالية (0→1)
    يتحول مع كل تحقق ميداني.
    """
    edge_type: EdgeType
    weight: float                # القوة الحالية (يتطور)
    initial_weight: float        # الوزن الأولي (من الخبرة البشرية)
    conditions: dict = field(default_factory=dict)
    confirmation_count: int = 0
    refutation_count: int = 0
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_updated: Optional[str] = None
    update_history: list = field(default_factory=list)
    source: str = "expert_knowledge"   # من أين أتت؟

    @property
    def confidence(self) -> float:
        n = self.confirmation_count + self.refutation_count
        if n == 0:
            return 0.50   # neutral
        return self.confirmation_count / n

    @property
    def is_well_established(self) -> bool:
        return self.confirmation_count >= 5 and self.confidence >= 0.70

    @property
    def is_suspect(self) -> bool:
        return self.refutation_count >= 3 and self.confidence < 0.30


# =============================================================================
# Living Knowledge Graph
# =============================================================================

class LivingKnowledgeGraph:
    """
    محرك المعرفة الحي لـ MINERVA.

    يبدأ بمعرفة خبراء (Physics + Domain Knowledge).
    يتطور مع كل تحقق ميداني.
    يكتشف علاقات جديدة من الأنماط المتكررة.
    """

    LEARNING_RATE = 0.15   # معدل التعلم: كم يتغير الوزن في كل تحديث

    def __init__(self):
        self.G = nx.MultiDiGraph()
        self._edge_data: dict[tuple, KGEdge] = {}   # (u, v, key) → KGEdge
        self._discovery_log: list[dict] = []
        self._build_initial_knowledge()

    # =========================================================================
    # Graph Construction
    # =========================================================================

    def add_node(self, node_id: str, node_type: NodeType, **properties):
        self.G.add_node(node_id, type=node_type, **properties)

    def add_edge(
        self,
        source: str,
        target: str,
        edge_type: EdgeType,
        weight: float = 0.50,
        conditions: dict | None = None,
        source_label: str = "expert_knowledge",
    ) -> str:
        """يُضيف حافة وتُسجِّل في الـ edge_data. يُعيد مفتاح الحافة."""
        key = self.G.add_edge(source, target, edge_type=edge_type)
        edge = KGEdge(
            edge_type=edge_type,
            weight=weight,
            initial_weight=weight,
            conditions=conditions or {},
            source=source_label,
        )
        self._edge_data[(source, target, key)] = edge
        return str(key)

    # =========================================================================
    # Living Operations — التحديث الحي
    # =========================================================================

    def reinforce(
        self,
        source: str,
        target: str,
        evidence: str,
        edge_type: EdgeType = "SUPPORTS",
    ):
        """
        تحقق ميداني أكَّد هذه العلاقة → قوِّها.
        خوارزمية: new_w = old_w + α(1 - old_w)
        """
        edges = self._find_edges(source, target, edge_type)
        for key in edges:
            edge = self._edge_data[(source, target, key)]
            old_w = edge.weight
            edge.weight = min(1.0, old_w + self.LEARNING_RATE * (1.0 - old_w))
            edge.confirmation_count += 1
            edge.last_updated = datetime.utcnow().isoformat()
            edge.update_history.append({
                "action": "REINFORCE",
                "old_weight": round(old_w, 4),
                "new_weight": round(edge.weight, 4),
                "evidence": evidence,
                "timestamp": edge.last_updated,
            })

    def weaken(
        self,
        source: str,
        target: str,
        evidence: str,
        edge_type: EdgeType = "SUPPORTS",
    ):
        """
        تحقق ميداني نقض هذه العلاقة → ضعِّفها.
        خوارزمية: new_w = old_w - α × old_w
        """
        edges = self._find_edges(source, target, edge_type)
        for key in edges:
            edge = self._edge_data[(source, target, key)]
            old_w = edge.weight
            edge.weight = max(0.01, old_w - self.LEARNING_RATE * old_w)
            edge.refutation_count += 1
            edge.last_updated = datetime.utcnow().isoformat()
            edge.update_history.append({
                "action": "WEAKEN",
                "old_weight": round(old_w, 4),
                "new_weight": round(edge.weight, 4),
                "evidence": evidence,
                "timestamp": edge.last_updated,
            })

    def discover_relationship(
        self,
        source: str,
        target: str,
        edge_type: EdgeType,
        evidence: str,
        initial_weight: float = 0.30,
    ) -> bool:
        """
        يُضيف علاقة جديدة اكتُشفت من الأنماط المتكررة.
        يُسجِّل أنها "مكتشفة" وليست "معرفة خبراء".
        """
        if not (self.G.has_node(source) and self.G.has_node(target)):
            return False

        # هل هذه العلاقة موجودة مسبقًا؟
        existing = self._find_edges(source, target, edge_type)
        if existing:
            # قوِّي الموجودة
            self.reinforce(source, target, evidence, edge_type)
            return False

        # أضف علاقة جديدة
        self.add_edge(source, target, edge_type,
                      weight=initial_weight, source_label="discovered")
        self._discovery_log.append({
            "type": "NEW_RELATIONSHIP",
            "source": source,
            "target": target,
            "edge_type": edge_type,
            "evidence": evidence,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return True

    # =========================================================================
    # Query Operations
    # =========================================================================

    def get_event_supporters(
        self,
        event_id: str,
        min_weight: float = 0.20,
    ) -> list[tuple[str, float]]:
        """
        ما الإشارات التي تدعم هذا الحدث؟
        Returns: [(signal_id, weight), ...] مرتبة تنازليًا.
        """
        supporters = []
        for u, v, key, data in self.G.in_edges(event_id, keys=True, data=True):
            if data.get("edge_type") == "SUPPORTS":
                edge = self._edge_data.get((u, v, key))
                if edge and edge.weight >= min_weight:
                    supporters.append((u, edge.weight))
        return sorted(supporters, key=lambda x: x[1], reverse=True)

    def get_event_refuters(
        self,
        event_id: str,
        min_weight: float = 0.20,
    ) -> list[tuple[str, float]]:
        refuters = []
        for u, v, key, data in self.G.in_edges(event_id, keys=True, data=True):
            if data.get("edge_type") == "REFUTES":
                edge = self._edge_data.get((u, v, key))
                if edge and edge.weight >= min_weight:
                    refuters.append((u, edge.weight))
        return sorted(refuters, key=lambda x: x[1], reverse=True)

    def get_root_causes(self, event_id: str) -> list[tuple[str, float]]:
        """الأسباب الجذرية لحدث معين مع احتمالاتها."""
        causes = []
        for u, v, key, data in self.G.out_edges(event_id, keys=True, data=True):
            if data.get("edge_type") == "CAUSED_BY":
                edge = self._edge_data.get((u, v, key))
                if edge:
                    causes.append((v, edge.weight))
        return sorted(causes, key=lambda x: x[1], reverse=True)

    def get_causal_chain(self, event_id: str) -> list[dict]:
        """التسلسل السببي للإشارات المتوقعة بعد حدوث الحدث."""
        chain = []
        for u, v, key, data in self.G.out_edges(event_id, keys=True, data=True):
            if data.get("edge_type") == "PRECEDES":
                edge = self._edge_data.get((u, v, key))
                if edge:
                    chain.append({
                        "signal": v,
                        "direction": edge.conditions.get("direction", "?"),
                        "lag_days": edge.conditions.get("lag_days", (0, 7)),
                        "weight": edge.weight,
                    })
        chain.sort(key=lambda x: x["lag_days"][0])
        return chain

    def find_reasoning_path(
        self, source: str, target: str, max_depth: int = 4
    ) -> list[list[str]]:
        """يجد مسارات الاستدلال بين عقدتين."""
        try:
            paths = list(nx.all_simple_paths(self.G, source, target, cutoff=max_depth))
            return paths[:5]   # أفضل 5 مسارات
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def get_knowledge_stats(self) -> dict:
        nodes_by_type: dict[str, int] = {}
        for n, data in self.G.nodes(data=True):
            t = data.get("type", "UNKNOWN")
            nodes_by_type[t] = nodes_by_type.get(t, 0) + 1

        confirmed_edges = sum(
            1 for e in self._edge_data.values() if e.confirmation_count > 0
        )
        discovered_edges = sum(
            1 for e in self._edge_data.values() if e.source == "discovered"
        )

        return {
            "total_nodes": self.G.number_of_nodes(),
            "total_edges": self.G.number_of_edges(),
            "nodes_by_type": nodes_by_type,
            "confirmed_edges": confirmed_edges,
            "discovered_edges": discovered_edges,
            "discovery_log_entries": len(self._discovery_log),
        }

    def get_edge_data(self, source: str, target: str, edge_type: str) -> list[KGEdge]:
        keys = self._find_edges(source, target, edge_type)
        return [self._edge_data[(source, target, k)] for k in keys
                if (source, target, k) in self._edge_data]

    # =========================================================================
    # Private Helpers
    # =========================================================================

    def _find_edges(self, source: str, target: str, edge_type: str) -> list[int]:
        if not self.G.has_edge(source, target):
            return []
        return [
            k for k, d in self.G[source][target].items()
            if d.get("edge_type") == edge_type
        ]

    # =========================================================================
    # Initial Knowledge Seeding — بذر المعرفة الأولية
    # =========================================================================

    def _build_initial_knowledge(self):
        """
        يُحمِّل المعرفة الفيزيائية الأولية.
        هذا هو "الدماغ المولود" — ما يعرفه النظام من اليوم الأول.
        """
        self._seed_signals()
        self._seed_events()
        self._seed_root_causes()
        self._seed_asset_types()
        self._seed_signal_event_relationships()
        self._seed_causal_chains()
        self._seed_root_cause_relationships()
        self._seed_context_modifiers()

    def _seed_signals(self):
        signals = [
            ("SOIL_MOISTURE",    "رطوبة التربة السطحية (0-10cm)"),
            ("SURFACE_TEMP",     "درجة حرارة سطح التربة"),
            ("SAR_BACKSCATTER",  "شدة الانعكاس الراداري VV"),
            ("VEGETATION_INDEX", "مؤشر النشاط النباتي"),
            ("INSAR_DISPLACEMENT","إزاحة السطح الرأسية"),
            ("DEM_CHANGE",       "تغير الارتفاع الرقمي"),
            ("PRECIPITATION",    "الهطول المطري"),
            ("SAR_TEXTURE",      "نسيج صورة الرادار"),
            ("SOIL_TEMP",        "درجة حرارة التربة"),
        ]
        for sig_id, desc in signals:
            self.add_node(sig_id, "SIGNAL", description=desc)

    def _seed_events(self):
        events = [
            ("WATER_LEAK",       "تسرب مياه من أنبوب أو خزان"),
            ("OIL_SPILL",        "انسكاب نفط أو مواد هيدروكربونية"),
            ("SUBSIDENCE",       "هبوط أرض أو انخساف"),
            ("EROSION",          "تجريف أو تآكل تربة"),
            ("CONSTRUCTION",     "بناء أو إنشاء جديد"),
            ("FIRE",             "حريق أو احتراق"),
            ("ENCROACHMENT",     "اعتداء على حرم الأصل"),
            ("PIPE_BREAK",       "كسر كامل في الأنبوب"),
            ("IRRIGATION_EFFECT","تأثير الري الزراعي القريب"),
            ("NATURAL_RAIN",     "تأثير الهطول المطري الطبيعي"),
            ("MAINTENANCE",      "أعمال صيانة مجدولة"),
        ]
        for ev_id, desc in events:
            self.add_node(ev_id, "EVENT", description=desc)

    def _seed_root_causes(self):
        causes = [
            ("RC_PIPE_AGING",        "تقادم الأنبوب وتدهور المادة"),
            ("RC_CORROSION",         "تآكل كيميائي أو كهروكيميائي"),
            ("RC_HIGH_PRESSURE",     "ضغط تشغيل مرتفع"),
            ("RC_SOIL_MOVEMENT",     "حركة التربة أو الانكماش"),
            ("RC_THIRD_PARTY_DMG",   "ضرر من طرف ثالث (حفر، بناء)"),
            ("RC_MANUFACTURING_DEFECT","عيب تصنيعي"),
            ("RC_SEISMIC",           "نشاط زلزالي"),
            ("RC_OVERLOAD",          "حمل زائد على البنية التحتية"),
            ("RC_DROUGHT_STRESS",    "إجهاد جفاف ودورات تمدد/انكماش"),
            ("RC_VEGETATION_ROOTS",  "جذور النباتات"),
        ]
        for rc_id, desc in causes:
            self.add_node(rc_id, "ROOT_CAUSE", description=desc)

    def _seed_asset_types(self):
        for at in ["WATER_PIPELINE", "OIL_PIPELINE", "POWER_LINE", "DAM", "ROAD"]:
            self.add_node(at, "ASSET_TYPE")

    def _seed_signal_event_relationships(self):
        """
        علاقات الإشارات بالأحداث — قلب المعرفة الفيزيائية.
        الأوزان مبنية على:
          - قوة العلاقة الفيزيائية
          - تميُّز الإشارة لهذا الحدث (هل تظهر في أحداث أخرى؟)
        """
        relationships = [
            # --- WATER_LEAK ---
            ("SOIL_MOISTURE",    "WATER_LEAK",   "SUPPORTS", 0.85, {"direction": "INCREASE", "min_z": 2.0}),
            ("SURFACE_TEMP",     "WATER_LEAK",   "SUPPORTS", 0.75, {"direction": "DECREASE", "min_z": 1.5}),
            ("SAR_BACKSCATTER",  "WATER_LEAK",   "SUPPORTS", 0.65, {"direction": "DECREASE", "min_z": 1.2}),
            ("VEGETATION_INDEX", "WATER_LEAK",   "SUPPORTS", 0.45, {"direction": "INCREASE", "lag_weeks": 2}),
            ("PRECIPITATION",    "WATER_LEAK",   "REFUTES",  0.80, {"condition": "HIGH_RECENT", "mm_7d": 20}),

            # --- OIL_SPILL ---
            ("SAR_BACKSCATTER",  "OIL_SPILL",    "SUPPORTS", 0.80, {"direction": "DECREASE", "min_z": 2.5}),
            ("SURFACE_TEMP",     "OIL_SPILL",    "SUPPORTS", 0.75, {"direction": "INCREASE", "min_z": 2.0}),
            ("VEGETATION_INDEX", "OIL_SPILL",    "SUPPORTS", 0.70, {"direction": "DECREASE", "min_z": 2.0}),
            ("SOIL_MOISTURE",    "OIL_SPILL",    "REFUTES",  0.60, {"condition": "HIGH", "min_z": 2.0}),

            # --- SUBSIDENCE ---
            ("INSAR_DISPLACEMENT","SUBSIDENCE",  "SUPPORTS", 0.95, {"direction": "NEGATIVE_LOS"}),
            ("DEM_CHANGE",       "SUBSIDENCE",   "SUPPORTS", 0.85, {"direction": "DECREASE"}),
            ("SAR_TEXTURE",      "SUBSIDENCE",   "SUPPORTS", 0.55, {"direction": "CHANGE"}),
            ("SOIL_MOISTURE",    "SUBSIDENCE",   "SUPPORTS", 0.40, {"direction": "INCREASE", "lag_weeks": 4}),

            # --- CONSTRUCTION ---
            ("VEGETATION_INDEX", "CONSTRUCTION", "SUPPORTS", 0.80, {"direction": "DECREASE", "instant": True}),
            ("SAR_BACKSCATTER",  "CONSTRUCTION", "SUPPORTS", 0.70, {"direction": "INCREASE", "roughness": True}),
            ("SURFACE_TEMP",     "CONSTRUCTION", "SUPPORTS", 0.55, {"direction": "INCREASE", "bare_soil": True}),

            # --- IRRIGATION ---
            ("SOIL_MOISTURE",    "IRRIGATION_EFFECT", "SUPPORTS", 0.70, {"direction": "INCREASE", "spatial": "DIFFUSE"}),
            ("VEGETATION_INDEX", "IRRIGATION_EFFECT", "SUPPORTS", 0.60, {"direction": "INCREASE", "seasonal": True}),

            # --- NATURAL_RAIN ---
            ("SOIL_MOISTURE",    "NATURAL_RAIN", "SUPPORTS", 0.80, {"direction": "INCREASE", "spatial": "AREA_WIDE"}),
            ("SAR_BACKSCATTER",  "NATURAL_RAIN", "SUPPORTS", 0.65, {"direction": "INCREASE", "surface_wet": True}),
            ("PRECIPITATION",    "NATURAL_RAIN", "SUPPORTS", 0.95, {"condition": "MEASURED", "min_mm": 5}),
            ("PRECIPITATION",    "WATER_LEAK",   "REFUTES",  0.90, {"condition": "HIGH_7D", "threshold_mm": 20}),
        ]

        for sig, ev, rel_type, w, cond in relationships:
            self.add_edge(sig, ev, rel_type, weight=w, conditions=cond)

    def _seed_causal_chains(self):
        """
        التسلسل السببي الزمني — أي إشارة تظهر أولًا؟
        مهم للتمييز بين الأحداث التي تُنتج إشارات مشابهة.
        """
        # WATER_LEAK: تسلسل زمني محدد
        leak_chain = [
            ("WATER_LEAK", "SOIL_MOISTURE",    {"direction": "INCREASE", "lag_days": (0, 5),  "step": 1}),
            ("WATER_LEAK", "SURFACE_TEMP",     {"direction": "DECREASE", "lag_days": (1, 10), "step": 2}),
            ("WATER_LEAK", "SAR_BACKSCATTER",  {"direction": "DECREASE", "lag_days": (0, 10), "step": 3}),
            ("WATER_LEAK", "VEGETATION_INDEX", {"direction": "INCREASE", "lag_days": (14, 35),"step": 4}),
        ]
        for event, signal, cond in leak_chain:
            self.add_edge(event, signal, "PRECEDES", weight=0.80, conditions=cond)

        # NATURAL_RAIN: تسلسل مختلف (كل الإشارات تتغير في نفس اليوم)
        rain_chain = [
            ("NATURAL_RAIN", "SOIL_MOISTURE",    {"direction": "INCREASE", "lag_days": (0, 2), "step": 1}),
            ("NATURAL_RAIN", "SAR_BACKSCATTER",  {"direction": "INCREASE", "lag_days": (0, 2), "step": 1}),  # ← عكس التسرب
            ("NATURAL_RAIN", "SURFACE_TEMP",     {"direction": "DECREASE", "lag_days": (0, 3), "step": 2}),
        ]
        for event, signal, cond in rain_chain:
            self.add_edge(event, signal, "PRECEDES", weight=0.75, conditions=cond)

    def _seed_root_cause_relationships(self):
        """الحوادث وأسبابها الجذرية — مع احتمالات مبنية على الإحصاء."""
        causes = [
            # WATER_LEAK root causes (احتمالات مبنية على دراسات الصناعة)
            ("WATER_LEAK", "RC_PIPE_AGING",      0.35),
            ("WATER_LEAK", "RC_CORROSION",       0.25),
            ("WATER_LEAK", "RC_THIRD_PARTY_DMG", 0.20),
            ("WATER_LEAK", "RC_HIGH_PRESSURE",   0.10),
            ("WATER_LEAK", "RC_SOIL_MOVEMENT",   0.07),
            ("WATER_LEAK", "RC_MANUFACTURING_DEFECT", 0.03),

            # SUBSIDENCE root causes
            ("SUBSIDENCE", "RC_SOIL_MOVEMENT",   0.40),
            ("SUBSIDENCE", "RC_DROUGHT_STRESS",  0.25),
            ("SUBSIDENCE", "RC_SEISMIC",         0.15),
            ("SUBSIDENCE", "RC_OVERLOAD",        0.10),
            ("SUBSIDENCE", "RC_VEGETATION_ROOTS",0.10),

            # CONSTRUCTION always third-party
            ("CONSTRUCTION", "RC_THIRD_PARTY_DMG", 0.90),
            ("CONSTRUCTION", "RC_OVERLOAD",         0.10),
        ]
        for event, cause, prob in causes:
            self.add_edge(event, cause, "CAUSED_BY", weight=prob)

    def _seed_context_modifiers(self):
        """السياق يُعدِّل احتمالات الأحداث."""
        ctx_mods = [
            # الصيانة الحديثة تُقلِّل احتمال التسرب الحاد
            ("CONTEXT_POST_MAINT",    "WATER_LEAK",   "CONTEXT_MODIFIER", 0.50,
             {"effect": "REDUCE_50PCT", "reason": "inspection reduces acute failure probability"}),
            # الري النشط يُقلِّل احتمال تشخيص التسرب
            ("CONTEXT_IRRIGATION",    "WATER_LEAK",   "CONTEXT_MODIFIER", 0.40,
             {"effect": "ALTERNATIVE_EXPLANATION"}),
            ("CONTEXT_IRRIGATION",    "IRRIGATION_EFFECT", "CONTEXT_MODIFIER", 2.0,
             {"effect": "STRONG_BOOST"}),
        ]
        for src, tgt, etype, w, cond in ctx_mods:
            self.add_node(src, "CONTEXT")
            self.add_edge(src, tgt, etype, weight=w, conditions=cond)
