"""
MINERVA Phase 11 — MonitoringMission
=====================================
A MonitoringMission answers WHY a target is being monitored.

The same MonitoringTarget can be under multiple missions:
  PIPE-WTR-032 →  Mission A: WATER_LEAK_DETECTION
               →  Mission B: PIPELINE_PROTECTION
               →  Mission C: INFRASTRUCTURE_AGING

Each mission activates a different set of:
  • Signals of interest (which EO bands to weight)
  • Alert thresholds (NDMI < -0.08 for Mission A vs NDVI < 0.1 for Mission D)
  • Decision rules (logic that triggers an alert or recommendation)
  • Prediction horizon (leak detection: 30d, ageing: 365d)
  • Evidence requirements (what data is needed to be confident)
  • Decision actions (what can be done)

This architecture makes MINERVA a general-purpose platform:
  New sector = add new MissionType + thresholds + rules
  No change to the core engine needed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple


# ── Mission Types ─────────────────────────────────────────────────────────────

class MissionType(str, Enum):
    # Water / Utility Infrastructure
    WATER_LEAK_DETECTION     = "WATER_LEAK_DETECTION"
    PIPELINE_PROTECTION      = "PIPELINE_PROTECTION"
    INFRASTRUCTURE_AGING     = "INFRASTRUCTURE_AGING"
    PRESSURE_MONITORING      = "PRESSURE_MONITORING"

    # Agriculture
    CROP_HEALTH_MONITORING   = "CROP_HEALTH_MONITORING"
    IRRIGATION_EFFICIENCY    = "IRRIGATION_EFFICIENCY"
    SOIL_DEGRADATION         = "SOIL_DEGRADATION"

    # Environmental
    VEGETATION_HEALTH        = "VEGETATION_HEALTH"
    FLOOD_RISK               = "FLOOD_RISK"
    FIRE_MONITORING          = "FIRE_MONITORING"
    COASTAL_EROSION          = "COASTAL_EROSION"
    DESERTIFICATION          = "DESERTIFICATION"

    # Urban / Civil
    URBAN_EXPANSION          = "URBAN_EXPANSION"
    CONSTRUCTION_MONITORING  = "CONSTRUCTION_MONITORING"
    SUBSIDENCE_MONITORING    = "SUBSIDENCE_MONITORING"

    # Energy / Industrial
    FACILITY_SURVEILLANCE    = "FACILITY_SURVEILLANCE"
    OIL_SPILL_DETECTION      = "OIL_SPILL_DETECTION"

    # Custom
    CUSTOM                   = "CUSTOM"


class AlertSeverity(str, Enum):
    WATCH   = "WATCH"     # اتجاه سلبي، لم تُعبَر أي عتبة
    WARNING = "WARNING"   # اقتراب من العتبة
    ALERT   = "ALERT"     # شذوذ محتمل خلال < 14 يوم
    CRITICAL= "CRITICAL"  # تجاوز العتبة الحرجة


# ── Signal Threshold ──────────────────────────────────────────────────────────

@dataclass
class SignalThreshold:
    """
    MINERVA يراقب signal == 'NDMI' ويطلق إنذار إذا تجاوزت العتبة.
    كل Mission تحدد عتباتها الخاصة.
    """
    signal: str              # 'NDMI' | 'NDVI' | 'VV_dB' | 'LST_C' | custom
    watch_below:   Optional[float] = None   # أقل من هذه القيمة → WATCH
    warning_below: Optional[float] = None   # أقل من → WARNING
    alert_below:   Optional[float] = None   # أقل من → ALERT
    watch_above:   Optional[float] = None   # أعلى من → WATCH
    warning_above: Optional[float] = None
    alert_above:   Optional[float] = None
    trend_warn_per_day: Optional[float] = None  # معدل تغيير يومي يستدعي تحذيراً
    weight: float = 1.0                         # وزن هذه الإشارة في تقييم المهمة


# ── Decision Rule ─────────────────────────────────────────────────────────────

@dataclass
class DecisionRule:
    """
    قاعدة منطقية تُفعَّل عند تحقق شرط مركّب.
    تُكتب كنص وتُفسَّر بواسطة RuleEngine.

    مثال:
      condition:   "NDMI < -0.06 AND days_since_rain > 14 AND VV_dB > -4"
      conclusion:  "احتمال تسرب مياه تحت الأرض: عالٍ"
      action:      "FIELD_INSPECTION"
    """
    rule_id:   str
    condition: str      # DSL نصي: "NDMI < threshold AND trend < -0.0002"
    conclusion: str     # ماذا يعني هذا؟
    action:    str      # الإجراء المقترح
    severity:  AlertSeverity = AlertSeverity.WARNING
    confidence_required: float = 0.5  # الحد الأدنى للثقة لإطلاق هذه القاعدة


# ── Evidence Requirement ──────────────────────────────────────────────────────

@dataclass
class EvidenceRequirement:
    """ما يحتاجه هذا المهمة من بيانات لاتخاذ قرار موثوق."""
    source:          str      # 'sentinel-2' | 'sentinel-1' | 'ERP' | 'SCADA' | 'field_inspection'
    signal:          Optional[str] = None
    max_age_days:    int = 30      # القراءة يجب ألا تكون أقدم من X يوم
    is_required:     bool = True   # أم اختيارية؟
    confidence_gain: float = 0.15  # كم تزيد هذه القراءة من الثقة إذا توفرت


# ── Decision Action ───────────────────────────────────────────────────────────

@dataclass
class DecisionAction:
    """إجراء ممكن بموجب هذه المهمة."""
    action_id:       str
    description_ar:  str
    description_en:  str
    typical_cost_usd: Optional[float] = None
    typical_lead_days: int = 7       # كم يوم من القرار حتى التنفيذ
    expected_benefit_usd: Optional[float] = None  # القيمة المتوقعة لهذا الإجراء
    applicable_severity: List[AlertSeverity] = field(
        default_factory=lambda: [AlertSeverity.WARNING, AlertSeverity.ALERT]
    )


# ── Monitoring Mission ────────────────────────────────────────────────────────

@dataclass
class MonitoringMission:
    """
    مهمة مراقبة — تحدد لماذا يُراقَب هدف ما.

    المفهوم الجوهري:
      نفس الهدف (مثلاً PIPE-WTR-032) يمكن أن يكون ضمن عدة مهام:
        • WATER_LEAK_DETECTION:  يراقب NDMI + هطل الأمطار + VV
        • PIPELINE_PROTECTION:   يراقب SAR change + اكتشاف الحفريات
        • INFRASTRUCTURE_AGING:  يراقب الاتجاه طويل المدى لكل الإشارات

      كل مهمة مستقلة تمامًا في عتباتها وقواعدها وتوصياتها.

    المزايا المعمارية:
      + إضافة قطاع جديد = إضافة MissionType + thresholds فقط
      + لا تغيير في المحرك الأساسي
      + نفس الـ EO data تُستخدم لمهام مختلفة
      + ممكن مشاركة مهمة عبر عدة أهداف (شبكة خطوط المياه كلها)
    """
    mission_id:    str
    mission_type:  MissionType
    name:          str
    description:   str

    # الأهداف التي تغطيها هذه المهمة
    target_ids:    List[str]

    # الإشارات والعتبات
    signal_thresholds: List[SignalThreshold] = field(default_factory=list)

    # قواعد القرار
    decision_rules: List[DecisionRule] = field(default_factory=list)

    # متطلبات الأدلة
    evidence_requirements: List[EvidenceRequirement] = field(default_factory=list)

    # الإجراءات المتاحة
    available_actions: List[DecisionAction] = field(default_factory=list)

    # إعدادات التنبؤ الخاصة بهذه المهمة
    prediction_horizon_days: int = 90      # حتى متى نتنبأ؟
    update_frequency_days:   int = 5       # كم يوم بين تحديثات التنبؤ؟
    min_confidence_to_alert: float = 0.55  # الحد الأدنى للثقة قبل إطلاق إنذار

    # الحالة
    active:   bool = True
    priority: int = 2   # 1=أعلى أولوية

    # الميتاداتا
    sector:   Optional[str] = None  # 'WATER' | 'AGRICULTURE' | 'URBAN' | ...
    owner:    Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


# ── Mission Templates ─────────────────────────────────────────────────────────

class MissionTemplates:
    """
    قوالب جاهزة للمهام الأكثر شيوعاً.
    يمكن تخصيصها أو استخدامها مباشرة.
    """

    @staticmethod
    def water_leak_detection(target_ids: List[str]) -> MonitoringMission:
        return MonitoringMission(
            mission_id=f"MLK-{'-'.join(target_ids[:2])}",
            mission_type=MissionType.WATER_LEAK_DETECTION,
            name="كشف تسربات المياه",
            description="رصد الارتفاع غير الموسمي في رطوبة التربة ومقارنته مع سجلات الطقس والضغط",
            target_ids=target_ids,
            sector="WATER",
            prediction_horizon_days=60,
            signal_thresholds=[
                SignalThreshold("NDMI", warning_below=-0.07, alert_below=-0.09, weight=0.40),
                SignalThreshold("VV_dB", watch_above=-3.0, warning_above=-1.0, weight=0.25),
                SignalThreshold("NDWI", watch_above=0.10, warning_above=0.20, weight=0.20),
            ],
            decision_rules=[
                DecisionRule(
                    "WL-001",
                    "NDMI < -0.07 AND days_since_rain > 14",
                    "ارتفاع رطوبة التربة دون أمطار — مؤشر تسرب",
                    "FIELD_PRESSURE_TEST",
                    AlertSeverity.WARNING,
                ),
                DecisionRule(
                    "WL-002",
                    "NDMI < -0.09 AND VV_dB > -4 AND days_since_rain > 21",
                    "تسرب مياه تحت الأرض شبه مؤكد",
                    "EMERGENCY_INSPECTION",
                    AlertSeverity.ALERT,
                ),
            ],
            evidence_requirements=[
                EvidenceRequirement("sentinel-2", "NDMI", max_age_days=10, confidence_gain=0.25),
                EvidenceRequirement("sentinel-1", "VV_dB", max_age_days=12, confidence_gain=0.20),
                EvidenceRequirement("ERP", "pressure_reading", max_age_days=7, confidence_gain=0.30),
                EvidenceRequirement("field_inspection", None, max_age_days=30,
                                    is_required=False, confidence_gain=0.40),
            ],
            available_actions=[
                DecisionAction("MONITOR", "مواصلة المراقبة المعتادة", "Continue monitoring",
                               typical_cost_usd=0, applicable_severity=[AlertSeverity.WATCH]),
                DecisionAction("FIELD_PRESSURE_TEST", "اختبار الضغط الميداني",
                               "Field pressure test", typical_cost_usd=500,
                               expected_benefit_usd=8000),
                DecisionAction("EMERGENCY_INSPECTION", "فحص طارئ فوري",
                               "Emergency inspection", typical_cost_usd=2000,
                               expected_benefit_usd=25000,
                               applicable_severity=[AlertSeverity.ALERT, AlertSeverity.CRITICAL]),
            ],
        )

    @staticmethod
    def vegetation_health(target_ids: List[str]) -> MonitoringMission:
        return MonitoringMission(
            mission_id=f"VEG-{'-'.join(target_ids[:2])}",
            mission_type=MissionType.VEGETATION_HEALTH,
            name="مراقبة صحة الغطاء النباتي",
            description="رصد NDVI على المدى البعيد وكشف التدهور النباتي",
            target_ids=target_ids,
            sector="AGRICULTURE",
            prediction_horizon_days=120,
            signal_thresholds=[
                SignalThreshold("NDVI", warning_below=0.15, alert_below=0.08, weight=0.50),
                SignalThreshold("NDMI", warning_below=-0.05, alert_below=-0.10, weight=0.30),
                SignalThreshold("LST_C", warning_above=42.0, alert_above=48.0, weight=0.20),
            ],
            available_actions=[
                DecisionAction("INCREASE_IRRIGATION", "زيادة الري", "Increase irrigation",
                               typical_cost_usd=200, expected_benefit_usd=3000),
                DecisionAction("SOIL_ANALYSIS", "تحليل التربة", "Soil analysis",
                               typical_cost_usd=150, expected_benefit_usd=2000),
            ],
        )

    @staticmethod
    def infrastructure_aging(target_ids: List[str]) -> MonitoringMission:
        return MonitoringMission(
            mission_id=f"AGE-{'-'.join(target_ids[:2])}",
            mission_type=MissionType.INFRASTRUCTURE_AGING,
            name="مراقبة تقادم البنية التحتية",
            description="رصد الاتجاه التراجعي طويل المدى في كل الإشارات مقرونًا بعمر الأصل وسجل الصيانة",
            target_ids=target_ids,
            sector="INFRASTRUCTURE",
            prediction_horizon_days=365,
            signal_thresholds=[
                SignalThreshold("NDMI", trend_warn_per_day=-0.0002, weight=0.30),
                SignalThreshold("NDVI", trend_warn_per_day=-0.0001, weight=0.20),
                SignalThreshold("VV_dB", trend_warn_per_day=0.005, weight=0.25),
            ],
            available_actions=[
                DecisionAction("SCHEDULED_MAINTENANCE", "صيانة دورية مجدولة",
                               "Scheduled maintenance", typical_cost_usd=3000,
                               expected_benefit_usd=40000),
                DecisionAction("FULL_REPLACEMENT", "استبدال كامل",
                               "Full replacement", typical_cost_usd=50000,
                               expected_benefit_usd=120000,
                               applicable_severity=[AlertSeverity.CRITICAL]),
            ],
        )
