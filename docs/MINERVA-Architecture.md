# MINERVA — Asset Spatial Intelligence Engine
## Multi-source INtelligence Engine for Reasoning and Verifying Asset-health

> **تحول فلسفي جذري عن ARGUS v1**
>
> ARGUS كان يسأل: *"ماذا حدث هنا؟"*
>
> MINERVA تسأل: *"هل هذا الأصل يتصرف بشكل طبيعي؟"*
>
> هذا ليس تغيير اسم. هذا تغيير في نقطة البداية الكاملة.

---

## لماذا تغيير الاسم والفلسفة؟

**ARGUS كان يبدأ من الحدث → يبحث عن الدليل.**

هذا يعني أن النظام يحتاج أن يعرف ما يبحث عنه قبل أن يجد شيئًا.
وهذا خطأ في المنهج.

**MINERVA تبدأ من الأصل → تراقب السلوك → تكتشف الشذوذ → تستنتج السبب.**

هذا هو الترتيب الطبيعي للمعرفة:
1. أعرف كيف يبدو الحال الطبيعي.
2. ألاحظ شيئًا مختلفًا.
3. أسأل: ما الذي يمكن أن يفسر هذا الاختلاف؟
4. أختار التفسير الأقوى.

---

## القواعد التصميمية الأساسية

قبل أي مكون، يجب أن يلتزم كل قرار هندسي بهذه القواعد:

1. **المنطق قبل الخوارزمية**: إذا لم يمكن تفسير القرار بالكلام البشري البسيط، فهو قرار خاطئ.
2. **الفيزياء قبل الإحصاء**: القانون الفيزيائي لا يستثنى. الإحصاء يُقيس الاحتمال ضمن ما هو ممكن فيزيائيًا.
3. **الشك الصريح أفضل من اليقين الزائف**: إذا لم تكن البيانات كافية، يقول النظام "لا أعرف" — ولا يُقدِّم تخمينًا مرتبًا.
4. **كل استنتاج قابل للتفنيد**: يجب أن يذكر النظام ما الذي سيغير استنتاجه لو وُجد.

---

## المكون الأول: Asset Behavior Model — نموذج سلوك الأصل

### 1.1 ما الذي نحتاج وصفه فعلًا؟

الأصل ليس نقطة على الخريطة. الأصل هو **كيان حي يتصرف**.

لوصف تصرفاته نحتاج ثلاثة أبعاد:

```
┌─────────────────────────────────────────────────────┐
│              ASSET BEHAVIOR SPACE                   │
│                                                     │
│  البعد الأول: الخصائص الثابتة (لا تتغير)           │
│  البعد الثاني: الحالة الحالية (تتغير ببطء)          │
│  البعد الثالث: السلوك المشروط (يتغير مع السياق)    │
└─────────────────────────────────────────────────────┘
```

---

### 1.2 الخصائص الثابتة (Static Profile)

```yaml
asset_static_profile:
  # الهوية
  asset_id:          "PIPE-WTR-0044"
  name_ar:           "خط المياه الرئيسي - الشمال"
  asset_class:       "WATER_PIPELINE"        # ← أساسي لـ Event Catalogue
  asset_subclass:    "TRANSMISSION"          # نقل رئيسي، ليس توزيع

  # الموقع
  geometry:
    centerline:      LINESTRING(...)
    buffer_10m:      POLYGON(...)            # منطقة حرم ضيق
    buffer_50m:      POLYGON(...)            # منطقة حرم واسع

  # الخصائص الفيزيائية
  physical:
    material:        "HDPE"
    diameter_mm:     400
    depth_m:         1.2
    pressure_bar:    8.5
    installation_year: 2014

  # البيئة المحيطة (تُحسب مرة وتُخزَّن)
  environment:
    biome:           "ARID_SEMI_ARID"
    soil_type:       "SANDY_LOAM"
    terrain:         "FLAT_GENTLE"
    nearby_agriculture: true               # ري زراعي قريب؟
    flood_risk_zone: false
    seismic_zone:    "LOW"

  # الأهمية
  criticality:
    score:           0.85                   # 0→1
    population_served: 45000
    no_alternative_route: true
```

---

### 1.3 السلوك المشروط — الابتكار الحقيقي

**المشكلة مع Baseline التقليدي:**

Baseline تقليدي: "NDVI هذا الأصل في يوليو = 0.12 ± 0.05"

لكن هذا يخلط:
- يوليو بعد موجة حر طويلة ≠ يوليو بعد أسبوع أمطار
- يوليو مع ري زراعي قريب ≠ يوليو بدون ري
- يوليو بعد صيانة مؤخرًا ≠ يوليو بعد 3 سنوات بدون صيانة

**الحل: Conditional Baseline**

بدلًا من: `E[NDVI]`
نريد: `E[NDVI | Context]`

### 1.4 تعريف فضاء السياق (Context Space)

