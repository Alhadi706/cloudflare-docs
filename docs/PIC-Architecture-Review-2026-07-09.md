# PIC — مراجعة معمارية علمية شاملة
## Project Intelligence Center: From Image Comparator to Construction Intelligence Engine

**التاريخ**: 2026-07-09  
**المراجع**: GitHub Copilot — Claude Sonnet 4.6  
**الحالة**: مسودة معتمدة للتنفيذ  
**الغرض**: توجيه إعادة تصميم المحرك قبل أي تطوير إضافي

---

## الحكم الأولي

> **التطبيق الحالي ليس محرك استخبارات إنشائية.**  
> إنه أداة مقارنة ملفات تُعطي وهم الذكاء.

كل رقم ينتجه النظام حالياً — الإنجاز، الصحة، الحالة، الاتجاه — لا يمكن الدفاع عنه أمام مفتش إنشاء خبير.  
هذا ليس نقداً للجهد المبذول. إنه تشخيص معماري يستوجب إعادة التصميم قبل الاستمرار.

---

## 1. تشريح الكود الحالي — نقطة الفشل الجذري

### 1.1 `compareImages()` — الخطأ المؤسسي

```typescript
// الكود الحالي — lib/picAnalysis.ts السطر 98-119
export function compareImages(pathA: string, pathB: string): number {
  const sizeA = bufA.length;
  const sizeB = bufB.length;
  const sizeRatio = Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB);

  const offset = 33; // بعد header الـ PNG
  for (let i = 0; i < sampleCount; i++) {
    byteSum += Math.abs(bufA[posA] - bufB[posB]);
  }
  const magnitude = Math.min(1, sizeRatio * 1.5 + byteDiff * 0.5);
}
```

**ما الذي يفعله هذا الكود فعلاً؟**

يقارن **بيانات DEFLATE المضغوطة**، وليس البيكسلات.

PNG هو تنسيق ضغط فقدان الأصالة، يعمل هكذا:
```
بيكسلات → فلتر PNG → ضغط DEFLATE → ملف PNG
```

الـ bytes بعد الـ header ليست بيكسلات. إنها دفق DEFLATE مضغوط.  
نفس الصورة البصرية + تغيير طفيف في metadata يعطي حجم ملف مختلفاً كلياً.  
صورتان لنفس الموقع بعد أسبوع قد تكونان متطابقتين بصرياً لكن بفارق 30% في الحجم بسبب اختلاف ضغط JPEG الداخلي أو metadata.

**المسار الحالي للبيانات:**
```
PNG file A (compressed bytes)
       ↓
Sample 50 random bytes from DEFLATE stream
       ↓
Compute absolute byte difference
       ↓
Combine with file size ratio (×1.5 weight)
       ↓
magnitude = 0.0 to 1.0   ← هذا الرقم لا معنى له
       ↓
classifyActivity(magnitude)  ← 0.20 threshold خيالي
       ↓
progress_pct               ← رقم بلا أساس علمي
```

**نتيجة فعلية مؤكدة من الاختبار**: النظام أنتج `magnitude = 0.93` لآخر مشهد لمشروع الطريق. هذا لا يعني أن الموقع تغير 93% من سعته — يعني فقط أن الملفين لهما فارق في الضغط.

---

### 1.2 `classifyActivity()` — عتبات خيالية

```typescript
const ACTIVE_THRESHOLD  = 0.20;  // لا مرجعية علمية
const SLOW_THRESHOLD    = 0.06;  // لا مرجعية علمية

export function classifyActivity(magnitude: number): ... {
  const score = Math.min(1, magnitude * 3);  // تضخيم عشوائي
  if (magnitude >= ACTIVE_THRESHOLD) return { state: 'active', score };
  if (magnitude >= SLOW_THRESHOLD)   return { state: 'slow',   score };
  return { state: 'stopped', score };
}
```

**المشكلة**: هذه العتبات غير مُعايَرة على أي بيانات حقيقية.  
موقع بناء نشط في طرابلس مقابل حقل رمال ساكن يعطيان نفس التصنيف إذا تصادف أن فرق ضغط الملف متشابه.  
لا يوجد فصل بين **التغيير الحقيقي** (حركة بشر، آليات، مواد) و **التغيير المزيف** (إضاءة مختلفة، ضباب خفيف، metadata مختلف).

---

### 1.3 `buildTimeline()` — الإنجاز ≠ نسبة أيام النشاط

```typescript
// السطر 248-263
const rawProgress = (activeDays / totalDays) * 100;
// Mix: 60% activity-based + 40% time-based
progress_pct = Math.min(100, Math.round(rawProgress * 0.6 + timePct * 0.4));
```

**ما المشكلة؟**

`activeDays / totalDays = 0.85` لا يعني أن المشروع مكتمل 85%.

مثال مضاد: موقع بناء كان نشطاً بشكل دائم لمدة 20 شهراً على مبنى 30 طابقاً مخطط لـ 24 شهراً. هل هو مكتمل 85%؟ ربما مكتمل 40% هيكلياً فقط.

