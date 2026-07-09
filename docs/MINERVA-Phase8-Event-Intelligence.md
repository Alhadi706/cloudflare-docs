# MINERVA Phase 8 — Event Intelligence & Case Management
## من "تنبيهات مُفككة" إلى "قضايا تشغيلية متكاملة"
### الإصدار 1.0 | 2026-07-09

---

> **الفلسفة الجوهرية**:
>
> الحدث الحقيقي ليس لحظة واحدة.
> الحدث الحقيقي هو **تسلسل زمني من المشاهدات المترابطة** تتطور معًا.
>
> تسرب مياه لا يبدأ بـ "NDMI مرتفع".
> يبدأ قبل ذلك بـ ضغط ينخفض تدريجيًا.
> ثم رطوبة تنتشر.
> ثم نباتات تنمو.
> ثم أرض تهبط.
>
> كل هذه ليست 5 تنبيهات. هي **قضية واحدة** تتطور.

---

## 0. المشكلة — لماذا Phase 8 ضروري

### 0.1 المشكلة الحالية: انفجار التنبيهات

حادثة تسرب مياه واحدة تُولِّد بالنظام الحالي:

```
اليوم 1:  NDMI يتجاوز العتبة      → ALERT_001
اليوم 3:  SAR يتغير               → ALERT_002
اليوم 7:  LST ينخفض               → ALERT_003
اليوم 14: NDVI يرتفع               → ALERT_004
اليوم 21: InSAR يُظهر إزاحة       → ALERT_005
اليوم 30: ERP يُسجِّل صيانة       → ALERT_006
────────────────────────────────────
المُشغِّل يرى: 6 تنبيهات مُنفصلة
الحقيقة:      قضية واحدة متطورة
```

**الأثر التشغيلي:**
- المُشغِّل يُغرق في التنبيهات
- لا رؤية للصورة الكاملة
- تكرار العمل (6 أوامر عمل لحادثة واحدة)
- ضياع التطور الزمني للحادثة
- لا استخلاص دروس موحّد

### 0.2 الحل: Event Intelligence

```
اليوم 1:  NDMI يتجاوز العتبة      → إنشاء CASE-2026-001 [MONITORING]
اليوم 3:  SAR يتغير               → تحديث CASE-2026-001 [INVESTIGATING]
اليوم 7:  LST ينخفض               → تقوية أدلة CASE-2026-001
اليوم 14: NDVI يرتفع               → تحديث تسلسل السببية
اليوم 21: InSAR يُظهر إزاحة       → CASE-2026-001 [ALERT_ACTIVE] ← تنبيه واحد
اليوم 30: ERP يُسجِّل صيانة       → CASE-2026-001 [MITIGATION]
────────────────────────────────────
المُشغِّل يرى: قضية واحدة واضحة
              مع تاريخ كامل
```

---

## 1. دورة حياة الحدث الكاملة

```
                   ┌──────────────────────────────────────────┐
                   │                                          │
                   ▼                                          │ evidence
        ┌──────────────────┐                                  │ weakens completely
        │    NEW_SIGNAL    │                                  │
        │  (إشارة أولى)    │                                  │
        └──────────────────┘                                  │
                   │                                          │
                   │ correlation check
                   ▼
     ┌─────────────────────────┐        ┌──────────────────────┐
     │   Case already exists?  │──YES──►│  Update Existing     │
     └─────────────────────────┘        │  Case                │
                   │                    └──────────────────────┘
                   │ NO
                   ▼
        ┌──────────────────┐
        │   CASE CREATED   │
        │   [MONITORING]   │ ← حالة المراقبة
        └──────────────────┘
                   │
                   │ evidence accumulates
                   ▼
        ┌──────────────────┐
        │  [INVESTIGATING] │ ← بدأ التحليل العميق
        └──────────────────┘
                   │
                   │ evidence threshold exceeded
                   ▼
        ┌──────────────────┐
        │  [ALERT_ACTIVE]  │ ← تنبيه واحد للمُشغِّل
        └──────────────────┘
                   │
                   │ field team dispatched
                   ▼
        ┌──────────────────┐
        │   [CONFIRMED]    │ ← تأكيد ميداني
        └──────────────────┘
                   │
                   │ repair initiated
                   ▼
        ┌──────────────────┐
        │  [MITIGATION]    │ ← معالجة جارية
        └──────────────────┘
                   │
                   │ repair complete + monitoring confirms normal
                   ▼
        ┌──────────────────┐
        │   [RESOLVED]     │ ← مُعالَج ومؤكد
        └──────────────────┘
                   │
                   │ lessons learned extracted
                   ▼
        ┌──────────────────┐
        │   [ARCHIVED]     │ ← محفوظ للتعلم المستقبلي
        └──────────────────┘
                   │
                   └──────────────────────────────────────────┘
```

