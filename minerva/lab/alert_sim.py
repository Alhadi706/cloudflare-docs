"""
MINERVA Lab — Alert Simulator
================================
Generates synthetic operational alerts ONLY for UI/workflow testing.

STRICT ISOLATION RULES:
  1. Every simulated alert carries {"is_test_data": True}
  2. Never stored in production tables
  3. Stored only in minerva_lab.simulated_alerts
  4. Never trigger real notifications
  5. Dashboard must show "TEST" badge on all simulated items

Usage:
  sim = AlertSimulator(experiment_id="UI-TEST-001")
  alerts = sim.generate_scenario_alerts("WATER_LEAK_TRIPOLI_001", n=5)
"""

from __future__ import annotations

import uuid
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from minerva.lab import TEST_DATA_MARKER


@dataclass
class SimulatedAlert:
    """
    A synthetic alert for UI/workflow testing.
    ALWAYS tagged as test data — never mixes with production.
    """
    alert_id:         str
    title:            str
    severity:         str
    status:           str = "NEW"
    mission_name:     str = ""
    target_name:      str = ""
    recommended_action: str = ""
    risk_level_text:  str = ""
    lat:              float = 0.0
    lon:              float = 0.0
    detected_at:      datetime = field(default_factory=datetime.now)
    assigned_to:      Optional[str] = None

    # ISOLATION: these fields MUST always be set
    is_test_data:         bool = True
    test_data_marker:     str  = TEST_DATA_MARKER
    lab_experiment_id:    str  = "UNKNOWN"

    def to_dict(self) -> Dict[str, Any]:
        d = self.__dict__.copy()
        d["detected_at"] = self.detected_at.isoformat()
        assert d["is_test_data"] is True, "SAFETY: test data marker must be True"
        assert d["test_data_marker"] == TEST_DATA_MARKER
        return d


class AlertSimulator:
    """
    Generates synthetic alerts for UI and workflow testing.
    """

    SEVERITIES  = ["WATCH", "WARNING", "ALERT", "CRITICAL"]
    SEVERITIES_W= [0.30,    0.40,      0.20,    0.10]   # probability weights

    MISSIONS = [
        "كشف تسربات المياه",
        "مراقبة صحة الغطاء النباتي",
        "حماية حرم خط الأنابيب",
        "مراقبة تقادم البنية التحتية",
    ]
    TARGETS = [
        "خط مياه الميناء — 032",
        "خط مياه الجنوب — 015",
        "مضخة المنطقة الغربية",
        "حقل بنغازي — القطعة أ",
        "خط الأنابيب الرئيسي — المقطع 7",
    ]
    ACTIONS = [
        "إرسال فريق ميداني لفحص ضغط الخط",
        "مراجعة خطة الري وتحليل التربة",
        "مسح ميداني للكشف عن الحفريات",
        "جدولة صيانة دورية خلال 30 يوماً",
        "فحص طارئ فوري",
    ]

    # Tripoli area bounding box for random coordinates
    LAT_RANGE = (32.70, 32.95)
    LON_RANGE = (13.05, 13.30)

    def __init__(self, experiment_id: str = "UNKNOWN"):
        self.experiment_id = experiment_id

    def generate(
        self,
        n: int = 10,
        severity_distribution: Optional[List[float]] = None,
        seed: Optional[int] = None,
    ) -> List[SimulatedAlert]:
        """Generate n random synthetic alerts (test data only)."""
        if seed is not None:
            random.seed(seed)

        weights = severity_distribution or self.SEVERITIES_W
        alerts  = []

        for i in range(n):
            severity = random.choices(self.SEVERITIES, weights=weights, k=1)[0]
            mission  = random.choice(self.MISSIONS)
            target   = random.choice(self.TARGETS)
            action   = random.choice(self.ACTIONS)
            conf     = round(random.uniform(0.45, 0.92), 2)
            days     = random.randint(14, 180)

            alert = SimulatedAlert(
                alert_id           = f"SIM-{uuid.uuid4().hex[:8].upper()}",
                title              = f"[تجريبي] {severity}: {mission} — {target}",
                severity           = severity,
                status             = random.choice(["NEW", "NEW", "ACKNOWLEDGED", "IN_PROGRESS"]),
                mission_name       = mission,
                target_name        = target,
                recommended_action = action,
                risk_level_text    = f"احتمال عالٍ ({int(conf*100)}%)",
                lat  = round(random.uniform(*self.LAT_RANGE), 5),
                lon  = round(random.uniform(*self.LON_RANGE), 5),
                detected_at= datetime.now() - timedelta(hours=random.randint(0, 72)),
                is_test_data       = True,
                test_data_marker   = TEST_DATA_MARKER,
                lab_experiment_id  = self.experiment_id,
            )
            alerts.append(alert)

        return alerts

    def generate_escalation_sequence(
        self,
        hours: List[float] = [0, 4, 12, 24],
        severity: str = "ALERT",
    ) -> List[Dict[str, Any]]:
        """
        Generate a sequence of escalation events for testing
        the escalation engine UI.
        """
        base_time = datetime.now() - timedelta(hours=max(hours))
        alert_id  = f"SIM-{uuid.uuid4().hex[:8].upper()}"
        sequence  = []
        for h in hours:
            sequence.append({
                "alert_id":         alert_id,
                "timestamp":        (base_time + timedelta(hours=h)).isoformat(),
                "event_type":       "ESCALATION" if h > 0 else "CREATED",
                "level":            min(int(h / 4), 3),
                "is_test_data":     True,
                "test_data_marker": TEST_DATA_MARKER,
                "lab_experiment_id": self.experiment_id,
            })
        return sequence
