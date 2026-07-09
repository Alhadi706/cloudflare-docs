# MINERVA — Signal Validation & Quality Engine
## The Trust Layer: No Unvalidated Signal May Pass

**التاريخ**: 2026-07-09  
**الإصدار**: 3.0 — Trust-First Architecture  
**يُكمل**: MINERVA-Signal-Abstraction-Architecture.md  
**الحالة**: وثيقة تصميم معتمدة

---

## الحكم الافتتاحي

> **إشارة خاطئة لا يُعترض عليها أخطر من غياب الإشارة.**

المعمارية الحالية تفصل المزودين عن الاستدلال. هذا صحيح.  
لكن ثمة افتراض ضمني خطير:

**كل إشارة تنجح في الوصول إلى Feature Layer يُفترض أنها صحيحة.**

هذا الافتراض غير مقبول علمياً.

إشارة `VEGETATION_ACTIVITY = 0.95` في موقع مشروع إنشائي وسط طرابلس في يوليو — هل هي حقيقية؟  
أم هي غيمة خفيفة جعلت بيكسلات خضراء؟  
أم خطأ في معالجة الـ adapter؟  
أم تغيير حقيقي في النباتات بعد مطر؟

النظام الحالي لا يعرف. يستخدمها كما هي.

---

## 1. تعريف المشكلة

### 1.1 أنواع الإشارات غير الموثوقة

```
النوع 1: إشارة خارج النطاق الفيزيائي
  مثال: SURFACE_TEMPERATURE = 450K (قيمة مستحيلة للأرض)
  السبب: خطأ في الـ adapter أو بيانات corrupt
  الخطر: يُشوّه كل حساب يعتمد عليها

النوع 2: إشارة متطرفة لكن ضمن النطاق
  مثال: VEGETATION_ACTIVITY قفز من 0.1 إلى 0.8 في يوم واحد
  السبب: قد يكون غيمة، إضاءة مختلفة، أو خطأ
  الخطر: قد يُفسَّر كتغيير حقيقي ويُولّد تنبيهات كاذبة

النوع 3: إشارة ذات جودة منخفضة مخفية
  مثال: SURFACE_REFLECTANCE بـ cloud_fraction = 0.35 لكن تجاوزت حد الرفض بـ 0.05
  السبب: حدود threshold غير كافية
  الخطر: تُضعف الاستدلال دون إعلام

النوع 4: إشارات متضاربة
  مثال: VEGETATION_ACTIVITY = 0.8 و BUILT_SURFACE_FRACTION = 0.9 في نفس الموقع ونفس الوقت
  السبب: إشارة واحدة على الأقل خاطئة
  الخطر: يجعل الاستنتاج مستحيلاً بدون حل النزاع

النوع 5: إشارة معزولة تاريخياً
  مثال: SURFACE_MOISTURE = 0.9 في يوم صحو لا يسبقه أو يلحقه مطر
  السبب: ربما خطأ في القياس
  الخطر: قد يُصنَّف كـ "weather_pause" خطأً

النوع 6: إشارة فاقدة للسياق المكاني
  مثال: coverage_fraction = 0.3 — أي 70% من الموقع غير مرئي
  السبب: سحاب جزئي أو حافة المشهد
  الخطر: تعميم عينة 30% على الموقع الكامل
```

---

### 1.2 حجم الضرر المتوقع في النظام الحالي

في اختبار طرابلس الفعلي، أنتج النظام `magnitude = 0.93` بشكل متكرر.  
هذا الرقم جاء من مقارنة ملفات PNG مضغوطة — وهو خاطئ تماماً.

بعد الإصلاح، سيُنتج PlanetAdapter إشارات. لكن هل ستكون موثوقة؟  
في 28,701 مشهد بُني أرشيفنا عليها:

```python
# تقدير نسب الإشارات المشكوك فيها في أرشيف طرابلس
cloud_fraction > 0.15 : ~18% من المشاهد  ← إشارات بصرية مشكوك فيها
acquisition_time = nighttime : ~3% ← لا ضوء مرئي حقيقي
duplicate dates (same area, same day) : ~12% ← أي الإشارتين صحيحة؟
edge_coverage < 0.5 (proj bbox at scene edge) : ~8% ← نصف الموقع مقطوع
```

**~41% من المشاهد تحتوي على مشكلة تؤثر على جودة الإشارة.**  
بدون validation engine، هذه الإشارات تصل إلى Feature Layer كاملة الأهلية.

---

## 2. المعمارية المحدَّثة

```
╔══════════════════════════════════════════════════════════════════╗
║                     PROVIDER ADAPTER TIER                       ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │ RawSignal[]
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║                  SIGNAL ABSTRACTION LAYER (SAL)                 ║
║  Normalizer → Registry → Harmonizer                             ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │ NormalizedSignal[]
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║           SIGNAL VALIDATION & QUALITY ENGINE (SVQE)            ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │                  VALIDATION PIPELINE                     │    ║
║  │                                                          │    ║
║  │  1. RangeValidator          (فيزيائياً ممكن؟)           │    ║
║  │       ↓                                                  │    ║
║  │  2. TemporalConsistency     (متسق مع السجل الزمني؟)     │    ║
║  │       ↓                                                  │    ║
║  │  3. CrossSignalConsistency  (يتفق مع الإشارات الأخرى؟)  │    ║
║  │       ↓                                                  │    ║
║  │  4. SpatialCoverage         (التغطية المكانية كافية؟)   │    ║
║  │       ↓                                                  │    ║
║  │  5. AnomalyDetector         (شاذ إحصائياً؟)             │    ║
║  │       ↓                                                  │    ║
║  │  6. EnvironmentalContext    (السياق البيئي يدعمه؟)       │    ║
║  │       ↓                                                  │    ║
║  │  7. ConfidenceAggregator    (الثقة النهائية)             │    ║
║  └──────────────────────────┬──────────────────────────────┘    ║
║                             │                                   ║
║  ┌──────────────────────────▼──────────────────────────────┐    ║
║  │              ValidationDecision                          │    ║
║  │  ACCEPTED | DOWNGRADED | FLAGGED | REJECTED             │    ║
║  └──────────────────────────┬──────────────────────────────┘    ║
║                             │                                   ║
║  ┌──────────────────────────▼──────────────────────────────┐    ║
║  │              ValidatedSignal                             │    ║
║  │  = NormalizedSignal + ValidationReport + Trust Score    │    ║
║  └─────────────────────────────────────────────────────────┘    ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │ ValidatedSignal[]
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║                       FEATURE TIER                               ║
║  ← يستهلك ValidatedSignal فقط                                   ║
║  ← REJECTED signals لا تصل هنا أبداً                           ║
║  ← DOWNGRADED signals تصل بثقة مخفَّضة                         ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │ FeatureBundle
                           ▼
                    Evidence → Reasoning
```

