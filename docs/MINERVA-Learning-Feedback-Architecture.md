# MINERVA — Learning & Feedback Architecture
## How the System Improves from Experience

**التاريخ**: 2026-07-09  
**الإصدار**: 4.0 — Experience-Driven Intelligence  
**يُكمل**: MINERVA-Signal-Validation-Engine.md  
**الحالة**: وثيقة تصميم معتمدة

---

## الحكم الافتتاحي

> **النظام الذي لا يتعلم من أخطائه يُعيدها.**

المعمارية الحالية قادرة على:
- فصل المزودين عن الاستدلال ✓
- التحقق من جودة الإشارات ✓
- توليد الأدلة وشرحها ✓

لكنها ثابتة. لن تكون أدق في مشروعها المئة من مشروعها الأول.

**طبقة التعلم والتغذية الراجعة تُحوّل MINERVA من نظام ثابت إلى نظام يتحسن.**

---

## 1. المبدأ التأسيسي — ما هو التعلم هنا؟

### 1.1 ليس Machine Learning

لن نبني شبكات عصبية أو نُدرّب نماذج.  
التعلم هنا يعني:

```
مهندس خبير يُصحّح تقدير النظام
          ↓
النظام يُسجّل الخطأ ويُحلله
          ↓
يُعدّل معاملاته وعتباته وأوزانه
          ↓
القرارات المستقبلية أدق
```

هذا **تعلم تجريبي معتمد** — يشبه ما يفعله مهندس خبير عندما يُراجع أحكامه بعد كل مشروع.

### 1.2 ما الذي يتعلمه النظام؟

```typescript
type LearningTarget =
  // ما يمكن للنظام تحسينه بناءً على التغذية الراجعة:

  | 'SIGNAL_CONFIDENCE_BIAS'
  // إذا أعطى النظام Planet VEGETATION_ACTIVITY ثقة 0.45
  // وأثبت الواقع أنها كانت 0.7 في طرابلس صيفاً
  // → اضبط typical_confidence للـ Planet في موسم الصيف

  | 'PROGRESS_MODEL_BIAS'
  // إذا قدّر نموذج المباني الإنجاز بـ 40% دائماً بينما الواقع 65%
  // → معامل تصحيح للمباني في ليبيا

  | 'PHASE_TRANSITION_TIMING'
  // إذا توقع النظام أن المرحلة الهيكلية تستمر 8 أشهر
  // لكن في مشاريع طرابلس الفعلية 12 شهراً
  // → اضبط معامل الوقت المتوقع للمرحلة

  | 'TEMPORAL_THRESHOLD_CALIBRATION'
  // إذا كانت عتبة الكشف عن التوقف 14 يوماً
  // لكن التحقيق الميداني يؤكد أن التوقف الفعلي بدأ بعد 10 أيام
  // → اضبط العتبة

  | 'SVQE_FALSE_POSITIVE_RATE'
  // إذا رفض SVQE 30% من إشارات Planet في طرابلس
  // لكن مهندس مراجعة أكد أن 15% منها كانت صحيحة
  // → اضبط عتبة الرفض لهذا النوع من الإشارات في هذه المنطقة

  | 'ALERT_THRESHOLD_CALIBRATION'
  // إذا أنتج النظام 10 تنبيهات كاذبة لكل تنبيه صحيح
  // → ارفع عتبة التنبيه للتوقف

  | 'SEASONAL_PROFILE_CORRECTION'
  // إذا كان النظام يتوقع VEGETATION_ACTIVITY = 0.06 في يوليو
  // لكن مشاريع الساحل الليبي تُظهر 0.12 باستمرار
  // → اضبط الملف الموسمي لهذه المنطقة
```

---

## 2. المعمارية الكاملة لطبقة التعلم

```
╔════════════════════════════════════════════════════════════════════╗
║                    EXISTING ARCHITECTURE                           ║
║  Adapters → SAL → SVQE → Features → Evidence → Reasoning          ║
╚════════════════════════════╤═══════════════════════════════════════╝
                             │ ConstructionIntelligence (prediction)
                             ▼
╔════════════════════════════════════════════════════════════════════╗
║                    PREDICTION LEDGER                               ║
║  ← كل تقدير يُسجَّل فور صدوره مع سياقه الكامل                    ║
║  ← غير قابل للتعديل (append-only)                                ║
╚════════════════════════════╤═══════════════════════════════════════╝
                             │
              ┌──────────────┤ Human / Field Input
              │              │
              ▼              ▼
╔═════════════════════════════════════════════════════════════════════╗
║                   GROUND TRUTH COLLECTOR                            ║
║  FieldObservation | EngineerCorrection | SurveyResult | ERPRecord  ║
╚═════════════════════════════════════════════════════════════════════╝
                             │
                             ▼
╔═════════════════════════════════════════════════════════════════════╗
║                   ERROR ANALYZER                                    ║
║  ErrorRecord: prediction vs reality, root cause, contributing factors║
╚═════════════════════════════════════════════════════════════════════╝
                             │
                             ▼
╔═════════════════════════════════════════════════════════════════════╗
║                   CALIBRATION ENGINE                                ║
║  PatternDetector → CalibrationProposal → ApprovalWorkflow          ║
║  → CalibrationRule (versioned) → ActiveRuleSet                     ║
╚═════════════════════════════════════════════════════════════════════╝
                             │ CalibrationRule (versioned)
                             ▼
╔═════════════════════════════════════════════════════════════════════╗
║                   RULE REGISTRY                                     ║
║  Current rules + history + audit trail                              ║
║  Every prediction references its rule version                       ║
╚═════════════════════════════════════════════════════════════════════╝
                             │ Applies rules at runtime
                             ▼
              ┌──────────────────────────────┐
              │   EXISTING ARCHITECTURE      │
              │   (rules applied via hooks)  │
              └──────────────────────────────┘
```

---

## 3. هيكل قاعدة البيانات الكامل

### 3.1 سجل التوقعات (Prediction Ledger) — غير قابل للتعديل

