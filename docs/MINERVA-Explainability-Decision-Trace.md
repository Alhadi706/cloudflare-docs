# MINERVA — Explainability & Decision Trace
## Every Decision Must Be Readable by a Human, Auditable Years Later

**التاريخ**: 2026-07-09  
**الإصدار**: 5.0 — Transparency by Design  
**يُكمل**: MINERVA-Stability-Evidence-Model.md  
**الحالة**: وثيقة تصميم معتمدة

---

## الحكم الافتتاحي

> **القرار غير القابل للشرح قرار لا يُستحق الثقة.**

المعمارية الحالية تُنتج أرقاماً. لكن كل رقم يجب أن يأتي مصحوباً بجواب على سؤال واحد:

**"كيف وصلنا إلى هذا؟"**

إذا كان مفتش إنشاء خبير يحمل هاتفه وينظر في تقرير MINERVA عن مشروع يراقبه — يجب أن يفهم كل رقم فيه بدون أن يسأل مطوراً.

---

## 1. مراجعة قابلية الشرح في المعمارية الحالية

### 1.1 أي مكون يستطيع شرح قراراته الآن؟

```
SVQE Validators              → ✅ كل validator يُنتج message_ar
Signal Abstraction Layer     → ✅ كل إشارة تحمل provenance
EvidenceSufficiencyGate      → ✅ كل بوابة لها message_ar
CalibrationRule              → ✅ يحمل expected_improvement_ar

buildTimeline() progress     → ❌ "rawProgress*0.6 + timePct*0.4" — لا شرح
classifyActivity() state     → ❌ threshold 0.20 — لا تبرير
health_score formula         → ❌ "40 + activityBonus + recentActivity" — لا شرح
compareImages() magnitude    → ❌ (مُقرَّر إلغاؤه — لكن موجود حالياً)
InterruptionDetector         → ❌ "14 days threshold" — لا تبرير
trend (last3 vs prev3)       → ❌ لا يُشرح سبب اختيار 3 نقاط
alert generation             → ⚠️ جزئي — النص موجود لكن بدون أدلة داعمة
```

**الخلاصة**: الطبقات الجديدة (SAL, SVQE) مُصمَّمة للشرح.  
طبقة الاستدلال القديمة لا تُشرح نفسها. **يجب إعادة تصميمها قبل أي تنفيذ.**

---

## 2. المعمارية الجديدة للشفافية

```
╔══════════════════════════════════════════════════════════════════════╗
║              كل طبقة تُضيف إلى DecisionTrace                        ║
╚══════════════════════════════════════════════════════════════════════╝

Adapters → SAL → SVQE → Features → Evidence → Reasoning
    │         │       │        │         │          │
    ▼         ▼       ▼        ▼         ▼          ▼
 DataTrace  SignalTrace  ValidationTrace  FeatureTrace  ReasoningTrace
                                                               │
                              ┌────────────────────────────────┘
                              ▼
╔══════════════════════════════════════════════════════════════════════╗
║                    DecisionTrace (كائن كامل)                        ║
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │ 1. DataInventory    — ما البيانات المستخدمة؟               │    ║
║  │ 2. ReasoningChain   — كيف وصلنا للنتيجة؟                  │    ║
║  │ 3. InfluenceRanking — أي العوامل أثّرت أكثر؟              │    ║
║  │ 4. ConfidenceJourney— كيف تطورت الثقة؟                    │    ║
║  │ 5. AssumptionList   — ماذا افترضنا؟                        │    ║
║  │ 6. UncertaintyProfile— ماذا لا نعرف؟                      │    ║
║  │ 7. AlternativeHypotheses — ما البدائل التي رفضناها؟        │    ║
║  └─────────────────────────────────────────────────────────────┘    ║
║                              │                                      ║
║              ┌───────────────┼───────────────┐                      ║
║              ▼               ▼               ▼                      ║
║    TechnicalTrace     NarrativeAR      ExecutiveSummary             ║
║    (للمطورين)        (للمهندسين)      (للمديرين)                   ║
╚══════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
                    stored with prediction
                    retrievable years later
```

---

## 3. نموذج DecisionTrace الكامل