**القاعدة الحديدية**: لا ميزة تُحسب من إشارة لم تمر بـ SVQE.

---

## 3. نموذج ValidatedSignal

```typescript
// ─────────────────────────────────────────────────────────────────
//  نتيجة التحقق
// ─────────────────────────────────────────────────────────────────

export type ValidationStatus =
  | 'ACCEPTED'    // إشارة موثوقة — تُستخدم بالثقة الكاملة
  | 'DOWNGRADED'  // إشارة مقبولة لكن بثقة مُخفَّضة
  | 'FLAGGED'     // إشارة تحتاج مراجعة بشرية قبل الاستخدام
  | 'REJECTED';   // إشارة مرفوضة — لا تصل إلى Feature Layer أبداً

export type ValidationFailureReason =
  | 'OUT_OF_PHYSICAL_RANGE'       // القيمة خارج ما هو ممكن فيزيائياً
  | 'TEMPORAL_OUTLIER'            // قفزة مفاجئة غير مبررة
  | 'CROSS_SIGNAL_CONFLICT'       // تعارض مع إشارة أخرى
  | 'INSUFFICIENT_COVERAGE'       // coverage_fraction منخفض جداً
  | 'CLOUD_CONTAMINATION'         // تلوث بالسحاب
  | 'SHADOW_CONTAMINATION'        // تلوث بالظلال
  | 'LOW_ILLUMINATION'            // ضوء غير كافٍ (غروب/شروق)
  | 'MISSING_DATA'                // بيانات ناقصة في الـ ROI
  | 'STATISTICAL_ANOMALY'         // شاذ إحصائياً بدون تفسير
  | 'ENVIRONMENTAL_INCONSISTENCY' // لا يتطابق مع السياق البيئي
  | 'LOW_CONFIDENCE_THRESHOLD'    // الثقة الأصلية أقل من الحد الأدنى
  | 'DUPLICATE_OBSERVATION'       // تكرار لملاحظة سابقة
  | 'STALE_SIGNAL'                // انتهت صلاحية الإشارة زمنياً
  | 'ADAPTER_ERROR'               // خطأ داخلي في الـ adapter
  | 'UNKNOWN';

export interface ValidationFinding {
  validator_name:   string;
  status:           ValidationStatus;
  reason?:          ValidationFailureReason;
  description_ar:   string;
  confidence_impact: number;  // سالب = يُخفّض الثقة، صفر = لا تأثير
  is_blocking:      boolean;  // إذا true → REJECTED بغض النظر عن باقي النتائج
  evidence:         string;   // ما الذي جعل هذا الـ validator يُعلم هذه النتيجة
}

export interface ValidationReport {
  signal_id:         string;
  validated_at:      string;
  final_status:      ValidationStatus;
  final_confidence:  number;  // بعد تطبيق كل التعديلات
  final_quality:     number;  // بعد تطبيق كل التعديلات
  trust_score:       number;  // 0-1: مدى الاعتماد على هذه الإشارة
  findings:          ValidationFinding[];
  blocked_by?:       ValidationFailureReason;  // سبب الرفض إن رُفضت
  human_review_required: boolean;
  review_reason?:    string;
  // للتتبع التاريخي
  validator_version: string;
  validation_rules_applied: string[];
}

export interface ValidatedSignal extends NormalizedSignal {
  validation: ValidationReport;
  // القيم المُحدَّثة بعد التحقق
  validated_confidence: number;  // قد تختلف عن confidence الأصلية
  validated_quality:    number;
  is_consumable:        boolean;  // false = REJECTED
}
```

---

## 4. محركات التحقق السبعة

### 4.1 RangeValidator — هل القيمة ممكنة فيزيائياً؟

