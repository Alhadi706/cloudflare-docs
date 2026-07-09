# MINERVA — Evidence Sufficiency & Stability Guarantee
## Verification and Redesign of the Learning Architecture

**التاريخ**: 2026-07-09  
**الإصدار**: 4.1 — Stability-First Learning  
**يُعدِّل**: MINERVA-Learning-Feedback-Architecture.md  
**الحالة**: مراجعة نقدية + إعادة تصميم معتمدة

---

## الحكم الافتتاحي

> **الاستقرار لا يعني الجمود. يعني أن التغيير مُبرَّر، موثَّق، وتدريجي.**

المعمارية السابقة صحيحة في اتجاهها.  
لكن التدقيق الدقيق يكشف **ثغرات محددة** تُتيح للنظام أن يتعلم من أدلة غير كافية.  
هذه الوثيقة تُحدد كل ثغرة بالسطر، وتُقدم الحل الصحيح.

---

## 1. التدقيق في المعمارية الحالية

### 1.1 المتطلبات الستة — نتيجة التدقيق

| المتطلب | الحالة | السطر الإشكالي | الحكم |
|---------|--------|---------------|-------|
| تصحيح واحد لا يُغيّر السلوك | ⚠️ جزئي | 660 | النمط يُنشأ بـ 2 أخطاء فقط |
| مطلوب تكرار قبل أي اقتراح | ⚠️ ضعيف | 657 | الاقتراح عند 5 أخطاء — غير كافٍ إحصائياً |
| كل تغيير مدعوم بأدلة كافية | ❌ مفقود | 721 | الثقة 90% عند 5 أخطاء فقط — خوارزمية بلا أساس |
| كل تغيير يحتاج موافقة بشرية | ✅ موجود | — | صحيح |
| كل تغيير قابل للإلغاء | ✅ موجود | — | صحيح |
| كل تغيير قابل للقياس بعد التطبيق | ✅ موجود | — | صحيح |

**النتيجة: ثلاثة من المتطلبات الستة يحتاج تصحيحاً.**

---

### 1.2 تفصيل الثغرات

#### الثغرة 1 — نمط من خطأين (السطر 660)

```typescript
// الكود الحالي — ثغرة
} else if (cluster.errors.length >= 2) {
  newPatterns.push(this.createPattern(cluster));
}
```

**المشكلة**:  
خطآن من مهندس واحد على مشروع واحد في يوم واحد يُنشئان نمطاً رسمياً.  
النمط بمجرد وجوده يدخل دورة المعايرة.  
**خطآن لا يُثبتان أي شيء إحصائياً.**

---

#### الثغرة 2 — اقتراح معايرة عند 5 أخطاء (السطر 657)

```typescript
// الكود الحالي — ثغرة
if (matching.occurrence_count >= 5 && matching.status === 'active') {
  maturedPatterns.push(matching);
}
```

**المشكلة**:  
5 أخطاء لا تكفي لأي استنتاج إحصائي موثوق.  
بدون شرط تنوع المصدر: 5 أخطاء من مهندس واحد = 5 أخطاء من 5 مهندسين مختلفين.  
بدون شرط التنوع الزمني: 5 أخطاء في ساعة = 5 أخطاء على مدى سنة.  
بدون شرط تنوع المشاريع: 5 أخطاء في مشروع واحد قد تعكس خاصية فريدة لذلك المشروع لا خللاً في النموذج.

---

#### الثغرة 3 — حساب الثقة بلا أساس إحصائي (السطر 721)

```typescript
// الكود الحالي — ثغرة خطيرة
proposal.evidence_confidence = Math.min(0.9, 0.5 + pattern.occurrence_count * 0.08);
```

**التحليل**:

| عدد الأخطاء | الثقة المُحسوبة | الحقيقة الإحصائية |
|-------------|----------------|-------------------|
| 5  | **0.90** | لا يكفي حتى لاختبار t بسيط |
| 10 | 0.90 (مقيّدة) | حد أدنى لأي استنتاج |
| 20 | 0.90 (مقيّدة) | مقبول بشروط |
| 30 | 0.90 (مقيّدة) | موثوق مع تنوع كافٍ |

**الصيغة الحالية تعطي ثقة 90% عند 5 أخطاء فقط.** هذا مستحيل علمياً.

---

#### الثغرة 4 — غياب شرط تنوع المشاريع

لا يوجد في الكود الحالي أي فحص لعدد المشاريع المختلفة التي جاءت منها الأخطاء.  
سيناريو المشكلة: مشروع واحد معقد (مستشفى كبير) يُنتج 10 تصحيحات — فيُشغّل معايرة تؤثر على جميع مشاريع المباني.

---

#### الثغرة 5 — غياب شرط التنوع الزمني

لا يوجد فحص للفترة الزمنية الفاصلة بين أول وآخر خطأ في النمط.  
سيناريو المشكلة: مهندس يُدخل 10 تصحيحات في جلسة واحدة → يُشغّل معايرة فورية.

---

