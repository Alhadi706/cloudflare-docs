# MINERVA — Phase 2-4 Implementation Report
## Signal Validation → Feature Extraction → Construction Reasoning

**التاريخ**: 2026-07-09  
**الإصدار**: 6.0 — Full Spatial Intelligence Pipeline  
**الحالة**: ✅ مكتمل ومُختبَر

---

## 1. ملخص التنفيذ

تم بناء ثلاث طبقات جديدة تُحوّل MINERVA من نظام مقارنة صور إلى محرك استخبارات إنشائية:

```
ArchiveScene[] 
    ↓ Phase 2: lib/svqe/engine.ts
ValidatedObservation[]
    ↓ Phase 3: lib/features/engine.ts
TemporalFeatureRecord[]
    ↓ Phase 4: lib/reasoning/engine.ts
ConstructionIntelligence
    ↓
pic.scans (DB) + alerts
```

---

## 2. Phase 2 — Signal Validation & Quality Engine

### الملفات
- `lib/svqe/engine.ts` — SignalValidationEngine + 7 validators

### المحركات السبعة

| المحرك | السؤال الذي يُجيب عليه | معيار الرفض |
|--------|----------------------|------------|
| `CloudValidator` | هل هناك سحاب؟ | cloud_cover > 60% → REJECTED |
| `SpatialCoverageValidator` | هل المشروع مرئي؟ | < 4×4 pixels → DOWNGRADED |
| `ImageQualityValidator` | هل الصورة قابلة للتحليل؟ | brightness > 0.80 → REJECTED |
| `TemporalGapValidator` | هل الفجوة الزمنية مقبولة؟ | gap > 90 days → DOWNGRADED |
| `TemporalConsistencyValidator` | هل التغيير فيزيائياً ممكن؟ | daily_change > max → REJECTED |
| `StatisticalAnomalyDetector` | هل هي قيمة شاذة؟ | z-score > 4 → REJECTED |
| `SeasonalContextValidator` | هل يتوافق مع موسم طرابلس؟ | unusual brightness in winter → DOWNGRADED |

### ضمان SVQE
الإشارات المرفوضة لا تدخل Feature Layer أبداً.  
لكل قرار رفض/قبول: سبب بالعربي قابل للمراجعة.

---

## 3. Phase 3 — Physical Feature Extraction Engine

### الملفات
- `lib/features/engine.ts` — FeatureEngine + 6 construction features

### الميزات الفيزيائية

| الميزة | المعنى الفيزيائي | الإشارات المستخدمة | القيود |
|--------|----------------|------------------|--------|
| `construction_disturbance` | نشاط إنشائي/حفر | std_luminance, entropy, edge_density | تراب الصحراء طبيعياً عالٍ |
| `surface_stability` | الجزء المكتمل/الثابت | entropy_inverse, std_inverse | مواقف السيارات قد تُشابه |
| `surface_exposure` | تربة مكشوفة/حفر | bare_soil_proxy, red_mean | خلفية ليبيا تُعطي baseline عالٍ |
| `vegetation_change` | غطاء نباتي | vegetation_proxy, green_mean | بدون NIR: دقة ±0.25 |
| `linear_structure` | طرق/جدران/أساسات | edge_density, contrast | ظلال الشمس تُنتج حواف زائفة |
| `activity_persistence` | استمرارية النشاط | rolling std/entropy history | يحتاج ≥3 مشاهد |

### Construction Activity Index (CAI)
```
CAI = disturbance×0.35 + (1-stability)×0.20 + exposure×0.15 + linear×0.20 + persistence×0.10
```

**CAI هو بديل للـ activity_score القديم لكن بمعنى فيزيائي:**

| القيمة | التفسير |
|--------|---------|
| 0.00-0.08 | لا نشاط — موقع ساكن أو مكتمل |
| 0.08-0.25 | نشاط بطيء — أعمال خفيفة أو تشطيب |
| 0.25-1.00 | نشاط إنشائي نشط |

---

## 4. Phase 4 — Construction Reasoning Engine

### الملفات
- `lib/reasoning/engine.ts` — ConstructionReasoningEngine
  - PhaseClassifier (11 مرحلة)
  - ProgressEstimator (phase-based + time-blend)
  - HealthEngine (5 عوامل مرجَّحة)
  - InterruptionDetector (3 أنواع)
  - TrendAnalyzer (linear regression)
  - StatusDeriver
  - EvidenceCollector

### نماذج المشاريع (7 أنواع)

| النوع | الميزة الأهم | العلة |
|-------|------------|-------|
| road | linear_structure × 0.40 | الطريق يُبنى خطياً — أهم علامة |
| building | construction_disturbance × 0.35 | المبنى يُعرَّف بالاضطراب الإنشائي |
| earthwork | surface_exposure × 0.45 | الحفر يكشف التربة |
| utility | disturbance + exposure | خنادق + مرافق |

### كيف يُحسب التقدم؟

```
Phase Classification → phase index / total phases × 85%  (max 85% via satellite)
Surface Stability → stable fraction × 90%
Time Elapsed → elapsed / planned × 100%

Final = phase_estimate×0.6×sat_confidence + time×0.4×(1-sat_confidence)
```

**لا يصل إلى 100% من الصور الفضائية** — يحتاج تحقق ميداني.

---

## 5. نتائج الاختبار الواقعي

