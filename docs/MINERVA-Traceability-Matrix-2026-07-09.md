# MINERVA PIC — Traceability Matrix
## Architecture vs. Source Code: Full Implementation Audit

**التاريخ**: 2026-07-09  
**المدقق**: GitHub Copilot — Claude Sonnet 4.6  
**الهدف**: مطابقة كل مكوّن معماري مع الكود الفعلي  
**الحالة**: تقرير مراجعة — لا تنفيذ خلال هذه المرحلة

---

## 0. الحكم الفوري

> **النظام يعمل على معمارية مختلفة تماماً عما يصفه الوثائق.**

خمسة وثائق معمارية كُتبت، لكن تحليل الكود يكشف:
- المعمارية الجديدة (SAL, SVQE, Features, Evidence, Learning, Explainability) = **صفر كود مكتوب**
- المعمارية القديمة (compareImages + classifyActivity) = **لا تزال في الإنتاج**
- يوجد ملف `lib/pic/analyzer.ts` (460 سطراً) لا يُستخدم من أحد
- يوجد ملف `lib/picAnalysis.ts` (424 سطراً) يُستخدم في الإنتاج ويحتوي الكود المُقرَّر إلغاؤه

هذا **انجراف معماري (Architectural Drift)** كامل — لكن النظام يشتغل.

---

## 1. الفهرس الكامل للملفات الموجودة فعلياً

### 1.1 Source Files

```
app/api/v1/pic/
├── projects/route.ts          (65 سطر)   — GET/POST
├── projects/[id]/route.ts     (131 سطر)  — GET/PUT/DELETE/POST(analyze)
├── dashboard/route.ts          (49 سطر)   — KPIs
└── alerts/route.ts             (38 سطر)   — Alerts

app/dashboard/gis-sovereignty/project-intelligence-center/
├── page.tsx                    (11 سطر)
└── components/PICShell.tsx   (1124 سطر)  — الواجهة الكاملة

lib/
├── picDB.ts                   (332 سطر)  — CRUD + Multi-tenant
├── picAnalysis.ts             (424 سطر)  — ← يُستخدم في الإنتاج
├── pic/analyzer.ts            (460 سطر)  — ← موجود لكن لا يُستخدم
└── pic/types.ts               (172 سطر)  — Type definitions

lib/sal/          → غير موجود
lib/features/     → غير موجود
lib/evidence/     → غير موجود
lib/reasoning/    → غير موجود
```

### 1.2 Database (PostgreSQL)

```
pic schema — موجود:
├── pic.projects    (44 عمود، 4 صفوف)
├── pic.scans       (11 عمود، 9,781 صف)
├── pic.events      (9 أعمدة، 0 صف)
└── pic.alerts      (10 أعمدة، 0 صف)

minerva_learning schema       → غير موجود
minerva_explainability schema → غير موجود

satellite_intelligence schema — موجود (غير مرتبط بـ PIC):
├── scenes, analysis_runs, scene_comparisons, ...
```

### 1.3 Third-party Dependencies

```
sharp (pixel analysis)  → NOT INSTALLED
node_modules/sharp      → غير موجود
```

---

## 2. مصفوفة التتبع الكاملة

### 2.1 الطبقة الصفرية — البنية التحتية الحالية