التقدم في الإنشاء ليس دالة زمنية. هو دالة **كمية العمل المنجز** مقارنة بـ **إجمالي نطاق العمل**.

---

### 1.4 Health Score — أوزان بلا مبرر

```typescript
// السطر 265-270
const interruptionPenalty = Math.min(50, interruptions.length * 10);
const activityBonus       = (activePoints.length / points.length) * 40;
const recentActivity      = points.slice(-3).some(...) ? 20 : 0;
const health_score        = 40 + activityBonus + recentActivity - interruptionPenalty;
```

**نقد علمي**:
- لماذا القاعدة 40؟ (وليس 50 أو 30)
- لماذا كل توقف يُعاقَب بـ 10؟ (وليس 5 أو 15)
- لماذا النشاط الأخير يُكافأ بـ 20؟ (النشاط منذ 3 أيام مقابل 3 أشهر)
- لماذا أحدث 3 نقاط فقط؟ (إذا كانت 3 scans في يومين، هل هذا "نشاط أخير"؟)

**لا توجد إجابة. هذه أوزان اخترعها شخص ما.**

---

### 1.5 Trend — نافذة 3 نقاط غير كافية إحصائياً

```typescript
const recent = points.slice(-3).map(p => p.score);
const prev   = points.slice(-6, -3).map(p => p.score);
```

**ثلاثة scans تمثل أقل من أسبوع من البيانات إذا كانت يومية.**  
هذا لا يصنع "اتجاهاً". يصنع ضوضاء.

الاتجاه الحقيقي يحتاج على الأقل 4-8 أسابيع من الملاحظات المتسقة.  
الاتجاه بـ 3 نقاط يتأثر باليوم الغائم العشوائي الواحد.

---

## 2. توثيق كل نمط Image→Difference→Progress

| الموقع | الكود | الفشل |
|--------|-------|-------|
| `compareImages()` السطر 98 | `sizeRatio = abs(sizeA-sizeB)/max(sizeA,sizeB)` | حجم ملف مضغوط ≠ تغيير بصري |
| `compareImages()` السطر 108 | `byteSum += abs(bufA[posA] - bufB[posB])` | bytes DEFLATE ≠ بيكسلات |
| `classifyActivity()` السطر 122 | `magnitude >= 0.20 → active` | عتبة اعتباطية بلا معايرة |
| `buildTimeline()` السطر 248 | `rawProgress = activeDays/totalDays * 100` | نسبة وقت النشاط ≠ نسبة إنجاز العمل |
| `buildTimeline()` السطر 255 | `rawProgress*0.6 + timePct*0.4` | خلط وقت مرور الزمن بإنجاز العمل |
| `buildTimeline()` السطر 265 | `40 + activityBonus + recentActivity - penalty` | أوزان صحة بلا أساس |
| `buildTimeline()` السطر 276 | `points.slice(-3) vs slice(-6,-3)` | اتجاه من 6 نقاط فقط |
| `analyzeProject()` السطر 388 | `status: 'active' if lastPoint.state !== 'stopped'` | حالة المشروع من آخر scan فقط |

**جميع هذه الأنماط يجب إلغاؤها.**

---

## 3. قرارات المعمارية (ADR — Architecture Decision Records)

### ADR-001: استبدال مقارنة الملفات بتحليل البيكسل

**القرار**: إلغاء `compareImages()` كلياً. استبدالها بمحرك استخراج ميزات يعمل على بيانات بيكسل مُفككة فعلياً.

**الأسباب**:
- PNG bytes المضغوطة لا تحمل أي معلومة بصرية قابلة للقياس
- حجم الملف يتأثر بـ metadata وخوارزمية ضغط المصدر لا بالمحتوى البصري

**البديل**: استخدام `sharp` (مكتبة Node.js عالية الأداء) لفك PNG → مصفوفة بيكسل RGB → حساب مقاييس بصرية حقيقية

**تأثير على الكود**: حذف كامل لـ `compareImages()` + إضافة `FeatureExtractor` class

---

### ADR-002: الإنجاز يجب أن يُستنتج من الأدلة، لا أن يُحسب مباشرة

**القرار**: لا يوجد حساب مباشر لـ `progress_pct`. كل قيمة إنجاز هي استنتاج من `EvidenceBundle`.

**النموذج الجديد**:
```
Observable Evidence → Evidence Bundle → Progress Hypothesis → Confidence Interval
```

**مثال**:
```
"لاحظنا توسع footprint المبنى بنسبة 23% من المساحة الكلية المخططة"
"لاحظنا تراجع التغييرات اليومية في الـ 30 يوم الأخيرة (مرحلة تشطيب؟)"
"لاحظنا 4 حالات توقف كاملة لمدة إجمالية 45 يوماً"
→ الإنجاز المقدر: 65% ± 15% (ثقة: متوسطة)
```

---

### ADR-003: كل نوع مشروع يحتاج نموذج تقدم خاص