---

## 2. قضية تشغيلية كاملة (Operational Case)

```python
@dataclass
class OperationalCase:
    """
    كيان مركزي يُمثِّل حادثة واحدة كاملة في دورة حياتها.
    """
    
    # ── الهوية ────────────────────────────────────────────────────
    case_id:          str          # مثال: CASE-2026-LY-001
    case_number:      str          # رقم للعرض: "LY-001-2026"
    created_at:       datetime
    tenant_id:        str
    
    # ── الحالة الحالية ────────────────────────────────────────────
    status: CaseStatus             # MONITORING/INVESTIGATING/ALERT_ACTIVE/...
    status_updated_at: datetime
    days_open: int
    
    # ── الأصول المتأثرة ────────────────────────────────────────────
    primary_asset_id:   str
    primary_asset_name: str
    related_assets:     list[str]  # أصول ثانوية في نفس الحادثة
    affected_area:      dict       # GeoJSON Polygon
    
    # ── الموقع ────────────────────────────────────────────────────
    center_lat: float
    center_lon: float
    localization_method: str       # POINT / LINEAR / DIFFUSE
    localization_uncertainty_m: float
    
    # ── التشخيص المتطور ────────────────────────────────────────────
    current_hypothesis:   str      # "WATER_LEAK"
    current_confidence:   float
    current_root_cause:   str      # "RC_PIPE_AGING"
    hypothesis_history:   list[HypothesisSnapshot]  # التطور عبر الزمن
    
    # ── الأدلة المتراكمة ────────────────────────────────────────────
    evidence_timeline:    list[EvidenceEntry]  # كل ملاحظة بترتيب زمني
    supporting_count:     int
    conflicting_count:    int
    evidence_completeness: float
    
    # ── التأثير (يتطور مع الوقت) ─────────────────────────────────
    impact: EventImpact
    
    # ── القرارات والإجراءات ────────────────────────────────────────
    recommendations:      list[Recommendation]
    assigned_to:          Optional[str]    # مُعيَّن لـ
    work_order_id:        Optional[str]    # ربط بـ ERP
    field_visits:         list[FieldVisit]
    
    # ── العلاقات بالأحداث الأخرى ─────────────────────────────────
    parent_case_id:      Optional[str]    # إذا كان حدثًا فرعيًا
    child_case_ids:      list[str]        # الأحداث الناتجة عنه
    related_case_ids:    list[str]        # أحداث مرتبطة في نفس المنطقة
    
    # ── الدروس المستفادة ──────────────────────────────────────────
    detection_delay_days:    Optional[int]
    initial_hypothesis_correct: Optional[bool]
    root_cause_at_resolution:   Optional[str]
    lessons_learned:            Optional[str]
    
    # ── الصور ──────────────────────────────────────────────────────
    planet_scenes_used:  list[str]    # scene IDs المستخدمة
    thumbnail_paths:     list[str]    # صور مرتبطة بالقضية
    before_after_pairs:  list[dict]   # مقارنة قبل/بعد
```

---

## 3. محرك ترابط الأحداث (Event Correlation Engine)

### 3.1 السؤال الجوهري

عند وصول ملاحظة جديدة، السؤال الأول دائمًا:

> **"هل هذا شيء جديد، أم امتداد لشيء موجود؟"**

### 3.2 خوارزمية التقرير

