# MINERVA v2.0 — Asset Spatial Intelligence Engine
## Chief Research Architect Review & Complete Redesign

> **هذه الوثيقة تُلغي وتُحل محل MINERVA v1.0**
>
> القرارات التصميمية الجديدة مُبرَّرة بالمنطق العلمي والهندسي.
> أي جزء تغيّر من v1 موضّح سبب التغيير.

---

## قرارات Chief Research Architect

قبل البدء، ثلاثة قرارات استراتيجية تُشكّل كل ما يليها:

**القرار الأول**: الـ Knowledge Graph هو العمود الفقري، ليس قاعدة البيانات العلائقية.
> السبب: النظام يعيش من العلاقات. كل استنتاج هو مسار عبر الـ Graph، وليس JOIN بين جداول.

**القرار الثاني**: الـ Evidence يُعرَّف بمعناه الفيزيائي، وليس بمصدره.
> السبب: إذا ربطنا الـ Evidence بـ Sentinel-2، النظام يموت عند وصول مصدر جديد. إذا ربطناه بـ "رطوبة سطح التربة"، يظل النظام يعمل مع أي مصدر يقيس هذا المعنى.

**القرار الثالث**: الـ Baseline ليس قيمة واحدة، بل نموذج سلوكي متعدد الإصدارات.
> السبب: الأصل يتغير مع الزمن. الـ Baseline يجب أن يتطور معه دون أن يفقد تاريخه.

---

## طبقة جديدة أساسية: Signal Abstraction Layer

### لماذا هذه الطبقة غير موجودة في v1؟

v1 كان يفترض أن المعالم (NDMI, SAR_VV, LST...) تأتي من مصادر محددة.
هذا يعني أن تغيير مصدر البيانات يتطلب تغيير الـ Evidence Engine.
هذا خطأ هندسي.

### الحل: فصل كامل بين الاستشعار والاستنتاج

```
┌──────────────────────────────────────────────────────────────────┐
│                   SIGNAL ABSTRACTION LAYER                       │
│                                                                  │
│  أي مصدر بيانات          المعنى الفيزيائي       الأدلة          │
│                                                                  │
│  Sentinel-2 Band8 ──┐                                            │
│  Planet NIR ────────┼──► SOIL_MOISTURE ──────► Evidence[NDMI]   │
│  Drone Multispectral┘                                            │
│                                                                  │
│  Landsat TIR ───────┐                                            │
│  MODIS LST ─────────┼──► SURFACE_TEMP ───────► Evidence[LST]    │
│  Ground Sensor ─────┘                                            │
│                                                                  │
│  Sentinel-1 VV ─────┐                                            │
│  ICEYE SAR ─────────┼──► SAR_BACKSCATTER ────► Evidence[SAR]    │
│  SAOCOM ────────────┘                                            │
│                                                                  │
│  [أي مصدر مستقبلي] ──► تُعرَّف النقاط الفيزيائية → يعمل النظام│
└──────────────────────────────────────────────────────────────────┘
```

### تعريف Physical Signal

```yaml
physical_signal:
  signal_id:       "SOIL_MOISTURE_SURFACE"
  physical_meaning: "محتوى الرطوبة في أول 5-10cm من التربة"
  unit:            "m³/m³ or index"
  valid_range:     [0.0, 0.8]
  spatial_concept: "raster_continuous"

  # قائمة المصادر التي تقيس هذه الإشارة
  sources:
    - source_id:   "sentinel2_ndmi"
      formula:     "(B08 - B11) / (B08 + B11)"
      resolution_m: 20
      temporal_res: "5-10 days"
      quality_class: "B"      # A=excellent, B=good, C=fair, D=poor

    - source_id:   "sentinel1_sar_moisture"
      method:      "backscatter_inversion"
      resolution_m: 10
      temporal_res: "6-12 days"
      quality_class: "B"

    - source_id:   "era5_soil_moisture"
      resolution_m: 30000    # خشن جدًا للتحليل المحلي
      temporal_res: "hourly"
      quality_class: "D"     # مفيد فقط كـ context

    - source_id:   "ground_sensor_future"  # مصدر مستقبلي
      resolution_m: 1
      temporal_res: "continuous"
      quality_class: "A"
```

**النتيجة**: عند إضافة مصدر جديد، يُضاف فقط إلى قائمة `sources` في الـ Physical Signal المناسب. الـ Reasoning Engine لا يتغير أبدًا.

---

## العمود الفقري: Knowledge Graph

### لماذا Graph وليس جداول علائقية؟

```
السؤال: "ما الأحداث التي وقعت في أصول مشابهة لهذا الأصل في بيئة مشابهة؟"

في جداول علائقية:
  SELECT events FROM assets 
  JOIN environments ON...
  JOIN asset_types ON...
  WHERE similarity_score > threshold
  → 5 JOINs، أداء ضعيف، صعب التوسع

في Knowledge Graph:
  MATCH (a:Asset)-[:IS_TYPE]->(t:AssetType)<-[:IS_TYPE]-(similar:Asset)
        -[:LOCATED_IN]->(e:Environment {biome: $biome})
        -[:EXPERIENCED]->(ev:Event)
  RETURN ev
  → مسار طبيعي في الـ Graph، سريع، قابل للتوسع
```

### مخطط الـ Knowledge Graph الكامل

