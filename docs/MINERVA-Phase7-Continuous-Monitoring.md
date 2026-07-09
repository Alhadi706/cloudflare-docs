# MINERVA Phase 7 — Continuous Spatial Monitoring
## من "اسأل ثم أجب" إلى "راقب، تذكر، افهم، ثم نبه"
### الإصدار 1.0 | 2026-07-09

---

> **الفلسفة الأساسية**:
>
> MINERVA لا يعمل بأسلوب "اسأل ثم أجب".
>
> MINERVA يعمل بأسلوب **"راقب، تذكر، افهم، ثم نبه"**.
>
> المستخدم يُعرِّف الأصول مرة واحدة.
> بعد ذلك، MINERVA يُراقب باستمرار ويُنبِّه تلقائيًا عند حدوث تغيير ذي معنى.

---

## 0. سياق التصميم — ما لدينا الآن

### أرقام حقيقية من النظام الحالي

| المورد | الرقم | الدلالة |
|--------|-------|---------|
| Planet archive | 29,683 مشهد | غطاء تاريخي 10 سنوات |
| متوسط الفجوة بين المشاهد | **3.6 يوم** (وسيط: 2 يوم) | إمكانية رصد شبه يومي |
| مشاهد 2025+ | 5,234 مشهد | سنة ونصف من البيانات الحديثة |
| المناطق المغطاة | 16 منطقة | الأراضي الرئيسية في ليبيا |
| أعلى كثافة | طبرق، سرت، بريقة (2,750 مشهد/منطقة) | |

### المكونات الموجودة التي سنبني عليها

```
✓ Weather Adapter (Open-Meteo)     ← ركيزة البيانات الحقيقية
✓ Planet Provider                   ← مزود الصور الرئيسي
✓ Living Knowledge Graph            ← الذاكرة الحية
✓ Spatial Memory                    ← تذكر الأنماط المكانية
✓ Ground Truth Store                ← ربط التحقق الميداني
✓ Historical Replay                 ← التحقق التاريخي
✓ VoI Engine                        ← قرار الاستحواذ
```

### المكونات المفقودة (ما يجب بناؤه في Phase 7)

```
✗ Monitoring Subscription Store     ← من يُراقَب ولماذا
✗ Asset Monitoring State Machine    ← الحالة الحالية لكل أصل
✗ Evidence Repository (persistent)  ← المستودع الزمني للأدلة
✗ Continuous Ingestion Scheduler    ← الاستيعاب التلقائي
✗ Incremental Evidence Updater      ← التحديث بدون إعادة التحليل الكامل
✗ Evidence-Based Alert Engine       ← تنبيه بالأدلة لا بإشارة واحدة
✗ Temporal Intelligence Engine      ← الاتجاهات والموسمية والشيخوخة
✗ Monitoring Dashboard API          ← نظرة شاملة على جميع الأصول
```

---

## 1. التحول المعماري الجوهري

### 1.1 النموذج القديم (On-Demand)

```
[المستخدم] ─ يضغط "تحليل" ──► [MINERVA] ─ يُحلِّل ──► [نتيجة]
     ↑                                                        │
     └──────────────── يقرأ النتيجة ◄──────────────────────┘
```

**المشكلة**: اللحظات الأكثر أهمية (بداية حدث، تطور متسارع) تحدث **بين** طلبات التحليل.

### 1.2 النموذج الجديد (Continuous Monitoring)

```
[مصادر البيانات] ──► [Ingestion Scheduler] ──► [Evidence Repository]
                                                        │
                                              [Asset State Machine]
                                                        │
                                                [Alert Engine]
                                                        │
                                     ┌──────────────────┤
                                     ▼                  ▼
                              [MINERVA UI]         [Notifications]
                              (يعرض حالة)          (يُنبِّه عند تغيير)
```

**الخاصية الجوهرية**: MINERVA يعمل حتى لو لم يفتح أحد التطبيق.

---

## 2. العناصر المعمارية الأساسية

---

### 2.1 Evidence Repository — المستودع الزمني للأدلة

**المبدأ**: كل ملاحظة تُضاف، لا تُحذف. المعرفة تراكمية.