```sql
-- ═══════════════════════════════════════════════════════════
-- كل توقع يصدر عن النظام يُسجَّل هنا فور صدوره
-- APPEND ONLY — لا UPDATE، لا DELETE أبداً
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_learning.prediction_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  project_id        UUID REFERENCES pic.projects(id),

  -- تعريف التوقع
  prediction_type   TEXT NOT NULL,
  -- 'PROGRESS_PCT' | 'CONSTRUCTION_PHASE' | 'ACTIVITY_LEVEL'
  -- 'HEALTH_SCORE' | 'INTERRUPTION_TYPE' | 'TREND' | 'SIGNAL_VALIDITY'

  prediction_date   DATE NOT NULL,     -- التاريخ الذي يصف الواقع
  predicted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- متى صدر التوقع

  -- القيمة المتوقعة
  predicted_value        NUMERIC,      -- للتوقعات الرقمية
  predicted_category     TEXT,         -- للتوقعات التصنيفية
  predicted_confidence   NUMERIC(4,3), -- الثقة في وقت التوقع

  -- السياق الكامل الذي أنتج هذا التوقع (للتحقيق لاحقاً)
  model_version          TEXT NOT NULL,  -- إصدار نموذج الاستدلال
  rule_set_version       TEXT NOT NULL,  -- إصدار مجموعة القواعد المستخدمة
  signals_used           JSONB,          -- الإشارات التي استُخدمت
  features_used          JSONB,          -- الميزات التي استُخدمت
  evidence_chain         JSONB,          -- سلسلة الأدلة
  explanation_ar         TEXT,           -- الشرح العربي وقت التوقع

  -- هل هذا التوقع يحتاج تحققاً ميدانياً؟
  review_requested       BOOLEAN DEFAULT false,
  review_priority        TEXT,           -- 'high' | 'normal' | 'low'

  -- حالة التوقع
  status  TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'confirmed' | 'partially_correct' | 'incorrect' | 'unverifiable'

  -- إشارة إلى التصحيح إن وجد
  ground_truth_id        UUID,  -- → minerva_learning.ground_truth

  -- لا يمكن تعديل أي شيء فوق هذا السطر بعد الإنشاء
  CONSTRAINT no_modification CHECK (predicted_at = predicted_at)
);

-- ضمان عدم التعديل (PostgreSQL Row Security)
ALTER TABLE minerva_learning.prediction_ledger ENABLE ROW LEVEL SECURITY;
-- Insert only — no update/delete for regular users
CREATE POLICY ledger_insert_only ON minerva_learning.prediction_ledger
  FOR INSERT WITH CHECK (true);
CREATE POLICY ledger_read_only ON minerva_learning.prediction_ledger
  FOR SELECT USING (true);
-- Updates/Deletes require superuser (for emergency corrections only)

CREATE INDEX ON minerva_learning.prediction_ledger (project_id, prediction_type, prediction_date);
CREATE INDEX ON minerva_learning.prediction_ledger (status);
CREATE INDEX ON minerva_learning.prediction_ledger (rule_set_version);
```

---

### 3.2 الحقيقة الميدانية (Ground Truth)

```sql
-- ═══════════════════════════════════════════════════════════
-- الواقع المؤكد — من مهندسين أو مسوحات ميدانية أو ERP
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_learning.ground_truth (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  project_id       UUID REFERENCES pic.projects(id),
  prediction_id    UUID REFERENCES minerva_learning.prediction_ledger(id),

  -- الواقع الفعلي
  actual_value        NUMERIC,     -- القيمة الحقيقية (للتوقعات الرقمية)
  actual_category     TEXT,        -- التصنيف الحقيقي (للتوقعات التصنيفية)
  observation_date    DATE NOT NULL,

  -- مصدر التحقق
  source_type         TEXT NOT NULL,
  -- 'field_visit'           ← مهندس زار الموقع
  -- 'engineering_review'    ← مراجعة هندسية داخلية
  -- 'erp_milestone'         ← ربط بمعلومات ERP
  -- 'payment_certificate'   ← شهادة مستخلص دفع
  -- 'progress_report'       ← تقرير تقدم رسمي
  -- 'photo_evidence'        ← صور ميدانية موثقة
  -- 'contractor_statement'  ← تصريح المقاول (موثوقية أقل)
  -- 'aerial_survey'         ← مسح جوي بطائرة مسيّرة

  source_reliability  NUMERIC(3,2),  -- 0-1: موثوقية المصدر ذاتياً
  reviewer_id         TEXT NOT NULL,  -- هوية المراجع
  reviewer_role       TEXT,           -- 'senior_engineer' | 'site_inspector' | ...

  -- التصحيح والسبب
  correction_reason   TEXT NOT NULL,
  -- 'underestimated_activity' | 'signal_quality_issue' | 'model_bias' |
  -- 'seasonal_effect' | 'local_factor' | 'data_gap' | 'phase_misidentified' | 'other'

  correction_details_ar  TEXT,        -- شرح تفصيلي بالعربي
  correction_confidence  NUMERIC(3,2), -- كم نحن واثقون من هذا التصحيح؟

  -- هل هذا تصحيح جزئي أم كامل؟
  correction_scope    TEXT NOT NULL,
  -- 'full'      ← التوقع خاطئ كلياً
  -- 'partial'   ← التوقع صحيح جزئياً
  -- 'timing'    ← القيمة صحيحة لكن التوقيت خاطئ
  -- 'confirmed' ← التوقع صحيح (تأكيد لا تصحيح)

  -- مرفقات
  photo_urls          TEXT[],
  document_refs       TEXT[],

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  -- لا حذف — فقط إضافة تصحيح للتصحيح
  CONSTRAINT source_type_check CHECK (source_type IN (
    'field_visit','engineering_review','erp_milestone','payment_certificate',
    'progress_report','photo_evidence','contractor_statement','aerial_survey'
  ))
);

CREATE INDEX ON minerva_learning.ground_truth (project_id, observation_date);
CREATE INDEX ON minerva_learning.ground_truth (correction_reason);
CREATE INDEX ON minerva_learning.ground_truth (source_type, source_reliability);
```

---

### 3.3 سجل الأخطاء (Error Analysis)