| المكوّن | الوثيقة | الملف الفعلي | الحالة | الملاحظة |
|---------|---------|-------------|--------|----------|
| `pic.projects` table | PIC-status | DB: pic.projects | ✅ مكتمل | 44 عمود |
| `pic.scans` table | PIC-status | DB: pic.scans | ✅ مكتمل | 11 عمود |
| `pic.events` table | PIC-status | DB: pic.events | ✅ مكتمل | فارغ |
| `pic.alerts` table | PIC-status | DB: pic.alerts | ✅ مكتمل | فارغ |
| `lib/picDB.ts` CRUD | PIC-status | `lib/picDB.ts` | ✅ مكتمل | 332 سطر، multi-tenant |
| `normalizeProject()` | PIC-status | `lib/picDB.ts` | ✅ مكتمل | تطبيع تواريخ DB |
| `toDateStr()` helper | PIC-status | `lib/picDB.ts` | ✅ مكتمل | إصلاح DATE → string |
| `ON CONFLICT DO UPDATE` | PIC-status | `lib/picDB.ts` | ✅ مكتمل | idempotent scans |
| API: `GET/POST /pic/projects` | PIC-status | route.ts | ✅ مكتمل | |
| API: `GET/PUT/DELETE /pic/projects/[id]` | PIC-status | [id]/route.ts | ✅ مكتمل | |
| API: `?include=archive` | PIC-status | [id]/route.ts | ✅ مكتمل | يُرجع archive scenes |
| API: `?action=analyze` | PIC-status | [id]/route.ts | ✅ مكتمل | try-catch موجود |
| API: `GET /pic/dashboard` | PIC-status | dashboard/route.ts | ✅ مكتمل | |
| API: `GET/POST /pic/alerts` | PIC-status | alerts/route.ts | ✅ مكتمل | |
| `PICShell.tsx` map view | PIC-status | PICShell.tsx | ✅ مكتمل | 1124 سطر |
| `PICShell.tsx` time slider | PIC-status | PICShell.tsx | ✅ مكتمل | archive scenes slider |
| `PICShell.tsx` lightbox | PIC-status | PICShell.tsx | ✅ مكتمل | |
| `staticImageOverlay` (SceneMapPanel) | PIC-status | SceneMapPanel.tsx | ✅ مكتمل | ImageLayer + ImageStatic |
| Middleware `/api/v1/pic/` | PIC-status | middleware.ts:44 | ✅ مكتمل | |
| GIS Hub navigation | PIC-status | gis-sovereignty/page.tsx | ✅ مكتمل | badge "PIC · NEW" |
| `'delayed'` status in `ProjectStatus` | PIC-status | picDB.ts + PICShell.tsx | ✅ مكتمل | إصلاح v1 |
| `STATUS_CONFIG['delayed']` | PIC-status | PICShell.tsx | ✅ مكتمل | برتقالي |
| `extractionLayers` prop | PIC-status | PICShell.tsx:513 | ✅ مكتمل | إصلاح v1 |
| `findScenesForBbox` bbox fix | PIC-status | picAnalysis.ts | ✅ مكتمل | من geometry |

---

### 2.2 وثيقة 1 — PIC-Architecture-Review

| المكوّن | الحالة | الملف المناسب | الاعتماديات |
|---------|--------|--------------|------------|
| حذف `compareImages()` | ⚠️ مخطط فقط | `lib/picAnalysis.ts:96` | `analyzeProject()` |
| حذف `classifyActivity()` | ⚠️ مخطط فقط | `lib/picAnalysis.ts:130` | `analyzeProject()` |
| حذف progress = activeDays/totalDays | ⚠️ مخطط فقط | `lib/picAnalysis.ts:248` | `buildTimeline()` |
| حذف health hardcoded weights | ⚠️ مخطط فقط | `lib/picAnalysis.ts:265` | `buildTimeline()` |
| حذف trend last3/prev3 | ⚠️ مخطط فقط | `lib/picAnalysis.ts:276` | `buildTimeline()` |
| `pic.features` table (DDL) | ❌ مفقود | يحتاج migration | `FeatureExtractor` |
| `pic.evidence_chain` table | ❌ مفقود | يحتاج migration | `EvidenceGenerator` |

---

### 2.3 وثيقة 2 — MINERVA-Signal-Abstraction-Architecture