```python
class EventCorrelationEngine:
    """
    يُحدِّد لكل ملاحظة جديدة: هل تنتمي لحالة موجودة أم تُنشئ حالة جديدة؟
    """
    
    CORRELATION_WEIGHTS = {
        'spatial_proximity':     0.35,   # القرب المكاني
        'temporal_proximity':    0.25,   # القرب الزمني
        'asset_relationship':    0.20,   # نفس الشبكة
        'signal_coherence':      0.15,   # نفس البصمة الفيزيائية
        'no_contrary_evidence':  0.05,   # لا دليل على انفصال
    }
    
    def correlate(
        self,
        new_observation: EvidenceObservation,
        open_cases: list[OperationalCase],
    ) -> CorrelationDecision:
        """
        يُعيد: إما case_id لقضية موجودة، أو None لإنشاء قضية جديدة.
        """
        best_score = 0.0
        best_case  = None
        
        for case in open_cases:
            if case.status in ('RESOLVED', 'ARCHIVED'):
                continue
            
            score = self._compute_similarity(new_observation, case)
            
            if score > best_score:
                best_score = score
                best_case  = case
        
        if best_score >= self.MERGE_THRESHOLD:
            return CorrelationDecision(
                action='MERGE',
                target_case_id=best_case.case_id,
                confidence=best_score,
                reason=self._explain_merge(new_observation, best_case),
            )
        else:
            return CorrelationDecision(
                action='NEW_CASE',
                target_case_id=None,
                confidence=1.0 - best_score,
                reason="New spatial/temporal cluster detected",
            )
    
    def _compute_similarity(self, obs, case) -> float:
        score = 0.0
        
        # 1. القرب المكاني
        dist_m = haversine(obs.lat, obs.lon, case.center_lat, case.center_lon)
        spatial = max(0, 1 - dist_m / self.SPATIAL_THRESHOLD_M)
        score += spatial * self.CORRELATION_WEIGHTS['spatial_proximity']
        
        # 2. القرب الزمني
        days_diff = abs((obs.date - case.evidence_timeline[-1].date).days)
        temporal = max(0, 1 - days_diff / self.TEMPORAL_THRESHOLD_DAYS)
        score += temporal * self.CORRELATION_WEIGHTS['temporal_proximity']
        
        # 3. علاقة الأصول
        asset_related = (obs.asset_id == case.primary_asset_id) or \
                        (obs.asset_id in case.related_assets)
        score += (1.0 if asset_related else 0.0) * self.CORRELATION_WEIGHTS['asset_relationship']
        
        # 4. تماسك الإشارات
        coherence = self._signal_coherence(obs.z_scores, case.evidence_timeline)
        score += coherence * self.CORRELATION_WEIGHTS['signal_coherence']
        
        return min(score, 1.0)
```

### 3.3 قرارات التوحيد والفصل

```
سيناريوهات الترابط:

✓ MERGE — توحيد مع قضية موجودة إذا:
  • نفس الأنبوب، < 7 أيام، بصمة فيزيائية مشابهة

✓ NEW_CASE — قضية جديدة إذا:
  • موقع مختلف تمامًا (> 1km)
  • أنبوب مختلف
  • فجوة زمنية > 30 يوم بدون أي دليل

✓ SPLIT — فصل قضية مدمجة إذا:
  • تحقق ميداني يُؤكِّد أنها حادثتان منفصلتان
  • InSAR يُظهر نقطتي إزاحة مختلفتين

✓ RELATE — ربط دون دمج إذا:
  • أحداث متتالية (تسرب → هبوط أرض) في نفس المنطقة
  • يُربطان كـ parent_case_id / child_case_id
```

---

## 4. الأحداث المتسلسلة (Cascading Events)

### 4.1 سلاسل التأثير الطبيعية

هذه علاقات فيزيائية مُثبَتة:

```
WATER_LEAK (الحدث الأولي)
  │
  ├──► [2-4 أسابيع] Vegetation_Anomaly
  │     السبب: مياه تروي النباتات الانتهازية
  │     الإشارة: NDVI ↑ خارج الموسم
  │
  ├──► [6-24 شهر] Subsidence
  │     السبب: فقدان تماسك التربة
  │     الإشارة: InSAR ↓ (هبوط تدريجي)
  │
  └──► [1-6 أشهر] Pipe_Break (إذا لم يُعالَج)
        السبب: استمرار الضغط على مقطع ضعيف
        الإشارة: SCADA → فقدان ضغط حاد

CONSTRUCTION (الحدث الأولي)
  │
  ├──► [فوري] Vegetation_Removal
  │     الإشارة: NDVI ↓ مفاجئ
  │
  ├──► [1-30 يوم] Encroachment
  │     الإشارة: مقارنة حدود الحرم
  │
  └──► [فوري-3 أشهر] Pipe_Damage_Risk
        الإشارة: SAR texture change + SCADA vibration

SUBSIDENCE (الحدث الأولي)
  │
  ├──► [فوري] Pipe_Stress
  │     الإشارة: SCADA → تذبذب الضغط
  │
  └──► [2-8 أشهر] Water_Leak
        السبب: إجهاد انثنائي يتراكم
```