**لماذا لا نحذف؟**
> ملاحظة تبدو "غير مهمة" اليوم قد تُفسِّر شذوذًا بعد 3 سنوات.
> حادثة هبوط أرض في 2024 قد تُفسَّر فقط بمقارنتها بـ InSAR من 2019.

```python
class EvidenceRepository:
    """
    Append-only time series store.
    Indexed by: (asset_id, signal_id, date)
    
    Storage tiers:
      Hot (0-90 days):   fast access, uncompressed
      Warm (90d-2yr):    compressed, indexed
      Cold (2yr+):       archived, never deleted
    """
    
    def append(self,
               asset_id: str,
               signal_id: str,
               obs_date: date,
               value: float,
               quality_score: float,
               source_id: str,
               raw_metadata: dict = None) -> str:
        """يُضيف ملاحظة جديدة. يُعيد evidence_id الفريد."""
        ...
    
    def get_timeline(self,
                     asset_id: str,
                     signal_id: str,
                     start_date: date,
                     end_date: date,
                     min_quality: float = 0.3) -> list[Observation]:
        """يجلب المسار الزمني لإشارة محددة."""
        ...
    
    def get_baseline_stats(self,
                           asset_id: str,
                           signal_id: str,
                           month: int,
                           context_key: str) -> BaselineStats:
        """يجلب إحصائيات الـ Baseline لشهر وسياق محددين."""
        ...
    
    def get_cross_asset_correlation(self,
                                    asset_ids: list[str],
                                    signal_id: str,
                                    date_range: tuple) -> dict:
        """يحسب الارتباط بين أصول متجاورة — لكشف الحوادث الشبكية."""
        ...
    
    def never_delete(self, evidence_id: str) -> None:
        """محظور استدعاؤه في الإنتاج."""
        raise PermissionError("Evidence is permanent. Archive instead.")
```

**المخطط الزمني:**

```
2016  2017  2018  2019  2020  2021  2022  2023  2024  2025  2026
 │─────────────────────────────────────────────────────────── →
 │
 │  Cold Archive    │  Warm Store    │  Hot Store  │
 │  (compressed)   │  (indexed)     │  (fast)     │
 │                 │                │             │
 └─ 2 years+       └─ 90d - 2yr    └─ 0 - 90d
```

---

### 2.2 Asset Monitoring State Machine

**المبدأ**: كل أصل في مراقبة له حالة واحدة واضحة في أي لحظة.

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │ evidence weakens
              ┌──────────┐                           │ OR anomaly resolves
              │   IDLE   │◄──────────────────────────┘
              └──────────┘
                    │
                    │ single signal anomaly detected
                    │ (score > low_threshold)
                    ▼
              ┌──────────┐
              │  WATCH   │──── 72h without confirmation ──► IDLE
              └──────────┘
                    │
                    │ 2+ signals agree
                    │ OR anomaly persists 5+ observations
                    ▼
          ┌───────────────────┐
          │  INVESTIGATING    │──── 14d without escalation ──► WATCH
          └───────────────────┘
                    │
                    │ evidence_score > confirmation_threshold
                    │ AND persists N days
                    ▼
          ┌───────────────────┐
          │   ALERT_ACTIVE    │◄── only state that generates notification
          └───────────────────┘
                    │
                    │ ground truth confirmed
                    ▼
          ┌───────────────────┐
          │     CONFIRMED     │
          └───────────────────┘
                    │
                    │ repair completed OR evidence disappears
                    ▼
          ┌───────────────────┐
          │     RESOLVED      │──► archive ──► IDLE
          └───────────────────┘
```

**قواعد الانتقال:**

```python
class MonitoringStateMachine:
    
    TRANSITION_RULES = {
        ('IDLE', 'single_signal_anomaly'):  'WATCH',
        ('WATCH', 'multi_signal_agreement'): 'INVESTIGATING',
        ('WATCH', 'anomaly_persists_5obs'):  'INVESTIGATING',
        ('WATCH', 'timeout_72h'):            'IDLE',
        ('INVESTIGATING', 'evidence_exceeds_threshold'): 'ALERT_ACTIVE',
        ('INVESTIGATING', 'timeout_14d'):    'WATCH',
        ('ALERT_ACTIVE', 'ground_truth_confirmed'): 'CONFIRMED',
        ('CONFIRMED', 'repair_complete'):    'RESOLVED',
        ('RESOLVED', 'archival'):            'IDLE',
        # أي حالة → IDLE إذا ضعف الدليل
        ('*', 'evidence_weakens_below_min'): 'IDLE',
    }