```typescript
// ═══════════════════════════════════════════════════════════════════
//  DecisionTrace — الكائن الشامل الذي يُرفَق مع كل قرار
// ═══════════════════════════════════════════════════════════════════

export interface DecisionTrace {

  // الهوية
  trace_id:        string;      // UUID
  prediction_id:   string;      // → minerva_learning.prediction_ledger
  project_id:      string;
  prediction_type: string;      // 'PROGRESS_PCT' | 'PHASE' | ...
  produced_at:     string;      // ISO timestamp
  architecture_version: string; // '5.0' — لتتبع تطور النظام

  // ────────────────────────────────────────────────────────────────
  // 1. DataInventory — ماذا استخدمنا؟
  // ────────────────────────────────────────────────────────────────
  data_inventory: {
    total_scenes_available:    number;  // كل المشاهد في الأرشيف للمنطقة
    scenes_used:               number;  // المشاهد التي استُخدمت فعلاً
    scenes_rejected_by_svqe:   number;  // رُفضت بواسطة SVQE
    date_range: { from: string; to: string };
    providers_used: string[];           // ['planet_scope']
    signals_available: SignalSummary[]; // كل الإشارات المتاحة
    signals_used:      SignalSummary[]; // الإشارات المستخدمة في القرار
    data_gaps: DataGap[];               // فجوات في التغطية
    data_quality_overall: 'high' | 'medium' | 'low';
    data_quality_notes_ar: string;      // وصف عربي لجودة البيانات
  };

  // ────────────────────────────────────────────────────────────────
  // 2. ReasoningChain — سلسلة المنطق خطوة بخطوة
  // ────────────────────────────────────────────────────────────────
  reasoning_chain: ReasoningStep[];

  // ────────────────────────────────────────────────────────────────
  // 3. InfluenceRanking — أي العوامل أثّرت أكثر؟
  // ────────────────────────────────────────────────────────────────
  influence_ranking: InfluenceFactor[];

  // ────────────────────────────────────────────────────────────────
  // 4. ConfidenceJourney — كيف تطورت الثقة عبر الطبقات؟
  // ────────────────────────────────────────────────────────────────
  confidence_journey: ConfidenceCheckpoint[];

  // ────────────────────────────────────────────────────────────────
  // 5. AssumptionList — ماذا افترضنا بدون تحقق كامل؟
  // ────────────────────────────────────────────────────────────────
  assumptions: Assumption[];

  // ────────────────────────────────────────────────────────────────
  // 6. UncertaintyProfile — ما الذي لا نعرفه؟
  // ────────────────────────────────────────────────────────────────
  uncertainty_profile: UncertaintyFactor[];

  // ────────────────────────────────────────────────────────────────
  // 7. AlternativeHypotheses — ما البدائل التي رفضناها ولماذا؟
  // ────────────────────────────────────────────────────────────────
  alternatives_considered: AlternativeHypothesis[];

  // ────────────────────────────────────────────────────────────────
  // المخرجات المُولَّدة (للعرض للمستخدم)
  // ────────────────────────────────────────────────────────────────
  narrative: {
    executive_summary_ar: string;    // فقرة للمدير — بدون أرقام تقنية
    technical_summary_ar: string;    // فقرة للمهندس — مع الأرقام الرئيسية
    key_evidence_ar:      string[];  // 3-5 نقاط رئيسية
    key_limitations_ar:   string[];  // 2-3 قيود رئيسية
    confidence_label_ar:  string;    // "عالية" | "متوسطة" | "منخفضة"
  };
}

// ───────────────────────────────────────────────────
// خطوة في سلسلة المنطق
// ───────────────────────────────────────────────────
export interface ReasoningStep {
  step_order:    number;
  layer:         string;    // 'signal' | 'feature' | 'evidence' | 'reasoning'
  component:     string;    // اسم المكون المسؤول
  question_ar:   string;    // السؤال الذي أجابت عليه هذه الخطوة
  observation_ar: string;   // ماذا لاحظنا
  conclusion_ar: string;    // ماذا استنتجنا
  confidence:    number;    // ثقة هذه الخطوة
  evidence_refs: string[];  // إشارة لـ signals أو features استُخدمت
  is_critical:   boolean;   // هل هذه الخطوة محورية في القرار النهائي؟
}

// ───────────────────────────────────────────────────
// عامل تأثير مُرتَّب
// ───────────────────────────────────────────────────
export interface InfluenceFactor {
  rank:           number;
  name_ar:        string;    // اسم العامل بالعربي
  type:           'supporting' | 'reducing';  // يرفع أم يخفض التقدير؟
  magnitude:      number;    // حجم التأثير المحسوب (0-1)
  value_used:     number;    // القيمة التي تم استخدامها
  signal_type?:   string;    // من أي إشارة جاء هذا العامل
  explanation_ar: string;    // لماذا أثّر هذا العامل؟
}

// ───────────────────────────────────────────────────
// نقطة تحقق في رحلة الثقة
// ───────────────────────────────────────────────────
export interface ConfidenceCheckpoint {
  layer:          string;
  checkpoint_ar:  string;    // ماذا فعلنا في هذه النقطة
  confidence_before: number;
  confidence_after:  number;
  delta:             number;  // موجب = رفع، سالب = خفض
  reason_ar:         string;  // لماذا تغيرت الثقة
}

// ───────────────────────────────────────────────────
// افتراض صريح
// ───────────────────────────────────────────────────
export interface Assumption {
  assumption_ar:    string;   // ما الذي افترضناه؟
  basis_ar:         string;   // على أي أساس افترضناه؟
  impact_if_wrong_ar: string; // ماذا يحدث للنتيجة إذا كان خاطئاً؟
  confidence_in_assumption: number;  // كم نحن واثقون من هذا الافتراض؟
  is_verifiable:    boolean;  // هل يمكن التحقق منه ميدانياً؟
}

// ───────────────────────────────────────────────────
// عامل عدم يقين
// ───────────────────────────────────────────────────
export interface UncertaintyFactor {
  source_ar:        string;   // من أين يأتي عدم اليقين؟
  impact_ar:        string;   // كيف يؤثر على النتيجة؟
  magnitude:        'high' | 'medium' | 'low';
  would_resolve_if_ar: string; // ما الذي يمكن أن يُزيل هذا الغموض؟
  is_reducible:     boolean;  // هل يمكن تقليله بالحصول على بيانات إضافية؟
}

// ───────────────────────────────────────────────────
// فرضية بديلة مُرفوضة
// ───────────────────────────────────────────────────
export interface AlternativeHypothesis {
  hypothesis_ar:  string;    // الفرضية البديلة
  probability:    number;    // احتمال أن تكون صحيحة (0-1)
  why_rejected_ar: string;   // لماذا رفضناها؟
  evidence_against_ar: string; // ما الدليل ضدها؟
}
```