**تحدٍّ حقيقي يجب الاعتراف به:**

إذا عرّفنا السياق بدقة شديدة (مثلًا: "درجة حرارة 34-35°C، مطر 0-5mm في آخر 7 أيام، بعد الصيانة بـ 30-45 يومًا")، لن يكون لدينا بيانات كافية في كل خلية.

**القاعدة**: دقة السياق = دالة في كمية البيانات المتاحة.

لذلك نقترح **سياقًا خشنًا** بحدٍّ أقصى من الأبعاد يضمن وجود بيانات كافية:

```
CONTEXT DIMENSIONS (أربعة أبعاد فقط):

البعد 1 — الموسم الحراري:
  HOT_DRY      (مثلًا: يونيو-أغسطس في شمال أفريقيا)
  MILD_DRY     (مثلًا: أبريل-مايو، سبتمبر-أكتوبر)
  COOL_WET     (مثلًا: نوفمبر-مارس)

البعد 2 — حالة الرطوبة الأخيرة:
  DRY          (هطول < 5mm في 30 يومًا)
  MOIST        (هطول 5-30mm في 30 يومًا)
  WET          (هطول > 30mm في 30 يومًا)

البعد 3 — الحالة التشغيلية:
  NORMAL       (تشغيل عادي)
  POST_MAINT   (< 60 يومًا بعد صيانة)
  NEAR_ACTIVITY (نشاط إنشاء/حفر في نطاق 200m)

البعد 4 — حالة المنطقة المحيطة:
  NORMAL
  IRRIGATION_ACTIVE    (ري زراعي نشط قريب)
  HIGH_TRAFFIC         (حركة معدات ثقيلة قريبة)

عدد الخلايا = 3 × 3 × 3 × 3 = 27 خلية سياق
كافية للبناء، مفسرة للمشغل.
```

---

### 1.5 بناء Behavior Profile لكل خلية سياق

لكل أصل × لكل خلية سياق × لكل معلم، نخزن:

```
BehaviorCell {
  asset_id:      "PIPE-WTR-0044"
  context:       {season: HOT_DRY, moisture: DRY, ops: NORMAL, vicinity: NORMAL}
  feature:       "NDMI"
  
  # الإحصاءات الوصفية
  n_observations: 47           ← عدد الملاحظات في هذه الخلية
  mean:           0.06
  std:            0.02
  percentile_5:  0.03
  percentile_95: 0.10
  
  # الثقة في الـ Baseline
  confidence:    HIGH           ← HIGH (n>30), MEDIUM (n=10-30), LOW (n<10)
  
  # التحقق الأخير
  last_updated:  2026-06-01
}
```

**قاعدة مهمة:** إذا كان `confidence = LOW`، فالنظام لا يُصدر تنبيهًا، بل يُصنِّف الملاحظة كـ "غير كافية البيانات". هذا قرار تصميمي متعمد — **الشك الصريح أفضل من اليقين الزائف**.

---

### 1.6 تحديث الـ Behavior Profile

**متى يُحدَّث؟**
- دوريًا كل ربع سنة (إضافة ملاحظات جديدة).
- تلقائيًا بعد كل تحقق ميداني مؤكد **بدون** حدث (= ملاحظة طبيعية مؤكدة).
- يدويًا بعد أي تغيير دائم في الأصل (توسعة، إعادة تبطين، تغيير مسار).

**ما لا يُدمج في Baseline:**
- أي ملاحظة خلال فترة حدث مؤكد.
- أي ملاحظة تُصنَّف كـ Data Quality Issue.

---

## المكون الثاني: Anomaly Engine — محرك اكتشاف الشذوذ

### 2.1 الفكرة الأساسية

لا نبحث عن "تسرب" ولا عن "بناء جديد".

نبحث عن: **هل الأصل يتصرف كما هو متوقع في هذا السياق؟**

```
ANOMALY = |current_observation - expected_given_context| > threshold
```

البساطة في التعريف، الدقة في التنفيذ.

---

### 2.2 خطوات الـ Anomaly Engine

```
الخطوة 1: تحديد السياق الحالي
  ← من Weather API: موسم + حالة رطوبة
  ← من ERP: الحالة التشغيلية
  ← من GIS: نشاط مجاور

الخطوة 2: جلب Behavior Profile لهذا السياق
  ← إذا confidence = LOW → توقف، أعد التصنيف كـ "Insufficient Data"
  ← إذا confidence = MEDIUM أو HIGH → تابع

الخطوة 3: حساب الانحراف لكل معلم
  z_score = (observed - mean) / std

الخطوة 4: تجميع الانحرافات → Composite Anomaly Score
  (سنشرحه بالتفصيل أدناه)

الخطوة 5: تصنيف الشذوذ (بدون تسمية السبب)
  → لا يوجد شذوذ
  → شذوذ طفيف (مراقبة)
  → شذوذ واضح (تحليل مطلوب)
  → شذوذ حاد (إجراء مطلوب)
```