```typescript
export class RangeValidator {
  name = 'range_validator';

  // القيود الفيزيائية المطلقة — لا استثناءات
  private readonly PHYSICAL_LIMITS: Record<SignalType, {
    absolute_min: number;
    absolute_max: number;
    typical_min:  number;
    typical_max:  number;
    unit:         string;
    reference:    string;
  }> = {
    'VEGETATION_ACTIVITY': {
      absolute_min: -1.0,  // قيمة NDVI دنيا مطلقة (جسم أسود)
      absolute_max:  1.0,  // قيمة NDVI قصوى مطلقة (نبات كثيف)
      typical_min:  -0.2,  // أرض جرداء في المناطق القاحلة
      typical_max:   0.85, // غابة استوائية كثيفة
      unit:          'fraction',
      reference:     'Rouse et al. 1974, NDVI physical bounds',
    },
    'SURFACE_TEMPERATURE': {
      absolute_min: 183,   // K — أبرد نقطة مسجلة على الأرض
      absolute_max: 363,   // K — أعلى حرارة سطح مسجلة
      typical_min:  253,   // K — شتاء بارد
      typical_max:  343,   // K — صحراء في الصيف
      unit:          'kelvin',
      reference:     'MODIS LST product validation',
    },
    'SURFACE_MOISTURE': {
      absolute_min: 0.0,
      absolute_max: 1.0,
      typical_min:  0.0,
      typical_max:  0.95,
      unit:          'fraction',
      reference:     'Entekhabi et al. 2010',
    },
    'SURFACE_REFLECTANCE': {
      absolute_min: 0.0,
      absolute_max: 1.0,
      typical_min:  0.02,  // السطوح الداكنة (مياه عميقة)
      typical_max:  0.90,  // الجليد والثلج
      unit:          'fraction',
      reference:     'Schaaf et al. 2002 MODIS BRDF/Albedo',
    },
    'BACKSCATTER_VV': {
      absolute_min: -40,   // dB — أهدأ سطح ممكن
      absolute_max:  5,    // dB — انعكاس مزدوج قوي
      typical_min:  -25,
      typical_max:   -3,
      unit:          'dB',
      reference:     'Sentinel-1 SAR product specifications',
    },
    'BUILT_SURFACE_FRACTION': {
      absolute_min: 0.0,
      absolute_max: 1.0,
      typical_min:  0.0,
      typical_max:  0.98,  // لا يمكن أن يكون 100% مبني تماماً بدون أرصفة
      unit:          'fraction',
      reference:     'Urban remote sensing literature',
    },
  };

  validate(signal: NormalizedSignal): ValidationFinding {
    const limits = this.PHYSICAL_LIMITS[signal.signal_type];

    if (!limits) {
      // نوع إشارة غير معروف → نقبله مع تنبيه
      return {
        validator_name:    this.name,
        status:            'DOWNGRADED',
        reason:            'UNKNOWN',
        description_ar:    `نوع الإشارة "${signal.signal_type}" ليس في سجل الحدود الفيزيائية`,
        confidence_impact: -0.1,
        is_blocking:       false,
        evidence:          'signal_type not registered in physical limits registry',
      };
    }

    // تحقق من الحدود المطلقة
    if (signal.value < limits.absolute_min || signal.value > limits.absolute_max) {
      return {
        validator_name:    this.name,
        status:            'REJECTED',
        reason:            'OUT_OF_PHYSICAL_RANGE',
        description_ar:    `القيمة ${signal.value} ${limits.unit} خارج النطاق الفيزيائي المطلق [${limits.absolute_min}, ${limits.absolute_max}]. مرجع: ${limits.reference}`,
        confidence_impact: -1.0,
        is_blocking:       true,
        evidence:          `value=${signal.value}, absolute_range=[${limits.absolute_min},${limits.absolute_max}]`,
      };
    }

    // تحقق من النطاق الاعتيادي
    const beyondTypical =
      signal.value < limits.typical_min || signal.value > limits.typical_max;

    if (beyondTypical) {
      // ليس خطأً فيزيائياً بالضرورة، لكن غير معتاد
      return {
        validator_name:    this.name,
        status:            'FLAGGED',
        reason:            'STATISTICAL_ANOMALY',
        description_ar:    `القيمة ${signal.value} خارج النطاق الاعتيادي [${limits.typical_min}, ${limits.typical_max}] لكن ضمن الحدود المطلقة. تحتاج مراجعة.`,
        confidence_impact: -0.2,
        is_blocking:       false,
        evidence:          `value=${signal.value}, typical_range=[${limits.typical_min},${limits.typical_max}]`,
      };
    }

    return {
      validator_name:    this.name,
      status:            'ACCEPTED',
      description_ar:    `القيمة ${signal.value} ضمن النطاق الفيزيائي المتوقع`,
      confidence_impact: 0,
      is_blocking:       false,
      evidence:          `value=${signal.value} within typical_range=[${limits.typical_min},${limits.typical_max}]`,
    };
  }
}
```

---

### 4.2 TemporalConsistencyValidator — هل القفزة مبررة؟

```typescript
export class TemporalConsistencyValidator {
  name = 'temporal_consistency';

  // أقصى تغيير يومي مقبول لكل نوع إشارة
  private readonly MAX_DAILY_CHANGE: Record<SignalType, {
    hard_limit:    number;  // فوق هذا → REJECTED دائماً
    soft_limit:    number;  // فوق هذا → يحتاج تفسيراً
    explanation_ar: string; // لماذا هذا الحد؟
  }> = {
    'VEGETATION_ACTIVITY': {
      hard_limit:    0.5,   // تغيير 0.5 في يوم واحد مستحيل فيزيائياً
      soft_limit:    0.15,  // 0.15 ممكن بعد مطر غزير لكن نادر
      explanation_ar: 'النشاط النباتي يتغير ببطء. قفزة > 0.5 في يوم = خطأ في القياس غالباً.',
    },
    'SURFACE_REFLECTANCE': {
      hard_limit:    0.6,
      soft_limit:    0.20,
      explanation_ar: 'الانعكاسية قد تقفز بسبب سحاب أو ثلج، لكن 0.6 في يوم واحد مشكوك فيه',
    },
    'BUILT_SURFACE_FRACTION': {
      hard_limit:    0.4,
      soft_limit:    0.10,
      explanation_ar: 'البناء عملية تدريجية. تغيير 40% في يوم واحد = artifact في المعالجة.',
    },
    'SURFACE_MOISTURE': {
      hard_limit:    0.8,
      soft_limit:    0.40,
      explanation_ar: 'الرطوبة قد تتغير بعد مطر غزير، لكن 0.8 في يوم يُشير لخطأ.',
    },
  };

  validate(
    signal:  NormalizedSignal,
    history: NormalizedSignal[],  // الإشارات السابقة من نفس النوع لنفس المشروع
  ): ValidationFinding {

    const limits = this.MAX_DAILY_CHANGE[signal.signal_type];
    if (!limits || history.length === 0) {
      return { validator_name: this.name, status: 'ACCEPTED',
        description_ar: 'لا سجل تاريخي للمقارنة', confidence_impact: 0, is_blocking: false, evidence: 'no_history' };
    }

    // الإشارة الأخيرة المقبولة قبل هذه
    const prev = history
      .filter(h => h.validation?.final_status !== 'REJECTED' && h.observation_time < signal.observation_time)
      .sort((a, b) => b.observation_time.localeCompare(a.observation_time))[0];

    if (!prev) {
      return { validator_name: this.name, status: 'ACCEPTED',
        description_ar: 'أول إشارة في السجل', confidence_impact: 0, is_blocking: false, evidence: 'first_signal' };
    }

    const daysDiff = daysBetween(prev.observation_time.slice(0,10), signal.observation_time.slice(0,10));
    if (daysDiff === 0) {
      return { validator_name: this.name, status: 'ACCEPTED',
        description_ar: 'نفس اليوم', confidence_impact: 0, is_blocking: false, evidence: 'same_day' };
    }

    const dailyChange = Math.abs(signal.value - prev.value) / Math.max(daysDiff, 1);

    if (dailyChange > limits.hard_limit) {
      return {
        validator_name:    this.name,
        status:            'REJECTED',
        reason:            'TEMPORAL_OUTLIER',
        description_ar:    `تغيير يومي ${dailyChange.toFixed(3)} يتجاوز الحد الأقصى ${limits.hard_limit}. ${limits.explanation_ar}`,
        confidence_impact: -1.0,
        is_blocking:       true,
        evidence:          `prev=${prev.value}@${prev.observation_time.slice(0,10)}, curr=${signal.value}, daily_change=${dailyChange.toFixed(4)}, days=${daysDiff}`,
      };
    }

    if (dailyChange > limits.soft_limit) {
      return {
        validator_name:    this.name,
        status:            'FLAGGED',
        reason:            'TEMPORAL_OUTLIER',
        description_ar:    `تغيير يومي ${dailyChange.toFixed(3)} مرتفع بشكل غير معتاد. ${limits.explanation_ar}`,
        confidence_impact: -0.25,
        is_blocking:       false,
        evidence:          `daily_change=${dailyChange.toFixed(4)} exceeds soft_limit=${limits.soft_limit}`,
      };
    }

    return {
      validator_name:    this.name,
      status:            'ACCEPTED',
      description_ar:    `التغيير الزمني ${dailyChange.toFixed(3)}/يوم ضمن الحدود المتوقعة`,
      confidence_impact: 0,
      is_blocking:       false,
      evidence:          `daily_change=${dailyChange.toFixed(4)} within soft_limit=${limits.soft_limit}`,
    };
  }
}
```