---

## 4. نماذج تطبيقية — كيف يبدو الشرح فعلياً

### 4.1 مثال شرح تقدير الإنجاز (85%)

```
📊 تقرير MINERVA — مشروع: طريق الدائري الثالث
═══════════════════════════════════════════════

نسبة الإنجاز المُقدَّرة: 85% ± 12%   |   ثقة: متوسطة (62%)
──────────────────────────────────────────────────────────

الملخص التنفيذي (للمدير):
───────────────────────────
درسنا هذا الطريق بالأقمار الاصطناعية خلال 16 شهراً.
الموقع يُظهر نشاطاً إنشائياً متواصلاً مع بعض فترات الهدوء.
التقدير الحالي 85% لكنه يحمل هامشاً للخطأ بسبب محدودية الصور المتاحة.
نوصي بزيارة ميدانية لتأكيد هذا الرقم قبل اتخاذ قرارات مالية.

الملخص التقني (للمهندس):
──────────────────────────
• 124 مشهد من أرشيف Planet (مارس 2025 – يوليو 2026)
• 89 مشهداً مقبولاً (72%)، 35 مشهداً رُفض (28%) بسبب سحاب أو جودة منخفضة
• متوسط إشارة اضطراب السطح: 0.71 (عالٍ → نشاط إنشائي)
• اكتشفنا تراجعاً في النباتات (98% من الموقع جرداء) ← مؤشر تهيئة
• إشارة هيكل خطي قوية (linear_score = 0.83) ← مؤشر طريق مُنجَّز
• تقدير الوقت: مضى 75% من المدة المُخططة (15 من 20 شهراً)
• تقدير النشاط: 81% من الأيام كانت نشطة
• النتيجة: (81% نشاط × 0.60) + (75% وقت × 0.40) = 85%

أبرز الأدلة:
────────────
1. قوة الهياكل الخطية (linear_score 0.83): يدل على رصف واسع الامتداد على
   طول الطريق المُخطَّط — أقوى دليل على الإنجاز
2. ثبات السطح في 78% من المقاطع: الأجزاء الثابتة = مكتملة أو قريبة من الاكتمال
3. تراجع اضطراب السطح في آخر 30 يوماً: يُشير لمرحلة تشطيب ونهاية الأعمال الكبرى
4. الجدول الزمني: المشروع في 75% من عمره المُخطَّط مع نشاط متواصل

القيود الرئيسية:
────────────────
1. الصور المتاحة دقتها 3م/بيكسل — لا يمكن التمييز بين أنواع الطبقات (أساس، رصف)
2. لا معلومات ارتفاع — لا يمكن قياس سُمك الطبقات أو نسبة الهياكل الجانبية المنجزة
3. 28% من المشاهد رُفضت — فجوات في التغطية قد تُخفي تغييرات مهمة
```

---

### 4.2 مثال شرح تنبيه توقف

```
🔔 تنبيه — مشروع: محطة معالجة الصرف الصحي
══════════════════════════════════════════

النوع: توقف مشتبه به | الشدة: متوسطة | الثقة: 71%
──────────────────────────────────────────────────

ما حدث (للمدير):
──────────────────
لاحظنا أن هذا الموقع لم يُظهر أي نشاط مرئي لمدة 26 يوماً.
هذا قد يعني توقفاً عن العمل، لكن يحتمل أن يكون سببه طقس أو موسم.
نوصي بالتواصل مع المقاول للتحقق.

التفاصيل التقنية:
──────────────────
• آخر مشهد أظهر نشاطاً: 2026-06-13
• 26 مشهداً متتالياً منذ ذلك التاريخ بدون تغيير ملحوظ
• متوسط اضطراب السطح في هذه الفترة: 0.04 (أقل من عتبة التوقف 0.06)
• لا غيوم تُفسر غياب النشاط (cloud_fraction < 5% في 23 من 26 مشهد)

سلسلة المنطق:
──────────────
1. رصدنا ثباتاً في surface_reflectance (تغيير < 2%) لمدة 26 يوماً
2. لا تفسير للطقس: الفترة صحوة بنسبة 88%
3. لا تفسير موسمي: هذه الفترة ليست موسم أمطار في طرابلس
4. السجل التاريخي يُظهر 5 فترات توقف سابقة، أطولها 14 يوماً
5. الفترة الحالية (26 يوماً) تتجاوز الحد التاريخي بمرتين
6. استنتاج: نشاط منخفض غير معتاد — قد يكون توقفاً إدارياً أو عمالياً

عوامل خفضت الثقة (من 85% إلى 71%):
────────────────────────────────────
• مشهد واحد في يوم 15 أظهر تغييراً خفيفاً (magnitude 0.08) — لم يستوفِ عتبة النشاط لكنه يُثير الشك
• لا بيانات رطوبة متاحة — لا يمكن استبعاد تأثير أمطار خفيفة
• الدقة المكانية 3م — الأعمال الداخلية في المنشآت لا ترى من الأقمار

الفرضيات البديلة المدروسة:
───────────────────────────
1. "الأعمال انتقلت للداخل" — احتمال 22%: غير مؤكد لأن الأعمال الخارجية ما زالت غير مكتملة
2. "طقس غير مسجل" — احتمال 7%: يتعارض مع 23 مشهداً صحواً متتالياً

الافتراضات:
────────────
• نفترض أن تقييم البناء يعتمد على التغييرات المرئية من الأعلى
  (قد يفوت: أعمال بنية تحتية تحت الأرض، أعمال داخلية)
• نفترض أن مشاهد Planet تغطي الموقع بالكامل — غير مؤكد إذا كان bbox أكبر من footprint المشهد
```