```

**لماذا State Machine وليس Threshold بسيط؟**

```
الفرق العملي:

Threshold بسيط:
  يوم 1: NDMI = 3.2σ → تنبيه ← خاطئ (ضجيج)
  يوم 6: NDMI = 1.1σ → لا تنبيه
  يوم 11: NDMI = 3.5σ → تنبيه ← خاطئ مرة أخرى

State Machine:
  يوم 1:  NDMI = 3.2σ → IDLE → WATCH
  يوم 6:  NDMI = 1.1σ → WATCH → IDLE (تراجع)
  يوم 11: NDMI = 3.5σ → IDLE → WATCH
  يوم 16: NDMI = 3.8σ + LST انخفض → WATCH → INVESTIGATING
  يوم 21: 4 إشارات متوافقة + 3 أيام متتالية → INVESTIGATING → ALERT_ACTIVE ✓
```

---

### 2.3 Continuous Ingestion Scheduler

**المبدأ**: كل مصدر بيانات له جدول زمني خاص بناءً على معدل تغيره.

```python
INGESTION_SCHEDULE = {
    'open_meteo_weather': {
        'interval_hours': 24,
        'priority': 'HIGH',
        'cost': 0.0,
        'reason': 'changes daily, critical for context',
    },
    'planet_archive_scan': {
        'interval_hours': 12,     # نفحص الأرشيف مرتين يوميًا
        'priority': 'MEDIUM',
        'cost': 0.0,
        'reason': 'new scenes added daily, check for new coverage',
    },
    'sentinel1_sar': {
        'interval_hours': 72,     # كل 3 أيام نتحقق من توفر مشاهد جديدة
        'priority': 'HIGH',
        'cost': 0.0,
        'reason': '6-12 day revisit, most independent signal',
    },
    'scada_readings': {
        'interval_hours': 1,      # كل ساعة
        'priority': 'CRITICAL',
        'cost': 0.0,
        'reason': 'real-time operational data, strongest leak indicator',
    },
    'erp_maintenance': {
        'interval_hours': 24,
        'priority': 'MEDIUM',
        'cost': 0.0,
        'reason': 'context for false alarm reduction',
    },
}

class IngestionScheduler:
    def run_forever(self):
        """يعمل في خلفية، يُنفِّذ الاستيعاب حسب الجدول الزمني."""
        while True:
            for source, config in INGESTION_SCHEDULE.items():
                if self.is_due(source, config['interval_hours']):
                    self.ingest(source)
                    self.notify_affected_assets(source)
            time.sleep(60)  # فحص كل دقيقة
```

---

### 2.4 Incremental Evidence Updater

**المبدأ**: عند وصول ملاحظة جديدة، لا نُعيد التحليل الكامل. نُحدِّث فقط ما تغيّر.

```python
class IncrementalEvidenceUpdater:
    """
    الفكرة: كل ملاحظة جديدة = "نقطة بيانات جديدة".
    المحرك يُحدِّث فقط:
      1. الـ Baseline (إذا كانت الملاحظة في فترة "طبيعية")
      2. الـ Anomaly Score (مقارنة بالـ Baseline الجديد)
      3. الـ State Machine (هل يجب الانتقال لحالة أخرى؟)
      4. الـ Spatial Memory (إضافة للسجل التاريخي)
    
    لا يُعيد:
      - بناء الـ KG (ثابت إلا عند GT جديد)
      - إعادة حساب كل الفرضيات (يُحدِّث فقط الفرضيات النشطة)
    """
    
    def update(self,
               asset_id: str,
               new_observation: EvidenceObservation,
               current_state: MonitoringState) -> StateUpdate:
        
        # 1. أضف للـ Repository (دائمًا)
        self.repo.append(asset_id, new_observation)
        
        # 2. هل هذه فترة طبيعية؟ → حدِّث الـ Baseline
        if current_state == 'IDLE':
            self.baseline_updater.incremental_update(asset_id, new_observation)
        
        # 3. احسب الـ Anomaly Score الجديد
        new_score = self.scorer.score_single(asset_id, new_observation)
        
        # 4. حدِّث الـ State Machine
        new_state = self.state_machine.transition(
            current_state=current_state,
            new_score=new_score,
            observation=new_observation,
        )
        
        # 5. حدِّث الـ Spatial Memory
        self.spatial_memory.record(
            lat=new_observation.lat,
            lon=new_observation.lon,
            obs_date=new_observation.date,
            event_type=new_state.suspected_event or 'UNKNOWN',
            signal_signature=new_observation.z_scores,
        )
        
        return StateUpdate(
            asset_id=asset_id,
            old_state=current_state,
            new_state=new_state,
            delta_score=new_score - current_state.last_score,
            requires_alert=new_state == 'ALERT_ACTIVE' and current_state != 'ALERT_ACTIVE',
        )