#### الثغرة 6 — غياب حجم الأثر الأدنى (Minimum Effect Size)

لا يوجد شرط على حجم الخطأ الوسطي قبل الاقتراح.  
سيناريو المشكلة: خطأ وسطي 2% على 10 مشاريع → يُقترح تعديل النموذج.  
2% خطأ أقل من دقة أي قياس ميداني — لا يستحق التدخل.

---

#### الثغرة 7 — غياب شرط تنوع المراجعين

لا يوجد فحص لعدد المراجعين المختلفين الذين قدموا التصحيحات.  
سيناريو المشكلة: مهندس واحد (ربما متحيز أو مخطئ) يُقدم 15 تصحيحاً → يُشغّل معايرة كاملة.

---

## 2. نموذج كفاءة الأدلة (Evidence Sufficiency Model)

**المبدأ**: قبل أن يُقترح أي تعديل، يجب أن تنجح الأدلة في **خمسة بوابات إلزامية**.  
فشل أي بوابة واحدة = عدم الاقتراح، بغض النظر عن باقي البوابات.

```
Evidence Collection
      │
      ▼
╔═════════════════════════════════════════════════════════╗
║  GATE 1: MINIMUM VOLUME                                 ║
║  هل عدد الأخطاء كافٍ؟                                 ║
║  Low Impact:  n ≥ 10                                    ║
║  Med Impact:  n ≥ 20                                    ║
║  High Impact: n ≥ 30                                    ║
╚═════════════════════════╤═══════════════════════════════╝
         FAIL ← ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                          │ PASS
                          ▼
╔═════════════════════════════════════════════════════════╗
║  GATE 2: PROJECT DIVERSITY                              ║
║  هل الأخطاء من مشاريع مختلفة؟                         ║
║  distinct_projects ≥ max(3, n/4)                        ║
╚═════════════════════════╤═══════════════════════════════╝
         FAIL ← ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                          │ PASS
                          ▼
╔═════════════════════════════════════════════════════════╗
║  GATE 3: TEMPORAL SPREAD                                ║
║  هل الأخطاء موزعة على فترة كافية؟                     ║
║  date_span ≥ 21 days                                    ║
║  no single 3-day window contains > 40% of errors        ║
╚═════════════════════════╤═══════════════════════════════╝
         FAIL ← ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                          │ PASS
                          ▼
╔═════════════════════════════════════════════════════════╗
║  GATE 4: EFFECT SIZE                                    ║
║  هل حجم الخطأ يستحق التدخل؟                           ║
║  PROGRESS_PCT:      mean_error ≥ 8%                     ║
║  HEALTH_SCORE:      mean_error ≥ 10 points              ║
║  PHASE:             misclassification_rate ≥ 25%        ║
║  SIGNAL_CONFIDENCE: mean_bias ≥ 0.12                    ║
╚═════════════════════════╤═══════════════════════════════╝
         FAIL ← ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                          │ PASS
                          ▼
╔═════════════════════════════════════════════════════════╗
║  GATE 5: STATISTICAL CONSISTENCY                        ║
║  هل الخطأ منهجي وليس عشوائياً؟                        ║
║  directional_consistency ≥ 70% (same direction)         ║
║  |mean| / std ≥ 1.5  (signal-to-noise ratio)           ║
║  source_diversity: no single reviewer > 35%             ║
╚═════════════════════════╤═══════════════════════════════╝
         FAIL ← ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                          │ ALL FIVE GATES PASSED
                          ▼
                  CalibrationProposal
                  (requires human approval)
```

---

## 3. المتطلبات الكمية المُعدَّلة

### 3.1 الحد الأدنى لكل نوع قاعدة