```
NODE TYPES:

Asset              ← كل أصل فيزيائي
AssetType          ← تصنيف الأصل (water_pipeline, dam...)
Environment        ← البيئة المحيطة (biome, terrain, climate)
PhysicalSignal     ← ما يُقاس فيزيائيًا (soil_moisture, temp...)
DataSource         ← من أين جاءت البيانات
Feature            ← قيمة محسوبة في مكان وزمان
Observation        ← مجموعة Features في لحظة واحدة
Anomaly            ← شذوذ مكتشف
Event              ← نوع حدث معروف (water_leak, subsidence...)
Hypothesis         ← فرضية في سياق منافسة محددة
Evidence           ← دليل بمعنى فيزيائي
Inference          ← نتيجة منافسة الفرضيات
Pattern            ← نمط مكاني/زمني (معروف أو مجهول)
GroundTruth        ← تحقق ميداني
MaintenanceRecord  ← سجل صيانة من ERP
SpatialMemory      ← ذاكرة مكانية لمنطقة معينة

EDGE TYPES:

Asset    -[IS_TYPE]->           AssetType
Asset    -[LOCATED_IN]->        Environment
Asset    -[CONNECTED_TO {type, direction}]-> Asset   ← شبكة الأصول
Asset    -[HAS_OBSERVATION]->   Observation
Asset    -[HAS_ANOMALY]->       Anomaly
Asset    -[EXPERIENCED {confirmed_at}]-> Event       ← تاريخ الأحداث
Asset    -[HAS_MAINTENANCE]->   MaintenanceRecord

AssetType -[MAY_EXPERIENCE]->   Event
AssetType -[CANNOT_EXPERIENCE]-> Event
AssetType -[MONITORED_BY]->     PhysicalSignal      ← أي إشارات مهمة لهذا النوع

PhysicalSignal -[MEASURED_BY]-> DataSource
PhysicalSignal -[SUPPORTS {direction, weight}]-> Event
PhysicalSignal -[REFUTES {condition}]->  Event

Observation -[FROM_SOURCE]->    DataSource
Observation -[CONTAINS]->       Feature
Observation -[CONTEXT]->        Hypothesis          ← السياق الزمني عند الملاحظة

Anomaly  -[DETECTED_IN]->       Observation
Anomaly  -[INVOLVES_SIGNAL]->   PhysicalSignal
Anomaly  -[EXPLAINED_BY]->      Inference
Anomaly  -[MATCHES_PATTERN]->   Pattern

Hypothesis -[PROPOSES]->        Event
Hypothesis -[SUPPORTED_BY {weight, quality}]-> Evidence
Hypothesis -[REFUTED_BY {weight, quality}]->   Evidence
Inference  -[WINNER]->          Hypothesis
Inference  -[VERIFIED_BY]->     GroundTruth

Pattern  -[LOCATED_AT]->        SpatialMemory
Pattern  -[PRECEDES {avg_days}]-> Pattern            ← تسلسل سببي
Pattern  -[CAUSED_BY]->         Event
```

---

## المكون الأول: Asset Behavior Model v2

### 1.1 Static Profile — بدون تغيير من v1 (صحيح كما هو)

### 1.2 الجديد: Versioned Behavior Profile

**المشكلة في v1**: عند تحديث الـ Baseline، تُحذف القيم القديمة.

هذا يعني:
- لا يمكن اكتشاف التدهور التدريجي على سنوات.
- لا يمكن المقارنة بين "سلوك 2020" و"سلوك 2025".
- الصيانة الكبرى تُغيّر الـ Baseline مما يُخفي الشذوذ اللاحق.

**الحل: Behavioral Version Control**

```
BehaviorVersion {
  version_id:      "v4"
  asset_id:        "PIPE-WTR-0044"
  valid_from:      "2024-03-15"
  valid_until:     null  ← الإصدار الحالي
  
  trigger:         "MAJOR_MAINTENANCE"   ← سبب الإصدار الجديد
  trigger_detail:  "استبدال قطعة بطول 200m"
  
  behavior_cells:  [...] ← نفس هيكل v1 لكن مُعلَّب في إصدار
  
  delta_from_prev: {
    NDMI: {change: -0.02, significance: "MINOR"},
    SAR_VV: {change: +0.5, significance: "MODERATE"}
  }
}
```

**فائدة إضافية**: الـ delta بين الإصدارات هو بذاته مؤشر صحة طولي.
أصل تتدهور قيم Baseline الخاصة به تدريجيًا → نمط تدهور تراكمي.

---

### 1.3 Context Space v2 — تحسين على v1

**نقد v1**: الأبعاد الأربعة صحيحة، لكن مصدر "NEAR_ACTIVITY" من أين يأتي؟

في v1 قلنا: "من GIS". لكن لم نحدد كيف. هذا ثغرة تنفيذية.

**الحل في v2**: Context يُحسب من مصادر محددة ومُعلَّمة:

```
CONTEXT RESOLVER:

context_season:
  SOURCE: Open-Meteo historical temperature monthly average
  RULE:   IF avg_temp > 30°C AND precipitation < 20mm/month → HOT_DRY
          IF avg_temp 15-30°C AND precipitation < 50mm/month → MILD_DRY
          ELSE → COOL_WET
  CONFIDENCE: HIGH (بيانات منتظمة)

context_moisture:
  SOURCE: Open-Meteo precipitation last 30 days
  RULE:   < 5mm → DRY, 5-30mm → MOIST, > 30mm → WET
  CONFIDENCE: HIGH

context_ops:
  SOURCE: ERP Maintenance Records API
  RULE:   IF maintenance_within_60days → POST_MAINT
          IF construction_permit_within_200m (OSM/local GIS) → NEAR_ACTIVITY
          ELSE → NORMAL
  CONFIDENCE: MEDIUM (يعتمد على جودة ERP)
  FALLBACK: NORMAL with uncertainty flag

context_vicinity:
  SOURCE: FAO crop calendar + local satellite NDVI trend
  RULE:   IF NDVI significant increase in agricultural zone within 500m → IRRIGATION_ACTIVE
          IF SAR motion detection in 300m buffer → HIGH_TRAFFIC
          ELSE → NORMAL
  CONFIDENCE: MEDIUM
```