```

---

### 2.5 Evidence-Based Alert Engine

**المبدأ**: التنبيه يُصدَر بناءً على تراكم الأدلة، ليس على إشارة واحدة.

```
لا تنبيه إذا:
  ✗ إشارة واحدة تجاوزت العتبة
  ✗ أدلة متناقضة
  ✗ انتُهت فترة الصمت (silence_period)
  ✗ الحالة لم تصل ALERT_ACTIVE
  
تنبيه فقط إذا:
  ✓ State Machine وصلت ALERT_ACTIVE
  ✓ evidence_score > confirmation_threshold
  ✓ الشذوذ استمر عبر N ملاحظات متتالية
  ✓ 2+ إشارات مستقلة متوافقة
  ✓ Physical Facts لا تُفسِّر الشذوذ (لا مطر، لا صيانة، لا ري)
```

```python
@dataclass
class MonitoringAlert:
    """كل تنبيه يجب أن يحتوي على هذه المعلومات."""
    
    alert_id: str
    timestamp: datetime
    asset_id: str
    asset_name_ar: str
    
    # ما الذي حدث؟
    suspected_event: str
    event_probability: float
    
    # أين حدث؟
    lat: float
    lon: float
    location_description: str
    localization_uncertainty_m: float
    
    # لماذا نُنبِّه الآن؟
    trigger_reason: str                    # "3 إشارات متوافقة لمدة 5 أيام متتالية"
    supporting_evidence: list[EvidenceItem]
    conflicting_evidence: list[EvidenceItem]
    
    # ما مستوى اليقين؟
    diagnostic_confidence: float
    evidence_completeness: float
    localization_confidence: float
    
    # ما التوصية؟
    recommended_action: str
    recommended_urgency: str              # IMMEDIATE / 48h / 7d / MONITOR
    estimated_cost_if_unacted: float      # بالدولار
    
    # التسلسل الزمني
    first_signal_date: date
    state_progression: list[StateChange]  # IDLE→WATCH→INVESTIGATING→ALERT
    days_to_detection: int
```

---

### 2.6 Monitoring Subscription

**المبدأ**: المستخدم يُعرِّف "ما الذي أريد مراقبته" مرة واحدة.

```python
@dataclass
class MonitoringSubscription:
    subscription_id: str
    created_at: datetime
    created_by: str
    
    # ماذا نراقب؟
    asset_id: str
    monitoring_area: dict              # GeoJSON (إذا كانت منطقة لا أصل)
    
    # بأي مصادر؟
    sources: list[str]                 # ["sentinel1", "weather", "planet", "scada"]
    
    # عتبات التنبيه
    watch_threshold: float    = 0.25   # بدء المراقبة المكثفة
    alert_threshold: float    = 0.65   # إصدار تنبيه
    min_observations: int     = 3      # حد أدنى للملاحظات قبل التنبيه
    min_independent_signals: int = 2   # حد أدنى للإشارات المستقلة
    silence_period_days: int  = 7      # لا تنبيهات متكررة قبل هذه الفترة
    
    # التنبيهات
    notify_channels: list[str]         # ["email", "sms", "in_app", "webhook"]
    notify_users: list[str]            # user IDs
    
    # الحالة الحالية
    current_state: MonitoringState
    active: bool
    last_alert_date: Optional[date]