| المكوّن | الحالة | الملف المناسب | الأولوية |
|---------|--------|--------------|---------|
| `NormalizedSignal` interface | ❌ مفقود | `lib/sal/types.ts` | 🔴 عالية |
| `SignalType` union type | ❌ مفقود | `lib/sal/types.ts` | 🔴 عالية |
| `SignalProvider` type | ❌ مفقود | `lib/sal/types.ts` | 🔴 عالية |
| `SignalProvenance` interface | ❌ مفقود | `lib/sal/types.ts` | 🔴 عالية |
| `SIGNAL_REGISTRY` | ❌ مفقود | `lib/sal/registry.ts` | 🔴 عالية |
| `IProviderAdapter` interface | ❌ مفقود | `lib/sal/adapters/base.ts` | 🔴 عالية |
| `PlanetAdapter` class | ❌ مفقود | `lib/sal/adapters/planet.ts` | 🔴 عالية (يحتاج `sharp`) |
| `SignalHarmonizer` | ❌ مفقود | `lib/sal/harmonizer.ts` | 🟠 متوسطة |
| `SignalQualityAssessor` | ❌ مفقود | `lib/sal/quality.ts` | 🟠 متوسطة |
| `Sentinel2Adapter` | ❌ مفقود | `lib/sal/adapters/sentinel2.ts` | 🟡 منخفضة (مستقبلي) |
| `SARAdapter` | ❌ مفقود | `lib/sal/adapters/sar.ts` | 🟡 منخفضة (مستقبلي) |
| `WeatherAdapter` | ❌ مفقود | `lib/sal/adapters/weather.ts` | 🟡 منخفضة |

---

### 2.4 وثيقة 3 — MINERVA-Signal-Validation-Engine

| المكوّن | الحالة | الملف المناسب | الأولوية |
|---------|--------|--------------|---------|
| `ValidatedSignal` interface | ❌ مفقود | `lib/sal/types.ts` | 🔴 عالية |
| `ValidationReport` | ❌ مفقود | `lib/sal/types.ts` | 🔴 عالية |
| `RangeValidator` | ❌ مفقود | `lib/svqe/validators/range.ts` | 🔴 عالية |
| `TemporalConsistencyValidator` | ❌ مفقود | `lib/svqe/validators/temporal.ts` | 🔴 عالية |
| `CrossSignalConsistencyValidator` | ❌ مفقود | `lib/svqe/validators/cross.ts` | 🟠 متوسطة |
| `SpatialCoverageValidator` | ❌ مفقود | `lib/svqe/validators/spatial.ts` | 🔴 عالية |
| `StatisticalAnomalyDetector` | ❌ مفقود | `lib/svqe/validators/anomaly.ts` | 🟠 متوسطة |
| `EnvironmentalContextValidator` | ❌ مفقود | `lib/svqe/validators/environment.ts` | 🟠 متوسطة |
| `ConfidenceAggregator` | ❌ مفقود | `lib/svqe/aggregator.ts` | 🔴 عالية |
| `SignalValidationEngine` (orchestrator) | ❌ مفقود | `lib/svqe/engine.ts` | 🔴 عالية |

---

### 2.5 وثيقة 4 — MINERVA-Learning-Feedback + Stability-Evidence-Model