---

## المكون الثاني: Anomaly Engine v2

### 2.1 تغيير مهم: فصل الشذوذ المكاني عن الزمني

v1 دمجهما. هذا خطأ. هناك نوعان مختلفان:

```
TEMPORAL ANOMALY:
  "هذا الأصل الآن مختلف عن سلوكه التاريخي في نفس السياق"
  يُكشف عبر: z-score مقارنة بـ Behavior Profile

SPATIAL ANOMALY:
  "هذا المكان داخل أو حول الأصل مختلف عن المناطق المشابهة المجاورة"
  يُكشف عبر: Local Spatial Autocorrelation (Anselin Local Moran's I)
```

**لماذا الفصل؟**

| الحالة | Temporal | Spatial | التفسير المحتمل |
|---|---|---|---|
| شذوذ زمني فقط | ✓ | - | تغيير حالة الأصل كله (صيانة، موسم غير عادي) |
| شذوذ مكاني فقط | - | ✓ | نقطة ساخنة جديدة لم يرها النظام من قبل |
| كلاهما | ✓ | ✓ | الأقوى: شيء يحدث في مكان ووقت محدد |
| لا شيء | - | - | طبيعي |

---

### 2.2 Evidence Quality Framework — جديد

**كل دليل يُقيَّم قبل استخدامه:**

```
EVIDENCE QUALITY SCORE = f(
  Data Quality,
  Temporal Relevance,
  Spatial Coverage,
  Source Calibration,
  Cross-Source Consistency
)

حساب تفصيلي:

1. Data Quality (0→1):
   - للبيانات الرادارية: noise figure, incidence angle
   - للبيانات البصرية: cloud_cover%, shadow_mask%, NDVI saturation
   - للبيانات الحرارية: atmospheric correction quality
   - مثال: صورة Sentinel-2 ب 15% cloud cover → DQ = 0.85

2. Temporal Relevance (0→1):
   - عمر الملاحظة مقارنة بالحدث المفترض
   - للشذوذ السريع (حريق، انسكاب): ملاحظة عمرها 10 أيام → TR = 0.1
   - للشذوذ البطيء (هبوط أرض): ملاحظة عمرها 10 أيام → TR = 0.9
   - يُعرَّف decay_rate لكل نوع إشارة فيزيائية

3. Spatial Coverage (0→1):
   - نسبة منطقة الشذوذ المغطاة بالملاحظة
   - دقة مكانية مقارنة بحجم الظاهرة
   - مثال: تسرب متوقع 50m × تحليل LST بدقة 100m → SC = 0.5

4. Source Calibration (0→1):
   - متى آخر معايرة للمصدر؟
   - هل يتوافق مع مصادر أخرى في نفس المنطقة؟
   - للبيانات التجارية: هل هناك تقرير معايرة؟

5. Cross-Source Consistency (0→1):
   - هل يتفق هذا المصدر مع مصادر أخرى تقيس نفس الإشارة؟
   - اتفاق: يرفع الجودة. تعارض: يخفضها ويُثير تحقيقًا.

EQ_Score = w1×DQ + w2×TR + w3×SC + w4×Cal + w5×CSC

أوزان افتراضية: [0.25, 0.25, 0.20, 0.15, 0.15]

الحد الأدنى: EQ < 0.3 → الدليل يُستبعد نهائيًا (لا يستحق المعالجة)
             EQ 0.3-0.6 → يُستخدم بوزن مخفوض
             EQ > 0.6 → يُستخدم بوزنه الكامل
```

---

## المكون الثالث: Hypothesis Competition v2 + Causal Reasoning

### 3.1 إضافة طبقة Causal Chain

**نقد v1**: المنافسة كانت تنظر إلى الأدلة في لحظة واحدة.

الواقع: الأحداث تترك **أثرًا زمنيًا متسلسلًا** له ترتيب يمكن التحقق منه.

**Causal Chain Library:**

```yaml
event: WATER_LEAK
causal_chain:
  - step: 1
    signal: SOIL_MOISTURE
    direction: INCREASE
    expected_lag_days: 0-3
    spatial_pattern: "linear, near centerline"
    
  - step: 2
    signal: SURFACE_TEMP
    direction: DECREASE
    expected_lag_days: 1-5
    prerequisite: "step_1_confirmed"
    spatial_pattern: "co-located with step_1"
    
  - step: 3
    signal: SAR_BACKSCATTER
    direction: DECREASE
    expected_lag_days: 0-7
    spatial_pattern: "co-located"
    
  - step: 4
    signal: VEGETATION_INDEX
    direction: INCREASE
    expected_lag_days: 14-30
    prerequisite: "step_1_confirmed"
    note: "ليس ضروريًا، لكن يُقوي الاستنتاج إذا وُجد"

causal_chain_vs_rain:
  # لماذا هذا مختلف عن المطر؟
  differentiators:
    - "المطر: SOIL_MOISTURE ترتفع في نفس اليوم على مساحة واسعة"
    - "التسرب: SOIL_MOISTURE ترتفع تدريجيًا في خط ضيق"
    - "المطر: SAR_BACKSCATTER يرتفع (surface roughening)"
    - "التسرب: SAR_BACKSCATTER ينخفض (moisture absorption)"
    - "المطر: له سجل في بيانات الطقس"
    - "التسرب: لا مصدر طقسي يفسره"
```

**كيف يُستخدم الـ Causal Chain في المنافسة؟**

```
Causal_Alignment_Score(h) = 
  Σ_steps [ step_found × step_in_right_order × step_in_right_timing ]
  / total_expected_steps

هذا المقياس يُضاف إلى درجة المنافسة:

Final_Score(h) = Bayesian_Posterior(h) × (1 + α × Causal_Alignment_Score(h))

حيث α = 0.3 (التسلسل السببي يرفع الثقة بـ 30% عند اكتمال)
```