```

---

### 2.7 Temporal Intelligence Engine

**المبدأ**: MINERVA يفهم الزمن. الماضي يُفسِّر الحاضر.

```python
class TemporalIntelligenceEngine:
    """
    يُجيب على:
      1. هل هذا الشذوذ طبيعي موسميًا؟
      2. هل يوجد اتجاه تدهوري على مدى سنوات؟
      3. هل هذا نمط متكرر؟
      4. كيف تطور الأصل مع الزمن؟
    """
    
    def detect_seasonal_anomaly(self, asset_id, signal_id, date) -> bool:
        """هل القيمة شاذة لهذا الشهر تحديدًا؟"""
        historical = self.repo.get_same_month_history(asset_id, signal_id, date.month)
        return z_score(current_value, historical) > 2.5
    
    def detect_long_term_trend(self, asset_id, signal_id) -> TrendAnalysis:
        """
        هل هناك تدهور تدريجي؟
        مثال: NDVI ينخفض ببطء على 3 سنوات → تدهور نباتي محيط
        """
        series = self.repo.get_timeline(asset_id, signal_id, 
                                        date.today() - timedelta(days=3*365),
                                        date.today())
        slope, r2 = linear_regression(series)
        return TrendAnalysis(
            direction='DECLINING' if slope < -0.001 else 'STABLE' if abs(slope) < 0.001 else 'IMPROVING',
            rate_per_year=slope * 365,
            confidence=r2,
            significant=r2 > 0.3 and abs(slope) > 0.001,
        )
    
    def detect_recurring_anomalies(self, asset_id) -> list[RecurringPattern]:
        """
        هل هذا النمط يتكرر؟
        مثال: كل صيف تظهر رطوبة مرتفعة في نفس المنطقة
        → يُميِّز بين ري موسمي متكرر وتسرب حقيقي
        """
        ...
    
    def estimate_asset_aging(self, asset_id, digital_twin) -> AgingAssessment:
        """
        هل يتقادم الأصل؟
        يقارن: معدل الشذوذات الحالي vs. معدل السنوات الأولى بعد التركيب
        """
        ...
```

---

## 3. تدفق البيانات الكامل (End-to-End Flow)

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    DATA SOURCES                              │
  │                                                             │
  │  Open-Meteo  Planet  Sentinel-1  Landsat  SCADA  ERP        │
  │     (daily)  (daily)  (6-12d)   (16d)   (hourly) (daily)  │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              INGESTION SCHEDULER                             │
  │  يُشغَّل في الخلفية، يتحقق كل دقيقة من الجدول الزمني       │
  │  يستدعي Adapter المناسب لكل مصدر                            │
  └──────────────────────────┬───────────────────────────────────┘
                             │ observations
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              EVIDENCE REPOSITORY                             │
  │  Append-only. Hot/Warm/Cold tiers. Never delete.            │
  │  Indexed by: (asset_id, signal_id, date)                    │
  └──────────────────────────┬───────────────────────────────────┘
                             │ new_observation notification
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │           INCREMENTAL EVIDENCE UPDATER                       │
  │  لكل أصل متأثر بالملاحظة الجديدة:                           │
  │   - احسب z-score بناءً على Baseline                         │
  │   - حدِّث State Machine                                      │
  │   - حدِّث Spatial Memory                                     │
  │   - حدِّث Temporal Intelligence                              │
  └──────────────────────────┬───────────────────────────────────┘
                             │ state_update
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │           ASSET STATE MACHINE                                │
  │  IDLE ─► WATCH ─► INVESTIGATING ─► ALERT_ACTIVE             │
  │                                                             │
  │  القاعدة: لا انتقال إلا بأدلة متعددة مستمرة               │
  └──────────────────────────┬───────────────────────────────────┘
                             │ if state_changed_to ALERT_ACTIVE
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              ALERT ENGINE                                    │
  │  يبني MonitoringAlert الكامل                                 │
  │  يُرسِل للـ notification channels                            │
  │  يُصدِر إلى MINERVA UI                                       │
  └──────────────────────────┬───────────────────────────────────┘
                             │
               ┌─────────────┴──────────────┐
               ▼                             ▼
  ┌─────────────────────┐       ┌────────────────────────┐
  │  MINERVA CENTER UI  │       │   ERP Work Order       │
  │  (يعرض الحالة)      │       │   (أمر عمل ميداني)    │
  └─────────────────────┘       └────────────────────────┘
               │                             │
               └─────────────┬──────────────┘
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              GROUND TRUTH FEEDBACK                           │
  │  الفريق الميداني يُدخِل النتيجة                              │
  │  → يُحدِّث KG أوزان                                          │
  │  → يُحدِّث Spatial Memory                                    │
  │  → يُحدِّث Calibration curves                                │
  └──────────────────────────────────────────────────────────────┘
```

