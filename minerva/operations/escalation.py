"""
MINERVA Phase 12 — Escalation Engine
======================================
Automatically escalates unresolved alerts through organizational hierarchy.

Escalation path (configurable per Mission):
  Level 0: Engineer          (default recipient)
  Level 1: Section Head      (if unresolved after X hours)
  Level 2: Department Manager(if still unresolved after Y hours)
  Level 3: Executive         (critical only, after Z hours)

Every escalation is recorded with timestamp, reason, and who was notified.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any


@dataclass
class EscalationRule:
    """قاعدة تصعيد واحدة لمستوى معين."""
    from_level:        int    # 0 = مهندس
    to_level:          int    # 1 = رئيس قسم
    hours_to_trigger:  float  # ساعات بدون حل تستدعي التصعيد
    notify_roles:      List[str]   # ['DEPT_MANAGER', 'SECTION_HEAD']
    notify_channels:   List[str]   # ['IN_APP', 'EMAIL', 'SMS']
    severity_filter:   Optional[List[str]] = None  # None = كل المستويات
    message_template:  str = ""


@dataclass
class EscalationEvent:
    """سجل تصعيد واحد."""
    alert_id:          str
    from_level:        int
    to_level:          int
    triggered_at:      datetime
    triggered_by:      str   # 'AUTO' | user_id
    reason:            str
    notified_users:    List[str] = field(default_factory=list)
    channels_used:     List[str] = field(default_factory=list)


class EscalationEngine:
    """
    يُراقب الإنذارات غير المحلولة ويُصعِّدها تلقائياً.

    يُشغَّل بواسطة Cron Job كل 15 دقيقة:
      engine = EscalationEngine(rules)
      escalations = engine.check_due_escalations(open_alerts)
    """

    DEFAULT_RULES = [
        EscalationRule(
            from_level=0, to_level=1,
            hours_to_trigger=4.0,
            notify_roles=["SECTION_HEAD"],
            notify_channels=["IN_APP", "EMAIL"],
            severity_filter=["WARNING", "ALERT", "CRITICAL"],
            message_template="إنذار لم يُعالَج منذ {hours:.0f} ساعة — بحاجة لمتابعة",
        ),
        EscalationRule(
            from_level=1, to_level=2,
            hours_to_trigger=12.0,
            notify_roles=["DEPT_MANAGER"],
            notify_channels=["IN_APP", "EMAIL", "SMS"],
            severity_filter=["ALERT", "CRITICAL"],
            message_template="إنذار حرج لم يُحسَم — يحتاج تدخل مدير القسم",
        ),
        EscalationRule(
            from_level=2, to_level=3,
            hours_to_trigger=24.0,
            notify_roles=["GENERAL_MANAGER"],
            notify_channels=["IN_APP", "SMS"],
            severity_filter=["CRITICAL"],
            message_template="حالة حرجة تستدعي انتباه الإدارة العليا",
        ),
    ]

    def __init__(self, rules: Optional[List[EscalationRule]] = None):
        self.rules = rules or self.DEFAULT_RULES

    def check_due_escalations(
        self,
        open_alerts: List[Dict[str, Any]],
        now: Optional[datetime] = None,
    ) -> List[EscalationEvent]:
        """
        يفحص كل الإنذارات المفتوحة ويُعيد قائمة بالتصعيدات المستحقة.
        open_alerts: قائمة dicts من قاعدة البيانات
        """
        now = now or datetime.now()
        due: List[EscalationEvent] = []

        for alert in open_alerts:
            if alert.get("status") in ("RESOLVED", "FALSE_ALARM"):
                continue

            detected_at = alert.get("detected_at")
            if isinstance(detected_at, str):
                detected_at = datetime.fromisoformat(detected_at)
            if detected_at is None:
                continue

            current_level = alert.get("escalation_level", 0)
            severity      = alert.get("severity", "")
            hours_open    = (now - detected_at).total_seconds() / 3600

            for rule in self.rules:
                if rule.from_level != current_level:
                    continue
                if rule.severity_filter and severity not in rule.severity_filter:
                    continue
                if hours_open >= rule.hours_to_trigger:
                    due.append(EscalationEvent(
                        alert_id     = alert["alert_id"],
                        from_level   = rule.from_level,
                        to_level     = rule.to_level,
                        triggered_at = now,
                        triggered_by = "AUTO",
                        reason       = rule.message_template.format(
                            hours=hours_open,
                            severity=severity,
                        ),
                        channels_used = rule.notify_channels,
                    ))
                    break   # قاعدة واحدة فقط لكل إنذار

        return due


# ── Notification Dispatcher ───────────────────────────────────────────────────

@dataclass
class NotificationChannel:
    channel_type: str    # 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH'
    enabled:      bool = True
    config:       Dict[str, Any] = field(default_factory=dict)


@dataclass
class NotificationPayload:
    recipient_id:    str
    recipient_name:  str
    channel:         str
    subject:         str
    body:            str
    alert_id:        Optional[str] = None
    task_id:         Optional[str] = None
    deep_link:       Optional[str] = None   # رابط مباشر للإنذار في التطبيق
    sent_at:         datetime = field(default_factory=datetime.now)


class NotificationDispatcher:
    """
    يُوزِّع الإشعارات عبر قنوات متعددة.
    كل Mission تُحدد من يستقبل الإشعارات وبأي قناة.
    """

    def build_alert_notification(
        self,
        alert: Dict[str, Any],
        recipients: List[Dict[str, Any]],
        channel: str = "IN_APP",
    ) -> List[NotificationPayload]:
        severity = alert.get("severity", "")
        emoji = {"WATCH": "👁", "WARNING": "⚠️", "ALERT": "🚨", "CRITICAL": "🔴"}.get(severity, "📢")

        subject = f"{emoji} {alert.get('title', 'إنذار MINERVA')}"
        body    = (
            f"المهمة: {alert.get('mission_name', '')}\n"
            f"الهدف: {alert.get('target_name', '')}\n"
            f"المستوى: {severity}\n"
            f"التوصية: {alert.get('recommended_action', '')}\n"
            f"عمر الإنذار: {alert.get('age_text', '')}"
        )

        return [
            NotificationPayload(
                recipient_id   = r["user_id"],
                recipient_name = r.get("name", ""),
                channel        = channel,
                subject        = subject,
                body           = body,
                alert_id       = alert.get("alert_id"),
                deep_link      = f"/dashboard/gis-sovereignty/minerva-center/alerts/{alert.get('alert_id')}",
            )
            for r in recipients
        ]