```sql
-- ═══════════════════════════════════════════════════════════
-- تحليل كل خطأ — ماذا أخطأ ولماذا
-- يُملأ تلقائياً بعد كل ground_truth
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_learning.error_record (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   UUID REFERENCES minerva_learning.prediction_ledger(id) NOT NULL,
  ground_truth_id UUID REFERENCES minerva_learning.ground_truth(id) NOT NULL,
  project_id      UUID REFERENCES pic.projects(id),
  tenant_id       UUID NOT NULL,

  -- قياس الخطأ
  error_magnitude    NUMERIC,     -- |predicted - actual| أو Hamming للتصنيف
  error_direction    TEXT,        -- 'overestimate' | 'underestimate' | 'misclassified'
  error_pct          NUMERIC,     -- للأرقام: (predicted - actual) / actual * 100
  is_significant     BOOLEAN,     -- هل الخطأ كبير بما يكفي للتعلم منه؟

  -- تشخيص المحرك
  -- أي جزء من النظام أسهم في هذا الخطأ؟
  contributing_layers  JSONB,
  -- {
  --   "signal_quality": { "contributed": true, "signal_type": "VEGETATION_ACTIVITY",
  --                       "issue": "confidence_too_high" },
  --   "feature_extraction": { "contributed": false },
  --   "progress_model": { "contributed": true, "issue": "bias_high_for_buildings" },
  --   "svqe": { "contributed": true, "issue": "false_acceptance_rate" },
  --   "temporal_engine": { "contributed": false }
  -- }

  -- التشخيص النهائي
  root_cause      TEXT NOT NULL,
  -- 'signal_confidence_overestimate'
  -- 'progress_model_systematic_bias'
  -- 'phase_transition_timing_error'
  -- 'seasonal_baseline_incorrect'
  -- 'svqe_threshold_too_permissive'
  -- 'svqe_threshold_too_strict'
  -- 'insufficient_archive_coverage'
  -- 'project_type_model_mismatch'
  -- 'local_context_not_captured'
  -- 'unknown'

  root_cause_confidence  NUMERIC(3,2),  -- ثقة في تشخيص السبب الجذري
  root_cause_ar          TEXT,          -- شرح عربي للسبب

  -- هل هذا الخطأ مرتبط بأخطاء مشابهة سابقة؟
  similar_errors_ids     UUID[],        -- من minerva_learning.error_record
  pattern_id             UUID,          -- → minerva_learning.error_pattern

  -- حالة المعالجة
  status          TEXT NOT NULL DEFAULT 'new',
  -- 'new' | 'analyzed' | 'learning_proposed' | 'calibration_applied' | 'closed'

  analyzed_at     TIMESTAMPTZ,
  analyzed_by     TEXT,  -- 'auto' | 'engineer:xxx'

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON minerva_learning.error_record (root_cause);
CREATE INDEX ON minerva_learning.error_record (project_id, root_cause);
CREATE INDEX ON minerva_learning.error_record (status);
CREATE INDEX ON minerva_learning.error_record (pattern_id);
```

---

### 3.4 أنماط الأخطاء (Error Patterns)

```sql
-- ═══════════════════════════════════════════════════════════
-- عندما يتكرر الخطأ بنفس الطريقة → نمط
-- النمط هو الأساس لأي قاعدة معايرة جديدة
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_learning.error_pattern (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,  -- null = global pattern

  -- وصف النمط
  pattern_name    TEXT NOT NULL,
  pattern_desc_ar TEXT NOT NULL,

  -- شروط تصنيف خطأ ضمن هذا النمط
  conditions      JSONB NOT NULL,
  -- {
  --   "prediction_type": "PROGRESS_PCT",
  --   "project_type": "building",
  --   "error_direction": "underestimate",
  --   "error_magnitude_min": 15,
  --   "region": "tripoli"
  -- }

  -- إحصاءات
  occurrence_count     INTEGER DEFAULT 0,
  first_seen_at        TIMESTAMPTZ,
  last_seen_at         TIMESTAMPTZ,
  mean_error_magnitude NUMERIC,
  error_ids            UUID[],  -- آخر 50 خطأ ضمن هذا النمط

  -- هل تمت معالجته؟
  calibration_id  UUID,  -- → minerva_learning.calibration_rule
  status          TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'addressed' | 'monitoring' | 'closed'

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3.5 قواعد المعايرة (Calibration Rules) — الإصدارات

```sql
-- ═══════════════════════════════════════════════════════════
-- كل قاعدة معايرة مُصدَّرة ومُؤرَّخة وقابلة للإلغاء
-- NEVER delete a rule — only deactivate
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_learning.calibration_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,  -- null = global

  -- التعريف
  rule_type       TEXT NOT NULL,
  -- 'SIGNAL_CONFIDENCE_ADJUSTMENT'
  -- 'PROGRESS_MODEL_BIAS_CORRECTION'
  -- 'PHASE_TIMING_ADJUSTMENT'
  -- 'SVQE_THRESHOLD_ADJUSTMENT'
  -- 'ALERT_THRESHOLD_ADJUSTMENT'
  -- 'SEASONAL_PROFILE_OVERRIDE'
  -- 'TEMPORAL_WINDOW_ADJUSTMENT'

  -- نطاق التطبيق
  applies_to      JSONB NOT NULL,
  -- {
  --   "signal_type": "VEGETATION_ACTIVITY",      ← إن كانت تتعلق بإشارة
  --   "provider": "planet_scope",                ← إن كانت تتعلق بمزود
  --   "project_type": "building",                ← إن كانت تتعلق بنوع مشروع
  --   "region": "tripoli",                       ← إن كانت جغرافية
  --   "month_range": [6, 7, 8],                  ← إن كانت موسمية
  --   "phase": "structural_works"                ← إن كانت مرحلية
  -- }

  -- القيمة (ما الذي يتغير؟)
  adjustment      JSONB NOT NULL,
  -- للثقة:   { "type": "multiply", "factor": 0.85 }
  -- للعتبة:  { "type": "set", "value": 0.18 }
  -- للتحيز:  { "type": "add_offset", "value": -0.12 }
  -- للملف:   { "type": "override", "new_profile": [...] }

  -- المصدر
  derived_from_pattern_id  UUID REFERENCES minerva_learning.error_pattern(id),
  derived_from_errors      UUID[],  -- الأخطاء التي أدت لهذه القاعدة
  evidence_count           INTEGER, -- عدد الأخطاء التي تدعم هذه القاعدة
  evidence_confidence      NUMERIC(3,2), -- الثقة في أن هذه القاعدة صحيحة

  -- الإصدار
  version         TEXT NOT NULL,  -- 'v1.0', 'v1.1', ...
  previous_version_id UUID REFERENCES minerva_learning.calibration_rule(id),

  -- الحالة
  status          TEXT NOT NULL DEFAULT 'proposed',
  -- 'proposed'  ← قاعدة مُقترَحة تنتظر الموافقة
  -- 'approved'  ← موافَق عليها من مهندس أول
  -- 'active'    ← مُطبَّقة حالياً
  -- 'superseded'← حُلَّت محلها نسخة أحدث
  -- 'reverted'  ← أُلغيت بعد أن ثبت أنها تُسيء

  -- الموافقة
  proposed_by     TEXT NOT NULL,  -- 'auto' | 'engineer:xxx'
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  activated_at    TIMESTAMPTZ,
  deactivated_at  TIMESTAMPTZ,
  deactivation_reason TEXT,

  -- التأثير المتوقع قبل التطبيق
  expected_improvement_ar  TEXT,
  -- "يُتوقع تحسين دقة تقدير إنجاز المباني بـ ~8%"

  -- التأثير الفعلي بعد التطبيق (يُملأ لاحقاً)
  measured_improvement     NUMERIC,
  measured_at              TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- مجموعة القواعد النشطة (للاستخدام في وقت التشغيل)