```typescript
export const EVIDENCE_THRESHOLDS = {

  // عدد الأخطاء الأدنى قبل الاقتراح
  MIN_ERRORS: {
    SIGNAL_CONFIDENCE_ADJUSTMENT:    10,  // تعديل ثقة الإشارة
    PROGRESS_MODEL_BIAS_CORRECTION:  10,  // تصحيح تحيز التقدم
    PHASE_TIMING_ADJUSTMENT:         15,  // تعديل توقيت المراحل
    SVQE_THRESHOLD_ADJUSTMENT:       20,  // تعديل عتبات التحقق ← تأثير أوسع
    ALERT_THRESHOLD_ADJUSTMENT:      20,  // تعديل عتبات التنبيه ← تأثير أوسع
    SEASONAL_PROFILE_OVERRIDE:       25,  // تجاوز الملف الموسمي ← تأثير عميق
    TEMPORAL_WINDOW_ADJUSTMENT:      30,  // تعديل النوافذ الزمنية ← تأثير جذري
  },

  // الحد الأدنى لعدد المشاريع المختلفة
  MIN_DISTINCT_PROJECTS: {
    default: 3,
    formula: (n: number) => Math.max(3, Math.floor(n / 4)),
    // 10 أخطاء → 3 مشاريع مختلفة على الأقل
    // 20 أخطاء → 5 مشاريع مختلفة على الأقل
    // 40 أخطاء → 10 مشاريع مختلفة على الأقل
  },

  // الانتشار الزمني الأدنى
  MIN_DATE_SPAN_DAYS: 21,
  MAX_BURST_FRACTION: 0.40,  // لا يزيد 40% من الأخطاء في أي نافذة 3 أيام

  // حجم الأثر الأدنى (تحت هذا لا يستحق التدخل)
  MIN_EFFECT_SIZE: {
    PROGRESS_PCT:       8,    // 8% خطأ وسطي
    HEALTH_SCORE:       10,   // 10 نقطة خطأ وسطي
    PHASE_ACCURACY:     0.25, // 25% معدل خطأ في التصنيف
    SIGNAL_CONFIDENCE:  0.12, // 0.12 تحيز وسطي في الثقة
    THRESHOLD:          0.10, // 10% تغيير في العتبة
  },

  // معدل الاتساق الاتجاهي
  MIN_DIRECTIONAL_CONSISTENCY: 0.70,  // 70% من الأخطاء في نفس الاتجاه

  // نسبة الإشارة إلى الضوضاء
  MIN_SIGNAL_TO_NOISE: 1.5,  // |mean| / std ≥ 1.5

  // تنوع المراجعين
  MAX_SINGLE_REVIEWER_FRACTION: 0.35,  // لا يزيد مراجع واحد عن 35%

} as const;
```

---

### 3.2 حساب الثقة المُعاد تصميمه

```typescript
/**
 * الصيغة القديمة: Math.min(0.9, 0.5 + n * 0.08)
 * المشكلة: تصل 0.9 عند n=5
 *
 * الصيغة الجديدة: مستوحاة من الإحصاء، تأخذ بالاعتبار:
 * 1. حجم العينة (n)
 * 2. الاتساق الاتجاهي
 * 3. نسبة الإشارة/الضوضاء
 * 4. تنوع المصادر
 */
export function computeEvidenceConfidence(stats: PatternStatistics): number {

  // 1. مكوّن حجم العينة — يتشبع ببطء
  // عند n=10 → 0.50 | n=20 → 0.67 | n=30 → 0.75 | n=50 → 0.83 | n=100 → 0.91
  const sampleFactor = stats.n / (stats.n + 10);

  // 2. مكوّن الاتساق — كيف منهجي الخطأ؟
  // directional_consistency: 0.7 → 0.0 | 0.85 → 0.5 | 1.0 → 1.0
  const consistencyFactor = Math.max(0,
    (stats.directional_consistency - 0.70) / 0.30
  );

  // 3. مكوّن الإشارة/الضوضاء
  // snr = 1.5 → 0.0 | snr = 2.0 → 0.25 | snr = 3.0 → 0.50 | snr ≥ 4.0 → 1.0
  const snrFactor = Math.min(1, Math.max(0,
    (stats.signal_to_noise - 1.5) / 2.5
  ));

  // 4. مكوّن تنوع المصادر
  // كل المراجعين من نفس الجهة → 0.7 | توزيع جيد → 1.0
  const diversityFactor = Math.min(1, stats.reviewer_diversity_score);

  // التركيب المرجَّح
  const confidence = (
    sampleFactor     * 0.35 +
    consistencyFactor * 0.30 +
    snrFactor         * 0.25 +
    diversityFactor   * 0.10
  );

  return Math.round(confidence * 100) / 100;
}

/*
 مثال مقارن:
 ┌──────┬────────────────────┬────────────────────┐
 │  n   │ الصيغة القديمة     │ الصيغة الجديدة     │
 ├──────┼────────────────────┼────────────────────┤
 │   5  │ 0.90 ← خطأ فادح  │ غير مقبول (gate 1)│
 │  10  │ 0.90 ← مبالغة    │ 0.35–0.55 (واقعي) │
 │  20  │ 0.90 ← مبالغة    │ 0.50–0.70 (معقول) │
 │  30  │ 0.90 ← مبالغة    │ 0.60–0.78 (جيد)   │
 │  50  │ 0.90 ← مبالغة    │ 0.68–0.85 (موثوق) │
 │ 100  │ 0.90 ← مبالغة    │ 0.75–0.90 (قوي)   │
 └──────┴────────────────────┴────────────────────┘
*/
```

---

## 4. EvidenceSufficiencyGate — الحارس الإلزامي

