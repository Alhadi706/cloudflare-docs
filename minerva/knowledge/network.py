"""
Asset Relationship Network — شبكة علاقات الأصول.

الأصول لا تعمل بمعزل. خط الأنابيب مرتبط بالمحطة التي قبله والخزان الذي بعده.
الشذوذ في أصل قد يكون أثرًا لحدث في أصل آخر.

هذه الوحدة:
  1. تُمثِّل الشبكة الفيزيائية للأصول
  2. تُشغِّل propagation analysis: إذا تأثر X، ما الذي يجب فحصه؟
  3. تُعزِّز الثقة عند تزامن الشذوذات في أصول مترابطة
  4. تكتشف Cluster Events (حادثة واحدة تؤثر على عدة أصول)
"""
from __future__ import annotations
import networkx as nx
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional, Literal


ConnectionType = Literal[
    "PHYSICAL_FLOW",       # تدفق مياه/نفط/كهرباء
    "STRUCTURAL_SUPPORT",  # دعم هيكلي (مبنى على جسر)
    "HYDRAULIC_DOMAIN",    # علاقة هيدرولوجية (upstream/downstream)
    "GEOGRAPHIC_PROXIMITY",# تجاور جغرافي مهم
    "OPERATIONAL_DEPENDENCY", # تبعية تشغيلية
]


@dataclass
class AssetConnection:
    source_id: str
    target_id: str
    connection_type: ConnectionType
    direction: Optional[str] = None   # "source_to_target", "bidirectional"
    flow_type: Optional[str] = None   # "water", "oil", "electricity"
    distance_m: Optional[float] = None
    criticality: float = 0.5          # 0→1


@dataclass
class PropagationResult:
    """ما يجب فحصه بعد اكتشاف شذوذ في أصل."""
    origin_asset: str
    propagation_depth: int
    assets_to_check: list[dict]        # {asset_id, reason, priority, direction}
    cluster_probability: float         # احتمال أن يكون حدثًا واحدًا
    recommended_action: str


@dataclass
class ClusterEvent:
    """حادثة واحدة تؤثر على عدة أصول."""
    cluster_id: str
    assets: list[str]
    anomaly_dates: dict[str, date]     # asset_id → date of anomaly
    temporal_spread_days: int
    spatial_correlation: float         # 0→1
    probable_cause: str