**القرار**: إنشاء `ProgressModel` لكل فئة مشروع: Road, Building, Bridge, Earthwork, Utility, Dam, Port, Airport.

**المبرر**: مشروع طريق يتقدم أفقياً ويمكن قياسه بالطول المنجز. مبنى يتقدم عمودياً (طوابق). سد يتقدم بالارتفاع والحجم. نموذج واحد لا يصلح للجميع.

---

### ADR-004: كل استنتاج يجب أن يكون قابلاً للشرح

**القرار**: إضافة `ExplainabilityChain` لكل مخرج. كل رقم يأتي مع:
- `evidence[]`: الأدلة الداعمة
- `counter_evidence[]`: الأدلة المضادة
- `missing_evidence[]`: ما كان يجب ملاحظته ولم يُلاحَظ
- `confidence: number`: مستوى الثقة
- `reasoning: string`: جملة شرح بالعربي

---

### ADR-005: المحرك يجب أن يكون مستقلاً عن مزود الصور

**القرار**: تجريد طبقة مزود البيانات (`ImageProvider` interface) بحيث Planet هو مجرد تطبيق واحد.

**المبرر**: الاستمرارية إذا توقف أرشيف Planet. إضافة Sentinel-2 أو بيانات طائرات مسيّرة في المستقبل.

---

## 4. المعمارية الجديدة — Construction Intelligence Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVATION LAYER                            │
│  SceneAcquisition → GeometricValidation → RadiometricValidation │
│  → CloudMask → ShadowMask → QualityScore                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ QualifiedScene
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE LAYER                                 │
│  PixelDecoder → FeatureExtractor → SpatialIndexer               │
│  Features: Texture, EdgeDensity, Brightness, NDVI-proxy,        │
│  SurfaceExposure, LinearStructure, FootprintGrowth              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ FeatureVector
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TEMPORAL LAYER                                │
│  TemporalAligner → RollingWindowAnalyzer → SeasonalityDetector  │
│  → ChangeVelocity → AccelerationDetector → TrendEngine          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ TemporalSignal
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EVIDENCE LAYER                                │
│  EvidenceGenerator → ConstructionPhaseClassifier               │
│  → ActivityLevelEstimator → InterruptionClassifier             │
│  → ExplainabilityChain                                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ EvidenceBundle
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REASONING LAYER                               │
│  ProgressModel(type) → HealthEngine → AlertEngine              │
│  → TimelineBuilder → ExecutiveReport                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ ConstructionIntelligence
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                             │
│  pic.scans + pic.evidence + pic.events + pic.alerts             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. مواصفات المكونات

### 5.1 Observation Layer

#### SceneValidator
```typescript
interface SceneQuality {
  scene_uid:        string;
  is_usable:        boolean;
  cloud_fraction:   number;   // 0-1: من metadata
  shadow_fraction:  number;   // 0-1: مقدَّر من brightness histogram
  brightness_mean:  number;   // متوسط سطوع القناة
  brightness_std:   number;   // انحراف معياري (عالٍ = بياض الغيوم)
  data_completeness: number;  // 1.0 إذا لم يوجد nodata
  rejection_reason: string | null;
}

// قواعد الرفض:
// cloud_fraction > 0.30 → rejected
// brightness_mean > 220 → likely overexposed or cloud
// brightness_std < 5    → likely monochrome/corrupt
// data_completeness < 0.85 → too many missing pixels
```

**المبرر العلمي**: الصور ذات تغطية سحابية أو ظلال عالية تُعطي تغييرات زائفة (false change) لا علاقة لها بالإنشاء. رفضها مسبقاً يُحسّن دقة كل التحليل التالي.

**حد الثقة**: scene مع cloud_fraction > 0.30 لا يجب أن يُستخدم في حساب التغيير. إدراجه يُدخل ضوضاء تتناسب مع (1 - cloud_fraction).

---

#### PixelDecoder
```typescript
interface DecodedScene {
  scene_uid: string;
  width: number;
  height: number;
  channels: {
    red:   Float32Array;  // 0-255 normalized to 0-1
    green: Float32Array;
    blue:  Float32Array;
    luminance: Float32Array;  // 0.299R + 0.587G + 0.114B
  };
  roi_pixels: number;    // pixels within project bbox (استبعاد الحواف)
}
```

**ملاحظة تطبيقية**: `sharp` مكتبة Node.js تُفكك PNG/JPEG إلى raw RGBA buffer. متاحة، مُجربة، سريعة (1-5ms لصورة thumbnail 256×256).

```typescript
import sharp from 'sharp';

async function decodeScene(thumbPath: string): Promise<DecodedScene> {
  const { data, info } = await sharp(thumbPath)
    .resize(256, 256)  // normalize to fixed grid
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const pixels = data.length / info.channels;
  const red   = new Float32Array(pixels);
  const green = new Float32Array(pixels);
  const blue  = new Float32Array(pixels);
  
  for (let i = 0; i < pixels; i++) {
    red[i]   = data[i * info.channels]     / 255;
    green[i] = data[i * info.channels + 1] / 255;
    blue[i]  = data[i * info.channels + 2] / 255;
  }
  // ...
}
```