---

## 5. TraceBuilder — يُنشئ DecisionTrace

```typescript
export class TraceBuilder {

  startTrace(predictionId: string, projectId: string, type: string): TraceContext {
    return {
      trace_id:      crypto.randomUUID(),
      prediction_id: predictionId,
      project_id:    projectId,
      prediction_type: type,
      produced_at:   new Date().toISOString(),
      steps:         [],
      influences:    [],
      checkpoints:   [],
      assumptions:   [],
      uncertainties: [],
      alternatives:  [],
    };
  }

  // ── يُستدعى من كل طبقة ─────────────────────────────────────

  addStep(ctx: TraceContext, step: Omit<ReasoningStep, 'step_order'>): void {
    ctx.steps.push({ ...step, step_order: ctx.steps.length + 1 });
  }

  addInfluence(ctx: TraceContext, factor: Omit<InfluenceFactor, 'rank'>): void {
    ctx.influences.push({ ...factor, rank: 0 });  // رتبة تُحسب لاحقاً
  }

  addConfidenceCheckpoint(ctx: TraceContext, cp: ConfidenceCheckpoint): void {
    ctx.checkpoints.push(cp);
  }

  addAssumption(ctx: TraceContext, a: Assumption): void {
    ctx.assumptions.push(a);
  }

  addUncertainty(ctx: TraceContext, u: UncertaintyFactor): void {
    ctx.uncertainties.push(u);
  }

  addAlternative(ctx: TraceContext, alt: AlternativeHypothesis): void {
    ctx.alternatives.push(alt);
  }

  // ── يُنهي بناء الـ trace ──────────────────────────────────

  finalize(ctx: TraceContext, dataInventory: DataInventory): DecisionTrace {
    // رتّب العوامل حسب التأثير
    const ranked = [...ctx.influences].sort((a, b) => b.magnitude - a.magnitude);
    ranked.forEach((f, i) => f.rank = i + 1);

    return {
      trace_id:              ctx.trace_id,
      prediction_id:         ctx.prediction_id,
      project_id:            ctx.project_id,
      prediction_type:       ctx.prediction_type,
      produced_at:           ctx.produced_at,
      architecture_version:  '5.0',
      data_inventory:        dataInventory,
      reasoning_chain:       ctx.steps,
      influence_ranking:     ranked,
      confidence_journey:    ctx.checkpoints,
      assumptions:           ctx.assumptions,
      uncertainty_profile:   ctx.uncertainties,
      alternatives_considered: ctx.alternatives,
      narrative:             NarrativeGenerator.generate(ctx, dataInventory),
    };
  }
}
```

---

## 6. NarrativeGenerator — يُحوّل الـ Trace إلى عربي مفهوم

```typescript
export class NarrativeGenerator {

  static generate(ctx: TraceContext, data: DataInventory): DecisionTrace['narrative'] {

    return {
      executive_summary_ar: this.buildExecutiveSummary(ctx, data),
      technical_summary_ar: this.buildTechnicalSummary(ctx, data),
      key_evidence_ar:      this.buildKeyEvidence(ctx),
      key_limitations_ar:   this.buildKeyLimitations(ctx, data),
      confidence_label_ar:  this.confidenceLabel(ctx),
    };
  }

  private static buildExecutiveSummary(ctx: TraceContext, data: DataInventory): string {
    const lastConfidence = ctx.checkpoints[ctx.checkpoints.length-1]?.confidence_after ?? 0;
    const confLabel      = lastConfidence > 0.75 ? 'عالية' : lastConfidence > 0.50 ? 'متوسطة' : 'منخفضة';
    const daysAnalyzed   = daysBetween(data.date_range.from, data.date_range.to);
    const usedPct        = Math.round((data.scenes_used / data.total_scenes_available) * 100);

    // بناء جملة موحّدة قابلة للفهم دون خلفية تقنية
    const lines = [
      `درسنا هذا الموقع بالأقمار الاصطناعية خلال ${daysAnalyzed} يوماً` +
        ` باستخدام ${data.scenes_used} مشهداً صالحاً من أصل ${data.total_scenes_available} متاحاً (${usedPct}%).`,
    ];

    // إضافة جملة عن الاستنتاج الرئيسي
    const criticalStep = ctx.steps.find(s => s.is_critical);
    if (criticalStep) {
      lines.push(criticalStep.conclusion_ar);
    }

    // الثقة والتوصية
    lines.push(
      `مستوى الثقة في هذا التقدير: ${confLabel}.` +
      (lastConfidence < 0.60
        ? ' نوصي بالتحقق الميداني قبل اتخاذ قرارات استناداً لهذه الأرقام.'
        : ' يمكن الاستناد لهذا التقدير مع الأخذ بالهامش المذكور.')
    );

    return lines.join(' ');
  }

  private static buildKeyEvidence(ctx: TraceContext): string[] {
    // أبرز 5 عوامل داعمة من InfluenceRanking
    return ctx.influences
      .filter(f => f.type === 'supporting')
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5)
      .map(f => `${f.name_ar}: ${f.explanation_ar}`);
  }

  private static buildKeyLimitations(ctx: TraceContext, data: DataInventory): string[] {
    const limitations: string[] = [];

    // 1. جودة البيانات
    if (data.data_quality_overall === 'low') {
      limitations.push(data.data_quality_notes_ar);
    }

    // 2. الافتراضات عالية الأثر
    ctx.assumptions
      .filter(a => a.confidence_in_assumption < 0.6)
      .forEach(a => limitations.push(`افتراض غير مؤكد: ${a.assumption_ar} — ${a.impact_if_wrong_ar}`));

    // 3. عدم اليقين العالي
    ctx.uncertainties
      .filter(u => u.magnitude === 'high')
      .forEach(u => limitations.push(u.source_ar + ' — ' + u.impact_ar));

    return limitations.slice(0, 4);
  }

  private static confidenceLabel(ctx: TraceContext): string {
    const last = ctx.checkpoints[ctx.checkpoints.length-1]?.confidence_after ?? 0;
    if (last >= 0.80) return 'عالية';
    if (last >= 0.60) return 'متوسطة-عالية';
    if (last >= 0.40) return 'متوسطة';
    if (last >= 0.25) return 'منخفضة-متوسطة';
    return 'منخفضة';
  }
}
```