---

### 3.2 Decision Confidence vs. Evidence Completeness — جديد

**هذا تمييز غائب في كل النظم الموجودة.**

```
DECISION MATRIX:

لكل استنتاج، نُصدر مقياسين مستقلين:

Confidence (ثقة الاستنتاج):
  "بناءً على الأدلة المتوفرة، ما احتمال صحة الفرضية الفائزة؟"
  نطاق: 0→1

Evidence_Completeness (اكتمال الأدلة):
  "ما نسبة الأدلة المثالية المتوفرة فعلًا؟"
  نطاق: 0→1
  
  يُحسب هكذا:
    Ideal_Evidence_Set = جميع الإشارات الموصوفة في Evidence File للحدث
    Available_Evidence = الإشارات الجيدة الجودة الموجودة فعلًا
    EC = |Available ∩ Ideal| / |Ideal|

أربعة أنواع من الاستنتاجات:

┌──────────────────┬──────────────────────────────────────────────┐
│ Confidence >0.75 │ EC > 0.7                                     │
│ EC > 0.7         │ "استنتاج موثوق بأدلة كافية"                 │
│                  │ التوصية: تحقق ميداني خلال 48 ساعة           │
├──────────────────┼──────────────────────────────────────────────┤
│ Confidence >0.75 │ EC < 0.4                                     │
│ EC < 0.4         │ "ثقة ظاهرية: اليقين مبني على أدلة قليلة"   │
│                  │ التوصية: اجمع بيانات إضافية أولًا           │
│                  │ خطر: False Positive مرجح                    │
├──────────────────┼──────────────────────────────────────────────┤
│ Confidence <0.5  │ EC > 0.7                                     │
│ EC > 0.7         │ "بيانات كثيرة لكن الصورة غامضة"            │
│                  │ التوصية: تحليل أعمق + مقارنة شبكة الأصول   │
├──────────────────┼──────────────────────────────────────────────┤
│ Confidence <0.5  │ EC < 0.4                                     │
│ EC < 0.4         │ "لا نعرف: بيانات غير كافية"                 │
│                  │ التوصية: لا تصرف، فقط مراقبة               │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## المكون الرابع: Asset Network Intelligence — جديد

### 4.1 الفلسفة

الأصول في الواقع ليست كيانات مستقلة. هي **شبكات فيزيائية**.

ضغط في بئر → ينعكس على محطة الضخ → يتردد على خط النقل.
تسرب في خط نقل → يُقلل الضغط في الخزان → يظهر كشذوذ في شبكة التوزيع.

إذا لم نفهم الشبكة، نصدر 5 تنبيهات منفصلة بدلًا من تنبيه واحد لحادثة واحدة.

---

### 4.2 Network Graph Design

```
ASSET NETWORK EDGES (نوع العلاقة يُحدد منطق الانتشار):

PHYSICAL_FLOW {direction: A→B, flow_type: water/oil/electricity}
  ← شبكات الأنابيب والكهرباء

STRUCTURAL_DEPENDENCY {type: supports/adjacent}
  ← مبنى يستند على جسر، أنبوب يمر تحت طريق

HYDRAULIC_DOMAIN {type: upstream/downstream}
  ← علاقات هيدرولوجية (حوض تصريف، سد ونهر)

GEOGRAPHIC_PROXIMITY {distance_m: float, significance: HIGH/MED/LOW}
  ← أصول متجاورة تُأثر على بعضها البعض
```

---

### 4.3 Network Anomaly Correlation Engine

```
الخوارزمية:

الخطوة 1: اكتشاف الشذوذات المتزامنة
  للفترة الزمنية [T-W, T]:
    anomalies = {all assets with anomaly_score > 0.6}

الخطوة 2: البحث عن مجموعات مترابطة
  للكل anomaly_i, anomaly_j في anomalies:
    IF هناك مسار في الـ Network Graph بين asset_i و asset_j:
      correlation_strength = f(
        network_distance,     ← قرب الأصلين في الشبكة
        temporal_proximity,   ← قرب الشذوذين في الزمن
        anomaly_similarity,   ← تشابه نوع الشذوذ
        flow_alignment        ← هل الشذوذ يسير باتجاه التدفق؟
      )
      
      IF correlation_strength > threshold:
        group = {asset_i, asset_j, ...}  ← مجموعة شذوذ مترابطة

الخطوة 3: رفع الثقة لكل الفرضيات المترابطة
  IF water_leak_hypothesis في asset_i ← مترابطة مع anomaly في asset_j:
    IF asset_j هو downstream من asset_i:
      P(water_leak | network_context) += Network_Boost  (مثلًا: +0.15)

الخطوة 4: توليد Event Cluster
  IF مجموعة مترابطة > 2 أصول:
    → إنشاء "Cluster Incident" بدلًا من تنبيهات منفردة
    → مع خريطة انتشار الشذوذ عبر الشبكة
    → مع احتمال أن تكون حادثة واحدة
```

---

### 4.4 مثال عملي: تسرب رئيسي في خط نقل

```
الأصول المتأثرة:
  PUMP-04 (upstream) → شذوذ ضغط صغير (+3 days)
  PIPE-WTR-0044 (main leak point) → شذوذ NDMI كبير (t=0)
  RES-NORTH (downstream) → انخفاض منسوب (+5 days)
  DIST-ZONE-A (downstream) → شكاوى ضغط منخفض (+7 days)