---

## 4. بنية الملفات الجديدة (Phase 7)

```
minerva/
├── monitoring/                        ← NEW MODULE
│   ├── __init__.py
│   ├── subscription.py                # MonitoringSubscription dataclass
│   ├── state_machine.py               # IDLE→WATCH→INVESTIGATING→ALERT
│   ├── alert_engine.py                # Evidence-based alerting
│   ├── scheduler.py                   # Ingestion scheduler
│   └── dashboard.py                   # Monitoring overview API
│
├── repository/                        ← NEW MODULE
│   ├── __init__.py
│   ├── evidence_store.py              # Append-only evidence store
│   ├── timeline.py                    # Time series queries
│   └── tiers.py                       # Hot/Warm/Cold storage mgmt
│
├── temporal/                          ← NEW MODULE
│   ├── __init__.py
│   ├── intelligence.py                # Trend, seasonal, recurring patterns
│   ├── aging.py                       # Asset aging estimation
│   └── baseline_updater.py            # Incremental baseline update
│
├── twin/                              ← NEW MODULE (from Phase 6)
│   ├── __init__.py
│   └── digital_twin.py               # AssetDigitalTwin dataclass
│
└── [existing modules - unchanged]
    ├── config.py
    ├── signals/
    ├── baseline/
    ├── anomaly/
    ├── evidence/
    ├── reasoning/
    ├── knowledge/
    ├── decision/
    └── imagery/
```

---

## 5. API للمراقبة المستمرة

```
POST /api/minerva/monitoring/subscribe
  body: { asset_id, sources, thresholds, notify_channels }
  → إنشاء Monitoring Subscription

GET  /api/minerva/monitoring/status
  → قائمة بجميع الأصول المراقبة وحالتها الحالية

GET  /api/minerva/monitoring/{asset_id}/state
  → الحالة التفصيلية لأصل محدد + المسار الزمني

GET  /api/minerva/monitoring/{asset_id}/timeline
  query: { signal_id, start, end }
  → المسار الزمني الكامل للأدلة

GET  /api/minerva/monitoring/alerts
  query: { status, asset_id, date_from }
  → قائمة التنبيهات النشطة والتاريخية

POST /api/minerva/monitoring/alerts/{alert_id}/verify
  body: { outcome, actual_event, location, notes }
  → تسجيل Ground Truth وإغلاق التنبيه

GET  /api/minerva/monitoring/dashboard
  → نظرة شاملة: عدد الأصول، حالاتها، آخر التنبيهات
```

---

## 6. قواعد التنبيه الذكية

### 6.1 قاعدة "الصمت الذكي" (Smart Silence)

```
المشكلة الكلاسيكية: إرهاق التنبيهات (Alert Fatigue)
  → المستخدم يتلقى 50 تنبيهًا يوميًا → يتجاهل الكل → يفوته الحقيقي

قواعد MINERVA:
  1. لا تنبيه لنفس الأصل قبل مرور silence_period_days
  2. دمج التنبيهات المتقاربة جغرافيًا (cluster nearby alerts)
  3. ترتيب التنبيهات بالأولوية (asset_criticality × anomaly_score)
  4. "ملخص يومي" للأصول في حالة WATCH بدلًا من تنبيه لكل واحد
```

### 6.2 قاعدة "العودة للوضع الطبيعي" (Return to Normal)