---

## 7. كيف تُضيف كل طبقة للـ Trace

### 7.1 Signal Abstraction Layer (PlanetAdapter)

```typescript
// في PlanetAdapter::adapt()
ctx.addStep(trace, {
  layer:    'signal',
  component: 'PlanetAdapter',
  question_ar: 'ما طبيعة السطح في هذا المشهد؟',
  observation_ar: `مشهد بتاريخ ${scene.acquisition_date}: ` +
    `انعكاسية متوسطة ${reflectance.mean.toFixed(2)}, ` +
    `اضطراب نباتي ${vegProxy.toFixed(2)}, ` +
    `خشونة سطح ${roughness.toFixed(2)}`,
  conclusion_ar: `السطح يُظهر ${builtFrac > 0.5 ? 'بنية مبنية ظاهرة' : 'تربة مكشوفة غالباً'}`,
  confidence: quality.quality_score,
  evidence_refs: [signal_id],
  is_critical: false,
});

ctx.addConfidenceCheckpoint(trace, {
  layer:             'signal',
  checkpoint_ar:     `معالجة مشهد ${scene.acquisition_date}`,
  confidence_before: 0,
  confidence_after:  quality.quality_score,
  delta:             quality.quality_score,
  reason_ar:         `جودة المشهد ${(quality.quality_score*100).toFixed(0)}% — ` +
    (quality.rejection_reason ?? 'مشهد نظيف'),
});
```

---

### 7.2 SVQE Validators

```typescript
// بعد كل ValidationFinding
ctx.addConfidenceCheckpoint(trace, {
  layer:             'svqe',
  checkpoint_ar:     `تحقق: ${finding.validator_name}`,
  confidence_before: currentConfidence,
  confidence_after:  currentConfidence + finding.confidence_impact,
  delta:             finding.confidence_impact,
  reason_ar:         finding.description_ar,
});

if (finding.confidence_impact < -0.1) {
  ctx.addUncertainty(trace, {
    source_ar:          finding.description_ar,
    impact_ar:          `خُفّضت الثقة بـ ${(-finding.confidence_impact*100).toFixed(0)}%`,
    magnitude:          finding.confidence_impact < -0.3 ? 'high' : 'medium',
    would_resolve_if_ar: `بيانات أوضح أو مصدر إشارة مختلف`,
    is_reducible:       true,
  });
}
```

---

### 7.3 Feature Layer (ConstructionDisturbanceFeature)

```typescript
// في extract()
const topEvidence = evidence.sort((a,b) => b.confidence - a.confidence).slice(0, 3);

ctx.addStep(trace, {
  layer:    'feature',
  component: 'ConstructionDisturbanceFeature',
  question_ar: 'هل يوجد نشاط إنشائي في هذا المشهد؟',
  observation_ar: topEvidence.map(e =>
    `${e.signal} = ${e.value.toFixed(2)} (${e.type === 'supporting' ? 'دليل داعم' : 'دليل مضاد'})`
  ).join('; '),
  conclusion_ar: `اضطراب إنشائي: ${(featureValue*100).toFixed(0)}% ` +
    `(${evidence.filter(e=>e.type==='supporting').length} دليل داعم, ` +
    `${evidence.filter(e=>e.type==='contradicting').length} دليل مضاد)`,
  confidence: featureConfidence,
  evidence_refs: evidence.map(e => e.scene_id),
  is_critical: featureValue > 0.5,
});

ctx.addInfluence(trace, {
  name_ar:        'اضطراب السطح الإنشائي',
  type:           featureValue > 0.5 ? 'supporting' : 'reducing',
  magnitude:      featureValue,
  value_used:     featureValue,
  signal_type:    'SURFACE_REFLECTANCE + VEGETATION_ACTIVITY',
  explanation_ar: featureValue > 0.7
    ? 'تغيرات واضحة في سطح الموقع تُشير لأعمال إنشائية نشطة'
    : featureValue > 0.3
      ? 'تغيرات معتدلة — إنشاء بوتيرة متراجعة أو مرحلة تشطيب'
      : 'تغيرات ضعيفة — الموقع هادئ أو أعمال غير مرئية',
});

if (result.missing_data.length > 0) {
  result.missing_data.forEach(missing => {
    ctx.addUncertainty(trace, {
      source_ar:          `إشارة غير متاحة: ${missing}`,
      impact_ar:          'يحدّ من دقة تقييم النشاط',
      magnitude:          'medium',
      would_resolve_if_ar: `توفر صور Sentinel-2 أو SAR لهذه المنطقة`,
      is_reducible:       true,
    });
  });
}
```