Network Intelligence Output:
  "تم اكتشاف 4 شذوذات مترابطة في شبكة مياه الشمال.
   النمط يتوافق مع تسرب رئيسي في PIPE-WTR-0044 (الاحتمال: 0.87).
   الانتشار يسير باتجاه التدفق من محطة الضخ 04 إلى منطقة التوزيع أ.
   النقطة المشتبه بها: KM 12.3 من PIPE-WTR-0044."
```

---

## المكون الخامس: Spatial Memory — جديد

### 5.1 التعريف

الـ Spatial Memory هي إجابة على سؤال:

> "هل رأينا شيئًا مشابهًا في هذه المنطقة تحديدًا من قبل؟"

وليس "هل حدث تسرب في هذا الأصل من قبل؟" — هذا تاريخ الأصل.

بل: "هل هذه البقعة الجغرافية بالذات تُظهر نفس النمط بشكل متكرر؟"

---

### 5.2 هيكل Spatial Memory

```
SpatialMemoryRecord {
  geohash:        "u5skegm"     ← خلية جغرافية (دقة ~50m × 50m)
  
  patterns: [
    {
      pattern_type:   "MOISTURE_PULSE"
      signal:         "SOIL_MOISTURE"
      direction:      "INCREASE"
      typical_magnitude: 2.8σ
      
      occurrences: [
        {date: "2021-08", confirmed_cause: "IRRIGATION"},
        {date: "2022-07", confirmed_cause: "IRRIGATION"},
        {date: "2023-08", confirmed_cause: "IRRIGATION"},
        {date: "2024-09", confirmed_cause: "WATER_LEAK"}  ← هذه المرة مختلف
      ]
      
      recurrence_pattern: "SEASONAL_AUGUST"
      exception_flag: true  ← 2024-09 خارج موسمها
    }
  ]
}
```

### 5.3 كيف تُستخدم Spatial Memory في المنافسة؟

```
عند تحليل شذوذ في geohash X:

IF الـ Spatial Memory تقول "هذه المنطقة تُظهر رطوبة كل أغسطس بسبب ري":
  → يُرفع Prior للفرضية IRRIGATION_EFFECT في أغسطس
  → يُخفَّض Prior للفرضية WATER_LEAK في أغسطس

IF الـ Spatial Memory تقول "هذه المنطقة شهدت تسرب مؤكد في 2021":
  → يُرفع Prior للفرضية WATER_LEAK (المنطقة ذات تاريخ)
  → يُضاف في التقرير: "تنبيه: نفس الموقع شهد تسرب مؤكد في 2021"

IF الـ Spatial Memory تقول "لم نشهد أي نمط في هذه المنطقة من قبل":
  → لا تعديل على Prior
  → يُشار إلى "أول ظهور لهذا النمط في هذه المنطقة"
```

---

## المكون السادس: Unknown Pattern Discovery — جديد

### 6.1 الفلسفة — Open World Assumption

النظام لا يعرف كل شيء. بعض الشذوذات لن تطابق أي فرضية معروفة.

الحل الخاطئ: إجبار الشذوذ على أقرب فرضية معروفة.
الحل الصحيح: الاعتراف بالجهل والبناء عليه.

---

### 6.2 متى يُفعَّل Unknown Pattern Discovery؟

```
يُفعَّل عند:
  1. أعلى P(hypothesis) في المنافسة < 0.35  ← لا فائز واضح
  2. DATA_ERROR ليست الأعلى  ← الشذوذ حقيقي
  3. anomaly_score > 0.6  ← الشذوذ معنوي

يُطلق:
  UNKNOWN_PATTERN record
```

---

### 6.3 هيكل Unknown Pattern Record

```json
{
  "pattern_id": "UNK-20260708-PIPE-0044-001",
  "asset_id": "PIPE-WTR-0044",
  "detection_time": "2026-07-08T14:30:00Z",
  "status": "UNDER_INVESTIGATION",
  
  "anomaly_description": {
    "anomaly_score": 0.73,
    "spatial_extent": "POINT",
    "location": {"lat": 32.891, "lon": 13.207},
    "onset_estimated": "2026-07-01",
    "trend": "INCREASING"
  },
  
  "signals_anomalous": [
    {"signal": "SAR_BACKSCATTER", "z_score": +3.1, "direction": "INCREASE"},
    {"signal": "SURFACE_TEMP", "z_score": +2.8, "direction": "INCREASE"},
    {"signal": "SOIL_MOISTURE", "z_score": -1.2, "direction": "DECREASE"}
  ],
  
  "closest_known_hypotheses": [
    {"event": "FIRE", "max_score": 0.28, "reason_low": "لا NDVI loss، لا SAR texture change"},
    {"event": "OIL_CONTAMINATION", "max_score": 0.22, "reason_low": "خط مياه، غير ممكن فيزيائيًا"}
  ],
  
  "why_unknown": "النمط الحراري يشبه حريقًا لكن الأصل خط مياه. الـ SAR يرتفع بدلًا من أن ينخفض.",
  
  "data_collection_needed": [
    "صورة بصرية عالية الدقة (< 5m) للمنطقة",
    "زيارة ميدانية لفحص السطح بصريًا",
    "قياس درجة حرارة سطحية بالحرارة اليدوية"
  ],
  
  "priority": "MEDIUM",
  "escalation_if_no_action_days": 7
}
```

### 6.4 دورة حياة Unknown Pattern

```
UNKNOWN → UNDER_INVESTIGATION
       → [بعد زيارة ميدانية]
       → EXPLAINED: يُحدَّث كـ Inference عادي
       → NEW_EVENT_TYPE: يُضاف لـ Event Catalogue الخاص بهذا النوع من الأصل
       → BENIGN: طبيعي لم يكن في Behavior Profile، يُضاف لـ Baseline
       → UNRESOLVED: تُحفَّظ للدراسة المستقبلية