```python
# إذا ضعف الدليل: أرسل تحديثًا وارجع للـ IDLE
if current_state == 'ALERT_ACTIVE' and new_score < return_threshold:
    send_notification(
        type='RESOLUTION',
        message=f"تراجع الشذوذ في {asset_name}. الوضع يعود للطبيعي.",
        explanation="احتمال: إما أن الحدث انتهى، أو كان تأثيرًا مؤقتًا",
    )
    transition_to('IDLE')
```

### 6.3 قاعدة "التصعيد التلقائي" (Auto-Escalation)

```python
# إذا بقي في INVESTIGATING أكثر من MAX_DAYS بدون تحقق ميداني:
if state == 'INVESTIGATING' and days_in_state > MAX_INVESTIGATION_DAYS:
    if asset.criticality_score > 0.80:
        escalate_to_supervisor()  # إشعار للمستوى الأعلى
        recommend_field_visit()   # توصية عاجلة
```

---

## 7. واجهة المراقبة المستمرة في MINERVA Center

```
┌────────────────────────────────────────────────────────────────┐
│  MINERVA Monitoring Center                                     │
│  ────────────────────────────────────────────────────────────  │
│  خريطة الأصول المراقبة          │  حالة الأصول               │
│                                  │                             │
│  🔴 PIPE-001  (ALERT_ACTIVE)     │  🔴 تنبيه:  2 أصل          │
│  🟡 PIPE-002  (INVESTIGATING)    │  🟡 تحقيق: 5 أصل           │
│  🔵 PIPE-003  (WATCH)            │  🔵 مراقبة: 12 أصل         │
│  🟢 PIPE-004  (IDLE)             │  🟢 طبيعي: 89 أصل          │
│  ...                             │                             │
│                                  │  ─────────────────────────  │
│                                  │  آخر تحديث: 14 دقيقة       │
│  ─────────────────────────────── │  التحليلات اليوم: 247      │
│                                  │  التنبيهات هذا الأسبوع: 3  │
│  التنبيهات النشطة               │  انتهى بتأكيد: 1            │
│  ───────────────────────         │  انتهى بإنذار خاطئ: 1      │
│  [تفاصيل] PIPE-001               │  لا يزال نشطًا: 1           │
│    تسرب مياه محتمل               │                             │
│    منذ: 5 أيام                   │                             │
│    ثقة: 65%                      │                             │
│    [إرسال فريق] [تعيين للمتابعة]│                             │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. التفوق على البيانات المُحاكاة — استخدام الأرشيف الحقيقي

### 8.1 الأرصدة الفعلية التي يمكن استخدامها فورًا

```
Planet Archive: 29,683 مشهد حقيقي
  - متوسط الفجوة: 3.6 يوم (ممتاز للمراقبة)
  - 16 منطقة في ليبيا مغطاة
  - غطاء سحابي: 3.4% (ممتاز)

هذا الأرشيف يُشكِّل الـ Evidence Repository الأساسي.
كل مشهد = observation في الـ Repository.
```

### 8.2 اختبار التاريخ الكامل

```
Walk-Forward Validation على الأرشيف الكامل:

Train Window: 24 شهر
Test Window:  6 أشهر
Step:         3 أشهر
Folds:        ~16 fold (من 2016 حتى 2024)

الهدف:
  - قياس الأداء عبر الزمن
  - هل يتحسن MINERVA بمرور الوقت؟
  - هل هناك drift في الدقة؟
  
الإجابة ستكون: نعم إذا اشتغل Temporal Intelligence بشكل صحيح.
```

---

## 9. فلسفة البيانات — لا تحذف شيئًا

```
المبدأ العلمي: المعرفة الزمنية لا قيمة لها إذا فُقدت أجزاء منها.

مثال عملي:
  2019: ملاحظة "غريبة" في PIPE-001 — لا تسرب مؤكد، تُؤرشف.
  2022: تسرب حقيقي في PIPE-001
  2024: بمقارنة 2019 بـ 2022، يكتشف MINERVA:
        "الشذوذ في 2019 كان بداية التدهور الذي أفضى للتسرب في 2022"
        → هذه المعرفة تُحسِّن الكشف المبكر لجميع الأصول المشابهة.