CREATE VIEW minerva_learning.active_rule_set AS
SELECT *
FROM minerva_learning.calibration_rule
WHERE status = 'active'
ORDER BY activated_at DESC;

-- إصدار مجموعة القواعد الحالية (يُستخدم في prediction_ledger)
CREATE VIEW minerva_learning.current_rule_set_version AS
SELECT
  md5(string_agg(id::text || version, ',' ORDER BY id)) AS version_hash,
  COUNT(*) AS rule_count,
  MAX(activated_at) AS last_updated
FROM minerva_learning.calibration_rule
WHERE status = 'active';
```

---

### 3.6 سجل أداء النظام (Performance Tracking)

```sql
-- ═══════════════════════════════════════════════════════════
-- تتبع دقة النظام عبر الزمن — الدليل على التحسن
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_learning.performance_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  snapshot_date   DATE NOT NULL,
  rule_set_version TEXT NOT NULL,

  -- مقاييس الدقة (تُحسب على الـ ground_truth المتراكمة)
  total_predictions    INTEGER,
  verified_predictions INTEGER,  -- التي وجد لها ground_truth

  -- للتوقعات الرقمية (progress_pct, health_score)
  mae_progress     NUMERIC,  -- Mean Absolute Error
  rmse_progress    NUMERIC,  -- Root Mean Square Error
  bias_progress    NUMERIC,  -- هل النظام متحيز نحو التضخيم أو التقليل؟

  -- للتصنيفات (phase, activity_level)
  accuracy_phase         NUMERIC,  -- نسبة تصنيف المرحلة الصحيح
  accuracy_activity      NUMERIC,

  -- SVQE
  svqe_false_positive_rate NUMERIC,  -- رُفضت إشارات كانت صحيحة
  svqe_false_negative_rate NUMERIC,  -- قُبلت إشارات كانت خاطئة

  -- التنبيهات
  alert_precision  NUMERIC,  -- من التنبيهات: كم منها كانت صحيحة؟
  alert_recall     NUMERIC,  -- من الأحداث الفعلية: كم نبّه عنها؟

  -- مقارنة بالـ snapshot السابق
  improvement_vs_previous  JSONB,
  -- { "mae_progress": -2.3, "accuracy_phase": +0.05, ... }

  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. محركات التعلم

### 4.1 ErrorAnalyzer — يُشخّص كل خطأ

```typescript
export class ErrorAnalyzer {

  /**
   * يُشغَّل تلقائياً بعد كل Ground Truth جديد
   */
  async analyze(
    prediction:  PredictionRecord,
    groundTruth: GroundTruthRecord,
  ): Promise<ErrorRecord> {

    const error = this.computeError(prediction, groundTruth);

    if (!error.is_significant) {
      // خطأ صغير → يُسجَّل لكن لا يُحلَّل
      return this.createMinorError(prediction, groundTruth, error);
    }

    // تحليل عميق: أي طبقة أسهمت في هذا الخطأ؟
    const diagnosis = await this.diagnoseContributingLayers(prediction, groundTruth, error);

    // هل يشبه أخطاء سابقة؟
    const similarErrors = await this.findSimilarErrors(error, diagnosis);
    const pattern       = await this.matchOrCreatePattern(error, diagnosis, similarErrors);

    return {
      prediction_id:       prediction.id,
      ground_truth_id:     groundTruth.id,
      error_magnitude:     error.magnitude,
      error_direction:     error.direction,
      error_pct:           error.pct,
      is_significant:      true,
      contributing_layers: diagnosis.layers,
      root_cause:          diagnosis.root_cause,
      root_cause_confidence: diagnosis.confidence,
      root_cause_ar:       diagnosis.explanation_ar,
      similar_errors_ids:  similarErrors.map(e => e.id),
      pattern_id:          pattern?.id,
      status:              'analyzed',
    };
  }

  private async diagnoseContributingLayers(
    prediction: PredictionRecord,
    gt:         GroundTruthRecord,
    error:      ErrorMetrics,
  ): Promise<Diagnosis> {

    const diagnosis: Diagnosis = { layers: {}, root_cause: 'unknown', confidence: 0, explanation_ar: '' };

    // 1. تحليل طبقة SVQE: هل رُفضت إشارات مفيدة؟
    const svqeAnalysis = await this.analyzeSVQEContribution(prediction);
    if (svqeAnalysis.contributed) {
      diagnosis.layers['svqe'] = svqeAnalysis;
    }

    // 2. تحليل طبقة الإشارات: هل كانت الثقة المُعطاة صحيحة؟
    const signalAnalysis = await this.analyzeSignalConfidence(prediction, gt);
    if (signalAnalysis.contributed) {
      diagnosis.layers['signal_quality'] = signalAnalysis;
    }

    // 3. تحليل نموذج التقدم: هل هناك تحيز منهجي؟
    const progressAnalysis = await this.analyzeProgressModelBias(prediction, gt);
    if (progressAnalysis.contributed) {
      diagnosis.layers['progress_model'] = progressAnalysis;
    }

    // 4. تحليل الزمن: هل التوقيت خاطئ؟
    const temporalAnalysis = await this.analyzeTemporalBias(prediction, gt);
    if (temporalAnalysis.contributed) {
      diagnosis.layers['temporal_engine'] = temporalAnalysis;
    }

    // 5. تحليل السياق البيئي: هل العوامل الموسمية غير محسوبة؟
    const envAnalysis = await this.analyzeEnvironmentalFactors(prediction, gt);
    if (envAnalysis.contributed) {
      diagnosis.layers['environmental_context'] = envAnalysis;
    }

    // تحديد السبب الجذري الأكثر احتمالاً
    diagnosis.root_cause     = this.identifyRootCause(diagnosis.layers);
    diagnosis.confidence      = this.computeDiagnosisConfidence(diagnosis);
    diagnosis.explanation_ar = this.buildExplanationAr(diagnosis);

    return diagnosis;
  }
}
```