---

### 2.3 Composite Anomaly Score

الانحراف في معلم واحد قد يكون ضوضاء.
الانحراف المتزامن في معالم متعددة مستقلة = إشارة حقيقية.

```
Anomaly_Score = Σᵢ (wᵢ × normalize(|z_scoreᵢ|)) × Coherence_Multiplier

حيث:
  wᵢ              = أهمية المعلم لهذا النوع من الأصول
  Coherence_Multiplier = 1 + 0.3 × (n_features_anomalous - 1)
                    ↑ كلما انحرفت معالم أكثر في نفس الاتجاه، تضاعف الثقة

نطاقات التصنيف:
  0.0 – 0.3  → NORMAL
  0.3 – 0.6  → WATCH
  0.6 – 0.8  → ANOMALY
  0.8 – 1.0  → SEVERE ANOMALY
```

**تحدٍّ:** أوزان المعالم `wᵢ` غير معروفة مسبقًا — نبدأ بأوزان متساوية، ثم نعدّلها من Ground Truth.

---

### 2.4 وصف الشذوذ (بدون تسمية السبب)

عند اكتشاف شذوذ، نصفه بدقة:

```
ANOMALY DESCRIPTOR {
  location:        نقطة أو مساحة الشذوذ داخل أو حول الأصل
  spatial_extent:  هل هو نقطي أم خطي أم مساحي؟
  magnitude:       كم درجة الانحراف؟
  onset_date:      متى بدأ؟ (من Time Series)
  trend:           متزايد / ثابت / متراجع
  persistence:     منذ كم من الوقت؟
  features_involved: [NDMI, LST, SAR_VV, ...]
  features_direction: {NDMI: UP, LST: DOWN, SAR_VV: DOWN}
}
```

هذا الوصف هو "المعطى" الذي سيُغذَّى للمكون التالي.

---

## المكون الثالث: Asset Event Catalogue — كتالوج الأحداث الممكنة

### 3.1 الفكرة

قبل طرح أي فرضية، نسأل: **هل هذا الحدث ممكن أصلًا لهذا الأصل؟**

هذا يُقلِّص فضاء الفرضيات ويُقلِّل False Positives بشكل جذري.

---

### 3.2 جدول الأحداث حسب نوع الأصل

| نوع الأصل | الأحداث الممكنة | الأحداث المستحيلة |
|---|---|---|
| خط مياه (Water Pipeline) | تسرب مياه، هبوط أرض، حفر/إزالة، تجريف، اعتداء على حرم، إنشاء مبنى، إزالة نباتات | تسرب نفط، حريق من خط، انسكاب مواد كيميائية |
| خط نفط (Oil Pipeline) | تسرب نفط، حريق، هبوط أرض، حفر، اعتداء على حرم، تلوث تربة | تسرب مياه، إنجاح نبات مصطنع |
| خط كهرباء هوائي | اقتحام نباتي، سقوط برج، حريق مجاور، تآكل هيكلي | تسرب سوائل |
| سد / خزان | تسرب خلال الجسم، تآكل المنحدرات، ترسيب، تشقق هيكلي، هبوط أرض | تسرب نفط |
| محطة ضخ | انهيار هيكلي، فيضان موضعي، حريق، اعتداء | تسرب خط بعيد |
| أرض زراعية محمية | تجاوز البناء، إزالة الغطاء النباتي، تجريف، تلوث | هبوط عميق |
| مبنى حيوي | تلف هيكلي، انهيار جزئي، حريق، تغيير اقتحامي | تسرب أنابيب تحت الأرض (ما لم يكن له شبكة مياه) |

---

### 3.3 قواعد الاستحالة الفيزيائية (Hard Rules)

هذه القواعد لا يمكن تجاوزها حتى لو "أنتجها" النموذج:

```
RULE 001: oil_spill IMPOSSIBLE IF asset_class = WATER_PIPELINE
RULE 002: water_leak IMPOSSIBLE IF asset_class = OIL_PIPELINE AND no_water_presence_in_500m
RULE 003: fire_ignition IMPOSSIBLE IF asset_class = WATER_PIPELINE
RULE 004: vegetation_encroachment IMPOSSIBLE IF biome = BARE_DESERT AND no_irrigation_nearby
RULE 005: deep_subsidence IMPOSSIBLE IF seismic_zone = NONE AND no_mining_nearby
RULE 006: structural_collapse IMPOSSIBLE IF asset_age < 5 AND material = NEW_CONCRETE
```

**ملاحظة تصميمية مهمة:** هذه القواعد تُدخلها خبرة بشرية، ليس حسابًا آليًا. يجب توفير واجهة لـ Domain Experts لتعريفها وتحديثها ومراجعتها دوريًا.

---

### 3.4 الفرق بين "ممكن" و"محتمل"