```typescript
/**
 * كل كائن CalibrationProposal يجب أن يمر بهذا الحارس قبل الإنشاء.
 * إذا فشل أي gate → throw EvidenceInsufficientError
 * لا CalibrationProposer يُنشئ اقتراحاً بدون المرور هنا.
 */

export class EvidenceSufficiencyGate {

  assess(
    pattern:    ErrorPattern,
    errors:     ErrorRecord[],
    reviewers:  string[],
    rule_type:  string,
  ): EvidenceAssessment {

    const results: GateResult[] = [];

    // ═══════════════════════════════════════════════
    // GATE 1: Minimum Volume
    // ═══════════════════════════════════════════════
    const minRequired = EVIDENCE_THRESHOLDS.MIN_ERRORS[rule_type] ?? 10;
    results.push({
      gate:   'MINIMUM_VOLUME',
      passed: errors.length >= minRequired,
      value:  errors.length,
      required: minRequired,
      message_ar: errors.length >= minRequired
        ? `✓ حجم العينة كافٍ: ${errors.length} خطأ (الحد الأدنى: ${minRequired})`
        : `✗ حجم العينة غير كافٍ: ${errors.length} خطأ، مطلوب ${minRequired} على الأقل`,
    });

    // ═══════════════════════════════════════════════
    // GATE 2: Project Diversity
    // ═══════════════════════════════════════════════
    const distinctProjects = new Set(errors.map(e => e.project_id)).size;
    const requiredProjects  = EVIDENCE_THRESHOLDS.MIN_DISTINCT_PROJECTS.formula(errors.length);
    results.push({
      gate:   'PROJECT_DIVERSITY',
      passed: distinctProjects >= requiredProjects,
      value:  distinctProjects,
      required: requiredProjects,
      message_ar: distinctProjects >= requiredProjects
        ? `✓ تنوع المشاريع كافٍ: ${distinctProjects} مشروع مختلف`
        : `✗ جميع الأخطاء من ${distinctProjects} مشروع فقط. المطلوب: ${requiredProjects}+. ` +
          `قد تعكس خاصية فريدة لهذه المشاريع لا خللاً في النموذج.`,
    });

    // ═══════════════════════════════════════════════
    // GATE 3: Temporal Spread
    // ═══════════════════════════════════════════════
    const dates      = errors.map(e => new Date(e.created_at).getTime()).sort((a,b) => a-b);
    const spanDays   = (dates[dates.length-1] - dates[0]) / 86400_000;
    const burstCheck = this.checkBurstConcentration(dates);

    results.push({
      gate:   'TEMPORAL_SPREAD',
      passed: spanDays >= EVIDENCE_THRESHOLDS.MIN_DATE_SPAN_DAYS && !burstCheck.hasBurst,
      value:  spanDays,
      required: EVIDENCE_THRESHOLDS.MIN_DATE_SPAN_DAYS,
      burst_fraction: burstCheck.maxFraction,
      message_ar: spanDays < EVIDENCE_THRESHOLDS.MIN_DATE_SPAN_DAYS
        ? `✗ الأخطاء تتمركز في ${spanDays.toFixed(0)} يوم فقط. المطلوب: ${EVIDENCE_THRESHOLDS.MIN_DATE_SPAN_DAYS}+ يوم. ` +
          `الأخطاء المتقاربة زمنياً قد تعكس ظرفاً مؤقتاً لا نمطاً منهجياً.`
        : burstCheck.hasBurst
          ? `✗ ${(burstCheck.maxFraction*100).toFixed(0)}% من الأخطاء في نافذة 3 أيام. احتمال تحيز مؤقت.`
          : `✓ الأخطاء موزعة على ${spanDays.toFixed(0)} يوم`,
    });

    // ═══════════════════════════════════════════════
    // GATE 4: Effect Size
    // ═══════════════════════════════════════════════
    const effectSize    = pattern.mean_error_magnitude;
    const minEffect     = this.getMinEffectSize(pattern.conditions.prediction_type);
    results.push({
      gate:   'EFFECT_SIZE',
      passed: effectSize >= minEffect,
      value:  effectSize,
      required: minEffect,
      message_ar: effectSize >= minEffect
        ? `✓ حجم الأثر ${effectSize.toFixed(1)} يستحق التدخل (الحد: ${minEffect})`
        : `✗ حجم الأثر ${effectSize.toFixed(1)} أقل من الحد الأدنى ${minEffect}. ` +
          `خطأ بهذا الحجم أصغر من دقة القياس الميداني — التدخل لن يُحسّن النتائج.`,
    });

    // ═══════════════════════════════════════════════
    // GATE 5: Statistical Consistency
    // ═══════════════════════════════════════════════
    const errorValues  = errors.map(e => e.error_magnitude * (e.error_direction === 'overestimate' ? 1 : -1));
    const mean         = errorValues.reduce((s,v) => s+v, 0) / errorValues.length;
    const std          = Math.sqrt(errorValues.reduce((s,v) => s+(v-mean)**2, 0) / (errorValues.length-1));
    const snr          = std > 0 ? Math.abs(mean) / std : 0;
    const dirConsistency = errors.filter(e =>
      e.error_direction === pattern.conditions.error_direction
    ).length / errors.length;
    const maxReviewerFraction = this.computeMaxReviewerFraction(reviewers);

    const consistencyPassed = dirConsistency >= EVIDENCE_THRESHOLDS.MIN_DIRECTIONAL_CONSISTENCY
      && snr >= EVIDENCE_THRESHOLDS.MIN_SIGNAL_TO_NOISE
      && maxReviewerFraction <= EVIDENCE_THRESHOLDS.MAX_SINGLE_REVIEWER_FRACTION;

    results.push({
      gate:   'STATISTICAL_CONSISTENCY',
      passed: consistencyPassed,
      directional_consistency: dirConsistency,
      signal_to_noise: snr,
      max_reviewer_fraction: maxReviewerFraction,
      message_ar: !consistencyPassed
        ? [
            dirConsistency < EVIDENCE_THRESHOLDS.MIN_DIRECTIONAL_CONSISTENCY
              ? `✗ الاتساق الاتجاهي ${(dirConsistency*100).toFixed(0)}% < 70% — الخطأ غير منهجي` : null,
            snr < EVIDENCE_THRESHOLDS.MIN_SIGNAL_TO_NOISE
              ? `✗ نسبة الإشارة/الضوضاء ${snr.toFixed(2)} < 1.5 — الإشارة مدفونة بالضوضاء` : null,
            maxReviewerFraction > EVIDENCE_THRESHOLDS.MAX_SINGLE_REVIEWER_FRACTION
              ? `✗ ${(maxReviewerFraction*100).toFixed(0)}% من التصحيحات من مراجع واحد — احتمال تحيز شخصي` : null,
          ].filter(Boolean).join(' | ')
        : `✓ الخطأ منهجي ومتسق (SNR: ${snr.toFixed(2)}, اتساق: ${(dirConsistency*100).toFixed(0)}%)`,
    });

    // ═══════════════════════════════════════════════
    // الحكم النهائي
    // ═══════════════════════════════════════════════
    const allPassed    = results.every(r => r.passed);
    const failedGates  = results.filter(r => !r.passed);

    // حساب الثقة (فقط إذا نجحت كل البوابات)
    const confidence = allPassed ? computeEvidenceConfidence({
      n: errors.length,
      directional_consistency: dirConsistency,
      signal_to_noise: snr,
      reviewer_diversity_score: 1 - maxReviewerFraction,
    }) : 0;

    return {
      all_passed:    allPassed,
      failed_gates:  failedGates,
      gate_results:  results,
      confidence,
      can_propose:   allPassed && confidence >= 0.50,  // حد أدنى للثقة
      blocking_reason_ar: failedGates.map(f => f.message_ar).join('\n'),
    };
  }

  private checkBurstConcentration(sortedTimestamps: number[]): { hasBurst: boolean; maxFraction: number } {
    const windowMs = 3 * 86400_000;  // 3 أيام
    let maxFraction = 0;
    for (let i = 0; i < sortedTimestamps.length; i++) {
      const windowEnd   = sortedTimestamps[i] + windowMs;
      const inWindow    = sortedTimestamps.filter(t => t >= sortedTimestamps[i] && t <= windowEnd).length;
      const fraction    = inWindow / sortedTimestamps.length;
      if (fraction > maxFraction) maxFraction = fraction;
    }
    return { hasBurst: maxFraction > EVIDENCE_THRESHOLDS.MAX_BURST_FRACTION, maxFraction };
  }

  private computeMaxReviewerFraction(reviewers: string[]): number {
    const counts = new Map<string, number>();
    reviewers.forEach(r => counts.set(r, (counts.get(r) ?? 0) + 1));
    return Math.max(...Array.from(counts.values())) / reviewers.length;
  }

  private getMinEffectSize(prediction_type: string): number {
    const mapping: Record<string, number> = {
      'PROGRESS_PCT':       EVIDENCE_THRESHOLDS.MIN_EFFECT_SIZE.PROGRESS_PCT,
      'HEALTH_SCORE':       EVIDENCE_THRESHOLDS.MIN_EFFECT_SIZE.HEALTH_SCORE,
      'CONSTRUCTION_PHASE': EVIDENCE_THRESHOLDS.MIN_EFFECT_SIZE.PHASE_ACCURACY,
      'SIGNAL_VALIDITY':    EVIDENCE_THRESHOLDS.MIN_EFFECT_SIZE.SIGNAL_CONFIDENCE,
    };
    return mapping[prediction_type] ?? EVIDENCE_THRESHOLDS.MIN_EFFECT_SIZE.THRESHOLD;
  }
}
```