---

### 5.2 Feature Layer

#### FeatureExtractor
كل ميزة هي دالة مستقلة: `Feature(pixels: DecodedScene) → FeatureValue`

**الميزات المطلوبة للمرحلة الأولى (قابلة للتنفيذ بدون تدريب):**

```typescript
interface FeatureSet {
  // ── Brightness Metrics ──────────────────────────────
  mean_luminance:      number;   // متوسط سطوع الـ ROI
  std_luminance:       number;   // تباين السطوع (ارتفاعه = حركة، مواد متعددة)
  
  // ── Texture Metrics (Gray Level Co-occurrence) ──────
  homogeneity:         number;   // انخفاضه يعني تنوع أكبر في الملمس (إنشاء نشط؟)
  contrast:            number;   // ارتفاعه يعني حواف وتفاصيل أكثر
  entropy:             number;   // ارتفاعه يعني فوضى → نشاط إنشاء عادةً
  
  // ── Edge Metrics (Sobel or Canny) ───────────────────
  edge_density:        number;   // نسبة بيكسلات الحواف (هياكل، آليات، مواد)
  edge_orientation_h:  number;   // حواف أفقية (طرق، أسقف، أساسات)
  edge_orientation_v:  number;   // حواف عمودية (جدران، أعمدة)
  
  // ── Color Metrics ────────────────────────────────────
  red_mean:            number;   // مرتفع = تربة مكشوفة، طوب، مواد إنشاء
  green_mean:          number;   // مرتفع = غطاء نباتي (عكس الإنشاء)
  bare_soil_fraction:  number;   // نسبة بيكسلات تربة مكشوفة (proxy للحفر)
  vegetation_fraction: number;   // نسبة بيكسلات خضراء
  
  // ── Structural Metrics ───────────────────────────────
  bright_patch_count:  number;   // عدد مناطق ساطعة مميزة (هياكل، مواد)
  dark_patch_count:    number;   // عدد مناطق داكنة (حفر، ظلال هياكل)
  linear_score:        number;   // قوة الهياكل الخطية (طرق، أسوار، أساسات)
}
```

**المبرر العلمي لكل ميزة**:

| الميزة | المبرر | محدودية |
|--------|--------|---------|
| `std_luminance` | النشاط الإنشائي يُنشئ تباين ضوئي عالٍ (آليات، مواد، تربة، ظل) | الغيوم أيضاً تُعطي تباين عالٍ |
| `entropy` | الموقع الإنشائي النشط يحتوي على توزيع غير منتظم للبيكسلات | الطقس السيئ يُعطي entropy عالية |
| `edge_density` | الهياكل الإنشائية تُنشئ حواف حادة | الأشجار والسياج أيضاً |
| `bare_soil_fraction` | الحفر والتسوية تكشف التربة | ليبيا جافة — التربة المكشوفة طبيعية في بعض المناطق |
| `vegetation_fraction` | انخفاض الغطاء النباتي يسبق الإنشاء وأثناءه | الموسمية |

---

#### TemporalChangeComputer
بدلاً من مقارنة صورتين، نحسب **فرق المتجهات** بين حزمة ميزات متتالية:

```typescript
function computeTemporalChange(
  featuresT1: FeatureSet,
  featuresT2: FeatureSet,
  sceneQuality: { t1: SceneQuality; t2: SceneQuality }
): TemporalChange {
  
  // لا نُجري المقارنة إذا كانت الجودة منخفضة
  const minQuality = Math.min(
    sceneQuality.t1.data_completeness * (1 - sceneQuality.t1.cloud_fraction),
    sceneQuality.t2.data_completeness * (1 - sceneQuality.t2.cloud_fraction)
  );
  
  if (minQuality < 0.5) {
    return { is_reliable: false, confidence: 0, ... };
  }
  
  // تغيير كل ميزة موزون بجودة الملاحظة
  const delta_luminance = Math.abs(featuresT2.mean_luminance - featuresT1.mean_luminance);
  const delta_entropy   = featuresT2.entropy - featuresT1.entropy;
  const delta_edges     = featuresT2.edge_density - featuresT1.edge_density;
  const delta_soil      = featuresT2.bare_soil_fraction - featuresT1.bare_soil_fraction;
  const delta_vegetation= featuresT1.vegetation_fraction - featuresT2.vegetation_fraction;
  
  // مؤشر التغيير المركّب (محدودية: لا تمييز بين أنواع التغيير)
  const raw_change = (
    delta_luminance * 0.20 +
    Math.abs(delta_entropy) * 0.25 +
    Math.abs(delta_edges) * 0.25 +
    Math.abs(delta_soil) * 0.15 +
    Math.abs(delta_vegetation) * 0.15
  );
  
  return {
    is_reliable:      minQuality > 0.7,
    confidence:       minQuality,
    change_magnitude: Math.min(1, raw_change),
    change_direction: delta_entropy > 0 ? 'increasing_complexity' : 'stabilizing',
    dominant_signal:  determineDominantSignal(delta_soil, delta_edges, delta_vegetation),
    quality_weight:   minQuality,
  };
}
```