| المكوّن | الحالة | المكان | الأولوية |
|---------|--------|--------|---------|
| `minerva_learning` schema | ❌ مفقود | DB migration | 🟠 متوسطة |
| `prediction_ledger` table | ❌ مفقود | DB migration | 🟠 متوسطة |
| `ground_truth` table | ❌ مفقود | DB migration | 🟠 متوسطة |
| `error_record` table | ❌ مفقود | DB migration | 🟡 منخفضة |
| `error_pattern` table | ❌ مفقود | DB migration | 🟡 منخفضة |
| `calibration_rule` table | ❌ مفقود | DB migration | 🟠 متوسطة |
| `performance_snapshot` table | ❌ مفقود | DB migration | 🟡 منخفضة |
| `EVIDENCE_THRESHOLDS` config | ❌ مفقود | `lib/learning/thresholds.ts` | 🟠 متوسطة |
| `EvidenceSufficiencyGate` | ❌ مفقود | `lib/learning/gate.ts` | 🟠 متوسطة |
| `computeEvidenceConfidence()` | ❌ مفقود | `lib/learning/confidence.ts` | 🟠 متوسطة |
| `ErrorAnalyzer` | ❌ مفقود | `lib/learning/analyzer.ts` | 🟡 منخفضة |
| `PatternDetector` | ❌ مفقود | `lib/learning/patterns.ts` | 🟡 منخفضة |
| `CalibrationProposer` | ❌ مفقود | `lib/learning/proposer.ts` | 🟡 منخفضة |
| `CalibrationApprovalWorkflow` | ❌ مفقود | `lib/learning/workflow.ts` | 🟡 منخفضة |
| `RuleApplicator` | ❌ مفقود | `lib/learning/applicator.ts` | 🟠 متوسطة |
| `AutoRevertDetector` | ❌ مفقود | `lib/learning/revert.ts` | 🟡 منخفضة |
| `PerformanceTracker` | ❌ مفقود | `lib/learning/tracker.ts` | 🟡 منخفضة |
| API: `POST /pic/projects/[id]/ground-truth` | ❌ مفقود | API route | 🟠 متوسطة |
| API: `GET /pic/learning/dashboard` | ❌ مفقود | API route | 🟡 منخفضة |
| Feedback form in PICShell | ❌ مفقود | PICShell.tsx | 🟠 متوسطة |

---

### 2.6 وثيقة 5 — MINERVA-Explainability-Decision-Trace

| المكوّن | الحالة | المكان | الأولوية |
|---------|--------|--------|---------|
| `minerva_explainability` schema | ❌ مفقود | DB migration | 🟠 متوسطة |
| `decision_traces` table | ❌ مفقود | DB migration | 🟠 متوسطة |
| `DecisionTrace` interface | ❌ مفقود | `lib/explainability/types.ts` | 🟠 متوسطة |
| `TraceBuilder` class | ❌ مفقود | `lib/explainability/builder.ts` | 🟠 متوسطة |
| `NarrativeGenerator` | ❌ مفقود | `lib/explainability/narrative.ts` | 🟠 متوسطة |
| `ExplainabilityAuditor` | ❌ مفقود | `lib/explainability/auditor.ts` | 🟠 متوسطة |
| "لماذا هذا الرقم؟" UI component | ❌ مفقود | PICShell.tsx | 🟠 متوسطة |
| API: `GET /pic/projects/[id]/explanations` | ❌ مفقود | API route | 🟡 منخفضة |
| API: `GET /trace` endpoint | ❌ مفقود | API route | 🟡 منخفضة |

---

### 2.7 الملف الغامض — `lib/pic/analyzer.ts` (460 سطر)

**المشكلة**: هذا الملف موجود لكن **لا يُستخدم من أحد**.

```typescript
// app/api/v1/pic/projects/[id]/route.ts
import { analyzeProject, buildTimeline, findScenesForBbox } from '@/lib/picAnalysis'; // ← يستخدم هذا
// لا يستخدم @/lib/pic/analyzer
```

**ما يحتويه `lib/pic/analyzer.ts` مقارنة بـ `lib/picAnalysis.ts`**:

| الميزة | `lib/picAnalysis.ts` (إنتاج) | `lib/pic/analyzer.ts` (غير مستخدم) |
|--------|------------------------------|--------------------------------------|
| `compareImages()` | ❌ موجود (bytes) | ✅ محسّن (computeActivityScore) |
| `classifyActivity()` | ❌ عتبات 0.20/0.06 | ✅ نفس العتبات لكن منفصلة |
| Health weights | ❌ مُضمَّنة | ✅ `HEALTH_WEIGHTS` object |
| Summary Arabic | ❌ غير موجود | ✅ `generateSummaryAr()` |
| Types import | ❌ مُعرَّفة داخلياً | ✅ من `./types` |
| `analyzeProject()` | ✅ يُستدعى من API | ✅ موجود لكن غير مستدعى |