### 4.2 اكتشاف التسلسل تلقائيًا

```python
class CascadeDetector:
    """
    عندما تُغلَق قضية (RESOLVED)، يبحث في الأحداث اللاحقة:
    هل يوجد حدث آخر في نفس المنطقة يمكن تفسيره كنتيجة؟
    """
    
    # علاقات التسلسل المُعرَّفة
    CASCADE_RULES = {
        ('WATER_LEAK', 'SUBSIDENCE'):        {'max_days': 730, 'min_confidence': 0.5},
        ('WATER_LEAK', 'VEGETATION_ANOMALY'): {'max_days': 60,  'min_confidence': 0.4},
        ('WATER_LEAK', 'PIPE_BREAK'):         {'max_days': 180, 'min_confidence': 0.6},
        ('SUBSIDENCE', 'WATER_LEAK'):         {'max_days': 240, 'min_confidence': 0.5},
        ('CONSTRUCTION', 'ENCROACHMENT'):     {'max_days': 90,  'min_confidence': 0.7},
    }
    
    def detect(self,
               closed_case: OperationalCase,
               candidate_case: OperationalCase) -> Optional[CascadeRelationship]:
        
        rule_key = (closed_case.current_hypothesis, candidate_case.current_hypothesis)
        rule = self.CASCADE_RULES.get(rule_key)
        if not rule:
            return None
        
        days_apart = (candidate_case.created_at.date() - closed_case.created_at.date()).days
        spatial_proximity = haversine(
            closed_case.center_lat, closed_case.center_lon,
            candidate_case.center_lat, candidate_case.center_lon
        ) < self.MAX_CASCADE_DISTANCE_M
        
        if 0 <= days_apart <= rule['max_days'] and spatial_proximity:
            return CascadeRelationship(
                parent_case_id=closed_case.case_id,
                child_case_id=candidate_case.case_id,
                relationship_type='CAUSED_BY',
                confidence=min(closed_case.current_confidence, rule['min_confidence']),
                days_between=days_apart,
                explanation=(
                    f"{closed_case.current_hypothesis} في {closed_case.primary_asset_name} "
                    f"قد أحدث {candidate_case.current_hypothesis} "
                    f"بعد {days_apart} يومًا — علاقة فيزيائية مُثبَتة"
                ),
            )
        return None
```

---

## 5. تطور الفرضية عبر الزمن (Hypothesis Evolution)

### 5.1 بنية التطور

```python
@dataclass
class HypothesisSnapshot:
    """لقطة من حالة التشخيص في لحظة محددة."""
    timestamp: datetime
    event_type: str
    probability: float
    confidence_level: str
    root_cause: str
    evidence_count: int
    trigger: str           # ما الذي أحدث هذا التغيير؟
    changed_by: str        # "system" / "field_team" / "analyst"
    notes: str
```

### 5.2 مثال على تطور حقيقي