---

### 7.4 Progress Model (RoadProgressModel)

```typescript
// في estimate()

// توثيق المنطق خطوة بخطوة
ctx.addStep(trace, {
  layer:    'reasoning',
  component: 'RoadProgressModel',
  question_ar: 'ما نسبة إنجاز مشروع الطريق؟',
  observation_ar: `${asphalt_sections.length} من ${totalSections} قطاعاً تُظهر علامات رصف مكتمل` +
    ` | نشاط في ${activeDays} يوماً من أصل ${totalDays} يوم`,
  conclusion_ar: `تقدير الإنجاز: ${progress_pct}% بناءً على نسبة الرصف المُنجَّز`,
  confidence: estimate.confidence,
  evidence_refs: [],
  is_critical: true,
});

ctx.addAssumption(trace, {
  assumption_ar: 'نفترض أن الطريق يتقدم بشكل خطي من نقطة البداية نحو النهاية',
  basis_ar:      'النمط الأكثر شيوعاً في مشاريع الطرق الليبية المرصودة',
  impact_if_wrong_ar: 'إذا كان الإنشاء يحدث في نقاط متفرقة، فإن قياسنا غير دقيق',
  confidence_in_assumption: 0.72,
  is_verifiable: true,
});

// توثيق البدائل
ctx.addAlternative(trace, {
  hypothesis_ar:   'المشروع مُنجَز أكثر مما نُقدّر بسبب أعمال تحت الأرض',
  probability:     0.15,
  why_rejected_ar: 'أعمال البنية التحتية لا تُشكّل تغييراً مرئياً في صور الأقمار',
  evidence_against_ar: 'لا تغيير في سطح الطريق في 30% من المقاطع',
});
```

---

### 7.5 Health Engine

```typescript
// في computeHealthScore()

// توثيق كل مكوّن من الصحة
for (const [key, weight] of Object.entries(config.weights)) {
  const score = scores[key];
  ctx.addInfluence(trace, {
    name_ar:    HEALTH_COMPONENT_LABELS_AR[key],
    type:       score >= 0.5 ? 'supporting' : 'reducing',
    magnitude:  Math.abs(score - 0.5) * weight * 2,
    value_used: score,
    explanation_ar: this.explainHealthComponent(key, score),
  });
}

ctx.addStep(trace, {
  layer:    'reasoning',
  component: 'HealthEngine',
  question_ar: 'ما صحة المشروع الإجمالية؟',
  observation_ar: Object.entries(scores)
    .map(([k, v]) => `${HEALTH_COMPONENT_LABELS_AR[k]}: ${(v*100).toFixed(0)}%`)
    .join(' | '),
  conclusion_ar: `الصحة الإجمالية: ${healthScore}/100 — ` +
    this.interpretHealthScore(healthScore),
  confidence: 0.75,
  evidence_refs: [],
  is_critical: true,
});

const HEALTH_COMPONENT_LABELS_AR: Record<string, string> = {
  progress_vs_expected:    'التقدم مقارنة بالخطة',
  construction_velocity:   'سرعة العمل الأخيرة (30 يوم)',
  interruption_severity:   'شدة التوقفات',
  evidence_completeness:   'اكتمال البيانات',
  data_recency:            'حداثة آخر رصد',
  activity_consistency:    'انتظام النشاط',
};
```

---

## 8. ExplainabilityAuditor — يتحقق من اكتمال الشرح