```
ممكن (Possible) ← يُدخل قائمة الفرضيات للتنافس
محتمل (Probable) ← ناتج عن الأدلة، ليس عن الـ Catalogue

مثال:
  الأصل: خط مياه
  الشذوذ: NDMI مرتفع جدًا، LST منخفضة، لا مطر

  الممكن (من Catalogue):
    - تسرب مياه ✓
    - صيانة مؤخرًا (رش ماء) ✓
    - ري زراعي من مصدر قريب ✓
    - خطأ في بيانات الاستشعار ✓

  بعد تقييم الأدلة → الأكثر احتمالًا: تسرب مياه (P=0.78)
```

---

## المكون الرابع: Evidence Engine — محرك الأدلة

### 4.1 الفكرة

لكل حدث محتمل، نبني **ملف دليل** يحتوي على:
- الأدلة المؤيدة (Confirming Evidence)
- الأدلة النافية (Refuting Evidence)
- الأدلة المحايدة (Neutral Evidence)

---

### 4.2 Evidence File لكل حدث

**مثال: تسرب مياه في بيئة جافة**

```yaml
event: WATER_LEAK
asset_class: WATER_PIPELINE
biome: ARID

confirming_evidence:
  - feature: NDMI
    expected_direction: INCREASE
    expected_magnitude: HIGH (z > 2.5)
    weight: 0.30
    physical_reason: "الماء المتسرب يرفع رطوبة التربة"

  - feature: LST
    expected_direction: DECREASE
    expected_magnitude: MEDIUM (z < -1.5)
    weight: 0.22
    physical_reason: "التبخر يخفض درجة حرارة السطح"

  - feature: SAR_VV_backscatter
    expected_direction: DECREASE
    expected_magnitude: LOW-MEDIUM (z < -1.0)
    weight: 0.15
    physical_reason: "التربة الرطبة تمتص الإشارة الرادارية"

  - feature: NDVI
    expected_direction: INCREASE (بعد 3-4 أسابيع)
    expected_magnitude: LOW-MEDIUM
    weight: 0.10
    physical_reason: "النبات الانتهازي يستجيب للرطوبة المفاجئة"

  - feature: PRECIPITATION_RECENT
    expected_value: NEAR_ZERO
    weight: 0.23  # ← ليس دليلًا مباشرًا بل مُحدِّد فارق
    physical_reason: "غياب المطر يستبعد التفسير الطبيعي للرطوبة"

refuting_evidence:
  - feature: PRECIPITATION_RECENT
    if_value: HIGH (> 20mm in 7 days)
    effect: NULLIFIES_HYPOTHESIS
    reason: "الرطوبة قد تكون طبيعية من مطر حديث"

  - feature: ERP_SCHEDULED_MAINTENANCE
    if_value: YES (within 14 days)
    effect: REDUCES_WEIGHT_BY_50%
    reason: "الصيانة تشمل رش وغسيل المنطقة عادةً"

  - feature: IRRIGATION_NEARBY_ACTIVE
    if_value: YES
    effect: REDUCES_WEIGHT_BY_40%
    reason: "الري الزراعي القريب يمكن أن يفسر الرطوبة"

spatial_pattern:
  expected: "LINEAR along pipeline centerline"
  NOT: "DIFFUSE across large area (يدل على مطر وليس تسرب)"
  NOT: "POINT far from pipeline (يدل على مصدر آخر)"

temporal_pattern:
  onset: "GRADUAL (days to weeks)"  ← التسرب يبدأ بتطور تدريجي
  NOT: "INSTANT (يدل على مطر أو حدث مفاجئ)"
  persistence: "PERSISTENT OR GROWING (لا يتراجع بدون تدخل)"
```

---

### 4.3 حجم الـ Evidence Library

هذا النظام يتطلب تعريفًا مسبقًا لـ Evidence Files. كم يحتاج؟

```
عدد أنواع الأصول:     ~10 أنواع رئيسية
عدد الأحداث لكل نوع: ~5-8 أحداث
عدد البيئات:          ~5 بيئات

الإجمالي: 10 × 7 × 5 = ~350 ملف دليل

هذا قابل للتنفيذ. ومعظم الملفات تتشارك قواعد مشتركة.
يمكن بناؤها خلال 3-6 أشهر بمشاركة خبراء الميدان.
```

---

## المكون الخامس: Hypothesis Competition Engine

### 5.1 الفلسفة — Abductive Reasoning

هذا هو قلب النظام.

لا نبحث عن: *"هل هذا تسرب؟"*
بل نسأل: *"من بين جميع الفرضيات الممكنة، أيها يُفسِّر كل الأدلة المتاحة بشكل أفضل؟"*

هذا ما يسميه الفلاسفة **"الاستدلال إلى أفضل تفسير"** (Inference to the Best Explanation).

---

### 5.2 خطوات المنافسة