```
══════════════════════════════════════════════════════════════════
CASE-2026-LY-001 | خط المياه الرئيسي - الشمال | PIPE-WTR-044
══════════════════════════════════════════════════════════════════

التطور التشخيصي:

[2026-05-10] إنشاء القضية
  الفرضية: WATER_LEAK (30%) | ثقة: LOW
  السبب المشتبه: غير محدد
  المحفز: NDMI +2.1σ في خطوط Sentinel-2

[2026-05-15] تحديث تلقائي
  الفرضية: WATER_LEAK (52%) | ثقة: MEDIUM  ← ارتفع
  السبب المشتبه: RC_PIPE_AGING
  المحفز: SAR يتغير + LST ينخفض

[2026-05-22] تحديث تلقائي → ALERT_ACTIVE
  الفرضية: WATER_LEAK (68%) | ثقة: MEDIUM
  السبب المشتبه: RC_PIPE_AGING (48%) > RC_CORROSION (25%)
  المحفز: 4 إشارات متوافقة × 12 يومًا متتالية
  ← أُرسِل تنبيه للمُشغِّل

[2026-05-25] تحديث بشري — فريق ميداني
  الفرضية: WATER_LEAK ✓ مؤكد | ثقة: CONFIRMED
  السبب الجذري: RC_CORROSION (خارجي) ✓ مؤكد ميدانيًا
  تعليق: "تآكل خارجي في KM 12.3، ثقب قطر ~2cm، عمق 1.2م"
  المحفز: تقرير فريق ميداني

[2026-05-27] معالجة جارية
  الحالة: MITIGATION
  أمر العمل: WO-2026-0892

[2026-05-30] مُغلق
  الحالة: RESOLVED
  مدة الحادثة: 20 يوم
  تأخير الكشف: 5 أيام (من بداية التسرب الحقيقية)
══════════════════════════════════════════════════════════════════
```

---

## 6. تقدير الأثر (Impact Assessment)

```python
@dataclass
class EventImpact:
    """
    تقدير الأثر — يتطور مع الوقت.
    يبدأ بتقديرات خشنة ويصبح أدق مع توفر الأدلة.
    """
    
    calculated_at: datetime
    confidence_level: str   # ESTIMATED / MODERATE / HIGH
    
    # ── الأثر التشغيلي ────────────────────────────────────────────
    assets_directly_affected: int
    assets_at_risk: int
    service_continuity_risk: float   # 0→1
    network_redundancy_available: bool
    estimated_service_disruption_hours: Optional[float]
    
    # ── الأثر المالي ──────────────────────────────────────────────
    estimated_water_loss_m3_per_day: float        # للتسرب المائي
    estimated_water_loss_cost_usd_per_day: float
    accrued_loss_since_start_usd: float
    estimated_repair_cost_usd: float              # تقدير الإصلاح
    total_economic_impact_usd: float
    
    # ── الأثر البيئي ──────────────────────────────────────────────
    soil_saturation_area_m2: float
    potential_groundwater_impact: bool
    vegetation_damage_area_m2: float
    
    # ── سلامة العامة ──────────────────────────────────────────────
    population_potentially_affected: int
    road_damage_risk: bool
    structural_risk_to_nearby_buildings: bool
    safety_risk_level: Literal['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    
    # ── الأولوية المُركَّبة ────────────────────────────────────────
    priority_score: float   # 0→1 مُركَّب من جميع الأبعاد
    recommended_response_time: str  # "IMMEDIATE" / "24h" / "7d" / "30d"
    
    def compute_priority(self) -> float:
        """
        الأولوية = f(criticality, financial_loss, safety, time_elapsed)
        
        أمثلة:
          تسرب ضخم + منطقة سكنية + بدون بديل = 0.95 → IMMEDIATE
          تسرب صغير + منطقة نائية + يوجد بديل = 0.25 → 30d
        """
        financial_factor = min(1.0, self.total_economic_impact_usd / 50000)
        safety_factor = {'CRITICAL': 1.0, 'HIGH': 0.8, 'MEDIUM': 0.5, 'LOW': 0.2, 'NONE': 0.0}[self.safety_risk_level]
        operational_factor = self.service_continuity_risk
        time_factor = min(1.0, self.accrued_loss_since_start_usd / 10000)
        
        return (
            financial_factor * 0.30 +
            safety_factor * 0.35 +
            operational_factor * 0.25 +
            time_factor * 0.10
        )
```

---

## 7. واجهة المُشغِّل — Case View vs. Alert View

### 7.1 قبل Phase 8: Alert View (مُرهِق)