```typescript
/**
 * قبل إرسال أي قرار للمستخدم، يتحقق من اكتمال شرحه.
 * إذا كان القرار لا يُشرح نفسه → لا يُرسَل.
 */
export class ExplainabilityAuditor {

  audit(trace: DecisionTrace): AuditResult {

    const issues: AuditIssue[] = [];

    // 1. هل توجد خطوة تفسيرية لكل طبقة؟
    const requiredLayers = ['signal', 'feature', 'reasoning'];
    for (const layer of requiredLayers) {
      if (!trace.reasoning_chain.some(s => s.layer === layer)) {
        issues.push({
          severity: 'error',
          issue_ar: `الطبقة "${layer}" لم تُسجّل أي خطوة تفسيرية`,
          resolution_ar: `أضف TraceBuilder.addStep() في ${layer} layer`,
        });
      }
    }

    // 2. هل هناك على الأقل خطوة محورية واحدة (is_critical)?
    if (!trace.reasoning_chain.some(s => s.is_critical)) {
      issues.push({
        severity: 'error',
        issue_ar: 'لا توجد خطوة محورية مُحدَّدة في سلسلة المنطق',
        resolution_ar: 'حدد is_critical=true للخطوة الأكثر تأثيراً',
      });
    }

    // 3. هل الملخص العربي غير فارغ؟
    if (!trace.narrative.executive_summary_ar || trace.narrative.executive_summary_ar.length < 50) {
      issues.push({
        severity: 'error',
        issue_ar: 'الملخص التنفيذي فارغ أو قصير جداً',
        resolution_ar: 'يجب أن يشرح الملخص القرار بجملتين على الأقل',
      });
    }

    // 4. هل كل الافتراضات موثقة؟
    if (trace.assumptions.length === 0) {
      issues.push({
        severity: 'warning',
        issue_ar: 'لا توجد افتراضات موثقة — كل نموذج يحتاج افتراضات',
        resolution_ar: 'وثّق على الأقل افتراضاً واحداً في ProgressModel',
      });
    }

    // 5. هل رحلة الثقة منطقية؟
    const firstConf = trace.confidence_journey[0]?.confidence_before ?? 0;
    const lastConf  = trace.confidence_journey[trace.confidence_journey.length-1]?.confidence_after ?? 0;
    if (lastConf === firstConf && trace.confidence_journey.length > 3) {
      issues.push({
        severity: 'warning',
        issue_ar: 'رحلة الثقة ثابتة رغم وجود نقاط تحقق متعددة — يبدو أن التحديث لا يعمل',
        resolution_ar: 'تحقق من حسابات delta في ConfidenceCheckpoint',
      });
    }

    // 6. هل عوامل التأثير مُسجَّلة؟
    if (trace.influence_ranking.length === 0) {
      issues.push({
        severity: 'error',
        issue_ar: 'لا توجد عوامل تأثير مُسجَّلة — المستخدم لن يفهم لماذا هذا الرقم',
        resolution_ar: 'أضف TraceBuilder.addInfluence() في Feature وReasoning layers',
      });
    }

    const is_complete = !issues.some(i => i.severity === 'error');

    return {
      is_complete,
      issues,
      completeness_score: this.computeCompleteness(trace, issues),
      can_publish:        is_complete,
      audit_summary_ar:   is_complete
        ? `القرار موثَّق بالكامل ويمكن نشره (${trace.reasoning_chain.length} خطوة، ${trace.assumptions.length} افتراض)`
        : `القرار غير مكتمل التوثيق — ${issues.filter(i=>i.severity==='error').length} مشكلة حرجة`,
    };
  }
}
```

---

## 9. هيكل قاعدة البيانات

```sql
-- ═══════════════════════════════════════════════════════════
-- جدول الـ Traces — يُرفَق مع كل توقع
-- ═══════════════════════════════════════════════════════════

CREATE TABLE minerva_explainability.decision_traces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id    UUID REFERENCES minerva_learning.prediction_ledger(id),
  project_id       UUID REFERENCES pic.projects(id),
  prediction_type  TEXT NOT NULL,
  produced_at      TIMESTAMPTZ NOT NULL,
  architecture_version TEXT NOT NULL,

  -- الأجزاء الكاملة (كائنات JSON)
  data_inventory         JSONB NOT NULL,
  reasoning_chain        JSONB NOT NULL,  -- ReasoningStep[]
  influence_ranking      JSONB NOT NULL,  -- InfluenceFactor[]
  confidence_journey     JSONB NOT NULL,  -- ConfidenceCheckpoint[]
  assumptions            JSONB NOT NULL,  -- Assumption[]
  uncertainty_profile    JSONB NOT NULL,  -- UncertaintyFactor[]
  alternatives_considered JSONB NOT NULL,  -- AlternativeHypothesis[]

  -- الملخصات النصية (للعرض السريع)
  executive_summary_ar   TEXT NOT NULL,
  technical_summary_ar   TEXT NOT NULL,
  key_evidence_ar        TEXT[],
  key_limitations_ar     TEXT[],
  confidence_label_ar    TEXT NOT NULL,

  -- جودة الشرح
  audit_passed           BOOLEAN NOT NULL,
  audit_issues           JSONB,
  completeness_score     NUMERIC(4,3),

  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON minerva_explainability.decision_traces (prediction_id);
CREATE INDEX ON minerva_explainability.decision_traces (project_id, produced_at DESC);
CREATE INDEX ON minerva_explainability.decision_traces (prediction_type, audit_passed);

-- ضمان: لا توقع بدون trace
ALTER TABLE minerva_learning.prediction_ledger
  ADD COLUMN trace_id UUID REFERENCES minerva_explainability.decision_traces(id);

-- Function: اجلب الشرح الكامل لتقدير معين
CREATE OR REPLACE FUNCTION minerva_explainability.get_explanation(pred_id UUID)
RETURNS TABLE(
  prediction_type TEXT, predicted_value NUMERIC, predicted_at TIMESTAMPTZ,
  executive_summary_ar TEXT, technical_summary_ar TEXT,
  key_evidence TEXT[], key_limitations TEXT[], confidence_label TEXT,
  full_trace JSONB
) AS $$
  SELECT
    p.prediction_type, p.predicted_value, p.predicted_at,
    t.executive_summary_ar, t.technical_summary_ar,
    t.key_evidence_ar, t.key_limitations_ar, t.confidence_label_ar,
    row_to_json(t)::jsonb
  FROM minerva_learning.prediction_ledger p
  JOIN minerva_explainability.decision_traces t ON t.prediction_id = p.id
  WHERE p.id = pred_id;
$$ LANGUAGE sql STABLE;
```