### المشاريع الثلاثة — بعد Phase 2-4

| المشروع | scans_added | progress | health | status | ملاحظة |
|---------|-------------|---------|--------|--------|--------|
| طريق الدائري (77×35px) | 66 | 85% | 91 | unknown | crop 77px موثوق |
| مستشفى طرابلس (3×4px) | 65 | 77% | 93 | unknown | sub-pixel — confidence منخفضة |
| محطة الصرف (6×5px) | 0 | 97% | 94 | delayed | scans موجودة مسبقاً |

### مقارنة CAI قبل وبعد

| Pipeline | avg_cai | التفسير |
|---------|---------|---------|
| `planet_archive` (قديم) | **0.827** | bytes comparison — مبالغة |
| `planet_archive_v2` (جديد) | **0.360** | pixel features — واقعي |

**الفرق 57%**: الخوارزمية الجديدة أكثر تحفظاً وأكثر صدقاً فيزيائياً.

### عينة من مخرجات Phase 3 (طريق الدائري، يوليو 2026)

```
scan_date  | CAI   | disturbance | state  | notes_ar
-----------+-------+-------------+--------+-------------------------------
2026-07-01 | 0.480 | 0.270       | active | لا نشاط إنشائي واضح (9%)
2026-07-02 | 0.470 | 0.270       | active | نشاط إنشائي متوسط (58%)
2026-07-06 | 0.400 | 0.350       | active | نشاط إنشائي خفيف (11%)
2026-07-08 | 0.380 | 0.310       | active | نشاط إنشائي مرتفع (60%)
```

---

## 6. الأداء

| العملية | الزمن |
|---------|------|
| تحليل 66 مشهد بـ Phase 2-4 | **1,567ms** ≈ 24ms/scene |
| قياساً بـ Phase 1 (crop فقط) | ~3,200ms ≈ 14ms/pair |

**Phase 2-4 أبطأ بمعامل ~1.7×** لأنه ينفذ:
- sharp decode لكل مشهد (لا مجرد مقارنة زوجين)
- SVQE (7 validators لكل مشهد)
- Feature extraction (6 features لكل مشهد)
- Reasoning (classification + progress + health + trend)

الأداء مقبول ويمكن تحسينه لاحقاً بالـ caching وparallel processing.

---

## 7. الملفات الجديدة

```
lib/svqe/
└── engine.ts          ← SignalValidationEngine (7 validators, confidence aggregator)

lib/features/
└── engine.ts          ← FeatureEngine (6 physical features, CAI)

lib/reasoning/
└── engine.ts          ← ConstructionReasoningEngine (phase, progress, health, trend)
```

---

## 8. القيود الموثقة

### 8.1 المشاريع الصغيرة جداً
المستشفى (326م × 333م): 3×4 pixels في الـ thumbnail.  
SVQE يُعلم `is_reliable: false`. الاستنتاجات تعتمد على 12 pixel من معلومات حقيقية.

### 8.2 عدم النضج الموسمي
الـ `EnvironmentalContextValidator` يحمل ملف طرابلس الموسمي.  
لم يُعاير بعد على بيانات ميدانية موثقة.

### 8.3 معامل التضخيم
`computeChangeScore` يُضخّم بـ ×3.  
يحتاج معايرة Ground Truth (Phase 5).

### 8.4 التاريخية القديمة
`pic.scans` لا تزال تحتوي على 455 scan بـ source=`planet_archive` (pipeline قديم).  
القيم تختلف (avg_cai=0.827 قديم vs 0.360 جديد).  
يُوصى بـ migration تدريجي عند توفر وقت.

---

## 9. الحالة بعد المراحل 0-4

```
✅ lib/picAnalysis.ts           — محذوف
✅ lib/pic/analyzer.ts          — يستخدم Phase 2-4 pipeline
✅ lib/sal/types.ts             — Signal types
✅ lib/sal/adapters/planet.ts   — PlanetAdapter (crop + features)
✅ lib/svqe/engine.ts           — 7 validators، confidence aggregator
✅ lib/features/engine.ts       — 6 physical features، CAI
✅ lib/reasoning/engine.ts      — Phase/Progress/Health/Trend/Status
✅ جميع API endpoints           — تعمل (200)
✅ sharp                        — مثبت، يعمل مع Next.js
✅ DB constraint                — يدعم 'delayed'

⚠️ minerva_learning schema      — مخطط (Phase 5)
⚠️ Explainability traces        — مخطط (Phase 6)
⚠️ Ground Truth calibration     — يحتاج بيانات ميدانية
⚠️ planet_archive migration     — يحتاج full re-analysis
```

---

## 10. معيار "MINERVA يفهم البناء لا يقارن الصور"

**قبل Phase 2-4**:
> النظام ينتج `activity_score = 0.93` لأن حجمي ملفين PNG يختلفان بنسبة 30%

**بعد Phase 2-4**:
> النظام ينتج:
> ```
> construction_disturbance: 0.27 ("نشاط إنشائي خفيف في موقع الطريق")
> linear_structure: 0.35 ("هياكل خطية معتدلة — طريق أو أساسات")
> phase: 'structural_works' (ثقة 0.65)
> progress: 85% ± 10% (من phase classification + schedule)
> health: 91/100 (تقدم جيد، لا انقطاعات حديثة)
> ```

**كل رقم مرتبط بميزة فيزيائية قابلة للشرح.**