**التوصية**: حدّث API routes لاستخدام `lib/pic/analyzer.ts` بدلاً من `lib/picAnalysis.ts`، ثم احذف `lib/picAnalysis.ts` تدريجياً. هذا يحل التعارض ويُقلّل التكرار.

---

## 3. الانجرافات المعمارية (Architectural Drift)

### 3.1 الانجراف الأكبر: محركَا تحليل متوازيان

```
الوضع الحالي:
  lib/picAnalysis.ts ──── يُستخدم من: [id]/route.ts
  lib/pic/analyzer.ts ─── لا يُستخدم من أحد

الوضع المطلوب:
  lib/sal/adapters/planet.ts ─── يُستبدل picAnalysis.ts
  lib/features/*.ts ──────────── يُستبدل compareImages + classifyActivity
  lib/reasoning/*.ts ─────────── يُستبدل buildTimeline + healthScore
```

**التأثير**: كل قرار في الإنتاج الآن يُنتجه `compareImages()` المُقرَّر إلغاؤه. المستخدمون يرون أرقاماً من الخوارزمية الخاطئة.

---

### 3.2 الانجراف الثاني: `lib/pic/types.ts` vs `lib/picDB.ts`

```typescript
// lib/pic/types.ts — لا يحتوي 'delayed'
export type ProjectStatus = 'active' | 'slow' | 'stopped' | 'completed' | 'cancelled' | 'unknown';

// lib/picDB.ts — يحتوي 'delayed'
export type ProjectStatus = 'active' | 'slow' | 'stopped' | 'completed' | 'cancelled' | 'unknown' | 'delayed';

// lib/pic/types.ts — لا يحتوي على AlertSeverity مطابقة
export type AlertSeverity = 'info' | 'warning' | 'critical';
// lib/picDB.ts
export type AlertSeverity = 'critical' | 'warning' | 'info';  // نفس القيم، ترتيب مختلف
```

**التأثير**: `lib/pic/analyzer.ts` يستخدم `lib/pic/types.ts` بينما الكود الحقيقي في `lib/picDB.ts` — أي types جديدة تُضاف لواحد لا تظهر للآخر.

---

### 3.3 الانجراف الثالث: DB columns مفقودة

DB الحالية مقارنة بما تطلبه الوثائق:

| الحقل | الجدول | الوضع |
|-------|--------|-------|
| `explanation_ar` | `pic.scans` | ❌ مفقود |
| `confidence` | `pic.scans` | ❌ مفقود |
| `feature_vector` | `pic.scans` | ❌ مفقود |
| `calibration_note_ar` | `pic.projects` | ❌ مفقود |
| `trace_id` | `pic.projects` | ❌ مفقود |
| `gate_results` | `calibration_rule` | ❌ مفقود (الجدول غير موجود) |

---

### 3.4 الانجراف الرابع: `lib/pic/analyzer.ts` يُعيد تعريف بعض ما في `lib/picDB.ts`

```typescript
// lib/pic/types.ts يُعرّف PICProject محلياً
export interface PICProject { ... }  // 25 حقل

// lib/picDB.ts يُعرّف PICProject مختلفاً
export interface PICProject { ... }  // 30 حقل + delayed status
```

هذا يعني أنه لو ربطنا `lib/pic/analyzer.ts` بالـ API، سيوجد خلاف في الأنواع.

---

## 4. ملخص الحالة الإجمالية