---

## 5. PatternDetector المُعاد تصميمه

```typescript
// ═══════════════════════════════════════════════════════════════
// الكود المُصحَّح — استبدل الكود الأصلي في الوثيقة السابقة
// ═══════════════════════════════════════════════════════════════

export class PatternDetector {

  private gate = new EvidenceSufficiencyGate();

  async detectPatterns(
    recentErrors:     ErrorRecord[],
    existingPatterns: ErrorPattern[],
  ): Promise<PatternDetectionResult> {

    const newPatterns:     ErrorPattern[]    = [];
    const updatedPatterns: ErrorPattern[]    = [];
    const maturedPatterns: CalibrationCandidate[] = [];  // وصلت لمعايير الاقتراح

    const clusters = this.clusterErrors(recentErrors);

    for (const cluster of clusters) {
      const matching = existingPatterns.find(p => this.matchesPattern(cluster, p));

      if (matching) {
        matching.occurrence_count     += cluster.errors.length;
        matching.last_seen_at          = new Date().toISOString();
        matching.mean_error_magnitude  = this.updateMean(matching, cluster);
        updatedPatterns.push(matching);

        // تحقق من كفاءة الأدلة قبل ترشيح للمعايرة
        const allErrors  = await this.loadAllPatternErrors(matching.id);
        const reviewers  = allErrors.map(e => e.analyzed_by ?? 'unknown');
        const assessment = this.gate.assess(matching, allErrors, reviewers, this.inferRuleType(matching));

        if (assessment.can_propose) {
          maturedPatterns.push({
            pattern:    matching,
            assessment,
            errors:     allErrors,
          });
        }
        // إذا فشلت البوابات، يُسجَّل السبب لكن لا يُقترح شيء
        else if (assessment.failed_gates.length > 0) {
          await this.logInsufficientEvidence(matching.id, assessment);
        }

      } else if (cluster.errors.length >= 3) {
        // نمط جديد — يحتاج 3 أخطاء كحد أدنى للتسجيل (ليس 2)
        // لكن لن يُقترح للمعايرة حتى تنجح كل البوابات الخمس
        newPatterns.push(this.createPattern(cluster));
      }
      // إذا cluster.errors.length < 3 → نتجاهله تماماً
    }

    return { newPatterns, updatedPatterns, maturedPatterns };
  }

  private clusterErrors(errors: ErrorRecord[]): ErrorCluster[] {
    const groups = new Map<string, ErrorRecord[]>();
    for (const error of errors) {
      const key = `${error.prediction_type}|${error.project_type}|${error.root_cause}|${error.error_direction}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(error);
    }
    return Array.from(groups.entries())
      .map(([key, errs]) => ({ key, errors: errs }))
      .filter(c => c.errors.length >= 3);  // ← تغيير من 2 إلى 3
  }
}
```

---

## 6. CalibrationProposer المُعاد تصميمه

```typescript
// ═══════════════════════════════════════════════════════════════
// الكود المُصحَّح — كل اقتراح يُنشأ فقط بعد نجاح البوابات الخمس
// ═══════════════════════════════════════════════════════════════