---

### 4.2 PatternDetector — يكتشف التحيزات المنهجية

```typescript
export class PatternDetector {

  /**
   * يُشغَّل دورياً (يومياً) للبحث عن أنماط في الأخطاء الجديدة
   */
  async detectPatterns(
    recentErrors: ErrorRecord[],
    existingPatterns: ErrorPattern[],
  ): Promise<PatternDetectionResult> {

    const newPatterns:     ErrorPattern[]    = [];
    const updatedPatterns: ErrorPattern[]    = [];
    const maturedPatterns: ErrorPattern[]    = [];  // وصلت لحجم كافٍ للمعايرة

    // 1. تجميع الأخطاء بالسياق
    const clusters = this.clusterErrors(recentErrors);

    for (const cluster of clusters) {
      const matching = existingPatterns.find(p => this.matchesPattern(cluster, p));

      if (matching) {
        // تحديث نمط موجود
        matching.occurrence_count  += cluster.errors.length;
        matching.last_seen_at       = new Date().toISOString();
        matching.mean_error_magnitude = this.updateMean(matching, cluster);
        updatedPatterns.push(matching);

        // هل وصل لحجم كافٍ للمعايرة؟ (حد ≥ 5 أخطاء)
        if (matching.occurrence_count >= 5 && matching.status === 'active') {
          maturedPatterns.push(matching);
        }
      } else if (cluster.errors.length >= 2) {
        // نمط جديد — يحتاج أكثر من خطأ واحد
        newPatterns.push(this.createPattern(cluster));
      }
    }

    return { newPatterns, updatedPatterns, maturedPatterns };
  }

  private clusterErrors(errors: ErrorRecord[]): ErrorCluster[] {
    // تجميع بناءً على: نوع التوقع + نوع المشروع + نوع الخطأ + اتجاهه
    const groups = new Map<string, ErrorRecord[]>();

    for (const error of errors) {
      const key = `${error.prediction_type}|${error.project_type}|${error.root_cause}|${error.error_direction}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(error);
    }

    return Array.from(groups.entries())
      .map(([key, errs]) => ({ key, errors: errs }))
      .filter(c => c.errors.length >= 2);
  }
}
```

---

### 4.3 CalibrationProposer — يُقترح القاعدة المعايِرة

```typescript
export class CalibrationProposer {

  async proposeFromPattern(pattern: ErrorPattern): Promise<CalibrationProposal> {

    const proposal: CalibrationProposal = {
      pattern_id:   pattern.id,
      proposed_by:  'auto',
      requires_approval: true,
    };

    switch (pattern.conditions.prediction_type) {

      case 'PROGRESS_PCT': {
        // تحيز منهجي في التقدير — نُضيف offset تصحيحي
        const meanError = pattern.mean_error_magnitude;
        const isOverest = pattern.conditions.error_direction === 'overestimate';

        proposal.rule_type   = 'PROGRESS_MODEL_BIAS_CORRECTION';
        proposal.applies_to  = {
          project_type: pattern.conditions.project_type,
          region:       pattern.conditions.region,
        };
        proposal.adjustment  = {
          type:   'add_offset',
          value:  isOverest ? -meanError * 0.7 : +meanError * 0.7,
          // 70% من متوسط الخطأ — تصحيح تدريجي لا كامل
          rationale: 'Gradual correction to avoid overcorrection',
        };
        proposal.expected_improvement_ar = `يُتوقع تخفيض متوسط الخطأ المطلق للإنجاز من ${meanError.toFixed(1)}% إلى ~${(meanError*0.3).toFixed(1)}%`;
        proposal.evidence_count   = pattern.occurrence_count;
        proposal.evidence_confidence = Math.min(0.9, 0.5 + pattern.occurrence_count * 0.08);
        break;
      }

      case 'SIGNAL_VALIDITY': {
        // SVQE يرفض إشارات صحيحة (false positive rejection)
        if (pattern.conditions.root_cause === 'svqe_threshold_too_strict') {
          proposal.rule_type  = 'SVQE_THRESHOLD_ADJUSTMENT';
          proposal.applies_to = {
            signal_type: pattern.conditions.signal_type,
            validator:   pattern.conditions.validator_name,
          };
          proposal.adjustment = {
            type:      'multiply_threshold',
            factor:    1.15,  // ارفع العتبة 15% — أقل صرامة
            rationale: 'Threshold was causing false rejections of valid signals',
          };
        }
        break;
      }

      case 'CONSTRUCTION_PHASE': {
        // خطأ متكرر في تحديد المرحلة
        proposal.rule_type  = 'PHASE_TRANSITION_TIMING_ADJUSTMENT';
        proposal.applies_to = {
          project_type:    pattern.conditions.project_type,
          from_phase:      pattern.conditions.predicted_phase,
          region:          pattern.conditions.region,
        };
        proposal.adjustment = {
          type:    'extend_phase_duration',
          factor:  1.25,  // المرحلة تستمر 25% أطول من المتوقع في هذا السياق
        };
        break;
      }
    }

    return proposal;
  }
}
```

---

### 4.4 ApprovalWorkflow — الموافقة البشرية قبل التطبيق

```typescript
/**
 * لا قاعدة معايرة تُطبَّق تلقائياً بدون موافقة إنسانية
 *
 * المنطق:
 * - الاقتراح التلقائي (auto) → يحتاج موافقة مهندس
 * - اقتراح مهندس → يحتاج موافقة مهندس أول
 * - تغيير حاسم (threshold رئيسي) → يحتاج موافقة مدير
 */