```
┌───────────────────────────────────────────────────────────────┐
│  التنبيهات النشطة (23)                                        │
│                                                               │
│  #001  NDMI anomaly - PIPE-044     ────── [HIGH] 2026-05-10  │
│  #002  SAR change  - PIPE-044      ────── [MED]  2026-05-15  │
│  #003  LST drop    - PIPE-044      ────── [LOW]  2026-05-22  │
│  #004  NDMI anomaly - PIPE-031     ────── [HIGH] 2026-05-18  │
│  #005  NDVI rise   - PIPE-044      ────── [LOW]  2026-05-29  │
│  #006  InSAR disp  - PIPE-031      ────── [MED]  2026-05-25  │
│  ...                                                          │
│                                                               │
│  المُشغِّل: ما العلاقة بين #001 و #002 و #003 و #005؟       │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 بعد Phase 8: Case View (واضح)

```
┌───────────────────────────────────────────────────────────────┐
│  القضايا التشغيلية (3 قضايا)               [خريطة] [تصدير]  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  🔴 CASE-2026-LY-001  │  خط المياه الشمالي (PIPE-044)  │ │
│  │  ─────────────────────────────────────────────────────  │ │
│  │  تسرب مياه محتمل • KM 12.3                             │ │
│  │  الحالة: ALERT_ACTIVE • منذ: 20 يوم                    │ │
│  │  الثقة: 68% ← MEDIUM                                   │ │
│  │  الأثر المالي: ~$6,200 مُتراكَم                         │ │
│  │                                                         │ │
│  │  التطور: MONITORING → INVESTIGATING → ALERT_ACTIVE      │ │
│  │  ●──────────●──────────────●                           │ │
│  │  05-10     05-15           05-22 ← اليوم               │ │
│  │                                                         │ │
│  │  [عرض تفاصيل] [إرسال فريق] [تعيين] [تقرير PDF]         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  🟡 CASE-2026-LY-002  │  خط التوزيع الجنوبي (PIPE-031)│ │
│  │  تحقيق جارٍ • KM 8.7 • منذ: 12 يوم                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 7.3 صفحة تفاصيل القضية

```
┌────────────────────────────────────────────────────────────────┐
│  CASE-2026-LY-001 • خط المياه الشمالي                         │
├──────────────────────┬─────────────────────────────────────────┤
│  MAP                 │  TIMELINE                               │
│                      │                                         │
│  [خريطة تفاعلية]    │  05-10 ●─ إشارة NDMI أولى             │
│  تُظهر:             │  05-15 ●─ تأكيد SAR + تصاعد             │
│  - مسار الأنبوب     │  05-22 ●─ 4 إشارات متوافقة ← تنبيه    │
│  - منطقة الشذوذ     │  05-25 ●─ تحقق ميداني ← مؤكد           │
│  - نقطة التسرب      │  05-27 ●─ أمر عمل WO-2026-0892         │
│  - Confidence Ring   │                                         │
│                      │  [عرض كل الأدلة]                       │
├──────────────────────┼─────────────────────────────────────────┤
│  EVIDENCE            │  IMPACT                                 │
│  ─────────────────   │  ──────────────────────────             │
│  ✓ NDMI +3.2σ        │  💧 خسارة مياه: ~4 م³/يوم             │
│  ✓ LST  -2.7σ        │  💰 الأثر: $310/يوم                    │
│  ✓ SAR  -2.8σ        │  📊 المتراكم: $6,200                   │
│  ✓ NDVI +4.1σ        │  ⚠️  الأمان: LOW                       │
│  ─────────────────   │  📅 وقت الاستجابة: 48h                 │
│  تسلسل سببي: 100%   │                                         │
│  اكتمال الأدلة: 80%  │                                         │
├──────────────────────┴─────────────────────────────────────────┤
│  ROOT CAUSE EVOLUTION                                          │
│  ─────────────────────────────────────────────────────────    │
│  05-10: "سبب مجهول"                                          │
│  05-15: "تقادم الأنبوب (40%)" ← MINERVA                      │
│  05-22: "تآكل محتمل (52%)" ← MINERVA                         │
│  05-25: "تآكل خارجي مؤكد ✓" ← فريق ميداني                   │
├─────────────────────────────────────────────────────────────── │
│  [إغلاق القضية] [صور Planet] [تصدير PDF] [الدروس المستفادة]   │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. الدروس المستفادة (Lessons Learned)

### 8.1 توليد تلقائي عند الإغلاق

```python
class LessonsLearnedExtractor:
    """
    يُولِّد تلقائيًا تقرير الدروس عند RESOLVED.
    هذا هو الوقود الحقيقي لتحسين MINERVA بمرور الزمن.
    """
    
    def extract(self, closed_case: OperationalCase) -> LessonsLearned:
        
        # 1. حساب تأخير الكشف
        first_real_signal = closed_case.evidence_timeline[0].date
        alert_date = next(
            (h.timestamp.date() for h in closed_case.hypothesis_history 
             if h.confidence_level in ('HIGH', 'CONFIRMED')),
            None
        )
        detection_delay = (alert_date - first_real_signal).days if alert_date else None
        
        # 2. هل كان التشخيص الأولي صحيحًا؟
        initial_hypothesis = closed_case.hypothesis_history[0].event_type
        final_root_cause   = closed_case.root_cause_at_resolution
        initial_correct = (initial_hypothesis == closed_case.current_hypothesis)
        
        # 3. أي إشارة كانت الأكثر تشخيصًا؟
        most_informative = self._find_most_informative_signal(closed_case)
        
        # 4. ماذا كان يمكن اكتشافه مبكرًا؟
        missed_early_signals = self._find_missed_early_signals(closed_case)
        
        return LessonsLearned(
            case_id=closed_case.case_id,
            
            # مقاييس الأداء
            detection_delay_days=detection_delay,
            initial_diagnosis_correct=initial_correct,
            confidence_at_alert=self._confidence_at_alert(closed_case),
            
            # المعرفة المكتسبة
            most_informative_signal=most_informative,
            missed_early_signals=missed_early_signals,
            actual_root_cause=final_root_cause,
            
            # تحديثات مقترحة
            suggested_weight_updates=self._compute_weight_updates(closed_case),
            suggested_threshold_updates=self._compute_threshold_updates(closed_case),
            
            # للعرض
            narrative_ar=self._build_narrative(closed_case),
        )