**لماذا هذا أفضل من مقارنة ملفات PNG؟**
- يعمل على **بيكسلات حقيقية** وليس bytes مضغوطة
- كل ميزة لها **تفسير فيزيائي** (تربة مكشوفة = حفر، حواف = هياكل)
- الجودة تدخل في الحساب → ملاحظات منخفضة الجودة تُضعَّف تلقائياً
- التغيير **موزون** وليس مجرد فرق

---

### 5.3 Evidence Layer

#### EvidenceGenerator
بدلاً من تحويل التغيير مباشرة إلى تصنيف، نُنشئ **حزمة أدلة**:

```typescript
interface Evidence {
  type: 'supporting' | 'contradicting' | 'missing';
  signal: string;          // ما لاحظناه
  value: number;           // القيمة العددية
  confidence: number;      // مستوى الثقة في هذه الملاحظة
  date_observed: string;
  scene_id: string;
}

interface ConstructionEvidence {
  // أدلة نشاط إنشائي
  surface_disturbance:    Evidence;  // تغيير في التربة/الأسطح
  structural_appearance:  Evidence;  // ظهور هياكل جديدة
  material_presence:      Evidence;  // مواد إنشاء مرئية
  equipment_indicators:   Evidence;  // مؤشرات وجود معدات (من edge_density)
  footprint_change:       Evidence;  // تغيير في footprint المشروع
  
  // أدلة توقف
  stasis_signal:          Evidence;  // ثبات الميزات عبر الزمن
  vegetation_recovery:    Evidence;  // عودة النباتات (إشارة توقف طويل)
  
  // جودة البيانات
  observation_quality:    Evidence;  // جودة المشاهد المستخدمة
  observation_count:      Evidence;  // عدد المشاهد المتاحة
  temporal_coverage:      Evidence;  // الفجوات الزمنية في التغطية
  
  // الاستنتاج
  overall_activity_level: number;    // 0-1 موزون بالجودة
  overall_confidence:     number;    // 0-1
  explanation_ar:         string;    // جملة شرح بالعربي
}
```

---

### 5.4 Construction Phase Classifier

```typescript
type ConstructionPhase =
  | 'pre_construction'   // قبل البدء — موقع طبيعي
  | 'site_clearing'      // إزالة النباتات، تسوية أولية
  | 'excavation'         // حفر واضح
  | 'foundation'         // صبّ أساسات
  | 'structural_works'   // أعمال هيكلية
  | 'road_base'          // طبقات الأساس (للطرق)
  | 'asphalt_paving'     // رصف (للطرق)
  | 'finishing'          // تشطيبات متأخرة، نشاط منخفض
  | 'completed'          // اكتمال
  | 'paused'             // متوقف مؤقتاً
  | 'abandoned'          // متوقف طويل
  | 'unknown';           // غير كافٍ للتصنيف

interface PhaseEstimate {
  phase:         ConstructionPhase;
  confidence:    number;
  evidence:      Evidence[];
  transition_from?: ConstructionPhase;  // إذا تغيرت المرحلة
  transition_date?: string;
}
```

**منطق التصنيف**:

| المرحلة | الأدلة البصرية المتوقعة |
|---------|-------------------------|
| `site_clearing` | زيادة مفاجئة في `bare_soil_fraction`، انخفاض `vegetation_fraction` |
| `excavation` | `dark_patch_count` عالٍ (حفر)، `std_luminance` عالٍ، `entropy` عالٍ |
| `structural_works` | `edge_density` مرتفع، `bright_patch_count` يزيد، `linear_score` عالٍ |
| `finishing` | استقرار `edge_density`، انخفاض `change_magnitude`، `entropy` ينخفض |
| `completed` | ثبات كامل للميزات، ظهور أسطح نهائية |

---

### 5.5 Progress Models (لكل نوع مشروع)

#### نموذج الطريق (Road Progress Model)
```typescript
class RoadProgressModel {
  /**
   * المفاهيم المستخدمة:
   * الطريق يتقدم أفقياً على طول خطه
   * يمكن قياس نسبة المقطع المكتمل من linear_score
   * والمساحة المعبّدة من انعدام التغيير (asphalt ثابت)
   */
  estimate(evidence: ConstructionEvidence[], projectGeometry: LineString): ProgressEstimate {
    
    // تقدير الطريق من:
    // 1. نسبة طول الخط الذي وصل لمرحلة asphalt_paving
    // 2. نسبة المساحة ذات edge_density عالٍ ومستقر
    // 3. تراجع activity على الأجزاء المكتملة (الرصف المكتمل لا يتغير)
    
    const asphalt_sections = evidence.filter(e => 
      e.surface_disturbance.value < 0.1 &&  // منخفض جداً
      e.structural_appearance.value > 0.6    // هيكل ثابت
    );
    
    return {
      progress_pct: (asphalt_sections.length / totalSections) * 100,
      confidence:   this.computeConfidence(evidence),
      reasoning_ar: `${asphalt_sections.length} قطاعات من أصل ${totalSections} تُظهر علامات الرصف المكتمل`,
      phase:        this.estimatePhase(evidence),
    };
  }
}
```