---

### 4.3 CrossSignalConsistencyValidator — هل الإشارات متوافقة؟

```typescript
/**
 * يتحقق من أن الإشارات المتزامنة لا تتناقض فيزيائياً
 *
 * قواعد التوافق (مستمدة من العلوم الفيزيائية):
 *
 *  إذا VEGETATION_ACTIVITY > 0.6 (غطاء نباتي كثيف)
 *  فـ BUILT_SURFACE_FRACTION يجب < 0.5
 *  التفسير: لا يمكن أن يكون مكان مكتظ بالنباتات ومبنياً في آن معاً
 *
 *  إذا SURFACE_MOISTURE > 0.8 (سطح رطب جداً)
 *  فـ SURFACE_TEMPERATURE يجب < 310K
 *  التفسير: الماء يمتص الحرارة — رطوبة عالية مع حرارة عالية = تناقض
 *
 *  إذا BACKSCATTER_VV < -20dB (سطح أملس — ماء أو أسفلت رطب)
 *  فـ SURFACE_ROUGHNESS يجب < 0.3
 *  التفسير: SAR منخفض = سطح أملس
 */

export class CrossSignalConsistencyValidator {
  name = 'cross_signal_consistency';

  private readonly CONSISTENCY_RULES: ConsistencyRule[] = [
    {
      condition_signal:  'VEGETATION_ACTIVITY',
      condition_op:      '>',
      condition_value:   0.6,
      constrained_signal:'BUILT_SURFACE_FRACTION',
      constraint_op:     '<',
      constraint_value:  0.5,
      severity:          'hard',  // hard = FLAGGED, soft = DOWNGRADED
      explanation_ar:    'غطاء نباتي كثيف (>0.6) يتعارض مع بناء عالٍ (>0.5). إحدى الإشارتين خاطئة.',
      physics_reference: 'Urban-vegetation mutual exclusion in remote sensing',
    },
    {
      condition_signal:  'VEGETATION_ACTIVITY',
      condition_op:      '>',
      condition_value:   0.7,
      constrained_signal:'VEGETATION_ACTIVITY', // نفس الإشارة — قيد مطلق
      constraint_op:     '<',
      constraint_value:  0.85,
      severity:          'soft',
      explanation_ar:    'نشاط نباتي > 0.7 في منطقة إنشائية في طرابلس: مشكوك فيه (موسمية؟)',
      physics_reference: 'Libyan coastal vegetation typical NDVI range',
    },
    {
      condition_signal:  'SURFACE_MOISTURE',
      condition_op:      '>',
      condition_value:   0.7,
      constrained_signal:'AIR_TEMPERATURE',
      constraint_op:     '<',
      constraint_value:  38,  // درجة مئوية
      severity:          'soft',
      explanation_ar:    'رطوبة عالية مع حرارة هواء عالية جداً يُشير لخطأ في أحد القياسين.',
      physics_reference: 'Soil moisture-temperature coupling in arid regions',
    },
  ];

  validate(
    targetSignal: NormalizedSignal,
    cotemporaneousSignals: Map<SignalType, NormalizedSignal>,
  ): ValidationFinding[] {

    const findings: ValidationFinding[] = [];

    for (const rule of this.CONSISTENCY_RULES) {
      // هل القيد ينطبق على هذه الإشارة؟
      if (rule.condition_signal !== targetSignal.signal_type) continue;

      const conditionMet = this.evaluateCondition(targetSignal.value, rule.condition_op, rule.condition_value);
      if (!conditionMet) continue;

      const constrainedSig = cotemporaneousSignals.get(rule.constrained_signal);
      if (!constrainedSig) continue;  // لا يمكن التحقق بدون الإشارة الأخرى

      const constraintViolated = !this.evaluateCondition(constrainedSig.value, rule.constraint_op, rule.constraint_value);

      if (constraintViolated) {
        findings.push({
          validator_name:    this.name,
          status:            rule.severity === 'hard' ? 'FLAGGED' : 'DOWNGRADED',
          reason:            'CROSS_SIGNAL_CONFLICT',
          description_ar:    rule.explanation_ar,
          confidence_impact: rule.severity === 'hard' ? -0.35 : -0.15,
          is_blocking:       false,
          evidence:          `${rule.condition_signal}=${targetSignal.value} (${rule.condition_op}${rule.condition_value}) but ${rule.constrained_signal}=${constrainedSig.value} violates (${rule.constraint_op}${rule.constraint_value}). Ref: ${rule.physics_reference}`,
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        validator_name:    this.name,
        status:            'ACCEPTED',
        description_ar:    'لا تعارض مع الإشارات المتزامنة المتاحة',
        confidence_impact: 0,
        is_blocking:       false,
        evidence:          `checked ${cotemporaneousSignals.size} co-temporal signals`,
      });
    }

    return findings;
  }

  private evaluateCondition(val: number, op: string, threshold: number): boolean {
    switch (op) {
      case '>':  return val > threshold;
      case '>=': return val >= threshold;
      case '<':  return val < threshold;
      case '<=': return val <= threshold;
      case '==': return Math.abs(val - threshold) < 0.001;
      default:   return false;
    }
  }
}
```