```
INPUT: Anomaly Descriptor + Asset Context

الخطوة 1: توليد قائمة الفرضيات
  ← من Asset Event Catalogue
  ← مع تطبيق Physical Impossibility Rules
  
  مثال: [WATER_LEAK, MAINTENANCE_SPILLAGE, IRRIGATION_EFFECT, DATA_ERROR]

الخطوة 2: لكل فرضية، حساب الدرجة الابتدائية
  Prior_Score(h) = Base_probability(h | asset_type, context)
  
  مثال بيانات أولية:
    WATER_LEAK:         0.35
    MAINTENANCE_EFFECT: 0.25
    IRRIGATION_EFFECT:  0.25
    DATA_ERROR:         0.15

الخطوة 3: تحديث الدرجات بناءً على كل دليل
  For each evidence e:
    Posterior(h | e) ∝ Prior(h) × Likelihood(e | h)

  (Bayesian Sequential Update)

الخطوة 4: تطبيق Refuting Evidence
  إذا كان الدليل الرافض موجودًا:
    Score(h) *= Refuting_Multiplier  (0.05 إلى 0.9 حسب قوة الرفض)

الخطوة 5: تطبيق Spatial Pattern Check
  إذا كان النمط المكاني لا يتوافق مع الفرضية:
    Score(h) *= Spatial_Coherence_Factor

الخطوة 6: Normalization
  Total = Σ Score(h)
  P(h) = Score(h) / Total

الخطوة 7: اختيار الفائز + حساب المنافسة
  Winner = argmax P(h)
  Competition_Gap = P(Winner) - P(Second_Best)
  
  إذا Competition_Gap < 0.15:
    → "فرضيتان متنافستان، لا يوجد تفسير واضح"
    → أولوية عالية للتحقق الميداني
```

---

### 5.3 الفرضية الخاصة: DATA_ERROR

**هذه فرضية دائمة في كل منافسة.**

أي شذوذ يمكن أن يكون خطأ في البيانات:
- سحب على صورة Sentinel-2 (Cloud/Shadow)
- خطأ في Geometric Correction
- ضوضاء SAR في حالة رياح شديدة
- انقطاع في بيانات الطقس

**قاعدة:** إذا فازت DATA_ERROR كأفضل تفسير، لا يُصدر تنبيه. بل يُطلب مصدر بيانات بديل أو انتظار الصورة التالية.

---

### 5.4 مثال متكامل

```
الأصل:     خط مياه، بيئة جافة، صيف حار
الشذوذ:    NDMI ارتفع بشكل غير طبيعي (+3.2σ)
           LST انخفضت (-2.1σ)
           SAR_VV انخفض (-1.8σ)
           النمط: خطي بطول 80m على محور الأنبوب
           البداية: تدريجية منذ 12 يومًا
           مطر آخر 21 يومًا: 0mm
           صيانة في ERP: لا
           ري قريب: لا

الفرضيات الممكنة (من Catalogue):
  [WATER_LEAK, EXCAVATION_DAMAGE, DATA_ERROR, MAINTENANCE_SPILLAGE]

بعد المنافسة:
  WATER_LEAK:          P = 0.81  ← الفائز
  EXCAVATION_DAMAGE:   P = 0.09
  MAINTENANCE_SPILLAGE: P = 0.06
  DATA_ERROR:          P = 0.04

Competition_Gap = 0.81 - 0.09 = 0.72  ← فارق كبير، ثقة عالية

الأدلة الحاسمة:
  (+) NDMI خطي على محور الأنبوب: يدعم WATER_LEAK بقوة
  (+) LST منخفض: متوافق مع تبخر
  (+) 0mm مطر: يستبعد التفسير الطبيعي
  (-) لا صيانة: يضعّف MAINTENANCE_SPILLAGE
  (-) لا حفريات مسجلة: يضعّف EXCAVATION_DAMAGE

الاستنتاج:
  "مجموعة أدلة مكانية وزمنية متوافقة مع تسرب مياه
   في نقطة الشذوذ الأعلى: {lat, lon}
   بثقة 0.81، فارق عن الفرضية التالية: 0.72"
```

---

## المكون السادس: Explainability Layer

### 6.1 مبدأ الشفافية الكاملة

لكل استنتاج، يُصدر النظام تقريرًا يُجيب على خمسة أسئلة:

```
1. ماذا رأيت؟          ← Anomaly Descriptor
2. ما الذي قارنته؟     ← Expected vs. Observed (Behavior Profile)
3. ما التفسيرات؟       ← جميع الفرضيات مع درجاتها
4. لماذا اخترت هذا؟    ← الأدلة المؤيدة والنافية
5. ما الذي سيغير رأيي؟ ← Counterfactual Statement
```

---

### 6.2 Counterfactual Statement — الأهم

كل تقرير يجب أن يحتوي على:

```
"سيتغير الاستنتاج إلى [X] إذا:
  - تبيّن أن هطولًا مطريًا حدث وغاب عن بيانات الطقس
  - أكد ERP وجود صيانة غير مسجلة في هذه المنطقة
  - أظهر مرور ميداني أن الشذوذ يقع على مسافة > 20m من الأنبوب"
```

هذا يحول المشغل الميداني إلى **محقق واعٍ** يعرف بالضبط ما يبحث عنه.

---

### 6.3 مستويات الثقة والشك

```
CONFIDENCE LEVELS:

HIGH_CONFIDENCE (> 0.75):
  "الأدلة تشير بوضوح إلى X"
  التوصية: تحقق ميداني خلال 48 ساعة

MEDIUM_CONFIDENCE (0.50 - 0.75):
  "الأدلة تميل نحو X لكن Y ممكن أيضًا"
  التوصية: مراقبة مكثفة + تحقق خلال أسبوع

LOW_CONFIDENCE (0.30 - 0.50):
  "فرضيتان متنافستان، لا يوجد تفسير واضح"
  التوصية: طلب بيانات إضافية + مراقبة يومية

INSUFFICIENT_DATA (< 0.30 OR data_gap > 7 days):
  "بيانات غير كافية للاستنتاج"
  التوصية: تحقق ميداني وقائي إذا كانت الأهمية عالية
```

---

## المكون السابع: Asset Health Score

### 7.1 لماذا Health Score وليس فقط Alerts؟

Alert = نقطة في الزمن.
Health Score = تاريخ ومسار.

Alert يقول: "يوجد مشكلة الآن."
Health Score يقول: "هذا الأصل يتدهور منذ 6 أشهر بمعدل X."

**الفرق التشغيلي:** مع Health Score، يمكن الوقاية قبل حدوث الكارثة.

---

### 7.2 بنية Health Score المركبة

```
HEALTH SCORE (0 - 100)
  │
  ├── STRUCTURAL INTEGRITY (وزن 35%)
  │    ← InSAR displacement trend
  │    ← DEM change
  │    ← SAR coherence stability
  │
  ├── BOUNDARY INTEGRITY (وزن 25%)
  │    ← encroachment indicators in buffer zone
  │    ← construction activity in 50m zone
  │    ← unauthorized excavation signs
  │
  ├── ENVIRONMENTAL CONDITION (وزن 20%)
  │    ← vegetation health around asset
  │    ← soil stability indicators
  │    ← drainage pattern changes
  │
  └── OPERATIONAL CONTEXT (وزن 20%)
       ← days since last maintenance (عمر ما بعد الصيانة)
       ← historical incident rate
       ← known anomaly persistence
```

---

### 7.3 حساب Health Score

```
Component_Score = 100 × (1 - normalize(Anomaly_Score_for_component))

Overall_Health = Σ (weight_c × Component_Score_c)

مثال:
  STRUCTURAL:    78  (وزن 0.35) → مساهمة: 27.3
  BOUNDARY:      91  (وزن 0.25) → مساهمة: 22.8
  ENVIRONMENTAL: 65  (وزن 0.20) → مساهمة: 13.0
  OPERATIONAL:   70  (وزن 0.20) → مساهمة: 14.0

Overall_Health = 77.1 / 100
```

---

### 7.4 مؤشرات الصحة الزمنية

بجانب الدرجة اللحظية، يعرض النظام:

```
HEALTH TREND (آخر 90 يومًا):
  الدرجة الحالية:    77
  الدرجة قبل 30 يوم: 84
  الدرجة قبل 90 يوم: 91

  الاتجاه:      تراجع مستمر  ▼
  معدل التراجع: -2.3 نقطة/أسبوع
  الوقت المتوقع للوصول إلى 50: ~12 أسبوعًا

  الخلاصة: "هذا الأصل يُظهر تدهورًا مستمرًا في Structural Integrity
             منذ 3 أشهر. يُوصى بإجراء فحص شامل."
```

---

### 7.5 المنطق الكامن وراء "الوقت المتوقع"

**تحدٍّ مهم:** التنبؤ بمسار الصحة يفترض أن التدهور يستمر بنفس المعدل.

هذا ليس صحيحًا دائمًا. بعض الأحداث تتسارع فجأة.

لذلك نُقدِّم ثلاثة سيناريوهات:
- **الوضع الحالي** (إذا استمر نفس المعدل)
- **الأفضل** (إذا أُجريت صيانة خلال أسبوعين)
- **الأسوأ** (إذا تضاعف معدل التدهور)

---

## المكون الثامن: Ground Truth Feedback Loop

### 8.1 التحقق الميداني كـ "أداة تعليم"

كل تحقق ميداني ينتج أحد أربعة نتائج:

```
نتيجة 1: التنبيه كان صحيحًا، الحدث مؤكد
  → يُضاف كـ Verified Positive
  → يُحدَّث Evidence Weights (ماذا كان الأقوى تنبؤًا؟)
  → تُحدَّث Prior Probabilities لهذا الحدث في هذا السياق

نتيجة 2: التنبيه كان خاطئًا (False Positive)
  → يُضاف كـ Verified Negative
  → يُوثَّق النمط الذي أوقع النظام في الخطأ
  → يُضاف إلى False Positive Library للأصل والبيئة
  → يُراجَع Evidence Weight المسؤول

نتيجة 3: الحدث مختلف عما توقعه النظام
  → يُضاف كـ Misclassified Event
  → يُراجَع Evidence File للحدثين (المتوقع والحقيقي)
  → يُحدَّث Catalogue إذا لزم

نتيجة 4: المنطقة غير وصولة (No Access)
  → لا تغيير في النموذج
  → يبقى التنبيه مفتوحًا مع تصعيد تدريجي
```

---

### 8.2 تحديث Behavior Profile من التحقق

```
إذا أكد الفريق الميداني أن كل شيء طبيعي:
  → تُضاف الملاحظة الحالية إلى Behavior Profile
  → هذا يُضيِّق حدود "الطبيعي" ويرفع حساسية النظام

إذا أكد الفريق وجود حدث:
  → الملاحظة لا تُضاف إلى Baseline
  → تُحفظ كـ Reference Event في Signature Library
```

---

### 8.3 أين يتدخل Machine Learning؟

بعد بناء كل ما سبق بالمنطق والفيزياء، يدخل ML لـ:

1. **ضبط Evidence Weights** — بدلًا من الأوزان اليدوية الأولية
2. **اكتشاف أنماط غير متوقعة** — قد تكون أدلة لأحداث جديدة لم نُعرِّفها
3. **تحسين Context Classification** — تحديد السياق بدقة أعلى
4. **التنبؤ بالتدهور** — بناءً على مسارات تدهور مشابهة في أصول أخرى

**لكن** ML لا يُفسِّر. المنطق الفيزيائي يُفسِّر. ML يُحسِّن الأوزان فقط.

---

## نموذج البيانات الكامل

```sql
-- نوع الأصل وكتالوج الأحداث الخاص به
CREATE TABLE asset_type (
    type_code          TEXT PRIMARY KEY,          -- WATER_PIPELINE, OIL_PIPELINE, ...
    possible_events    TEXT[],                    -- مصفوفة الأحداث الممكنة
    impossible_events  TEXT[],
    key_features       TEXT[]                     -- المعالم الأهم لهذا النوع
);

-- تعريف الأصل مع ربطه بنوعه
CREATE TABLE asset (
    asset_id           UUID PRIMARY KEY,
    name_ar            TEXT,
    type_code          TEXT REFERENCES asset_type,
    geometry_line      GEOMETRY(LINESTRING, 4326),
    geometry_buffer10  GEOMETRY(POLYGON, 4326),
    geometry_buffer50  GEOMETRY(POLYGON, 4326),
    criticality_score  FLOAT,
    static_profile     JSONB,                     -- الخصائص الثابتة
    environment        JSONB                      -- البيئة المحيطة
);

-- Behavior Profile (الـ Conditional Baseline)
CREATE TABLE behavior_cell (
    cell_id            UUID PRIMARY KEY,
    asset_id           UUID REFERENCES asset,
    context_season     TEXT,                      -- HOT_DRY, MILD_DRY, COOL_WET
    context_moisture   TEXT,                      -- DRY, MOIST, WET
    context_ops        TEXT,                      -- NORMAL, POST_MAINT, NEAR_ACTIVITY
    context_vicinity   TEXT,                      -- NORMAL, IRRIGATION_ACTIVE, HIGH_TRAFFIC
    feature_name       TEXT,
    mean               FLOAT,
    std                FLOAT,
    percentile_5       FLOAT,
    percentile_95      FLOAT,
    n_observations     INT,
    confidence         TEXT,                      -- HIGH, MEDIUM, LOW
    last_updated       TIMESTAMPTZ,
    UNIQUE (asset_id, context_season, context_moisture, context_ops, context_vicinity, feature_name)
);

-- الملاحظات المدخلة للنظام
CREATE TABLE observation (
    obs_id             UUID PRIMARY KEY,
    asset_id           UUID REFERENCES asset,
    obs_time           TIMESTAMPTZ,
    data_source        TEXT,
    features           JSONB,                     -- {NDMI: 0.31, LST: 32.1, ...}
    quality_score      FLOAT,
    context_resolved   JSONB                      -- السياق المحسوب لهذه اللحظة
);

-- نتائج Anomaly Engine
CREATE TABLE anomaly (
    anomaly_id         UUID PRIMARY KEY,
    asset_id           UUID REFERENCES asset,
    obs_id             UUID REFERENCES observation,
    anomaly_score      FLOAT,
    severity           TEXT,                      -- NORMAL, WATCH, ANOMALY, SEVERE
    features_anomalous TEXT[],
    features_direction JSONB,
    spatial_pattern    TEXT,
    onset_date         TIMESTAMPTZ,
    trend              TEXT
);

-- نتائج Hypothesis Competition
CREATE TABLE inference (
    inference_id       UUID PRIMARY KEY,
    anomaly_id         UUID REFERENCES anomaly,
    winner_hypothesis  TEXT,
    winner_probability FLOAT,
    competition_gap    FLOAT,
    all_hypotheses     JSONB,                     -- {hypothesis: probability, ...}
    evidence_used      JSONB,
    counterfactual     TEXT,
    confidence_level   TEXT                       -- HIGH, MEDIUM, LOW, INSUFFICIENT
);

-- Health Score الزمني
CREATE TABLE asset_health_history (
    health_id          UUID PRIMARY KEY,
    asset_id           UUID REFERENCES asset,
    calc_time          TIMESTAMPTZ,
    structural_score   FLOAT,
    boundary_score     FLOAT,
    environmental_score FLOAT,
    operational_score  FLOAT,
    overall_score      FLOAT,
    trend_30d          FLOAT,                     -- معدل التغيير في 30 يومًا
    trend_90d          FLOAT
);

-- Ground Truth
CREATE TABLE field_verification (
    fv_id              UUID PRIMARY KEY,
    inference_id       UUID REFERENCES inference,
    outcome            TEXT,                      -- CONFIRMED, FALSE_POSITIVE, MISCLASSIFIED, NO_ACCESS
    actual_event       TEXT,
    verified_by        TEXT,
    verified_at        TIMESTAMPTZ,
    exact_location     GEOMETRY(POINT, 4326),
    field_notes        JSONB,
    photos_urls        TEXT[]
);
```