```

---

## المكون السابع: Behavior Evolution Engine — جديد

### 7.1 المشكلة التي يحلها

الـ Behavior Profile يجب أن يتطور. لكن كيف نُطوِّره دون:
- أن نفقد التاريخ؟
- أن ندمج بيانات الأحداث مع البيانات الطبيعية؟
- أن "نُعلِّم" الـ Baseline على شذوذات تكررت؟

---

### 7.2 Incremental Update Rules

```
RULE 1 — التحديث العادي (كل ربع سنة):
  أضف ملاحظات جديدة (غير مرتبطة بأحداث مؤكدة) للـ Behavior Cell
  أعد حساب الإحصاءات
  إذا تغير الـ mean بأكثر من 1σ من الـ mean التاريخي → أنشئ إصدارًا جديدًا

RULE 2 — بعد تحقق ميداني يؤكد الطبيعية:
  أضف الملاحظة المعنية للـ Behavior Cell مباشرة
  هذه "أقوى بيانات" لأنها مؤكدة ميدانيًا → أعطها وزنًا مضاعفًا

RULE 3 — بعد حدث مؤكد:
  لا تُضف ملاحظات فترة الحدث للـ Baseline
  لكن سجّل التغيير الدائم إذا أُصلح الأصل بطريقة مختلفة

RULE 4 — اكتشاف التدهور التدريجي:
  إذا لاحظ النظام أن الـ Baseline نفسه يتغير تدريجيًا (drift):
    → إصدار تحذير: "سلوك الأصل يتغير تدريجيًا"
    → هذا قد يكون تدهورًا تراكميًا يُخفيه التحديث التلقائي
    
  مقياس Drift Detection:
    baseline_drift = |mean_current_version - mean_original_version| / σ_original
    IF drift > 2.0 → تحذير "تدهور محتمل في Baseline"
```

---

### 7.3 Behavioral Age Modeling

بعض الأصول تتغير سلوكها مع العمر بشكل قابل للتنبؤ:

```
PIPE_AGING_MODEL (for material: HDPE, age: 10+ years):
  expected_annual_degradation:
    SAR_coherence: -0.5% per year (يصبح السطح أكثر اضطرابًا)
    NDMI_baseline: +0.01 per year (تسربات دقيقة تراكمية)
  
  → النظام يُطبق Proactive Baseline Adjustment
  → يُحذر عندما يتجاوز التدهور الفعلي التدهور المتوقع
```

---

## المكون الثامن: Health Score v2

### 8.1 تحسين على v1: فصل الصحة عن التنبيه

في v1، كانت الصحة مرتبطة بالـ Anomaly Score.

في v2، الصحة لها مصادر إضافية:

```
HEALTH SCORE v2 COMPONENTS:

1. Anomaly-Based Health (40%):
   ← Anomaly Score المعكوس
   ← "هل الأصل طبيعي الآن؟"

2. Trend-Based Health (25%):
   ← معدل تغيير Behavior Baseline (drift)
   ← "هل الأصل يتدهور تدريجيًا؟"

3. Historical Incident Health (20%):
   ← عدد ونوع الأحداث المؤكدة في السنوات الثلاث الماضية
   ← "ما تاريخه؟"

4. Age & Maintenance Health (15%):
   ← عمر الأصل مقارنة بعمر التصميم
   ← وقت آخر صيانة
   ← "ما وضعه التشغيلي؟"
```

### 8.2 مخرجات Health Score v2

```json
{
  "asset_id": "PIPE-WTR-0044",
  "health_calc_time": "2026-07-08T00:00:00Z",
  
  "overall_score": 71,
  "grade": "C",
  
  "components": {
    "anomaly_health":   {"score": 68, "weight": 0.40, "note": "شذوذ نشط متوسط"},
    "trend_health":     {"score": 55, "weight": 0.25, "note": "drift تراكمي ملحوظ"},
    "historical_health":{"score": 82, "weight": 0.20, "note": "حادثة واحدة في 5 سنوات"},
    "maintenance_health":{"score": 90, "weight": 0.15, "note": "صيانة حديثة"}
  },
  
  "trend": {
    "direction": "DECLINING",
    "rate_per_week": -1.8,
    "projected_score_30d": 66,
    "projected_score_90d": 59
  },
  
  "scenarios": {
    "if_maintenance_now": {"score_30d": 82, "note": "يُوقف التدهور"},
    "if_no_action": {"score_90d": 59, "alert_threshold_eta": "~8 weeks"}
  },
  
  "primary_concern": "trend_degradation_in_behavior_baseline",
  "recommendation": "فحص ميداني وقائي + مراجعة بيانات SAR التاريخية"
}
```

---

## المكون التاسع: Ground Truth v2 — الحلقة الكاملة

### 9.1 ما يُحدَّث عند كل تحقق ميداني

```
CONFIRMED (حدث مؤكد):
  ✓ Inference record → status: VERIFIED_CORRECT
  ✓ Evidence Weights → Bayesian update (ما كان أقوى تنبؤًا؟)
  ✓ Prior Probabilities → رفع prior لهذا الحدث في هذا السياق
  ✓ Causal Chain → هل تسلسل الأدلة طابق التوقع؟ → تحديث أوقات التسلسل
  ✓ Spatial Memory → إضافة occurrence للـ pattern في هذا الـ geohash
  ✓ Knowledge Graph → إضافة حافة EXPERIENCED من Asset إلى Event

FALSE_POSITIVE (إنذار خاطئ):
  ✓ False Pattern Documentation في Spatial Memory
  ✓ Evidence Weight المُخطئ → يُخفَّض
  ✓ تحليل: أي context أوقع النظام في الخطأ؟ → تحسين Context Resolver
  ✓ إضافة حالة للـ Unknown Benign Library
  → هذه المعلومة تمنع نفس الخطأ مستقبلًا