```

### 8.2 أثر الدروس المستفادة على الدقة

```
بعد 10 قضايا مُغلَقة:
  → أوزان الإشارات تُعدَّل بناءً على الأداء الفعلي
  → العتبات تُضبَط بناءً على نسب FP/FN الفعلية
  → Calibration curves تُبنى من بيانات حقيقية

بعد 50 قضية مُغلَقة:
  → MINERVA يعرف "بصمة التسرب" في ليبيا تحديدًا
  → لا في المختبر، بل من الواقع

بعد 200 قضية مُغلَقة:
  → نظام ذاتي التعلم حقيقي
  → F1 Score يتجاوز 0.90 بدلًا من 0.77 الحالي
```

---

## 9. القضايا المتسلسلة — مثال متكامل

```
══════════════════════════════════════════════════════════════════
CASE CLUSTER: منطقة خط المياه KM 12-15، طرابلس
══════════════════════════════════════════════════════════════════

CASE-2026-LY-001: تسرب مياه [RESOLVED]
  الإشارة الأولى: 2026-05-10
  التأكيد:        2026-05-25
  الحل:           2026-05-30
  السبب الجذري:   تآكل خارجي — CI pipe عمره 22 سنة

    │
    │ 6 أشهر لاحقًا
    ▼

CASE-2026-LY-019: هبوط أرض [MONITORING] ← تم ربطه تلقائيًا
  الإشارة الأولى: 2026-11-15
  الارتباط بـ LY-001: 73% (spatial + causal)
  التفسير: "الجزء المجاور للتسرب المُعالَج في مايو يُظهر بداية هبوط — 
            محتمل أن رطوبة التربة من التسرب السابق أضعفت التربة"
  
══════════════════════════════════════════════════════════════════
رسالة MINERVA للمُشغِّل:
  "تنبيه: CASE-2026-LY-019 (هبوط أرض) يقع في نفس المنطقة التي كانت فيها
   CASE-2026-LY-001 (تسرب مائي) قبل 6 أشهر. العلاقة السببية محتملة (73%).
   يُنصح بمراجعة حالة الأنبوب في نفس القسم قبل إرسال فريق جديد."