---

## مقارنة المنهجية: ARGUS vs MINERVA

```
ARGUS (v1)                          MINERVA (v2)
──────────────────────────────────────────────────────
نقطة البداية: الحدث                 نقطة البداية: الأصل
السؤال: "ما الذي حدث؟"              السؤال: "هل سلوك الأصل طبيعي؟"
الـ Baseline: عالمي                  الـ Baseline: مشروط بالسياق
الفرضيات: مفتوحة                    الفرضيات: محصورة بالـ Catalogue
المخرج: Alert                       المخرج: Health Score + Alert إذا لزم
منطق الدمج: Dempster-Shafer         منطق الدمج: Abductive Competition
الأولوية: اكتشاف الحدث              الأولوية: فهم سلوك الأصل
الإنذارات الكاذبة: تُعالج لاحقًا   الإنذارات الكاذبة: تُستبعد بالتصميم
```

---

## الأسئلة التي يُجيب عليها كل مكون

| السؤال | المكون المسؤول |
|---|---|
| كيف يبدو هذا الأصل في الظروف الطبيعية؟ | Behavior Profile |
| هل هناك شيء غير طبيعي الآن؟ | Anomaly Engine |
| ماذا يمكن أن يكون السبب؟ | Asset Event Catalogue |
| ما الأدلة التي تدعم أو تنفي كل سبب؟ | Evidence Engine |
| أي سبب أفضل تفسير؟ | Hypothesis Competition |
| لماذا توصلنا لهذا الاستنتاج؟ | Explainability Layer |
| ما وضع صحة هذا الأصل عمومًا؟ | Health Score Engine |
| كيف نصبح أذكى مع الزمن؟ | Ground Truth Loop |

---

## الخطوة التالية: Proof of Concept

**الترتيب الصحيح للتنفيذ:**

```
الشهر 1: Behavior Profile Builder
  - اختيار 3-5 أصول تجريبية
  - استخراج بيانات Sentinel-2 تاريخية (2 سنة)
  - بناء Behavior Cells لكل سياق
  - التحقق اليدوي من منطقية القيم

الشهر 2: Anomaly Engine
  - تطبيق الـ Conditional Baseline
  - مقارنة مع Baseline التقليدي (هل يقل False Positives؟)
  - ضبط العتبات

الشهر 3: Event Catalogue + Evidence Engine
  - تعريف Catalogue لنوع أصل واحد (خط مياه)
  - بناء Evidence Files بمشاركة خبراء الميدان
  - اختبار يدوي

الشهر 4: Hypothesis Competition
  - تطبيق Bayesian Competition
  - اختبار على حوادث تاريخية موثقة
  - قياس الدقة

الشهر 5: Health Score + UI
  - حساب Health Score التاريخي للأصول التجريبية
  - عرضه في المنصة الحالية

الشهر 6: Ground Truth Loop
  - نموذج التحقق الميداني
  - أول دورة تحديث للنموذج
```

---

*MINERVA Architecture v1.0 — DSP R&D Division — 2026-07-08*
*تحول من Event Detection إلى Asset Intelligence*