export class CalibrationApprovalWorkflow {

  async submitForApproval(
    proposal: CalibrationProposal,
    submitter: string,
  ): Promise<ApprovalRequest> {

    const requiredLevel = this.determineRequiredApprovalLevel(proposal);

    // إنشاء طلب موافقة في قاعدة البيانات
    const request = await db.calibration_rule.create({
      ...proposal,
      status:      'proposed',
      proposed_by: submitter,
      proposed_at: new Date().toISOString(),
    });

    // إرسال إشعار للمراجع المناسب
    await this.notifyReviewer(request, requiredLevel);

    return request;
  }

  /**
   * المهندس يُراجع الاقتراح ويُقرر
   */
  async reviewProposal(
    ruleId:    string,
    decision:  'approve' | 'reject' | 'modify',
    reviewer:  string,
    notes?:    string,
    modifiedAdjustment?: any,
  ): Promise<void> {

    if (decision === 'approve') {
      await db.calibration_rule.update(ruleId, {
        status:       'approved',
        approved_by:  reviewer,
        approved_at:  new Date().toISOString(),
      });
      // لا تُطبَّق فوراً — تنتظر دورة التطبيق اليومية
      await this.scheduleActivation(ruleId);

    } else if (decision === 'reject') {
      await db.calibration_rule.update(ruleId, {
        status: 'superseded',
        deactivation_reason: `Rejected by ${reviewer}: ${notes}`,
      });

    } else if (decision === 'modify') {
      // إنشاء نسخة معدَّلة
      await this.createModifiedVersion(ruleId, modifiedAdjustment, reviewer, notes);
    }
  }
}
```

---

### 4.5 RuleApplicator — يُطبّق القواعد وقت التشغيل

```typescript
/**
 * هذا هو نقطة الدمج مع المعمارية الحالية
 * يُطبَّق في بداية كل تحليل — لا تغيير في بنية الكود الأخرى
 */

export class RuleApplicator {

  private activeRules: CalibrationRule[] = [];
  private lastLoaded:  Date = new Date(0);

  /**
   * يُحمَّل من قاعدة البيانات مرة كل ساعة
   */
  async loadActiveRules(): Promise<void> {
    const now = new Date();
    if (now.getTime() - this.lastLoaded.getTime() < 3600_000) return;

    this.activeRules = await db.calibration_rule.findMany({ status: 'active' });
    this.lastLoaded  = now;
  }

  /**
   * تطبيق قواعد المعايرة على إشارة
   * يُستدعى في SAL بعد التطبيع
   */
  applyToSignal(signal: NormalizedSignal): NormalizedSignal {
    const relevantRules = this.activeRules.filter(r =>
      r.rule_type === 'SIGNAL_CONFIDENCE_ADJUSTMENT' &&
      this.ruleAppliesTo(r, { signal_type: signal.signal_type, provider: signal.provenance.provider })
    );

    if (relevantRules.length === 0) return signal;

    let adjustedConfidence = signal.confidence;
    const appliedRules: string[] = [];

    for (const rule of relevantRules) {
      adjustedConfidence = this.applyAdjustment(adjustedConfidence, rule.adjustment);
      appliedRules.push(rule.id);
    }

    return {
      ...signal,
      confidence: Math.max(0, Math.min(1, adjustedConfidence)),
      provenance: {
        ...signal.provenance,
        processing_steps: [...signal.provenance.processing_steps, {
          step_name:  'calibration_applied',
          algorithm:  'rule_applicator',
          parameters: { rule_ids: appliedRules },
          applied_at: new Date().toISOString(),
          operator:   'system',
        }],
      },
    };
  }

  /**
   * تطبيق قواعد المعايرة على تقدير التقدم
   * يُستدعى في Reasoning Layer بعد ProgressModel
   */
  applyToProgress(
    estimate:    ProgressEstimate,
    project:     PICProject,
  ): ProgressEstimate {

    const relevantRules = this.activeRules.filter(r =>
      r.rule_type === 'PROGRESS_MODEL_BIAS_CORRECTION' &&
      this.ruleAppliesTo(r, { project_type: project.type })
    );

    if (relevantRules.length === 0) return estimate;

    let adjusted = estimate.progress_pct;
    const appliedRules: string[] = [];

    for (const rule of relevantRules) {
      adjusted = this.applyAdjustment(adjusted, rule.adjustment);
      appliedRules.push(rule.id);
    }

    return {
      ...estimate,
      progress_pct:       Math.max(0, Math.min(100, adjusted)),
      calibration_note_ar: `تُطبَّق ${appliedRules.length} قاعدة معايرة من التجربة السابقة`,
      applied_rules:      appliedRules,
    };
  }

  private ruleAppliesTo(rule: CalibrationRule, context: Record<string, any>): boolean {
    return Object.entries(rule.applies_to).every(([key, val]) => {
      if (!context[key]) return true;  // الشرط غير محدد → يسري دائماً
      if (Array.isArray(val)) return val.includes(context[key]);
      return context[key] === val;
    });
  }