---

### 4.4 SpatialCoverageValidator — التغطية المكانية كافية؟

```typescript
export class SpatialCoverageValidator {
  name = 'spatial_coverage';

  // الحد الأدنى للتغطية المكانية لكل نوع قرار
  private readonly COVERAGE_THRESHOLDS = {
    minimum_usable:    0.30,  // أقل من هذا → REJECTED (لا يمثل الموقع)
    minimum_reliable:  0.60,  // أقل من هذا → DOWNGRADED
    preferred:         0.80,  // فوق هذا → ACCEPTED بالكامل
    ideal:             0.95,
  };

  validate(signal: NormalizedSignal): ValidationFinding {
    const coverage = signal.coverage_fraction;

    if (coverage < this.COVERAGE_THRESHOLDS.minimum_usable) {
      return {
        validator_name:    this.name,
        status:            'REJECTED',
        reason:            'INSUFFICIENT_COVERAGE',
        description_ar:    `التغطية المكانية ${(coverage*100).toFixed(0)}% أقل من الحد الأدنى 30%. الإشارة لا تمثل الموقع.`,
        confidence_impact: -1.0,
        is_blocking:       true,
        evidence:          `coverage_fraction=${coverage.toFixed(3)}, minimum=${this.COVERAGE_THRESHOLDS.minimum_usable}`,
      };
    }

    if (coverage < this.COVERAGE_THRESHOLDS.minimum_reliable) {
      const penalty = (this.COVERAGE_THRESHOLDS.minimum_reliable - coverage) * 0.5;
      return {
        validator_name:    this.name,
        status:            'DOWNGRADED',
        reason:            'INSUFFICIENT_COVERAGE',
        description_ar:    `التغطية المكانية ${(coverage*100).toFixed(0)}% محدودة — قد لا تمثل الموقع الكامل`,
        confidence_impact: -penalty,
        is_blocking:       false,
        evidence:          `coverage_fraction=${coverage.toFixed(3)}, preferred=${this.COVERAGE_THRESHOLDS.preferred}`,
      };
    }

    return {
      validator_name:    this.name,
      status:            'ACCEPTED',
      description_ar:    `التغطية المكانية ${(coverage*100).toFixed(0)}% كافية`,
      confidence_impact: coverage >= this.COVERAGE_THRESHOLDS.ideal ? +0.05 : 0,
      is_blocking:       false,
      evidence:          `coverage_fraction=${coverage.toFixed(3)}`,
    };
  }
}
```

---

### 4.5 StatisticalAnomalyDetector — شاذ إحصائياً؟

```typescript
/**
 * يكتشف الإشارات التي تبتعد عن التوزيع الإحصائي التاريخي
 * للموقع المحدد (ليس عالمياً — لكل موقع توزيعه الخاص)
 */
export class StatisticalAnomalyDetector {
  name = 'statistical_anomaly';

  validate(
    signal:  NormalizedSignal,
    history: NormalizedSignal[],
    windowDays: number = 365,
  ): ValidationFinding {

    const recentHistory = history.filter(h => {
      const daysAgo = daysBetween(h.observation_time.slice(0,10), signal.observation_time.slice(0,10));
      return daysAgo > 0 && daysAgo <= windowDays && h.validation?.final_status !== 'REJECTED';
    });

    if (recentHistory.length < 5) {
      return {
        validator_name:    this.name,
        status:            'DOWNGRADED',
        reason:            'MISSING_DATA',
        description_ar:    `سجل تاريخي غير كافٍ (${recentHistory.length} إشارات). لا يمكن الكشف الإحصائي.`,
        confidence_impact: -0.10,
        is_blocking:       false,
        evidence:          `history_count=${recentHistory.length}, required=5`,
      };
    }

    const values = recentHistory.map(h => h.value);
    const mu     = mean(values);
    const sigma  = std(values);

    // Z-score: كم انحراف معياري يبعد هذا عن المتوسط
    const zScore = sigma > 0 ? Math.abs(signal.value - mu) / sigma : 0;

    if (zScore > 3.5) {
      // احتمالية وقوعه عشوائياً < 0.02%
      return {
        validator_name:    this.name,
        status:            'REJECTED',
        reason:            'STATISTICAL_ANOMALY',
        description_ar:    `القيمة تبتعد ${zScore.toFixed(1)} انحراف معياري عن المتوسط التاريخي. احتمالية طبيعية < 0.02%.`,
        confidence_impact: -1.0,
        is_blocking:       true,
        evidence:          `z_score=${zScore.toFixed(2)}, value=${signal.value}, mu=${mu.toFixed(4)}, sigma=${sigma.toFixed(4)}, n=${recentHistory.length}`,
      };
    }

    if (zScore > 2.5) {
      return {
        validator_name:    this.name,
        status:            'FLAGGED',
        reason:            'STATISTICAL_ANOMALY',
        description_ar:    `القيمة غير معتادة (${zScore.toFixed(1)} انحراف معياري). تحتاج مراجعة.`,
        confidence_impact: -0.20,
        is_blocking:       false,
        evidence:          `z_score=${zScore.toFixed(2)}, threshold=2.5`,
      };
    }

    return {
      validator_name:    this.name,
      status:            'ACCEPTED',
      description_ar:    `القيمة ضمن النطاق الإحصائي الطبيعي (z=${zScore.toFixed(2)})`,
      confidence_impact: zScore < 1.0 ? +0.05 : 0,  // قيمة "وسطية" تعزز الثقة قليلاً
      is_blocking:       false,
      evidence:          `z_score=${zScore.toFixed(2)}, mu=${mu.toFixed(4)}, sigma=${sigma.toFixed(4)}`,
    };
  }
}
```

---

### 4.6 EnvironmentalContextValidator — السياق البيئي يدعمه؟