#### نموذج المبنى (Building Progress Model)
```typescript
class BuildingProgressModel {
  /**
   * المبنى يتقدم عمودياً (طوابق) لكن بصرياً من الأعلى
   * المؤشرات:
   * - footprint مستقر = البناء يرتفع (لا توسع أفقي)
   * - ظهور ظلال أطول = المبنى يرتفع
   * - edge_density مرتفع ومتزايد = هيكل ينمو
   * - انخفاض activity في المراحل المتأخرة = تشطيبات داخلية
   */
  estimate(evidence: ConstructionEvidence[]): ProgressEstimate {
    // تقدير صعب بدون data ارتفاع
    // نستخدم: تاريخ بدء النشاط المكثف + اتجاه الـ entropy
    // + مقارنة مع مشاريع مشابهة
    
    const phases_completed = this.identifyCompletedPhases(evidence);
    const typical_duration = this.getTypicalDurationForType('building');
    
    // الاستنتاج من التسلسل الزمني للمراحل
    const phase_weights: Record<ConstructionPhase, number> = {
      'excavation':      0.10,
      'foundation':      0.20,
      'structural_works':0.50,
      'finishing':       0.85,
      'completed':       1.00,
    };
    
    return {
      progress_pct: (phase_weights[this.currentPhase] ?? 0) * 100,
      confidence:   0.55,  // بدون LiDAR أو بيانات ارتفاع، الثقة متوسطة دائماً
      reasoning_ar: `المشروع في مرحلة ${this.currentPhase} بناءً على التسلسل البصري المرصود`,
      limitation_ar: 'لا يمكن قياس ارتفاع المبنى من صور مستوية — الإنجاز الرأسي يحتاج بيانات LiDAR أو صور ستيريو',
    };
  }
}
```

---

### 5.6 Temporal Engine

#### RollingWindowAnalyzer
```typescript
interface TemporalSignal {
  window_days: number;
  mean_activity:       number;
  trend_slope:         number;   // إيجابي = متزايد، سلبي = متناقص
  trend_significance:  number;   // 0-1: هل الاتجاه حقيقي أم ضوضاء؟
  volatility:          number;   // تباين النشاط (عالٍ = غير منتظم)
  momentum:            number;   // تسارع أو تباطؤ النشاط
  seasonal_correction: number;   // تصحيح الموسمية (شتاء/صيف)
}

class RollingWindowAnalyzer {
  /**
   * نوافذ زمنية متعددة للكشف عن أنماط مختلفة:
   * 7  أيام  → نشاط يومي حديث
   * 30 يوم   → نشاط شهري
   * 90 يوم   → اتجاه ربع سنوي
   * 365 يوم  → نمط سنوي كامل
   */
  analyze(points: TimelinePoint[], windowDays: number): TemporalSignal {
    const cutoff = new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0,10);
    const window = points.filter(p => p.date >= cutoff);
    
    if (window.length < 3) {
      return { window_days: windowDays, trend_significance: 0, ... };
    }
    
    // Linear regression على نقاط النشاط
    const { slope, r_squared } = linearRegression(
      window.map((_, i) => i),
      window.map(p => p.activity_level)
    );
    
    return {
      window_days:         windowDays,
      mean_activity:       mean(window.map(p => p.activity_level)),
      trend_slope:         slope,
      trend_significance:  r_squared,   // R² > 0.5 = اتجاه حقيقي
      volatility:          std(window.map(p => p.activity_level)),
      momentum:            computeMomentum(window),
      seasonal_correction: this.getSeasonalFactor(new Date().getMonth()),
    };
  }
}
```

---

### 5.7 Health Engine (بلا أوزان مُضمَّنة)