  private applyAdjustment(value: number, adj: CalibrationAdjustment): number {
    switch (adj.type) {
      case 'multiply':        return value * adj.factor!;
      case 'add_offset':      return value + adj.value!;
      case 'set':             return adj.value!;
      case 'multiply_threshold': return value * adj.factor!;
      case 'clamp':           return Math.max(adj.min!, Math.min(adj.max!, value));
      default:                return value;
    }
  }
}
```

---

## 5. نقاط الدمج مع المعمارية الحالية

```typescript
// ═══════════════════════════════════════════════════════════════
// التغييرات المطلوبة في الكود الحالي لدمج طبقة التعلم
// ═══════════════════════════════════════════════════════════════

// ── 1. في ProjectAnalyzer::analyze() ──────────────────────────
// بعد: const intelligence = await this.reasoning.synthesize(...)
// أضف:
await predictionLedger.record({
  tenant_id:       tenantId,
  project_id:      project.id,
  prediction_type: 'PROGRESS_PCT',
  prediction_date: new Date().toISOString().slice(0,10),
  predicted_value: intelligence.progress_pct,
  predicted_confidence: intelligence.confidence,
  model_version:   MODEL_VERSION,
  rule_set_version: await ruleRegistry.getCurrentVersion(),
  signals_used:    validatedSignals.map(s => ({ type: s.signal_type, conf: s.confidence })),
  evidence_chain:  intelligence.evidence_chain,
  explanation_ar:  intelligence.explanation_ar,
});

// ── 2. في SAL / PlanetAdapter::adapt() ──────────────────────
// قبل إرجاع الإشارات:
const calibrated = signals.map(s => ruleApplicator.applyToSignal(s));
return calibrated;

// ── 3. في ProgressModel::estimate() ─────────────────────────
// بعد حساب التقدير:
const calibrated = ruleApplicator.applyToProgress(estimate, project);
return calibrated;

// ── 4. API جديد لإدخال Ground Truth ─────────────────────────
// POST /api/v1/pic/projects/[id]/ground-truth
// يُتيح للمهندسين إدخال التصحيحات من الواجهة
```

---

## 6. API Endpoints للتغذية الراجعة

```typescript
/**
 * GET  /api/v1/pic/learning/dashboard
 *   → إحصاءات دقة النظام، عدد الأخطاء، التحسن عبر الزمن
 *
 * GET  /api/v1/pic/projects/[id]/predictions
 *   → قائمة توقعات المشروع + حالة كل منها
 *
 * POST /api/v1/pic/projects/[id]/ground-truth
 *   → إدخال تصحيح ميداني
 *   Body: { prediction_id, actual_value, source_type, correction_reason, correction_details_ar }
 *
 * GET  /api/v1/pic/learning/patterns
 *   → أنماط الأخطاء المكتشفة
 *
 * GET  /api/v1/pic/learning/calibrations
 *   → قواعد المعايرة (مُقترَحة / نشطة / موقوفة)
 *
 * POST /api/v1/pic/learning/calibrations/[id]/approve
 *   → موافقة مهندس على قاعدة معايرة
 *   Body: { decision: 'approve'|'reject'|'modify', notes, modified_adjustment? }
 *
 * POST /api/v1/pic/learning/calibrations/[id]/revert
 *   → إلغاء قاعدة معايرة (تصبح 'superseded')
 *   Body: { reason }
 *
 * GET  /api/v1/pic/learning/performance
 *   → مقارنة دقة النظام قبل وبعد المعايرة
 */
```

---

## 7. واجهة المستخدم — شاشة التغذية الراجعة

### 7.1 ما يحتاجه المهندس الميداني

```
┌─────────────────────────────────────────────────────────────────┐
│  مشروع: طريق الدائري الثالث                                     │
│  آخر تقييم نظامي: 85% إنجاز | صحة: 91 | نشط                   │
│                                                    [تقديم تصحيح] │
└─────────────────────────────────────────────────────────────────┘

  نموذج التصحيح:
  ┌─────────────────────────────────────────────────┐
  │ الإنجاز الفعلي:        [____70____] %           │
  │ المرحلة الفعلية:       [رصف █ | تشطيب □]       │
  │ مصدر المعلومة:         [زيارة ميدانية ▼]        │
  │ سبب الفارق:            [تأثير موسمي ▼]          │
  │ شرح تفصيلي (اختياري):  [________________]       │
  │ ثقتك في هذا التصحيح:  [◉ عالية ○ متوسطة ○ منخ]│
  │                                    [حفظ التصحيح] │
  └─────────────────────────────────────────────────┘
```

### 7.2 ما يحتاجه المهندس الأول (مراجعة قواعد المعايرة)

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 اقتراح معايرة جديد                           يحتاج موافقتك │
├─────────────────────────────────────────────────────────────────┤
│  النمط المُكتشَف:                                                │
│  "تقليل منهجي لإنجاز مشاريع المباني في طرابلس"                │
│                                                                  │
│  الأدلة: 7 أخطاء متشابهة، متوسط الفارق: -18%                  │
│  الثقة في التشخيص: 87%                                         │
│                                                                  │
│  القاعدة المُقترَحة:                                             │
│  أضف +12.6% لتقديرات إنجاز المباني في طرابلس                  │
│                                                                  │
│  التأثير المتوقع: تخفيض MAE من 18% إلى ~5%                    │
│                                                                  │
│  [عرض الأخطاء السبعة] [موافقة] [رفض] [تعديل]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. التكامل مع PICShell الحالي

تغييرات بسيطة تُضاف للـ `ProjectDetailPanel`:

```typescript
// في ProjectDetailPanel — إضافة قسم "التحقق الميداني"
{project.progress_pct > 0 && (
  <div className="px-4 py-3 border-b border-slate-800">
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-bold text-slate-400">⚡ تقييم النظام</p>
      <button onClick={() => setShowFeedbackForm(true)}
        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline">
        تقديم تصحيح
      </button>
    </div>

    <div className="bg-slate-800/40 rounded-lg px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-slate-400">الإنجاز المُقدَّر:</span>
        <span className="text-white font-bold">{project.progress_pct}%</span>
      </div>
      {project.calibration_note_ar && (
        <p className="text-[10px] text-indigo-400 mt-1">
          🎯 {project.calibration_note_ar}
        </p>
      )}
      {project.last_correction && (
        <p className="text-[10px] text-amber-400 mt-1">
          🔧 آخر تصحيح ميداني: {project.last_correction.actual_value}% ({project.last_correction.source_type})
        </p>
      )}
    </div>
  </div>
)}