```typescript
/**
 * يتحقق من التوافق مع السياق البيئي المعروف للموقع
 * مثال: هل VEGETATION_ACTIVITY = 0.8 منطقي في طرابلس في يوليو؟
 */
export class EnvironmentalContextValidator {
  name = 'environmental_context';

  // معلومات عن طبيعة ليبيا للتحقق السياقي
  // (يجب أن تُستمد من قاعدة بيانات أو ملف config في الإنتاج)
  private readonly TRIPOLI_SEASONAL_PROFILE = {
    // متوسط VEGETATION_ACTIVITY لكل شهر في منطقة طرابلس
    vegetation_seasonal: [0.12, 0.15, 0.18, 0.16, 0.10, 0.06, 0.04, 0.04, 0.06, 0.10, 0.14, 0.12],
    // موسم الأمطار: نوفمبر-مارس
    rainy_months:        [10, 11, 0, 1, 2],  // 0-indexed
    // أشهر الجفاف الشديد
    dry_months:          [4, 5, 6, 7, 8],
    // متوسط درجات الحرارة الشهرية (مئوية)
    avg_temp_monthly:    [12, 13, 15, 18, 22, 26, 28, 28, 26, 22, 17, 13],
  };

  validate(
    signal:            NormalizedSignal,
    observationDate:   string,
    weatherContext?:   WeatherContext,
  ): ValidationFinding {

    const month = new Date(observationDate).getMonth();

    if (signal.signal_type === 'VEGETATION_ACTIVITY') {
      const expectedVeg = this.TRIPOLI_SEASONAL_PROFILE.vegetation_seasonal[month];
      const tolerance   = 0.25;  // هامش ± موسمي
      const deviation   = Math.abs(signal.value - expectedVeg);

      if (deviation > 0.4 && this.TRIPOLI_SEASONAL_PROFILE.dry_months.includes(month)) {
        // قيمة نباتية عالية جداً في موسم الجفاف
        if (signal.value > expectedVeg + tolerance && !weatherContext?.recent_rain) {
          return {
            validator_name:    this.name,
            status:            'FLAGGED',
            reason:            'ENVIRONMENTAL_INCONSISTENCY',
            description_ar:    `قيمة النشاط النباتي ${signal.value.toFixed(2)} غير معتادة لشهر ${month+1} في طرابلس (متوقع ~${expectedVeg.toFixed(2)}). هل سقط مطر غير مسجل؟`,
            confidence_impact: -0.20,
            is_blocking:       false,
            evidence:          `month=${month+1}, value=${signal.value}, expected=${expectedVeg}, no_recent_rain=${!weatherContext?.recent_rain}`,
          };
        }
      }
    }

    if (signal.signal_type === 'SURFACE_MOISTURE' && signal.value > 0.6) {
      // رطوبة عالية في موسم الجفاف بدون مطر
      const isDrySeason = this.TRIPOLI_SEASONAL_PROFILE.dry_months.includes(month);
      if (isDrySeason && !weatherContext?.recent_rain) {
        return {
          validator_name:    this.name,
          status:            'DOWNGRADED',
          reason:            'ENVIRONMENTAL_INCONSISTENCY',
          description_ar:    `رطوبة ${(signal.value*100).toFixed(0)}% في موسم الجفاف بدون مطر مُسجَّل. تأكد من مصداقية القياس.`,
          confidence_impact: -0.15,
          is_blocking:       false,
          evidence:          `month=${month+1}, is_dry_season=true, moisture=${signal.value}, recent_rain=false`,
        };
      }
    }

    return {
      validator_name:    this.name,
      status:            'ACCEPTED',
      description_ar:    'الإشارة متسقة مع السياق البيئي الموسمي',
      confidence_impact: 0,
      is_blocking:       false,
      evidence:          `month=${month+1}, signal_type=${signal.signal_type}`,
    };
  }
}
```

---

### 4.7 ConfidenceAggregator — القرار النهائي

```typescript
export class ConfidenceAggregator {
  name = 'confidence_aggregator';

  aggregate(
    signal:   NormalizedSignal,
    findings: ValidationFinding[],
  ): ValidationReport {

    // إذا كان أي finding حاجباً → رفض فوري
    const blockingFinding = findings.find(f => f.is_blocking);
    if (blockingFinding) {
      return {
        signal_id:             signal.signal_id,
        validated_at:          new Date().toISOString(),
        final_status:          'REJECTED',
        final_confidence:      0,
        final_quality:         0,
        trust_score:           0,
        findings,
        blocked_by:            blockingFinding.reason,
        human_review_required: false,
        validator_version:     '1.0',
        validation_rules_applied: findings.map(f => f.validator_name),
      };
    }

    // تجميع التأثير الإجمالي على الثقة
    const totalImpact = findings.reduce((sum, f) => sum + f.confidence_impact, 0);
    const adjustedConfidence = Math.max(0, Math.min(1,
      signal.confidence + totalImpact
    ));
    const adjustedQuality = Math.max(0, Math.min(1,
      signal.quality_score + totalImpact * 0.5
    ));

    // تحديد الحالة النهائية
    const hasRejected  = findings.some(f => f.status === 'REJECTED');
    const hasFlagged   = findings.some(f => f.status === 'FLAGGED');
    const hasDowngraded= findings.some(f => f.status === 'DOWNGRADED');

    let finalStatus: ValidationStatus = 'ACCEPTED';
    if (hasRejected)   finalStatus = 'REJECTED';
    else if (hasFlagged)    finalStatus = 'FLAGGED';
    else if (hasDowngraded) finalStatus = 'DOWNGRADED';

    // هل تحتاج مراجعة بشرية؟
    const humanRequired = finalStatus === 'FLAGGED' || adjustedConfidence < 0.3;

    // Trust score: يُعبّر عن الثقة الإجمالية بعد كل التحقق
    const trustScore = finalStatus === 'REJECTED' ? 0
      : adjustedConfidence * (hasFlagged ? 0.7 : hasDowngraded ? 0.85 : 1.0);

    return {
      signal_id:             signal.signal_id,
      validated_at:          new Date().toISOString(),
      final_status:          finalStatus,
      final_confidence:      adjustedConfidence,
      final_quality:         adjustedQuality,
      trust_score:           trustScore,
      findings,
      human_review_required: humanRequired,
      review_reason:         humanRequired ? findings.find(f => f.status === 'FLAGGED')?.description_ar : undefined,
      validator_version:     '1.0',
      validation_rules_applied: findings.map(f => f.validator_name),
    };
  }
}
```

---

## 5. SVQE Orchestrator — يُشغّل كل المحركات