MISCLASSIFIED (حدث مختلف عما توقع النظام):
  ✓ الحدث الفعلي يُضاف للـ Knowledge Graph
  ✓ مراجعة Evidence File لكلا الحدثين
  ✓ هل يجب إضافة evidence مميز بين الحدثين؟
  → قد يتطلب تحديث Evidence Library يدويًا

UNKNOWN_RESOLVED (نمط مجهول تم تفسيره):
  ✓ IF نوع حدث موجود: يُضاف كـ CONFIRMED
  ✓ IF نوع حدث جديد: يُضاف لـ Event Catalogue
  ✓ بيانات الـ Unknown Pattern تصبح Training Data للأنماط الجديدة
```

---

## نموذج البيانات v2

### طبقة أولى: Knowledge Graph (Neo4j)

```cypher
// Asset Node
CREATE (a:Asset {
  asset_id: 'PIPE-WTR-0044',
  name_ar: 'خط المياه الرئيسي - الشمال',
  type_code: 'WATER_PIPELINE',
  criticality: 0.85,
  geometry_wkt: 'LINESTRING(...)'
})

// Network Edge
MATCH (a1:Asset {id:'PUMP-04'}), (a2:Asset {id:'PIPE-WTR-0044'})
CREATE (a1)-[:CONNECTED_TO {
  flow_type: 'water',
  direction: 'a1_to_a2',
  connection_type: 'PHYSICAL_FLOW'
}]->(a2)

// Event History Edge
MATCH (a:Asset {id:'PIPE-WTR-0044'}), (e:Event {type:'WATER_LEAK'})
CREATE (a)-[:EXPERIENCED {
  confirmed_at: datetime('2021-03-15'),
  location_wkt: 'POINT(13.201 32.885)',
  severity: 'MODERATE'
}]->(e)

// Physical Signal → Event Relationship
MATCH (s:PhysicalSignal {id:'SOIL_MOISTURE'}), (e:Event {type:'WATER_LEAK'})
CREATE (s)-[:SUPPORTS {
  direction: 'INCREASE',
  weight: 0.30,
  physical_reason: 'الماء يرفع الرطوبة',
  biome_specific: 'ARID'
}]->(e)
```

### طبقة ثانية: Time Series (TimescaleDB)

```sql
-- الملاحظات الزمنية للمعالم
CREATE TABLE feature_observations (
  obs_time       TIMESTAMPTZ NOT NULL,
  asset_id       UUID NOT NULL,
  signal_id      TEXT NOT NULL,
  value          FLOAT,
  evidence_quality FLOAT,         -- EQ_Score المحسوب
  source_id      TEXT,
  context_hash   TEXT,            -- hash لـ Context الأربعة أبعاد
  is_event_period BOOLEAN DEFAULT FALSE  -- هل هذه فترة حدث مؤكد؟
);
SELECT create_hypertable('feature_observations', 'obs_time');

-- Health History
CREATE TABLE asset_health_history (
  calc_time      TIMESTAMPTZ NOT NULL,
  asset_id       UUID NOT NULL,
  overall_score  FLOAT,
  components     JSONB,
  trend_7d       FLOAT,
  trend_30d      FLOAT,
  trend_90d      FLOAT
);
SELECT create_hypertable('asset_health_history', 'calc_time');
```

### طبقة ثالثة: Spatial Store (PostGIS)

```sql
-- Behavior Cells (لا تغيير كبير من v1، لكن مع Versioning)
CREATE TABLE behavior_cell (
  cell_id        UUID PRIMARY KEY,
  asset_id       UUID NOT NULL,
  behavior_version TEXT NOT NULL,      -- ← إضافة جديدة
  context_hash   TEXT NOT NULL,
  signal_id      TEXT NOT NULL,
  mean           FLOAT,
  std            FLOAT,
  p05            FLOAT,
  p95            FLOAT,
  n_obs          INT,
  confidence     TEXT,
  drift_from_v1  FLOAT,               -- ← الانجراف من الإصدار الأول
  UNIQUE (asset_id, behavior_version, context_hash, signal_id)
);

-- Spatial Memory
CREATE TABLE spatial_memory (
  geohash        TEXT NOT NULL,       -- دقة 7 (±76m)
  signal_id      TEXT NOT NULL,
  pattern_type   TEXT,
  occurrences    JSONB,               -- مصفوفة التواريخ والأسباب
  recurrence_period TEXT,            -- SEASONAL_SUMMER, RANDOM, etc.
  last_updated   TIMESTAMPTZ,
  PRIMARY KEY (geohash, signal_id)
);

-- Unknown Patterns
CREATE TABLE unknown_patterns (
  pattern_id     UUID PRIMARY KEY,
  asset_id       UUID,
  detection_time TIMESTAMPTZ,
  status         TEXT,
  anomaly_desc   JSONB,
  signals_anomalous JSONB,
  data_needed    JSONB,
  priority       TEXT,
  resolution     JSONB               -- يُملأ عند الحل
);
```

---

## Technology Stack المُوصى به

**هذا أفضل stack للمشروع بناءً على المتطلبات الفعلية:**

```
KNOWLEDGE GRAPH:
  Neo4j Community → Production  
  السبب: Graph traversal لا يُقارَن بـ SQL لهذا النوع من الاستعلامات

TIME SERIES:
  TimescaleDB (PostgreSQL extension)
  السبب: مجاني، مدمج مع PostGIS، أداء ممتاز، SQL معروف للفريق

SPATIAL:
  PostGIS (نفس instance مع TimescaleDB)
  السبب: معيار الصناعة

SIGNAL PROCESSING:
  Python + Dask + rasterio
  السبب: النظام البيئي الأقوى لمعالجة البيانات الجغرافية

