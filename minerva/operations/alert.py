"""
MINERVA Phase 12 — Operations Core Models
==========================================
The operational layer sits above the intelligence engine.
Science complexity stays inside MINERVA.
Operational simplicity is delivered to the user.

Hierarchy:
  MonitoringMission generates → Forecast / EarlyWarning
    → OperationalAlert   (what the operator sees)
      → OperationalTask  (what the field team does)
        → FieldVerification (what feeds back to MINERVA)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any


# ── Enumerations ──────────────────────────────────────────────────────────────

class AlertSeverity(str, Enum):
    WATCH    = "WATCH"     # مراقبة
    WARNING  = "WARNING"   # تحذير
    ALERT    = "ALERT"     # إنذار
    CRITICAL = "CRITICAL"  # حرج


class AlertStatus(str, Enum):
    NEW         = "NEW"         # جديد، لم يُشاهَد
    ACKNOWLEDGED= "ACKNOWLEDGED"# تم الاطلاع عليه
    IN_PROGRESS = "IN_PROGRESS" # قيد المعالجة
    ESCALATED   = "ESCALATED"   # مُصعَّد لمستوى أعلى
    RESOLVED    = "RESOLVED"    # محلول
    FALSE_ALARM = "FALSE_ALARM" # إنذار كاذب


class TaskStatus(str, Enum):
    PENDING    = "PENDING"
    ASSIGNED   = "ASSIGNED"
    IN_FIELD   = "IN_FIELD"     # الفني في الموقع
    COMPLETED  = "COMPLETED"
    VERIFIED   = "VERIFIED"     # تحقق رئيس القسم
    CANCELLED  = "CANCELLED"


class UserRole(str, Enum):
    GENERAL_MANAGER    = "GENERAL_MANAGER"    # المدير العام
    DEPT_MANAGER       = "DEPT_MANAGER"       # مدير القسم
    ENGINEER           = "ENGINEER"           # مهندس
    FIELD_TECHNICIAN   = "FIELD_TECHNICIAN"   # فني ميداني
    ANALYST            = "ANALYST"            # محلل
    VIEWER             = "VIEWER"             # مشاهد فقط


# ── Operational Alert ─────────────────────────────────────────────────────────

@dataclass
class AlertLocation:
    lat:          float
    lon:          float
    address:      Optional[str] = None
    map_url:      Optional[str] = None  # رابط مباشر للخريطة


@dataclass
class EvidenceSummary:
    """
    ملخص الأدلة بلغة تشغيلية — بدون مصطلحات علمية.
    MINERVA تترجم "NDMI=-0.065" إلى "ارتفاع ملحوظ في رطوبة التربة".
    """
    plain_text:      str     # النص التشغيلي: "ارتفاع رطوبة التربة بنسبة 40%"
    confidence_pct:  int     # 73%
    data_age_days:   int     # عمر أحدث قراءة بالأيام
    signal_count:    int     # عدد الإشارات الداعمة
    technical_ref:   Optional[str] = None  # للمهندس: "NDMI=-0.065, VV=-4.2dB"


@dataclass
class OperationalAlert:
    """
    الإنذار التشغيلي — ما يراه المشغّل فعلاً.
    يُترجم مخرجات المحرك العلمي إلى لغة تشغيلية.
    """
    alert_id:        str
    title:           str          # "خطر تسرب مياه — منطقة الميناء"
    description:     str          # وصف تشغيلي مختصر

    # المصدر العلمي
    mission_id:      str
    mission_name:    str          # "كشف تسربات المياه"
    target_id:       str
    target_name:     str          # "خط مياه الميناء — القطعة 032"

    severity:        AlertSeverity
    status:          AlertStatus = AlertStatus.NEW

    # الموقع
    location:        Optional[AlertLocation] = None

    # الأدلة (مُبسَّطة)
    evidence:        Optional[EvidenceSummary] = None

    # التوصية التشغيلية (بدون مصطلحات)
    recommended_action: str = ""   # "أرسل فريقاً ميدانياً لفحص خط الأنابيب"
    action_deadline:    Optional[date] = None

    # الاحتمال بلغة بسيطة
    risk_level_text:    str = ""   # "احتمال عالٍ (73%)"
    time_to_impact_text:str = ""   # "خلال ~128 يوم بدون تدخل"

    # الإدارة
    assigned_to:     Optional[str] = None   # user_id
    assigned_name:   Optional[str] = None
    escalation_level: int = 0              # 0=لم يُصعَّد بعد
    escalation_history: List[Dict] = field(default_factory=list)

    # التتبع
    detected_at:     datetime = field(default_factory=datetime.now)
    updated_at:      datetime = field(default_factory=datetime.now)
    resolved_at:     Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None

    # ربط
    task_ids:        List[str] = field(default_factory=list)
    related_alerts:  List[str] = field(default_factory=list)  # أهداف مجاورة

    # الحقل التقني (للمهندس فقط)
    technical_detail: Optional[Dict[str, Any]] = None

    @property
    def age_hours(self) -> float:
        return (datetime.now() - self.detected_at).total_seconds() / 3600

    @property
    def age_text(self) -> str:
        hours = self.age_hours
        if hours < 1:
            mins = int(hours * 60)
            return f"منذ {mins} دقيقة"
        if hours < 24:
            return f"منذ {int(hours)} ساعة"
        return f"منذ {int(hours/24)} يوم"

    def to_operator_view(self, role: UserRole = UserRole.ENGINEER) -> Dict[str, Any]:
        """
        عرض مُكيَّف حسب دور المستخدم.
        المدير العام يرى ملخصاً، المهندس يرى التفاصيل التقنية.
        """
        base = {
            "alert_id":        self.alert_id,
            "title":           self.title,
            "severity":        self.severity.value,
            "status":          self.status.value,
            "mission":         self.mission_name,
            "target":          self.target_name,
            "age":             self.age_text,
            "risk_level":      self.risk_level_text,
            "time_to_impact":  self.time_to_impact_text,
            "recommended_action": self.recommended_action,
            "location":        {"lat": self.location.lat, "lon": self.location.lon}
                               if self.location else None,
            "assigned_to":     self.assigned_name,
        }

        if role in (UserRole.GENERAL_MANAGER, UserRole.DEPT_MANAGER):
            # المستوى الإداري: لا تفاصيل تقنية
            base["evidence_summary"] = self.evidence.plain_text if self.evidence else ""
            base["confidence"]       = f"{self.evidence.confidence_pct}%" if self.evidence else ""
        else:
            # المهندس والفني: تفاصيل كاملة
            base["evidence"]         = {
                "summary":    self.evidence.plain_text if self.evidence else "",
                "confidence": self.evidence.confidence_pct if self.evidence else 0,
                "data_age":   self.evidence.data_age_days if self.evidence else 0,
                "technical":  self.evidence.technical_ref if self.evidence else "",
            }
            if role == UserRole.ENGINEER:
                base["technical_detail"] = self.technical_detail

        return base


# ── Operational Task ──────────────────────────────────────────────────────────

@dataclass
class ChecklistItem:
    item_id:    str
    text:       str
    required:   bool = True
    completed:  bool = False
    notes:      str = ""


@dataclass
class FieldPhoto:
    photo_id:    str
    url:         str
    caption:     str
    taken_at:    datetime
    gps_lat:     Optional[float] = None
    gps_lon:     Optional[float] = None
    photo_type:  str = "GENERAL"   # 'BEFORE' | 'AFTER' | 'DAMAGE' | 'EVIDENCE'


@dataclass
class OperationalTask:
    """
    مهمة ميدانية — تُنشأ من إنذار وتُوجَّه لفني ميداني.
    الإغلاق يُعيد المعلومات تلقائياً إلى محرك MINERVA.
    """
    task_id:         str
    alert_id:        str
    title:           str
    description:     str

    status:          TaskStatus = TaskStatus.PENDING
    priority:        int = 2    # 1=أعلى

    # المسؤول
    assigned_to:     Optional[str] = None     # user_id
    assigned_name:   Optional[str] = None
    due_date:        Optional[date] = None

    # الموقع
    target_id:       str = ""
    target_name:     str = ""
    location:        Optional[AlertLocation] = None

    # قائمة التحقق الميدانية
    checklist:       List[ChecklistItem] = field(default_factory=list)

    # الصور والأدلة الميدانية
    photos:          List[FieldPhoto] = field(default_factory=list)

    # نتيجة الزيارة
    field_finding:   str = ""         # ما وجده الفني
    anomaly_confirmed: Optional[bool] = None   # هل أكد الشذوذ؟
    action_taken:    str = ""         # ما الذي فعله
    next_action:     str = ""

    # التواريخ
    created_at:      datetime = field(default_factory=datetime.now)
    assigned_at:     Optional[datetime] = None
    started_at:      Optional[datetime] = None
    completed_at:    Optional[datetime] = None
    verified_at:     Optional[datetime] = None
    verified_by:     Optional[str] = None

    notes:           str = ""

    @property
    def completion_pct(self) -> int:
        if not self.checklist:
            return 100 if self.status == TaskStatus.COMPLETED else 0
        done = sum(1 for item in self.checklist if item.completed)
        return int(done / len(self.checklist) * 100)

    def to_ground_truth(self) -> Optional[Dict[str, Any]]:
        """
        تحويل نتيجة الزيارة إلى Ground Truth يُغذّي محرك MINERVA.
        يُستدعى تلقائياً عند إغلاق المهمة.
        """
        if self.status not in (TaskStatus.COMPLETED, TaskStatus.VERIFIED):
            return None
        return {
            "target_id":          self.target_id,
            "observation_date":   (self.completed_at or datetime.now()).date().isoformat(),
            "anomaly_confirmed":  self.anomaly_confirmed,
            "field_finding":      self.field_finding,
            "action_taken":       self.action_taken,
            "photos":             [p.photo_id for p in self.photos],
            "source":             "FIELD_VERIFICATION",
            "task_id":            self.task_id,
            "technician_id":      self.assigned_to,
        }


# ── Field Verification (Ground Truth feedback) ────────────────────────────────

@dataclass
class FieldVerification:
    """
    نتيجة التحقق الميداني — تُغذّي قاعدة المعرفة في MINERVA.
    كل زيارة ميدانية تُحسّن النموذج.
    """
    verification_id:    str
    task_id:            str
    target_id:          str
    verified_date:      date

    # النتيجة
    anomaly_confirmed:  bool       # هل الشذوذ حقيقي؟
    severity_observed:  str        # "خفيف" | "متوسط" | "شديد"
    root_cause_observed: Optional[str] = None  # ما رآه الفني فعلاً

    # ربط بالتنبؤات السابقة
    matched_alert_type: Optional[str] = None   # 'WATER_LEAK' | 'SOIL_SATURATION' | ...
    prediction_was_accurate: Optional[bool] = None

    # البيانات الميدانية
    gps_lat:     Optional[float] = None
    gps_lon:     Optional[float] = None
    photos:      List[str] = field(default_factory=list)  # photo IDs

    # تأثير على MINERVA
    updates_baseline:   bool = False   # هل يُحدَّث خط الأساس؟
    notes:              str = ""