```typescript
export class SignalValidationEngine {

  private readonly validators = {
    range:         new RangeValidator(),
    temporal:      new TemporalConsistencyValidator(),
    crossSignal:   new CrossSignalConsistencyValidator(),
    spatial:       new SpatialCoverageValidator(),
    anomaly:       new StatisticalAnomalyDetector(),
    environmental: new EnvironmentalContextValidator(),
    aggregator:    new ConfidenceAggregator(),
  };

  /**
   * التحقق من إشارة واحدة
   */
  async validate(
    signal:            NormalizedSignal,
    context:           SignalValidationContext,
  ): Promise<ValidatedSignal> {

    const allFindings: ValidationFinding[] = [];

    // 1. Range validation (لا يحتاج سياق)
    allFindings.push(
      this.validators.range.validate(signal)
    );

    // إذا رُفض هنا، لا داعي للمتابعة
    if (allFindings[0].is_blocking) {
      const report = this.validators.aggregator.aggregate(signal, allFindings);
      return this.wrapValidated(signal, report);
    }

    // 2. Temporal consistency (يحتاج تاريخ)
    allFindings.push(
      this.validators.temporal.validate(signal, context.signalHistory)
    );

    // 3. Cross-signal consistency (يحتاج إشارات متزامنة)
    const crossFindings = this.validators.crossSignal.validate(
      signal,
      context.cotemporaneousSignals,
    );
    allFindings.push(...crossFindings);

    // 4. Spatial coverage (من الإشارة نفسها)
    allFindings.push(
      this.validators.spatial.validate(signal)
    );

    // 5. Statistical anomaly
    allFindings.push(
      this.validators.anomaly.validate(signal, context.signalHistory)
    );

    // 6. Environmental context
    allFindings.push(
      this.validators.environmental.validate(
        signal,
        signal.observation_time.slice(0, 10),
        context.weatherContext,
      )
    );

    // 7. Aggregate
    const report = this.validators.aggregator.aggregate(signal, allFindings);
    return this.wrapValidated(signal, report);
  }

  /**
   * التحقق من دفعة إشارات (أكثر كفاءة — يُوفّر السياق المشترك)
   */
  async validateBatch(
    signals: NormalizedSignal[],
    context: SignalValidationContext,
  ): Promise<ValidatedSignal[]> {

    const signalsByType = new Map<SignalType, NormalizedSignal[]>();
    signals.forEach(s => {
      if (!signalsByType.has(s.signal_type)) signalsByType.set(s.signal_type, []);
      signalsByType.get(s.signal_type)!.push(s);
    });

    const results: ValidatedSignal[] = [];
    const cotemporaneous = new Map<SignalType, NormalizedSignal>();

    // أول مرور: بناء السياق المشترك للتحقق المتقاطع
    for (const signal of signals) {
      cotemporaneous.set(signal.signal_type, signal);
    }

    // ثاني مرور: التحقق الكامل
    for (const signal of signals) {
      const enrichedContext: SignalValidationContext = {
        ...context,
        cotemporaneousSignals: cotemporaneous,
      };
      results.push(await this.validate(signal, enrichedContext));
    }

    return results;
  }

  private wrapValidated(signal: NormalizedSignal, report: ValidationReport): ValidatedSignal {
    return {
      ...signal,
      validation:           report,
      validated_confidence: report.final_confidence,
      validated_quality:    report.final_quality,
      is_consumable:        report.final_status !== 'REJECTED',
    };
  }
}

export interface SignalValidationContext {
  project_id:            string;
  project_type:          string;
  project_location_ar:   string;
  signalHistory:         NormalizedSignal[];          // إشارات سابقة من نفس النوع
  cotemporaneousSignals: Map<SignalType, NormalizedSignal>; // إشارات متزامنة من أنواع أخرى
  weatherContext?:       WeatherContext;
  baseline?:             ProjectBaseline;             // خط الأساس قبل الإنشاء
}

interface WeatherContext {
  recent_rain:     boolean;  // خلال 48 ساعة
  rain_mm?:        number;
  cloud_cover_pct: number;
  temperature_c:   number;
}

interface ProjectBaseline {
  // القيم المعيارية للموقع قبل الإنشاء (من الإشارات التاريخية)
  [key: string]: { mean: number; std: number; established_at: string };
}
```

---

## 6. تكامل SVQE في pipeline التحليل

```typescript
// في lib/reasoning/project_analyzer.ts

export class ProjectAnalyzer {

  private sal:  SignalAbstractionLayer;
  private svqe: SignalValidationEngine;
  private features: FeatureEngine;
  private reasoning: ReasoningEngine;

  async analyze(
    project:  PICProject,
    scenes:   ArchivedScene[],
    tenantId: string,
  ): Promise<ConstructionIntelligence> {

    const results: TemporalObservation[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // ── STEP 1: Provider Adapter (SAL) ──────────────────────
      const rawSignals = await this.sal.adapt(scene, project.bbox);

      // ── STEP 2: Signal Validation & Quality (SVQE) ──────────
      const signalHistory = await this.getSignalHistory(project.id, scene.acquisition_date);
      const weatherCtx    = await this.getWeatherContext(project.bbox, scene.acquisition_date);

      const validatedSignals = await this.svqe.validateBatch(rawSignals, {
        project_id:            project.id,
        project_type:          project.type,
        project_location_ar:   project.name,
        signalHistory,
        cotemporaneousSignals: new Map(rawSignals.map(s => [s.signal_type, s])),
        weatherContext:        weatherCtx,
      });

      // ← رُفضت الإشارات لا تصل أبدا إلى Feature Layer
      const consumableSignals = validatedSignals.filter(s => s.is_consumable);
      const rejectedCount     = validatedSignals.length - consumableSignals.length;

      if (consumableSignals.length === 0) {
        // لا توجد إشارات صالحة لهذا المشهد
        results.push({
          date:     scene.acquisition_date,
          skipped:  true,
          reason:   `جميع الإشارات الـ ${validatedSignals.length} رُفضت — مشهد غير قابل للاستخدام`,
          rejected_signals: rejectedCount,
        });
        continue;
      }

      // ── STEP 3: Feature Extraction ───────────────────────────
      const signalMap = new Map(consumableSignals.map(s => [s.signal_type, s]));
      const features  = await this.features.extract(signalMap, project);

      // ── STEP 4: Evidence Generation ──────────────────────────
      const evidence = this.reasoning.generateEvidence(features, project);

      // ── STEP 5: Persist ──────────────────────────────────────
      await this.persist(project.id, scene, validatedSignals, features, evidence);

      results.push({
        date:             scene.acquisition_date,
        skipped:          false,
        signals_used:     consumableSignals.length,
        signals_rejected: rejectedCount,
        features,
        evidence,
      });
    }

    // ── STEP 6: Temporal Analysis → Progress → Health ─────────
    return this.reasoning.synthesize(project, results);
  }
}
```