```
┌──────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION STATUS SUMMARY                      │
├─────────────────────────────┬────────────────────────────────────────┤
│ الفئة                       │ الحالة                                 │
├─────────────────────────────┼────────────────────────────────────────┤
│ DB — pic schema             │ ✅ مكتمل (4 جداول، 8000+ scan)         │
│ API Routes                  │ ✅ مكتمل (5 routes، كلها تعمل)         │
│ PICShell.tsx                │ ✅ مكتمل + time slider + lightbox       │
│ lib/picDB.ts                │ ✅ مكتمل + date normalization           │
│ lib/picAnalysis.ts          │ ⚠️ جزئي — compareImages لا تزال قائمة │
│ lib/pic/analyzer.ts         │ 🔶 موجود لكن منفصل — لا يُستخدم      │
│ lib/pic/types.ts            │ ⚠️ جزئي — تعارض مع picDB.ts           │
├─────────────────────────────┼────────────────────────────────────────┤
│ SAL (Signal Abstraction)    │ ❌ مفقود كلياً                         │
│ SVQE (Signal Validation)    │ ❌ مفقود كلياً                         │
│ Feature Layer               │ ❌ مفقود كلياً                         │
│ Evidence Layer              │ ❌ مفقود كلياً                         │
│ Reasoning Layer (new)       │ ❌ مفقود كلياً                         │
├─────────────────────────────┼────────────────────────────────────────┤
│ minerva_learning schema     │ ❌ مفقود كلياً                         │
│ minerva_explainability      │ ❌ مفقود كلياً                         │
│ Learning/Feedback Engine    │ ❌ مفقود كلياً                         │
│ Explainability/Trace        │ ❌ مفقود كلياً                         │
│ EvidenceSufficiencyGate     │ ❌ مفقود كلياً                         │
├─────────────────────────────┼────────────────────────────────────────┤
│ sharp (pixel analysis)      │ ❌ غير مثبّت                           │
└─────────────────────────────┴────────────────────────────────────────┘

مكتمل:    24 مكوّن  (27%)
جزئي:      3 مكوّنات (3%)
مخطط فقط: 60+ مكوّن (70%)
```

---

## 5. خارطة الطريق المُصحَّحة — بالترتيب الصحيح

### المرحلة صفر — توحيد المحرك الحالي (أسبوع 1)
**المشكلة**: ملفان للتحليل، أحدهما في الإنتاج، الآخر يتيم.

**الإجراءات**:
1. توحيد `lib/pic/types.ts` و `lib/picDB.ts` → نوع واحد مشترك (`lib/pic/types.ts` يكون المرجع)
2. تحديث `[id]/route.ts` لاستخدام `lib/pic/analyzer.ts` بدلاً من `lib/picAnalysis.ts`
3. التحقق من عمل API بعد التبديل
4. حذف `lib/picAnalysis.ts` (بعد التحقق)

**المعيار**: API تعمل وتُرجع نفس النتائج، ولا يوجد استيراد من `lib/picAnalysis.ts`

---

### المرحلة 1 — تثبيت sharp + PixelDecoder (أسبوع 2)
**المشكلة**: `compareImages()` تقارن bytes مضغوطة.

**الإجراءات**:
1. `npm install sharp @types/sharp`
2. إنشاء `lib/sal/types.ts` — فقط: `NormalizedSignal`, `SignalType` (لا كل الأنواع)
3. إنشاء `lib/sal/adapters/planet.ts` — `PlanetAdapter` يُفكك PNG → 5 إشارات
4. استبدال `computeActivityScore()` في `lib/pic/analyzer.ts` باستدعاء `PlanetAdapter`
5. الاحتفاظ ببقية `lib/pic/analyzer.ts` دون تغيير

**المعيار**: `compareImages()` محذوفة تماماً، الـ API لا تزال تعمل

---

### المرحلة 2 — SVQE المبسّط (أسبوع 3)
**المشكلة**: لا تحقق من جودة الإشارات.

**الإجراءات**:
1. إنشاء `lib/svqe/validators/range.ts` — `RangeValidator` فقط
2. إنشاء `lib/svqe/validators/spatial.ts` — `SpatialCoverageValidator`
3. إنشاء `lib/svqe/engine.ts` — `SignalValidationEngine` (يُشغّل المحركَين فقط)
4. تطبيقه في `lib/pic/analyzer.ts` قبل `buildScans()`
5. **لا تُضاف باقي validators بعد** — تُضاف تدريجياً