ORCHESTRATION:
  Apache Airflow
  السبب: تنسيق pipelines المعالجة، scheduling ذكي لكل tier

API:
  FastAPI + GraphQL (Strawberry)
  السبب: GraphQL طبيعي لـ Knowledge Graph

MESSAGE QUEUE:
  Redis Streams (بدلًا من Kafka في البداية)
  السبب: أبسط، كافٍ لـ PoC، يُرقَّى لاحقًا

FRONTEND:
  المنصة الحالية (Next.js) مع إضافة Health Score panels
```

---

## خطة التنفيذ المُعاد تصميمها

**المبدأ**: نبني أولًا ما يُثبت الفكرة، ثم ما يُضيف قيمة حقيقية.

```
PHASE 0 — Foundation (الشهر 1-2):
  الهدف: بنية تحتية صحيحة من البداية

  □ Neo4j schema + seed data (3-5 أصول تجريبية)
  □ Signal Abstraction Layer (Sentinel-2 + Open-Meteo فقط)
  □ Asset Registry + Static Profiles
  □ Context Resolver (4 أبعاد)
  □ Feature Observation ingestion pipeline

  اختبار النجاح: "نستطيع استيعاب Sentinel-2 وتحويله لـ Physical Signals"

PHASE 1 — Core Intelligence (الشهر 2-4):
  الهدف: النظام يكتشف شذوذات حقيقية

  □ Behavior Profile Builder (v1 فقط، بدون versioning)
  □ Anomaly Engine (temporal + spatial منفصلين)
  □ Evidence Quality Framework
  □ أول Evidence File يدوي: WATER_LEAK في ARID

  اختبار النجاح: "النظام اكتشف حادثة تاريخية مؤكدة"

PHASE 2 — Reasoning (الشهر 4-6):
  الهدف: النظام يستنتج السبب

  □ Hypothesis Competition (Bayesian)
  □ Causal Chain Library (2-3 أحداث)
  □ Decision Confidence + Evidence Completeness
  □ Explainability Reports

  اختبار النجاح: "تقرير مقروء يفسر الاستنتاج بالكلام"

PHASE 3 — Health & Network (الشهر 6-9):
  الهدف: تقييم مستمر + فهم الشبكة

  □ Health Score Engine
  □ Asset Network Graph
  □ Network Anomaly Correlation
  □ Health Score Dashboard في المنصة الحالية

  اختبار النجاح: "خريطة صحة لجميع الأصول التجريبية"

PHASE 4 — Memory & Evolution (الشهر 9-12):
  الهدف: النظام يتعلم ويتذكر

  □ Spatial Memory
  □ Unknown Pattern Discovery
  □ Behavior Versioning
  □ Ground Truth Loop كامل
  □ Behavior Evolution Engine

  اختبار النجاح: "أول دورة تحقق ميداني تُحسِّن النموذج"

PHASE 5 — Scale & Learn (الشهر 12+):
  الهدف: الإطلاق الكامل والتعلم المستمر

  □ توسعة لجميع أنواع الأصول
  □ ML weight optimization
  □ Active Learning Loop
  □ Multi-tenant + Federated Knowledge
```

---

## الإجابة على التحدي النهائي

**"هل سيستطيع MINERVA استيعاب مصادر بيانات لم تكن موجودة اليوم؟"**

```
الجواب: نعم، بسبب قرارات تصميمية محددة:

1. Signal Abstraction Layer:
   لا يوجد في كود الـ Reasoning أي ذكر لـ "Sentinel" أو "Landsat".
   كل ما يعرفه هو "SOIL_MOISTURE" و"SURFACE_TEMP".
   مصدر جديد = connector جديد في Signal Library فقط.

2. Knowledge Graph Extensibility:
   إضافة مصدر جديد = إضافة Node لـ DataSource + Edges لـ PhysicalSignal.
   لا تغيير في منطق الاستنتاج.

3. Evidence Definition by Physics:
   Evidence يُعرَّف بـ "ماذا يعني" وليس "من أين جاء".
   LiDAR فضائي جديد؟ يقيس ELEVATION_CHANGE → يُضاف لـ Evidence[DEM_CHANGE].
   Hyperspectral جديد؟ يقيس إشارات طيفية أدق → يُضاف كـ Physical Signal جديد.

4. Unknown Pattern Discovery:
   إذا أعطى المصدر الجديد إشارات لا نعرف تفسيرها الفيزيائي بعد،
   ستُصنَّف كـ Unknown Pattern وتنتظر التفسير البشري.
   النظام لن ينهار.
```

---

## المبدأ الختامي

**MINERVA ليست نظام برمجي. هي عقل مكاني.**

عقل يعرف كيف يُفكر، ليس فقط كيف يُحلّل.

```
يعرف ما هو طبيعي          ← Behavior Profile
يلاحظ ما هو مختلف         ← Anomaly Engine
يسأل: لماذا؟               ← Hypothesis Competition
يُعلن عدم اليقين صراحةً  ← Decision Confidence + Unknown Pattern
يتذكر ما حدث هنا         ← Spatial Memory
يفهم الشبكة كاملة         ← Network Intelligence
يتطور مع الزمن            ← Behavior Evolution + Ground Truth
يشرح قراره بالكلام         ← Explainability Layer
```

وعندما تظهر تقنية جديدة لم تكن موجودة اليوم، يستقبلها MINERVA دون أن يُعيد اختراع نفسه.

لأنه صُمِّم على المنطق الفيزيائي، لا على الأدوات التقنية.

---

*MINERVA Architecture v2.0 — DSP R&D Division — 2026-07-08*
*Complete Redesign by Chief Research Architect*
*تحول من Event Detection → Asset Intelligence → Spatial Reasoning Brain*