---

## 7. مراجعة المعمارية الكاملة — الضعف المتبقي

بعد إضافة SVQE، هذه نقاط الضعف المتبقية مرتبةً بالأولوية:

### ⚠️ الضعف 1: غياب خط الأساس (Baseline)
**المشكلة**: كيف نعرف أن تغيير `SURFACE_REFLECTANCE` من 0.3 إلى 0.4 يمثل نشاطاً إنشائياً وليس طبيعة المنطقة؟ بدون قياسات **قبل بدء الإنشاء**، كل تغيير يُقارَن بمتوسط تاريخي مشوه بوجود الإنشاء ذاته.

**الحل المطلوب**: `BaselineEstablisher` — يُحدد الحالة الطبيعية للموقع من أقدم المشاهد المتاحة (قبل تاريخ البدء المُعلن)، ثم كل إشارة تُقارَن بهذا الخط لا بمتوسط تاريخي عام.

### ⚠️ الضعف 2: لا تناظر مكاني داخل المشروع
**المشكلة**: الآن كل مشروع وحدة واحدة (bbox → إشارة واحدة). مشروع طريق بطول 5 كم قد يكون 60% منجزاً في الجزء الغربي و10% في الجزء الشرقي — لكن النظام يُعطي رقماً واحداً 35%.

**الحل المطلوب**: تقسيم مشاريع الطرق إلى segments، كل segment له بياناته المستقلة.

### ⚠️ الضعف 3: انتشار عدم اليقين (Uncertainty Propagation)
**المشكلة**: uncertainty مُتتبَّعة في الإشارة، لكنها لا تنتشر رياضياً عبر الميزات والأدلة والتقدير النهائي. الإنجاز النهائي 65% لا يحمل فاصلاً `±X%` مُحسوباً رياضياً.

**الحل المطلوب**: تطبيق قانون انتشار الخطأ عبر كل الطبقات:
```
σ_progress² = Σ (∂progress/∂signal_i)² × σ_signal_i²
```

### ⚠️ الضعف 4: لا آلية للتعلم من الواقع (Ground Truth Feedback)
**المشكلة**: لو أخطأ النظام وقدّر مشروعاً بـ 40% بينما مفتش ميداني يؤكد أنه 70% — هذا الخطأ لا يُصحَّح النموذج ولا يُستفاد منه.

**الحل المطلوب**: `GroundTruthFeedback` table — تسجيل ملاحظات بشرية مع ربطها بالإشارات المستخدمة لإعادة معايرة الأوزان.

### ⚠️ الضعف 5: نماذج التقدم تفتقر للفيزياء الإنشائية
**المشكلة**: نماذج التقدم الحالية تعتمد على الأنماط البصرية. لكن الإنشاء له فيزياء محددة: وقت تصليب الخرسانة 28 يوم، مراحل إلزامية لا يمكن تجاوزها، معدلات إنجاز نمطية.

**الحل المطلوب**: `ConstructionPhysicsModel` — يُضيف قيوداً فيزيائية على التقدير (لا يمكن أن ينتقل مشروع من تحضير الموقع إلى تشطيب خلال أسبوع).

---

## 8. جدول الأولويات المحدَّث

| الأولوية | المهمة | الأثر | الجهد |
|----------|--------|-------|-------|
| 🔴 1 | تثبيت sharp + PlanetAdapter | استبدال compareImages الخاطئ | أسبوع 1 |
| 🔴 2 | بناء SVQE (هذه الوثيقة) | منع الإشارات الخاطئة | أسبوع 1-2 |
| 🔴 3 | BaselineEstablisher | مرجع للتغيير الحقيقي | أسبوع 2 |
| 🟠 4 | FeatureLayer (بدون RGB) | فصل الاستدلال عن المزود | أسبوع 2-3 |
| 🟠 5 | Uncertainty Propagation | confidence intervals حقيقية | أسبوع 3 |
| 🟠 6 | Road Segmentation | دقة مكانية للطرق | أسبوع 3-4 |
| 🟡 7 | Progress Models (per type) | تقدير مخصص لكل نوع مشروع | أسبوع 4 |
| 🟡 8 | ConstructionPhysicsModel | قيود فيزيائية على التقدير | أسبوع 5 |
| 🟡 9 | GroundTruth Feedback | تعلم من التصحيحات | مستقبلي |
| 🟢 10 | WeatherAdapter | تمييز weather_pause | مستقبلي |

---

## 9. ملاحظات الاستقرار المعماري

**ما وصلنا إليه بعد ثلاث وثائق:**

```
Architecture v3.0 — الطبقات:

Provider Adapters    → يعرفون المزودين فقط
Signal Abstraction   → يُطبّع الإشارات
Signal Validation    → يُقرر هل الإشارة تُستحق الثقة
Feature Layer        → يُحوّل إشارات إلى ميزات
Evidence Layer       → يُنشئ سلسلة أدلة
Reasoning Layer      → يستنتج التقدم والصحة والتنبيهات
Persistence Layer    → يحفظ كل شيء مع تتبعه
```

**الخاصية الأساسية التي تحققت:**  
كل طبقة تعرف فقط ما تحتاجه. Provider Adapters لا تعرف الميزات. Feature Layer لا تعرف المزودين. الاستدلال لا يعرف من أين جاءت البيانات ولا هل هي موثوقة بالأصل (SVQE تُجيب على هذا قبل أن تصله).

**الخاصية التي لم تتحقق بعد:**  
التتبع الكمي الكامل للخطأ عبر الطبقات — سيُحقق في المرحلة 3 (Uncertainty Propagation).

---

*هذه الوثيقة تُكمل ثلاثية التصميم:*  
*1. PIC-Architecture-Review — ما هو خاطئ*  
*2. MINERVA-Signal-Abstraction — كيف نفصل المزودين*  
*3. هذه الوثيقة — كيف نُقرر هل نثق بالإشارة*