**المعيار**: المشاهد ذات cloud_fraction > 0.30 لا تُحلَّل

---

### المرحلة 3 — Feature Layer الأساسي (أسبوع 4)
**الإجراءات**:
1. إنشاء `lib/features/disturbance.ts` — `ConstructionDisturbanceFeature`
2. إنشاء `lib/features/vegetation.ts` — `VegetationRecoveryFeature`
3. تحديث `buildScans()` في analyzer لاستخدامهم بدلاً من `computeActivityScore()`

**المعيار**: activity_state مشتق من ميزات فيزيائية، لا من byte comparison

---

### المرحلة 4 — Progress Models (أسبوع 5)
**الإجراءات**:
1. إنشاء `lib/reasoning/progress/road.ts`
2. إنشاء `lib/reasoning/progress/building.ts`
3. تحديث `estimateProgress()` في analyzer لاستدعاء النموذج المناسب

**المعيار**: `progress_pct` مُستنتج من الأدلة، لا من `activeDays/totalDays`

---

### المرحلة 5 — Prediction Ledger (أسبوع 6)
**الإجراءات**:
1. إنشاء migration: `minerva_learning` schema + `prediction_ledger` + `ground_truth` tables
2. إضافة `record()` call بعد كل تحليل
3. API: `POST /pic/projects/[id]/ground-truth`
4. إضافة زر "تقديم تصحيح" في PICShell

**المعيار**: كل تحليل يُسجَّل في ledger. أول تصحيح ميداني قابل للإدخال.

---

### المرحلة 6+ — الباقي (مستقبلي)
- EvidenceSufficiencyGate (بعد تراكم 10+ أخطاء حقيقية)
- TraceBuilder + NarrativeGenerator
- CalibrationProposer + ApprovalWorkflow
- AutoRevertDetector

---

## 6. الأولويات المُقرَّرة قبل أي تطوير جديد

**لا يجب إضافة أي ميزة جديدة قبل إنجاز المرحلتين 0 و 1:**

| الرقم | المهمة | الملف | الأهمية |
|-------|--------|-------|---------|
| 0.1 | توحيد types (picDB ↔ pic/types) | `lib/pic/types.ts` | 🔴 حرجة |
| 0.2 | ربط API بـ `lib/pic/analyzer.ts` | `[id]/route.ts` | 🔴 حرجة |
| 0.3 | حذف `lib/picAnalysis.ts` | — | 🔴 حرجة |
| 1.1 | `npm install sharp` | `package.json` | 🔴 حرجة |
| 1.2 | `PlanetAdapter` + `PixelDecoder` | `lib/sal/adapters/planet.ts` | 🔴 حرجة |
| 1.3 | استبدال `computeActivityScore` | `lib/pic/analyzer.ts` | 🔴 حرجة |

---

## 7. التوصية النهائية

**الوضع الحالي قابل للاستخدام** — النظام يعمل، البيانات حقيقية، الواجهة جيدة.  
**لكن كل الأرقام المُنتَجة لا تزال من الخوارزمية الخاطئة** (`compareImages` + bytes).

**قبل أي تطوير جديد**:
1. أنجز المرحلة 0 (توحيد الملفات) — يوم واحد
2. أنجز المرحلة 1 (sharp + PlanetAdapter) — أسبوع
3. عندها فقط تصبح الأرقام ذات معنى فيزيائي حقيقي

بعد المرحلتين 0 و 1، يمكن البناء على أساس علمي صحيح.

---

*هذه الوثيقة نتاج تدقيق شامل للكود في تاريخ 2026-07-09.*  
*جميع الأحكام مبنية على قراءة مباشرة للملفات وقاعدة البيانات.*