```typescript
interface HealthConfig {
  weights: {
    progress_vs_expected:    number;  // كيف التقدم مقارنة بالخطة
    construction_velocity:   number;  // سرعة العمل الأخيرة
    interruption_severity:   number;  // شدة وتكرار التوقفات
    evidence_completeness:   number;  // كفاية البيانات للحكم
    data_recency:            number;  // حداثة آخر مشهد صالح
    activity_consistency:    number;  // انتظام النشاط
  };
  thresholds: {
    critical_health: number;   // < 30
    warning_health:  number;   // < 60
    good_health:     number;   // >= 80
  };
}

const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  weights: {
    progress_vs_expected:  0.30,
    construction_velocity: 0.20,
    interruption_severity: 0.20,
    evidence_completeness: 0.15,
    data_recency:          0.10,
    activity_consistency:  0.05,
  },
  thresholds: { critical_health: 30, warning_health: 60, good_health: 80 },
};

function computeHealthScore(
  project: PICProject,
  evidence: ConstructionEvidence[],
  temporal: TemporalSignal,
  config: HealthConfig = DEFAULT_HEALTH_CONFIG
): HealthEstimate {
  
  const scores: Record<string, number> = {};
  
  // 1. التقدم مقارنة بالخطة
  if (project.expected_end_date && project.start_date) {
    const timeRatio = daysBetween(project.start_date, today()) / daysBetween(project.start_date, project.expected_end_date);
    const progressRatio = project.progress_pct / 100;
    scores.progress_vs_expected = Math.min(1, progressRatio / Math.max(timeRatio, 0.01));
  } else {
    scores.progress_vs_expected = 0.5;  // غير محدد
  }
  
  // 2. سرعة العمل (من آخر 30 يوم)
  scores.construction_velocity = temporal.mean_activity;
  
  // 3. شدة التوقفات
  const totalStoppageDays = evidence.reduce((sum, e) => 
    e.stasis_signal.confidence > 0.7 ? sum + 1 : sum, 0
  );
  scores.interruption_severity = Math.max(0, 1 - (totalStoppageDays / 365));
  
  // 4. اكتمال البيانات
  const recentScenes = evidence.filter(e => e.observation_quality.confidence > 0.6).length;
  scores.evidence_completeness = Math.min(1, recentScenes / 10);
  
  // 5. حداثة البيانات
  const daysSinceLastObservation = project.last_scan_date 
    ? daysBetween(project.last_scan_date, today())
    : 999;
  scores.data_recency = Math.max(0, 1 - daysSinceLastObservation / 60);
  
  // 6. انتظام النشاط
  scores.activity_consistency = 1 - temporal.volatility;
  
  // الحساب المرجَّح
  const health = Object.entries(config.weights).reduce((sum, [key, weight]) => {
    return sum + (scores[key] ?? 0) * weight;
  }, 0) * 100;
  
  return {
    score: Math.round(health),
    components: scores,
    config_used: config,
    explanation_ar: buildHealthExplanation(scores, config),
  };
}
```

---

### 5.8 Interruption Classifier

```typescript
type InterruptionType =
  | 'normal_pause'         // توقف اعتيادي < 7 أيام
  | 'weekend_pattern'      // توقفات متكررة أسبوعياً
  | 'weather_pause'        // مرتبط بالطقس (مطر/حرارة شديدة)
  | 'seasonal_pause'       // نمط موسمي متكرر سنوياً
  | 'administrative_pause' // توقف مفاجئ، ليس طقساً
  | 'construction_slowdown'// تباطؤ تدريجي وليس توقفاً كاملاً
  | 'major_interruption'   // توقف طويل > 30 يوم
  | 'abandonment'          // > 6 أشهر، نمو نباتي
  | 'unknown';

interface ClassifiedInterruption {
  type:           InterruptionType;
  start_date:     string;
  end_date:       string | 'ongoing';
  duration_days:  number;
  confidence:     number;
  evidence:       string[];
  // ما الذي جعلنا نصنف هذا التوقف هكذا؟
  reasoning_ar:   string;
}
```

**منطق التصنيف**:

```
توقف 1-7 أيام        → normal_pause (confidence: 0.9)
متكرر كل 5-7 أيام   → weekend_pattern (يحتاج 3+ تكرارات)
مرتبط بأيام مطر     → weather_pause (يحتاج بيانات طقس)
توقف > 30 يوم مع تراجع vegetation → abandonment risk
توقف تدريجي لا فوري  → construction_slowdown
```

---

## 6. خارطة الطريق للتنفيذ

### المرحلة 0 — الأساس (أسبوع 1)
**الهدف**: استبدال `compareImages()` بـ pixel-based analysis

1. تثبيت `sharp`: `npm install sharp @types/sharp`
2. بناء `PixelDecoder` → `DecodedScene`
3. بناء `FeatureExtractor` لـ 8 ميزات أساسية
4. بناء `SceneQualityValidator`
5. إضافة جدول `pic.features` في قاعدة البيانات
6. **لا تُعيد كتابة progress estimation بعد** — فقط استبدل `compareImages`

**معيار النجاح**: `compareImages()` محذوف ولا يوجد مكانه أي مقارنة byte-level.

---

### المرحلة 1 — Evidence Engine (أسبوع 2-3)
1. بناء `EvidenceGenerator` و `ConstructionEvidence`
2. بناء `ConstructionPhaseClassifier` لأنواع road و building
3. تحديث `buildTimeline()` ليُخرج `evidence[]` مع كل نقطة
4. تحديث API لإرجاع evidence في response
5. إضافة `explanation_ar` لكل استنتاج

---

### المرحلة 2 — Progress Models (أسبوع 4)
1. بناء `RoadProgressModel`
2. بناء `BuildingProgressModel`
3. بناء `UtilityProgressModel`
4. ربطها بـ `project.type`
5. **حذف progress_pct = activeDays/totalDays**

