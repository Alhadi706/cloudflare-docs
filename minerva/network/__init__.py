"""
MINERVA Phase 11 — Network Intelligence
========================================
Models relationships between MonitoringTargets and propagates
risk and anomaly signals through the network.

Key insight: Failures rarely happen in isolation.
  • A leaking pipeline affects soil moisture in adjacent targets
  • A subsidence event may indicate a wider network problem
  • Two targets sharing the same water main have correlated failure modes

Network types modelled:
  HYDRAULIC:   upstream/downstream pressure relationships
  SPATIAL:     geographic proximity (shared soil, weather)
  OPERATIONAL: same maintenance crew, shared inspection schedule
  STRUCTURAL:  same pipe material, same construction year

Usage:
  graph = TargetNetwork()
  graph.add_edge("PIPE-001", "PIPE-002", "HYDRAULIC", coupling=0.7)
  propagated = graph.propagate_risk("PIPE-001", source_anomaly_prob=0.85)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Tuple, Any
from enum import Enum


class RelationshipType(str, Enum):
    HYDRAULIC    = "HYDRAULIC"    # ضغط / تدفق مشترك
    SPATIAL      = "SPATIAL"      # قرب جغرافي (< 500m)
    STRUCTURAL   = "STRUCTURAL"   # نفس المادة / نفس سنة الإنشاء
    OPERATIONAL  = "OPERATIONAL"  # نفس فريق الصيانة
    DEPENDENCY   = "DEPENDENCY"   # تبعية تشغيلية (B يعتمد على A)


@dataclass
class NetworkEdge:
    """علاقة بين هدفين."""
    source_id:        str
    target_id:        str
    relationship_type: RelationshipType
    coupling:         float   # قوة التأثير 0.0-1.0
    direction:        str     # 'BIDIRECTIONAL' | 'SOURCE_TO_TARGET'
    description:      str = ""


@dataclass
class RiskPropagationResult:
    """نتيجة نشر الخطر عبر الشبكة."""
    origin_target_id:    str
    origin_anomaly_prob: float
    propagated_risks:    Dict[str, float]   # target_id → adjusted probability
    affected_targets:    List[str]
    propagation_path:    List[Tuple[str, str, float]]  # (from, to, contribution)
    network_alert_level: str   # 'LOCAL' | 'CLUSTER' | 'NETWORK_WIDE'


class TargetNetwork:
    """
    شبكة من العلاقات بين أهداف المراقبة.
    """

    def __init__(self):
        self._edges: List[NetworkEdge] = []
        self._adjacency: Dict[str, List[NetworkEdge]] = {}

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        relationship_type: RelationshipType,
        coupling: float,
        direction: str = "BIDIRECTIONAL",
        description: str = "",
    ) -> None:
        edge = NetworkEdge(
            source_id, target_id, relationship_type,
            max(0.0, min(1.0, coupling)), direction, description
        )
        self._edges.append(edge)
        self._adjacency.setdefault(source_id, []).append(edge)
        if direction == "BIDIRECTIONAL":
            rev = NetworkEdge(
                target_id, source_id, relationship_type,
                coupling * 0.8,  # التأثير العكسي أقل قليلاً
                direction, description
            )
            self._adjacency.setdefault(target_id, []).append(rev)

    def propagate_risk(
        self,
        origin_id: str,
        source_anomaly_prob: float,
        max_hops: int = 3,
    ) -> RiskPropagationResult:
        """
        يُوزّع الخطر من هدف مصدر إلى الأهداف المجاورة.
        يستخدم نموذج انتشار مُتدهور: كل قفزة تُضعف التأثير.
        """
        visited:  Dict[str, float] = {origin_id: source_anomaly_prob}
        queue:    List[Tuple[str, float, int]] = [(origin_id, source_anomaly_prob, 0)]
        path:     List[Tuple[str, str, float]] = []

        while queue:
            current_id, current_prob, hop = queue.pop(0)
            if hop >= max_hops:
                continue

            for edge in self._adjacency.get(current_id, []):
                neighbor = edge.target_id
                # تأثير يتراجع مع المسافة
                propagated = current_prob * edge.coupling * math.exp(-0.5 * hop)
                propagated = max(0.0, min(0.99, propagated))

                if neighbor not in visited or visited[neighbor] < propagated:
                    visited[neighbor] = propagated
                    path.append((current_id, neighbor, propagated))
                    if propagated > 0.05:  # لا نشر تأثيرات ضئيلة جداً
                        queue.append((neighbor, propagated, hop + 1))

        # إزالة المصدر من النتائج
        propagated_risks = {k: round(v, 3) for k, v in visited.items() if k != origin_id}
        affected = [k for k, v in propagated_risks.items() if v > 0.20]

        # تحديد مستوى الإنذار الشبكي
        n_high = sum(1 for v in propagated_risks.values() if v > 0.60)
        n_med  = sum(1 for v in propagated_risks.values() if v > 0.30)
        if n_high >= 3:
            net_level = "NETWORK_WIDE"
        elif n_med >= 2:
            net_level = "CLUSTER"
        else:
            net_level = "LOCAL"

        return RiskPropagationResult(
            origin_target_id    = origin_id,
            origin_anomaly_prob = source_anomaly_prob,
            propagated_risks    = propagated_risks,
            affected_targets    = affected,
            propagation_path    = path,
            network_alert_level = net_level,
        )

    def get_neighbors(
        self, target_id: str, relationship_type: Optional[RelationshipType] = None
    ) -> List[str]:
        """قائمة الأهداف المجاورة."""
        edges = self._adjacency.get(target_id, [])
        if relationship_type:
            edges = [e for e in edges if e.relationship_type == relationship_type]
        return [e.target_id for e in edges]

    def get_network_summary(self) -> Dict[str, Any]:
        return {
            "n_edges":   len(self._edges),
            "n_targets": len(self._adjacency),
            "edge_types": {rt.value: sum(1 for e in self._edges if e.relationship_type == rt)
                           for rt in RelationshipType},
        }