لو حُذفت بيانات 2019 "لأنها قديمة" → ضاعت هذه الفرصة للأبد.
```

**قواعد الأرشفة:**

```python
DATA_RETENTION_POLICY = {
    'raw_observations':    'NEVER_DELETE',  # أبدًا
    'computed_features':   'NEVER_DELETE',  # أبدًا
    'anomaly_scores':      'NEVER_DELETE',  # أبدًا
    'alerts':              'NEVER_DELETE',  # أبدًا
    'ground_truth':        'NEVER_DELETE',  # أبدًا
    'model_weights_history': 'NEVER_DELETE', # أبدًا
    
    # الاستثناء الوحيد: نقل من Hot إلى Cold، لكن لا حذف
    'hot_to_warm_after_days': 90,
    'warm_to_cold_after_days': 730,
}
```

---

## 10. خارطة التنفيذ

### الأسبوع 1-2 (Foundation):
1. **Evidence Repository** — PostgreSQL/TimescaleDB + append-only schema
2. **MonitoringSubscription** — dataclass + persistent store
3. **State Machine** — خمس حالات + قواعد الانتقال

### الأسبوع 3-4 (Engine):
4. **Incremental Evidence Updater** — ربط الـ Repository بالـ State Machine
5. **Alert Engine** — بناء MonitoringAlert الكامل
6. **Basic Ingestion Scheduler** — Weather + Planet archive

### الشهر 2 (Intelligence):
7. **Temporal Intelligence Engine** — Trend + Seasonal + Recurring
8. **Monitoring Dashboard API** — 8 endpoints
9. **Walk-Forward Validation** — قياس الأداء عبر 16 fold تاريخي

### الشهر 3 (Integration):
10. **MINERVA Center UI update** — Monitoring view
11. **ERP Work Order integration** — تلقائي عند ALERT_ACTIVE
12. **SCADA ingestion** — أقوى مصدر داخلي

---

## 11. القرارات المعمارية الجديدة (ADRs)

### ADR-020: Evidence Repository = Append-Only

**القرار**: لا حذف. كل ملاحظة دائمة.

**السبب**: بيانات اليوم تُفسِّر حوادث السنوات القادمة.

**التقني**: TimescaleDB (PostgreSQL extension) + hypertables مع compression تلقائية.

---

### ADR-021: State Machine بدلًا من Threshold Polling

**القرار**: منطق الانتقال بين الحالات يُحدِّد متى نُنبِّه، ليس عتبة ثابتة.

**السبب**: الـ Threshold البسيط يُنتج إرهاق تنبيهات. الـ State Machine يُنبِّه فقط عند تغيير حقيقي مستمر.

**المقياس**: عدد التنبيهات الكاذبة يجب أن يقل بـ ≥50% عند مقارنة State Machine بـ Threshold.

---

### ADR-022: Ingestion-Driven بدلًا من Query-Driven

**القرار**: التحليل يُشغَّل تلقائيًا عند وصول بيانات جديدة، لا عند طلب المستخدم.

**السبب**: الأحداث الحقيقية لا تنتظر المستخدم ليضغط "تحليل".

**الاستثناء**: "تحليل يدوي" لا يزال متاحًا للطلبات المحددة.

---

## 12. الخلاصة

**التحول الجوهري في Phase 7:**

| قبل | بعد |
|-----|-----|
| المستخدم يبدأ التحليل | MINERVA يبدأ تلقائيًا |
| نتيجة لحظية | حالة مستمرة متطورة |
| التحليل الكامل لكل طلب | التحديث التدريجي لكل ملاحظة |
| بيانات تُنتج ثم تُنسى | بيانات تُحفظ إلى الأبد |
| تنبيه على إشارة واحدة | تنبيه على تراكم أدلة |
| "ماذا حدث الآن؟" | "كيف تطور الوضع؟ وماذا يعني؟" |

**الفلسفة النهائية:**

> MINERVA لا يُجيب على أسئلة.
> MINERVA يبني **فهمًا متطورًا** لكل أصل عبر الزمن.
> ويُنبِّهك فقط عندما يتغير هذا الفهم بشكل ذي معنى.

---

*MINERVA Phase 7 — Continuous Spatial Monitoring Design v1.0*
*DSP Spatial Intelligence Platform — 2026-07-09*
*"راقب، تذكر، افهم، ثم نبه"*