══════════════════════════════════════════════════════════════════
```

---

## 10. بنية الملفات الجديدة (Phase 8)

```
minerva/
├── cases/                             ← NEW MODULE
│   ├── __init__.py
│   ├── operational_case.py            # OperationalCase dataclass
│   ├── case_store.py                  # Persistent case storage
│   ├── case_lifecycle.py              # State transitions + rules
│   └── lessons_learned.py            # Extraction + storage
│
├── correlation/                       ← NEW MODULE
│   ├── __init__.py
│   ├── event_correlator.py           # MERGE / NEW_CASE / SPLIT
│   ├── cascade_detector.py           # Parent/child relationships
│   └── similarity_engine.py          # Scoring algorithm
│
├── impact/                            ← NEW MODULE
│   ├── __init__.py
│   ├── assessment.py                  # EventImpact calculation
│   ├── financial.py                   # Cost models
│   └── safety.py                      # Safety risk scoring
│
└── [existing - unchanged]
```

---

## 11. API القضايا التشغيلية

```
GET  /api/minerva/cases
  query: { status, asset_id, date_from, severity }
  → قائمة القضايا مع ملخص لكل واحدة

GET  /api/minerva/cases/{case_id}
  → القضية الكاملة مع كل التفاصيل

GET  /api/minerva/cases/{case_id}/timeline
  → التسلسل الزمني الكامل للأدلة والقرارات

POST /api/minerva/cases/{case_id}/update
  body: { status, notes, assigned_to, field_findings }
  → تحديث بشري للقضية

POST /api/minerva/cases/{case_id}/close
  body: { resolution, actual_event, root_cause, work_order_id }
  → إغلاق القضية + استخلاص الدروس

GET  /api/minerva/cases/{case_id}/impact
  → التقدير الحالي للأثر المالي والبيئي والأمني

GET  /api/minerva/cases/dashboard
  → ملخص تنفيذي: عدد القضايا حسب الحالة، الأثر الكلي، الاتجاهات
```

---

## 12. القرارات المعمارية الجديدة (ADRs)

### ADR-023: الحدث وليس التنبيه هو الوحدة الأساسية

**القرار**: الوحدة الأساسية في MINERVA هي الحدث (`OperationalCase`)، وليس التنبيه (`MonitoringAlert`).

**السبب**: التنبيهات هي فقط "إشارات". الحادثة هي ما يعيشه المُشغِّل.

---

### ADR-024: لا إنشاء قضية بدون تحقق ترابط

**القرار**: كل ملاحظة جديدة تمر أولًا عبر `EventCorrelationEngine` قبل إنشاء أي قضية جديدة.

**السبب**: تجنب تكرار القضايا لنفس الحادثة.

**الاستثناء**: إذا غاب الاتصال بقاعدة البيانات — يُنشئ مؤقتًا ويُدمج لاحقًا.

---

### ADR-025: تاريخ القضية = بيانات علمية لا تُحذف

**القرار**: كل تحديث لقضية (بما في ذلك التحديثات الخاطئة) يُحفظ كـ append-only.

**السبب**: تاريخ التفكير نفسه له قيمة علمية.

---

## 13. الخلاصة — التحول الجذري

### قبل Phase 8: نظام تنبيهات

```
23 تنبيهًا هذا الأسبوع
المُشغِّل: "أيها مهم؟ ما العلاقة بينها؟ متى حدث كل واحد؟"
```

### بعد Phase 8: نظام ذكاء تشغيلي

```
3 قضايا نشطة هذا الأسبوع:
  🔴 LY-001: تسرب مياه، KM 12.3، متأكد، انتظر الإصلاح منذ 3 أيام
  🟡 LY-002: هبوط محتمل، KM 8.7، قيد التحقيق
  🟢 LY-003: ري موسمي، ليس تسربًا، مراقبة فقط

المُشغِّل: "واضح تمامًا. أُركِّز على LY-001."
```

**الفلسفة النهائية:**

> MINERVA لا يُنتِج ملاحظات.
> MINERVA يبني **فهمًا سردويًا** لما يحدث في البنية التحتية.
> ويُقدِّم هذا الفهم كقصة واضحة وقابلة للتصرف.

---

*MINERVA Phase 8 — Event Intelligence & Case Management v1.0*
*DSP Spatial Intelligence Platform — 2026-07-09*
*"الحادثة الواحدة قضية واحدة، وليست عشرون تنبيهًا"*