class AssetNetwork:
    """
    شبكة الأصول الفيزيائية.
    """

    def __init__(self):
        self.G = nx.DiGraph()
        self._assets: dict[str, dict] = {}       # asset_id → metadata
        self._anomaly_log: list[dict] = []        # سجل الشذوذات المكتشفة

    # =========================================================================
    # Network Construction
    # =========================================================================

    def register_asset(
        self,
        asset_id: str,
        asset_type: str,
        name_ar: str = "",
        criticality: float = 0.5,
        lat: float = 0.0,
        lon: float = 0.0,
        **metadata,
    ):
        self._assets[asset_id] = {
            "type": asset_type,
            "name_ar": name_ar,
            "criticality": criticality,
            "lat": lat,
            "lon": lon,
            **metadata,
        }
        self.G.add_node(
            asset_id,
            asset_type=asset_type,
            criticality=criticality,
        )

    def connect(
        self,
        source_id: str,
        target_id: str,
        connection_type: ConnectionType,
        direction: str = "source_to_target",
        flow_type: str = "",
        criticality: float = 0.7,
    ):
        """يُنشئ اتصالًا بين أصلين."""
        self.G.add_edge(
            source_id, target_id,
            connection_type=connection_type,
            direction=direction,
            flow_type=flow_type,
            criticality=criticality,
        )
        if direction == "bidirectional":
            self.G.add_edge(
                target_id, source_id,
                connection_type=connection_type,
                direction="bidirectional",
                flow_type=flow_type,
                criticality=criticality,
            )

    # =========================================================================
    # Propagation Analysis
    # =========================================================================

    def analyze_propagation(
        self,
        origin_asset: str,
        anomaly_score: float,
        diagnosed_event: str,
        max_depth: int = 3,
    ) -> PropagationResult:
        """
        إذا حدث شيء في origin_asset، ما الذي يجب فحصه؟
        يُحدِّد الأصول المرتبطة وأولويات الفحص.
        """
        if origin_asset not in self.G:
            return PropagationResult(
                origin_asset=origin_asset,
                propagation_depth=0,
                assets_to_check=[],
                cluster_probability=0.0,
                recommended_action="Asset not in network — register it first",
            )

        assets_to_check = []

        # BFS على الشبكة
        visited = {origin_asset}
        queue = [(origin_asset, 0)]

        while queue:
            current, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            for neighbor in self.G.successors(current):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                queue.append((neighbor, depth + 1))

                edge_data = self.G[current][neighbor]
                conn_type = edge_data.get("connection_type", "")
                criticality = edge_data.get("criticality", 0.5)

                # حساب الأولوية بناءً على نوع الاتصال والعمق
                priority_score = criticality * (1 / (depth + 1))

                reason = self._build_check_reason(
                    origin_asset, neighbor, diagnosed_event, conn_type, depth + 1
                )

                assets_to_check.append({
                    "asset_id": neighbor,
                    "asset_type": self._assets.get(neighbor, {}).get("type", "UNKNOWN"),
                    "name_ar": self._assets.get(neighbor, {}).get("name_ar", ""),
                    "connection_type": conn_type,
                    "network_distance": depth + 1,
                    "priority_score": round(priority_score, 3),
                    "reason": reason,
                    "direction": "downstream" if depth == 0 else "connected",
                })

        assets_to_check.sort(key=lambda x: x["priority_score"], reverse=True)

        # احتمال Cluster Event
        cluster_prob = self._estimate_cluster_probability(
            origin_asset, diagnosed_event, anomaly_score
        )

        action = self._recommend_action(assets_to_check, cluster_prob)

        return PropagationResult(
            origin_asset=origin_asset,
            propagation_depth=max_depth,
            assets_to_check=assets_to_check,
            cluster_probability=cluster_prob,
            recommended_action=action,
        )

    def log_anomaly(
        self,
        asset_id: str,
        obs_date: date,
        anomaly_score: float,
        diagnosed_event: str,
    ):
        """يُسجِّل شذوذ في سجل الأحداث."""
        self._anomaly_log.append({
            "asset_id": asset_id,
            "date": obs_date,
            "score": anomaly_score,
            "event": diagnosed_event,
        })

    def detect_cluster_events(
        self,
        time_window_days: int = 14,
    ) -> list[ClusterEvent]:
        """
        يكتشف إذا كانت عدة شذوذات في أصول مترابطة تشير لحادثة واحدة.
        """
        if len(self._anomaly_log) < 2:
            return []

        clusters = []
        used_anomalies = set()

        for i, a1 in enumerate(self._anomaly_log):
            if i in used_anomalies:
                continue

            cluster_assets = [a1["asset_id"]]
            cluster_dates = {a1["asset_id"]: a1["date"]}

            for j, a2 in enumerate(self._anomaly_log):
                if j <= i or j in used_anomalies:
                    continue

                # هل الفترة الزمنية قريبة؟
                date_diff = abs((a2["date"] - a1["date"]).days)
                if date_diff > time_window_days:
                    continue

                # هل الأصلان مترابطان في الشبكة؟
                if not (self.G.has_node(a1["asset_id"]) and
                        self.G.has_node(a2["asset_id"])):
                    continue

                try:
                    path_len = nx.shortest_path_length(
                        self.G, a1["asset_id"], a2["asset_id"]
                    )
                    if path_len <= 3:
                        cluster_assets.append(a2["asset_id"])
                        cluster_dates[a2["asset_id"]] = a2["date"]
                        used_anomalies.add(j)
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue

            if len(cluster_assets) >= 2:
                spread = (max(cluster_dates.values()) - min(cluster_dates.values())).days
                clusters.append(ClusterEvent(
                    cluster_id=f"CLUSTER-{len(clusters)+1:03d}",
                    assets=cluster_assets,
                    anomaly_dates=cluster_dates,
                    temporal_spread_days=spread,
                    spatial_correlation=min(1.0, 2 / len(cluster_assets)),
                    probable_cause=a1["event"],
                ))
                used_anomalies.add(i)

        return clusters

    # =========================================================================
    # Helpers
    # =========================================================================

    def _build_check_reason(
        self, origin: str, target: str, event: str,
        conn_type: str, depth: int
    ) -> str:
        reasons = {
            "PHYSICAL_FLOW": f"يتدفق الوسط من {origin} إلى {target} — التسرب قد يؤثر على الضغط",
            "HYDRAULIC_DOMAIN": f"{target} في نفس الحوض الهيدرولوجي — فحص المنسوب",
            "GEOGRAPHIC_PROXIMITY": f"{target} في نطاق قريب — قد يتأثر بنفس الحدث",
            "STRUCTURAL_SUPPORT": f"{target} يعتمد هيكليًا على {origin}",
        }
        return reasons.get(conn_type, f"مرتبط بـ {origin} من خلال الشبكة (عمق {depth})")

    def _estimate_cluster_probability(
        self, asset_id: str, event: str, score: float
    ) -> float:
        recent = [
            a for a in self._anomaly_log
            if a["asset_id"] != asset_id and a["score"] > 0.5
        ]
        if not recent:
            return 0.05
        n_connected = sum(
            1 for a in recent
            if self.G.has_node(a["asset_id"]) and
               self.G.has_node(asset_id) and
               nx.has_path(self.G, asset_id, a["asset_id"])
        )
        return min(0.90, 0.10 + n_connected * 0.20)

    def _recommend_action(self, to_check: list, cluster_prob: float) -> str:
        if cluster_prob > 0.60:
            return "احتمال حادثة شبكية — فحص منسق لجميع الأصول المرتبطة"
        if to_check:
            top = to_check[0]["asset_id"]
            return f"فحص {top} أولًا كأصل أعلى أولوية في الشبكة"
        return "لا أصول مرتبطة — الحادثة معزولة"

    def get_network_summary(self) -> dict:
        return {
            "total_assets": self.G.number_of_nodes(),
            "total_connections": self.G.number_of_edges(),
            "isolated_assets": sum(
                1 for n in self.G.nodes() if self.G.degree(n) == 0
            ),
            "anomaly_log_size": len(self._anomaly_log),
        }