---

## 10. API Endpoints للشفافية

```typescript
/**
 * GET /api/v1/pic/projects/[id]/explanations
 *   → قائمة كل التقارير المُولَّدة للمشروع مع الملخص العربي
 *
 * GET /api/v1/pic/projects/[id]/predictions/[pred_id]/trace
 *   → الـ trace الكاملة لتقدير معين
 *   ?format=executive → ملخص للمدير فقط
 *   ?format=technical → ملخص تقني
 *   ?format=full      → كامل مع الـ JSON
 *
 * GET /api/v1/pic/projects/[id]/audit-trail
 *   → سجل كامل بكل القرارات والشرح منذ إنشاء المشروع
 *
 * POST /api/v1/pic/learning/ground-truth
 *   → (موجود من v4.0) + أضف: يُرجع الـ trace المُصحَّح
 *   Response: { ground_truth_id, prediction_was_incorrect, explanation_of_error_ar }
 */
```

---

## 11. تكامل الشرح في PICShell

```typescript
// في ProjectDetailPanel — قسم "لماذا هذا الرقم؟"

{projectDetail?.trace && (
  <div className="px-4 py-3 border-b border-slate-800">
    <button
      onClick={() => setShowTrace(!showTrace)}
      className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-indigo-400"
    >
      <span>💡</span>
      <span>لماذا {project.progress_pct}%؟</span>
      <ChevronDown size={10} className={showTrace ? 'rotate-180' : ''} />
    </button>

    {showTrace && (
      <div className="mt-3 space-y-2">

        {/* الملخص التنفيذي */}
        <div className="bg-indigo-900/10 border border-indigo-700/30 rounded-lg px-3 py-2">
          <p className="text-[11px] text-indigo-300 leading-relaxed">
            {projectDetail.trace.narrative.executive_summary_ar}
          </p>
        </div>

        {/* أبرز الأدلة */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-500">الأدلة الرئيسية:</p>
          {projectDetail.trace.narrative.key_evidence_ar.slice(0, 3).map((ev, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] text-slate-400">
              <span className="text-green-400 shrink-0">✓</span>
              <span>{ev}</span>
            </div>
          ))}
        </div>

        {/* القيود */}
        {projectDetail.trace.narrative.key_limitations_ar.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500">قيود وتحفظات:</p>
            {projectDetail.trace.narrative.key_limitations_ar.map((lim, i) => (
              <div key={i} className="flex gap-1.5 text-[10px] text-slate-400">
                <span className="text-amber-400 shrink-0">⚠</span>
                <span>{lim}</span>
              </div>
            ))}
          </div>
        )}

        {/* رابط للتقرير الكامل */}
        <button className="text-[10px] text-indigo-400 underline mt-1">
          عرض سلسلة المنطق الكاملة →
        </button>
      </div>
    )}
  </div>
)}
```

---

## 12. مراجعة المكونات التي لا تزال غير قابلة للشرح

بعد هذا التصميم، تبقى مكوّنات يجب معالجتها قبل التنفيذ:

| المكوّن | المشكلة | الحل |
|---------|---------|------|
| `compareImages()` | مقارنة bytes — لا شرح فيزيائي | محذوف — تُستبدل بـ PlanetAdapter |
| `classifyActivity()` | threshold 0.20 بلا مبرر | تُستبدل بـ ConstructionDisturbanceFeature |
| Health formula قديمة | أوزان مُضمَّنة بلا مبرر | تُستبدل بـ HealthEngine + HealthConfig |
| Trend (3 vs 3) | اختيار عشوائي | تُستبدل بـ RollingWindowAnalyzer |

**أي كود يبقى من هذه المكونات لا يمكنه المرور بـ ExplainabilityAuditor → لا يُنشر.**

---

## 13. القاعدة النهائية

```
قبل نشر أي تقدير أو تنبيه أو تقرير، يجب اجتياز هذا الاختبار:

1. هل يمكن لمهندس غير مبرمج قراءة الملخص والفهم؟       →  ✓ أو لا يُنشر
2. هل يمكن لمهندس أول تتبع كل رقم لمصدره؟             →  ✓ أو لا يُنشر
3. هل يمكن بعد 3 سنوات معرفة لماذا صدر هذا القرار؟    →  ✓ أو لا يُنشر
4. هل الافتراضات مكتوبة صراحةً؟                        →  ✓ أو لا يُنشر
5. هل عدم اليقين موثق بصدق؟                            →  ✓ أو لا يُنشر
```

> **المعيار الحقيقي للشفافية: القرار يجب أن يشرح نفسه حتى بعد رحيل مَن بناه.**

---

*هذه الوثيقة تُكمل خماسية التصميم:*  
*1. PIC-Architecture-Review — نقد الحاضر*  
*2. MINERVA-Signal-Abstraction — فصل المزودين*  
*3. MINERVA-Signal-Validation — الثقة في الإشارات*  
*4. MINERVA-Learning-Feedback — التعلم من التجربة*  
*5. هذه الوثيقة — الشفافية الكاملة*