{/* نموذج التصحيح */}
{showFeedbackForm && (
  <FeedbackForm project={project} onSubmit={handleFeedbackSubmit} onClose={() => setShowFeedbackForm(false)} />
)}
```

---

## 9. الضمانات المعمارية

### 9.1 عدم تعديل الماضي

```sql
-- لا يمكن تعديل أي توقع مُسجَّل في prediction_ledger
-- Trigger يمنع UPDATE/DELETE
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'prediction_ledger is append-only. Use ground_truth to record corrections.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_ledger_immutability
  BEFORE UPDATE OR DELETE ON minerva_learning.prediction_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();
```

### 9.2 قابلية إلغاء أي قاعدة

```typescript
// إلغاء قاعدة يعني:
// 1. تغيير status → 'superseded'
// 2. إنشاء سجل reversion في calibration_rule
// 3. تحميل مجموعة القواعد من جديد
// 4. إنشاء performance_snapshot لقياس الأثر

async revertCalibrationRule(ruleId: string, reason: string, by: string): Promise<void> {
  await db.calibration_rule.update(ruleId, {
    status:             'superseded',
    deactivated_at:     new Date().toISOString(),
    deactivation_reason: `Reverted by ${by}: ${reason}`,
  });
  await this.ruleApplicator.loadActiveRules();  // تحميل فوري
  await this.performanceTracker.takeSnapshot(); // قياس الأثر الفوري
}
```

### 9.3 كل تنبؤ يحمل إصدار القواعد التي أنتجته

```typescript
// في prediction_ledger:
rule_set_version: '7f3a9b2c'  // hash مجموعة القواعد النشطة

// بعد أشهر، يمكن إعادة إنتاج أي تقدير قديم بتحميل القواعد من نفس الإصدار
// هذا يجعل النظام قابلاً للمراجعة القانونية والهندسية
```

---

## 10. مسار التحسن التراكمي

```
المشروع الأول:
  └ تقدير: 65% | الواقع: 82% | خطأ: -17% | root_cause: progress_model_bias
  └ النظام يُسجَّل → لكن لا يتعلم بعد (عينة واحدة)

المشاريع 2-4 (نفس النوع، نفس الخطأ):
  └ pattern يتكون: "تقليل مباني طرابلس"
  └ النظام يُقترح قاعدة معايرة
  └ مهندس يوافق

المشاريع 5+:
  └ تُطبَّق القاعدة تلقائياً
  └ الخطأ ينخفض من 17% إلى ~5%

بعد سنة:
  └ النظام أجرى N مشروع
  └ performance_snapshot يُظهر:
     MAE_progress: 18% → 8% → 4%
     accuracy_phase: 61% → 72% → 84%
  └ كل تحسن موثق ومبرر وقابل للمراجعة
```

---

## 11. هيكل Schema الكامل

```sql
-- Schema للتعلم — مستقل عن pic schema الحالي
CREATE SCHEMA minerva_learning;

-- الجداول (بالترتيب المنطقي للإنشاء):
-- 1. minerva_learning.prediction_ledger
-- 2. minerva_learning.ground_truth
-- 3. minerva_learning.error_record
-- 4. minerva_learning.error_pattern
-- 5. minerva_learning.calibration_rule
-- 6. minerva_learning.performance_snapshot

-- Views:
-- minerva_learning.active_rule_set
-- minerva_learning.current_rule_set_version
-- minerva_learning.accuracy_trend (تحليل الأداء عبر الزمن)

-- Functions:
-- minerva_learning.compute_accuracy_metrics(tenant_id, date_range)
-- minerva_learning.detect_patterns_since(timestamp)
-- minerva_learning.revert_rule(rule_id, reason, by)
```

---

## 12. خارطة الطريق للتنفيذ

### المرحلة 0 — السجلات الأساسية (أسبوع 1)
1. إنشاء `minerva_learning` schema
2. إنشاء `prediction_ledger` مع trigger الحماية
3. إنشاء `ground_truth` table
4. تعديل `ProjectAnalyzer` لتسجيل كل تقدير في الـ ledger
5. API endpoint: `POST /pic/projects/[id]/ground-truth`

**معيار النجاح**: كل تحليل يُسجَّل. أول تصحيح ميداني يُدخَّل ويُقارَن.

### المرحلة 1 — التحليل والأنماط (أسبوع 2)
1. بناء `ErrorAnalyzer`
2. بناء `PatternDetector`
3. إنشاء `error_record` و `error_pattern` tables
4. Cron job يومي يُشغّل كلاهما على الأخطاء الجديدة

### المرحلة 2 — المعايرة (أسبوع 3)
1. بناء `CalibrationProposer`
2. بناء `ApprovalWorkflow` + API endpoints
3. بناء `RuleApplicator` وربطه بـ SAL وProgressModel
4. إضافة زر "تقديم تصحيح" في PICShell

### المرحلة 3 — قياس التأثير (أسبوع 4)
1. بناء `PerformanceTracker`
2. إنشاء `performance_snapshot` وتشغيله أسبوعياً
3. إضافة شاشة "دقة النظام" في لوحة KPIs

---

## 13. الخاصية الجوهرية

> **النظام لا ينسى. ولا يُعيد الخطأ في نفس السياق.**

كل تقدير مُسجَّل مع السياق الكامل الذي أنتجه.  
كل خطأ مُحلَّل ومُصنَّف.  
كل تحسين موثَّق وقابل للإلغاء.  
كل قرار مستقبلي يُعرف ما القواعد التي أنتجته.

هذا ليس machine learning.  
هذا **ذاكرة هندسية مؤسسية** تتراكم وتتحسن مع كل مشروع.

---

*هذه الوثيقة تُكمل رباعية التصميم:*  
*1. PIC-Architecture-Review — نقد الحاضر*  
*2. MINERVA-Signal-Abstraction — فصل المزودين*  
*3. MINERVA-Signal-Validation — الثقة في الإشارات*  
*4. هذه الوثيقة — التعلم من التجربة*