export class CalibrationProposer {

  /**
   * يُستدعى فقط من PatternDetector بعد نجاح EvidenceSufficiencyGate
   * لا يُستدعى مباشرة
   */
  async proposeFromCandidate(candidate: CalibrationCandidate): Promise<CalibrationProposal> {
    const { pattern, assessment, errors } = candidate;

    // تحقق ثانوي — لا يجب أن نصل هنا بدون assessment.can_propose
    if (!assessment.can_propose) {
      throw new Error(
        `EvidenceSufficiencyGate.can_propose=false for pattern ${pattern.id}. ` +
        `Reason: ${assessment.blocking_reason_ar}`
      );
    }

    const meanError   = pattern.mean_error_magnitude;
    const confidence  = assessment.confidence;

    switch (pattern.conditions.prediction_type) {

      case 'PROGRESS_PCT': {
        const isOverest = pattern.conditions.error_direction === 'overestimate';
        // التصحيح التدريجي: 50% من متوسط الخطأ الموثوق
        // (لا 70% كما كان — أكثر تحفظاً)
        const correctionValue = isOverest ? -meanError * 0.50 : +meanError * 0.50;

        return {
          rule_type:  'PROGRESS_MODEL_BIAS_CORRECTION',
          applies_to: {
            project_type: pattern.conditions.project_type,
            region:       pattern.conditions.region,
          },
          adjustment: {
            type:      'add_offset',
            value:     correctionValue,
            rationale: `Based on ${errors.length} verified corrections across ` +
                       `${new Set(errors.map(e=>e.project_id)).size} projects. ` +
                       `Mean error: ${meanError.toFixed(1)}%. Confidence: ${(confidence*100).toFixed(0)}%.`,
          },
          evidence_count:      errors.length,
          evidence_confidence: confidence,  // من EvidenceSufficiencyGate — ليس حساباً يدوياً
          derived_from_pattern_id: pattern.id,
          derived_from_errors:     errors.map(e => e.id),
          expected_improvement_ar: `تصحيح تدريجي: +${correctionValue.toFixed(1)}%. ` +
            `يُتوقع تخفيض MAE من ${meanError.toFixed(1)}% إلى ~${(meanError*0.5).toFixed(1)}%.`,
          // بعد التطبيق، نقيس ونُقرر إذا كان التصحيح كافياً أم يحتاج v2
        };
      }

      case 'SIGNAL_VALIDITY': {
        // تعديل SVQE — تأثير أوسع، يحتاج معلومات إضافية
        if (!assessment.all_passed) {
          throw new Error('SVQE adjustments require all gates to pass');
        }
        const currentThreshold = await this.getCurrentSVQEThreshold(
          pattern.conditions.signal_type,
          pattern.conditions.validator_name,
        );
        // تعديل محافظ: 10% (لا 15% كما كان)
        const newThreshold = pattern.conditions.root_cause === 'svqe_threshold_too_strict'
          ? currentThreshold * 1.10
          : currentThreshold * 0.90;

        return {
          rule_type:  'SVQE_THRESHOLD_ADJUSTMENT',
          applies_to: { signal_type: pattern.conditions.signal_type },
          adjustment: { type: 'set', value: newThreshold },
          evidence_count:      errors.length,
          evidence_confidence: confidence,
        };
      }

      default:
        throw new Error(`No proposer implemented for prediction_type: ${pattern.conditions.prediction_type}`);
    }
  }
}
```

---

## 7. ضمانات الاستقرار (Stability Guarantee)

**هذا الجدول هو العقد بين النظام والمستخدمين.**  
يُوثَّق في وثيقة النشر ويُراجع سنوياً.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    MINERVA STABILITY GUARANTEE                        │
│                         Version 4.1                                   │
├──────────────────────────┬───────────────────────────────────────────┤
│ الضمان                  │ التفاصيل التقنية                          │
├──────────────────────────┼───────────────────────────────────────────┤
│ تصحيح واحد لا يُغيّر   │ يُسجَّل فقط في prediction_ledger         │
│ سلوك النظام             │ لا يُنشئ نمطاً لوحده                    │
│                          │ لا يُقترح أي تعديل                      │
├──────────────────────────┼───────────────────────────────────────────┤
│ الحد الأدنى قبل أي      │ ≥ 10 تصحيحات                            │
│ اقتراح تعديل            │ + ≥ 3 مشاريع مختلفة                     │
│                          │ + ≥ 21 يوم زمنياً                       │
│                          │ + حجم أثر ≥ 8%                          │
│                          │ + اتساق اتجاهي ≥ 70%                    │
│                          │ → جميع الشروط الخمسة معاً               │
├──────────────────────────┼───────────────────────────────────────────┤
│ لا تعديل بدون           │ كل اقتراح يُعرض على مهندس أول           │
│ موافقة إنسانية           │ التغييرات الكبرى تحتاج مدير             │
│                          │ الموافقة لا تُطبَّق فوراً — دورة يومية │
├──────────────────────────┼───────────────────────────────────────────┤
│ كل تعديل قابل           │ status → 'superseded' في ثوانٍ          │
│ للإلغاء الفوري          │ القواعد الجديدة تُحمَّل تلقائياً        │
│                          │ تأثير الإلغاء يُقاس خلال 24 ساعة       │
├──────────────────────────┼───────────────────────────────────────────┤
│ كل تعديل قابل           │ performance_snapshot أسبوعي              │
│ للقياس                  │ MAE قبل/بعد مُقارَن تلقائياً            │
│                          │ تعديل يُسيء → يُلغى تلقائياً           │
│                          │   إذا MAE_after > MAE_before * 1.10     │
├──────────────────────────┼───────────────────────────────────────────┤
│ تغيير واحد في           │ العمر الأدنى لأي قاعدة: 14 يوم          │
│ المرة الواحدة            │ لا تعديلات متعددة لنفس المعامل          │
│                          │ في نفس الوقت (لمنع التداخل)             │
├──────────────────────────┼───────────────────────────────────────────┤
│ تعديل تدريجي            │ أقصى تصحيح دفعة واحدة: 50% من الخطأ    │
│ لا كامل                 │ إذا بقي خطأ → تصحيح v2 بعد 30 يوم      │
│                          │ لا تصحيح كامل في خطوة واحدة             │
└──────────────────────────┴───────────────────────────────────────────┘
```