---

### المرحلة 3 — Temporal Engine (أسبوع 5)
1. بناء `RollingWindowAnalyzer`
2. استبدال `trend = last3 vs prev3` بـ rolling regression
3. إضافة seasonality detection
4. تحديث `HealthEngine` لاستخدام `HealthConfig` قابلة للتخصيص

---

### المرحلة 4 — Explainability (أسبوع 6)
1. كل مخرج يحمل `explanation_ar`
2. إضافة `evidence_chain` في API responses
3. بناء executive report generator
4. تحديث PICShell لعرض سلسلة الأدلة

---

## 7. حدود النظام الصادقة

### ما يمكن للنظام فعله بصور thumbnail (256×256 pixels):
- ✅ كشف تغيير السطح الكبير (حفر، بناء هياكل كبيرة)
- ✅ تتبع vegetation cover على مدى الزمن
- ✅ كشف التوقفات الطويلة (> 14 يوم)
- ✅ تصنيف مرحلة البناء الكبرى بدقة **متوسطة** (±1 مرحلة)
- ✅ تقدير اتجاه النشاط (متزايد/متناقص) بثقة **مقبولة** مع > 20 مشهد

### ما لا يمكن للنظام فعله بهذه البيانات:
- ❌ قياس ارتفاع المباني (يحتاج LiDAR أو stereo)
- ❌ تمييز المعدات الفردية (يحتاج < 1m resolution)
- ❌ حساب حجم التربة المحفورة (يحتاج DEM)
- ❌ إنجاز دقيق > ±20% (بدون ground truth أو BIM)
- ❌ تمييز سبب التوقف (إداري/طقس) بدون بيانات خارجية

### نقاط الثقة الإلزامية:
كل رقم يجب أن يأتي مع `confidence` ويُعرض بشكل صريح في الواجهة.
**لا يجوز عرض "الإنجاز: 85%" بدون "±20%, ثقة: متوسطة".**

---

## 8. متطلبات قاعدة البيانات الجديدة

```sql
-- جدول ميزات المشاهد
CREATE TABLE pic.features (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES pic.projects(id) ON DELETE CASCADE,
  scene_id        TEXT NOT NULL,
  scene_date      DATE NOT NULL,
  
  -- Scene Quality
  cloud_fraction  NUMERIC(4,3),
  shadow_fraction NUMERIC(4,3),
  quality_score   NUMERIC(4,3),
  is_usable       BOOLEAN NOT NULL DEFAULT true,
  
  -- Feature Set
  mean_luminance     NUMERIC(6,4),
  std_luminance      NUMERIC(6,4),
  entropy            NUMERIC(6,4),
  edge_density       NUMERIC(6,4),
  bare_soil_fraction NUMERIC(6,4),
  vegetation_fraction NUMERIC(6,4),
  contrast           NUMERIC(6,4),
  linear_score       NUMERIC(6,4),
  
  -- Change from previous scene
  change_magnitude    NUMERIC(6,4),
  change_confidence   NUMERIC(4,3),
  dominant_signal     TEXT,
  
  -- Evidence
  activity_level      NUMERIC(4,3),
  activity_confidence NUMERIC(4,3),
  phase_estimate      TEXT,
  phase_confidence    NUMERIC(4,3),
  explanation_ar      TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, scene_id)
);

-- جدول سلسلة الأدلة
CREATE TABLE pic.evidence_chain (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES pic.projects(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES pic.features(id),
  evidence_type TEXT NOT NULL,  -- 'supporting'|'contradicting'|'missing'
  signal     TEXT NOT NULL,
  value      NUMERIC,
  confidence NUMERIC(4,3),
  reasoning_ar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. القرار النهائي

الكود الحالي في `lib/picAnalysis.ts` يجب اعتباره **نموذج أولي مؤقت** وليس محرك إنتاج.

**الأولويات بالترتيب:**
1. استبدال `compareImages()` بـ pixel-based feature extraction (sharp)
2. استبدال `progress = activeDays/totalDays` بـ evidence-based inference
3. استبدال health score الثابت بـ configurable HealthEngine
4. إضافة explanation_ar لكل مخرج
5. إضافة confidence intervals لكل رقم

**الحد الأدنى للنظام العلمي القابل للدفاع:**  
أي رقم يُعرض في الواجهة يجب أن يكون قابلاً للشرح بجملة واحدة تربط الرقم بملاحظة مباشرة.

إذا لم نستطع شرح كيف وصلنا إلى "85% إنجاز" بجملة مثل:  
*"25 من 30 قطاعاً رُصدت فيها علامات هيكل ثابت مع انخفاض النشاط < 10%"*  
— فالرقم غير صالح للاستخدام.

---

*تم إعداد هذه الوثيقة بناءً على مراجعة كاملة لكود `lib/picAnalysis.ts` (424 سطر).*  
*كل نقد موثق بالسطر والدالة. كل توصية قابلة للتطبيق بالأدوات المتاحة.*