---

## 8. الاكتشاف التلقائي للتدهور

```typescript
/**
 * يُشغَّل بعد كل performance_snapshot أسبوعي.
 * إذا أثبتت قاعدة معايرة أنها تُسيء → تُلغى تلقائياً.
 */
export class AutoRevertDetector {

  async checkActiveRules(): Promise<AutoRevertResult[]> {
    const activeRules = await db.calibration_rule.findMany({ status: 'active' });
    const results: AutoRevertResult[] = [];

    for (const rule of activeRules) {
      // احتاج أسبوعين على الأقل بعد التفعيل قبل الحكم
      if (daysSince(rule.activated_at) < 14) continue;

      const snapshots = await db.performance_snapshot.findMany({
        where: { created_at: { gte: rule.activated_at } },
        orderBy: { snapshot_date: 'asc' },
        take: 4,  // آخر 4 snapshots
      });

      if (snapshots.length < 2) continue;

      const beforeMAE = await this.getMAEBefore(rule);
      const afterMAE  = snapshots[snapshots.length-1].mae_progress;

      // تدهور > 10%: تلغ تلقائياً وأشعر مهندساً
      if (afterMAE > beforeMAE * 1.10) {
        await this.autoRevert(rule, beforeMAE, afterMAE);
        results.push({
          rule_id:       rule.id,
          action:        'AUTO_REVERTED',
          before_mae:    beforeMAE,
          after_mae:     afterMAE,
          reason:        `MAE زاد من ${beforeMAE.toFixed(1)}% إلى ${afterMAE.toFixed(1)}% بعد تطبيق القاعدة`,
        });
      }
      // تحسن ≤ 1%: علّم كـ "marginal" للمراجعة
      else if (afterMAE > beforeMAE * 0.99) {
        results.push({
          rule_id:   rule.id,
          action:    'MARGINAL_IMPROVEMENT',
          before_mae: beforeMAE,
          after_mae:  afterMAE,
          reason:    'التحسن أقل من 1% — راجع ضرورة هذه القاعدة',
        });
      }
    }

    return results;
  }
}
```

---

## 9. تحديث جدول قاعدة البيانات

```sql
-- إضافة عمودين للتحقق من استيفاء البوابات الخمس
ALTER TABLE minerva_learning.calibration_rule
  ADD COLUMN gate_results         JSONB,
  ADD COLUMN gate_assessment_at   TIMESTAMPTZ,
  -- حفظ نتيجة كل بوابة للمراجعة اللاحقة
  -- {
  --   "gate_1_volume": { "passed": true, "n": 15, "required": 10 },
  --   "gate_2_diversity": { "passed": true, "distinct": 4, "required": 3 },
  --   "gate_3_temporal": { "passed": true, "span_days": 45, "required": 21 },
  --   "gate_4_effect": { "passed": true, "mean_error": 12.3, "required": 8 },
  --   "gate_5_consistency": { "passed": true, "snr": 2.1, "directional": 0.80 }
  -- }

  ADD COLUMN auto_reverted_at     TIMESTAMPTZ,
  ADD COLUMN auto_revert_reason   TEXT;
  -- يُملأ إذا اكتشف AutoRevertDetector تدهوراً

-- قيد: لا قاعدة تصبح 'active' بدون gate_results مكتمل
ALTER TABLE minerva_learning.calibration_rule
  ADD CONSTRAINT require_gate_results_for_activation
  CHECK (
    status != 'active' OR gate_results IS NOT NULL
  );
```

---

## 10. ملخص التغييرات على الكود الأصلي

```
الكود في الوثيقة السابقة (v4.0)     →     الكود المُصحَّح (v4.1)
─────────────────────────────────────────────────────────────────────
cluster.errors.length >= 2           →     cluster.errors.length >= 3

occurrence_count >= 5                →     EvidenceSufficiencyGate
  (بدون قيود إضافية)                        (جميع البوابات الخمس)

Math.min(0.9, 0.5 + n * 0.08)       →     computeEvidenceConfidence()
  (ثقة 90% عند 5 أخطاء)                    (ثقة 40-60% عند 10 أخطاء)

معامل التصحيح: 70% من الخطأ         →     50% من الخطأ
  (تصحيح سريع)                             (تصحيح تدريجي أكثر تحفظاً)

لا حارس مستقل للأدلة                →     EvidenceSufficiencyGate إلزامي

لا فحص للتدهور التلقائي             →     AutoRevertDetector أسبوعي
```

---

## 11. الإجابة على المتطلبات الستة (بعد التصحيح)

| المتطلب | الحالة بعد التصحيح | الضمان التقني |
|---------|-------------------|--------------|
| ✅ تصحيح واحد لا يُغيّر السلوك | محقق بالكامل | السطر 660→3، لا نمط بأقل من 3 أخطاء |
| ✅ تكرار كافٍ قبل الاقتراح | محقق بالكامل | Gate 1: ≥ 10، Gate 2: ≥ 3 مشاريع، Gate 3: ≥ 21 يوم |
| ✅ كل تغيير مدعوم بأدلة | محقق بالكامل | جميع البوابات الخمس + confidence حقيقية لا حسابية |
| ✅ كل تغيير يحتاج موافقة | محقق (من v4.0) | ApprovalWorkflow بدون تغيير |
| ✅ كل تغيير قابل للإلغاء | محقق (من v4.0) | revertCalibrationRule + AutoRevertDetector الجديد |
| ✅ كل تغيير قابل للقياس | محقق (مُحسَّن) | AutoRevertDetector يُلغي تلقائياً عند تدهور > 10% |

---

## 12. القاعدة النهائية

> **النظام يجب أن يكون مملاً في تعلمه.**

التعلم السريع يعني عدم الاستقرار.  
النظام الذي يتغير بعد 3 تصحيحات لن يُثق به بعد 3 سنوات.  
النظام الذي يتغير بعد 10 تصحيحات موزعة على 3 مشاريع وشهر واحد — هذا نظام يمكن الاعتماد عليه.

**المعلومات الصحيحة لا تتسرع. تتراكم.**

---

*هذه الوثيقة تُعدِّل القسم 4.2 و 4.3 من MINERVA-Learning-Feedback-Architecture.md.*  
*جميع التغييرات موثقة بالسطر والدالة.*  
*نسخة المعمارية المعتمدة: 4.1*
