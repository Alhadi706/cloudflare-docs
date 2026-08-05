# MINERVA / DSP
## Data Integrity & Evidence Phase Report
### التاريخ: 2026-07-15
### الحالة: مراجعة مستقلة مكتملة

---

## 0) النتيجة التنفيذية

الحكم الفني الحالي:

- النظام حقق تقدماً قوياً في مسار PIC (تحليل مشاهد حقيقية، فلاتر جودة، ومنطق استدلال متعدد المراحل).
- لكن توجد فجوات ثقة حرجة تمنع الاعتماد الحكومي الكامل الآن، أهمها:
  - وجود مسارات تحليل تعيد نتائج تقديرية/حتمية غير مبنية على أدلة ميدانية كافية مع غياب وسم واضح للمستخدم بأنها تقديرية.
  - عرض أرقام نهائية (إنجاز/صحة/اتجاه) في واجهات القرار دون إظهار سلسلة الإثبات وقيود النموذج للمستخدم النهائي.
  - مخاطر عزل متعدد المستأجرين في واجهات PIC/GIS بسبب قبول tenant من الهيدر في مسارات مصنفة عامة.

قرار الجاهزية لهذه المرحلة:

- جاهزية تشغيلية مشروطة: نعم للتجارب التشغيلية الداخلية.
- جاهزية اعتماد حكومي رسمي عالي الثقة: لا بعد.

---

## 1) نسبة جاهزية كل جزء من النظام

منهجية القياس:

- 0-39: غير جاهز تشغيلياً
- 40-59: جاهزية منخفضة
- 60-79: جاهزية متوسطة
- 80-100: جاهزية عالية

| الجزء | الجاهزية | التقييم المختصر |
|---|---:|---|
| البيانات Data | 66% | مصادر حقيقية موجودة في أجزاء مهمة، لكن ما زالت توجد نقاط تقديرية/محلية غير موثقة بالكامل للمستخدم |
| الخرائط Maps | 63% | طبقات وتحليلات كثيرة، لكن بعض المسارات تستخدم fallback/simulated بدون حوكمة عرض موحدة |
| المشاريع Projects (PIC) | 74% | خط التحليل تحسن فعلياً (SVQE + Features + Reasoning)، لكن الشرح للمستخدم النهائي ناقص |
| الصور Satellite Imagery | 79% | أرشيف Planet محلي وتغذية صور فعلية قوية، مع حفظ مصدر الصورة داخلياً |
| Timeline | 58% | يوجد خط زمني وتشخيص توقف، لكن لا يوجد عرض واضح لسبب الحكم ودرجة عدم اليقين لكل نقطة |
| التقارير Reports | 55% | بعض التقارير جيدة تقنياً، لكن فصل “حقيقي مقابل تقديري” غير موحد عبر كل الواجهات |
| واجهة الاستخدام UX Trust | 60% | أجزاء كثيرة تعرض شارات “بيانات حقيقية/تجريبية”، لكن لوحات حرجة ما زالت تعرض نتائج دون توضيح كافٍ للثقة |
| الأمان والعزل Multi-tenant Trust | 42% | خطر مهم في قبول tenant من هيدر عميل لمسارات عامة PIC/GIS |

متوسط الجاهزية الكلي للمرحلة:

- 62%

---

## 2) نقاط القوة

1. تحسينات جوهرية في محرك PIC التحليلي
- انتقال فعلي إلى خط: SAL -> SVQE -> FeatureEngine -> ReasoningEngine في [lib/pic/analyzer.ts](lib/pic/analyzer.ts).
- فلاتر جودة المشاهد متعددة الأبعاد (سحب، جودة، فجوة زمنية، شذوذ، سياق موسمي) في [lib/svqe/engine.ts](lib/svqe/engine.ts).

2. تصحيح سابق مهم لسلامة مشاهد Planet
- اعتماد scene footprint الحقيقي بدل bbox تقريبي، ومنع إعادة استخدام scans قديمة خاطئة (موثق في [docs/MINERVA-PIC-Integrity-Validation-Report.md](docs/MINERVA-PIC-Integrity-Validation-Report.md)).

3. وجود مسارات تفصح بوضوح عند عدم توفر بيانات حقيقية
- عدة endpoints تعيد 503 مع required_services بدلاً من اختلاق نتائج، مثل InSAR/CVA/Subpixel/GroundTruth في [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts).

4. بنية صور واضحة المصدر على مستوى API
- endpoint الصور يعيد X-Source (local-archive أو planet-api) في [app/api/v1/satellite/planet-thumbnail/route.ts](app/api/v1/satellite/planet-thumbnail/route.ts).

5. بعض واجهات التحكم تعلن صراحة المصدر
- صفحات في control-center تعرض حالة المصدر “بيانات حقيقية/تجريبية” بوضوح، مثل:
  - [app/dashboard/control-center/alarm-management/page.tsx](app/dashboard/control-center/alarm-management/page.tsx)
  - [app/dashboard/control-center/production-schedule/page.tsx](app/dashboard/control-center/production-schedule/page.tsx)
  - [app/dashboard/control-center/pressure-zones/page.tsx](app/dashboard/control-center/pressure-zones/page.tsx)

---

## 3) نقاط الضعف

1. فجوة إثبات في واجهة PIC للمستخدم النهائي
- واجهة PIC تعرض إنجاز/صحة/اتجاه وتوقفات، لكنها لا تعرض سلسلة الإثبات الأساسية (الأدلة المؤيدة/المعارضة/القيود) رغم وجودها داخل محرك reasoning.
- ملفات ذات صلة:
  - [app/dashboard/gis-sovereignty/project-intelligence-center/components/PICShell.tsx](app/dashboard/gis-sovereignty/project-intelligence-center/components/PICShell.tsx)
  - [lib/reasoning/engine.ts](lib/reasoning/engine.ts)

2. فقدان بيانات التفسير عند التخزين
- طبقة DB الحالية لـ PIC لا تحفظ evidence/limitations/confidence التفصيلي ككيانات قابلة للاسترجاع، فقط مؤشرات عامة وملاحظات.
- ملف: [lib/picDB.ts](lib/picDB.ts)

3. اتساع واجهة GIS catch-all مع تباين كبير في موثوقية المخرجات
- في الملف نفسه يوجد خليط: مسارات real، ومسارات unavailable، ومسارات deterministic/estimated.
- هذا يزيد مخاطر سوء الفهم إذا لم يكن الإفصاح موحداً في جميع الواجهات.
- ملف: [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)

4. غياب اختبارات تلقائية واضحة
- لم يتم العثور على ملفات test/spec في المستودع، ما يرفع خطر الانحدار السلوكي خصوصاً في نقاط الثقة الحساسة.

---

## 4) الأخطاء الحرجة (Critical)

1. خطر عزل متعدد المستأجرين في PIC/GIS
- مسارات [app/api/v1/pic/projects/route.ts](app/api/v1/pic/projects/route.ts) و [app/api/v1/pic/projects/[id]/route.ts](app/api/v1/pic/projects/[id]/route.ts) تعتمد على extractTenantId.
- extractTenantId يقبل x-tenant-id من الطلب مباشرة في [lib/backendProxy.ts](lib/backendProxy.ts).
- في middleware، كل من /api/v1/pic/ و /api/gis/ مصنف كـ public API في [middleware.ts](middleware.ts)، لذلك لا يوجد إلزام Bearer موحد قبل تمرير الطلب.
- الأثر: إمكانية قراءة/العمل على بيانات tenant إذا عُرف معرفه.

2. مخرجات تقديرية غير موسومة بشكل كافٍ في واجهات قرار
- suitability يعتمد seed(bbox) ودرجات حتمية في [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)، بينما واجهة [app/dashboard/gis-sovereignty/satellite-intelligence-center/components/SuitabilityPanel.tsx](app/dashboard/gis-sovereignty/satellite-intelligence-center/components/SuitabilityPanel.tsx) لا تعرض تحذيراً صارماً أن النتائج تقديرية.
- network-design/auto-network يعيدان قيماً مُولدة/افتراضية في نفس route، وقد تُفهم كتشخيص فعلي.

3. حكم نهائي بلا سلسلة برهان مرئية للمستخدم
- مخرجات reasoning تحتوي دلائل وقيود وثقة، لكن API/UI لا يقدمانها كمسار تدقيق مباشر لكل قرار.
- هذا يخالف قاعدة “أي استنتاج يجب أن يستطيع النظام إثباته”.

---

## 5) الأخطاء التي يمكن تأجيلها

1. توحيد شكل رسائل عدم التوفر عبر كل التحليلات
- بعض المسارات ممتازة في الإفصاح (503 + required_services)، وأخرى أقل انتظاماً.

2. تحسين اتساق اللغة بين الوحدات
- هناك تفاوت بين مصطلحات فنية عربية/إنجليزية في التقارير والواجهات.

3. تعزيز أرشفة تشغيلية قابلة للتدقيق طويل المدى
- حالياً أجزاء من GIS CRUD محفوظة في JSON محلي داخل .data، مناسب للتطوير لكنه ليس مسار حوكمة إنتاجي مكتمل.

---

## 6) المخاطر المستقبلية

1. مخاطر السمعة المؤسسية
- أي عرض لنتيجة تقديرية كحقيقة تشغيلية سيؤدي سريعاً إلى فقدان الثقة لدى أصحاب القرار.

2. مخاطر أمنية/حوكمة بيانات
- عدم تشديد tenant verification على مسارات حساسة يهدد مصداقية المنصة بالكامل.

3. مخاطر الانحدار بدون اختبارات
- التوسع السريع في مسارات GIS/PIC دون tests سيعيد أخطاء سلامة البيانات بشكل دوري.

4. مخاطر تبعية خارجية
- أجزاء تعتمد على OpenTopoData/Overpass/CDSE. عند الانقطاع، يجب أن يكون سلوك النظام موحداً ومعلناً للمستخدم فوراً.

---

## 7) التوصيات مرتبة حسب الأولوية

P0 (فوري)

1. إغلاق ثغرة tenant spoofing في PIC/GIS
- إزالة قبول tenant من هيدر عميل غير موثق للمسارات الحساسة.
- فرض x-verified-tenant-id فقط بعد تحقق JWT/Session.

2. فرض Disclosure Contract موحد لكل endpoint تحليلي
- حقول إلزامية في كل استجابة: data_real،evidence_level،uncertainty_level،provenance_sources،limitations.
- رفض أي UI تعرض نتيجة نهائية إذا هذه الحقول غير موجودة.

P1 (عالٍ جداً)

3. تمرير Evidence Trace كامل من reasoning إلى API ثم UI
- عرض: لماذا هذا الرقم؟ ما الأدلة؟ ما الأدلة المعارضة؟ ما حدود النموذج؟
- ربط كل نقطة timeline بالصور والمشاهد التي بُني عليها الحكم.

4. وسم صريح غير قابل للإخفاء لكل مخرجات estimated/simulated
- خاصة في suitability/network/auto-network وأي fallback simulated.
- الشارة يجب أن تكون دائمة ومرافقة للنتيجة في اللوحة والتصدير.

P2 (عالٍ)

5. إضافة اختبارات نزاهة إجبارية
- tests لعزل tenant.
- tests لعدم تسرب fallback/simulated كمخرجات “حقيقية”.
- tests لثبات حساب progress/health مع بيانات معروفة.

P3 (متوسط)

6. ترقية تخزين GIS CRUD من ملفات JSON محلية إلى مخزن مدقق (DB + audit log + integrity hash).

7. توحيد قاموس المصطلحات (ثقة/يقين/دليل/مصدر) عبر الواجهات والتقارير.

---

## 8) أهم خمس مهام يجب تنفيذها بعد هذه المرحلة

1. تأمين طبقة العزل متعدد المستأجرين لمسارات PIC/GIS
- المخرج المطلوب: لا يُقبل أي tenant context إلا من claims موثقة.

2. إطلاق معيار “Truth Label” على مستوى المنصة
- كل نتيجة تحمل تصنيف: Real / Estimated / Simulated / Unavailable.
- منع تصدير PDF أو مشاركة تقرير بدون هذا التصنيف.

3. بناء صفحة Explainability موحدة داخل PIC
- تعرض سلسلة الاستدلال، الأدلة، درجات الثقة، ونقاط عدم اليقين لكل مشروع.

4. إعادة تصميم استجابات endpoints التحليلية بعقد موحد
- provenance + uncertainty + limitations + evidence links (scene_id, timestamp, source).

5. تفعيل حزمة اختبارات Integrity Gate في CI
- يمنع الدمج إذا كسر عزل tenant أو أخفى uncertainty أو غيّر سلوك الثقة دون تحديث متعمد.

---

## خاتمة المرحلة

الوضع الحالي لا يزال بعيداً عن العبارة المستهدفة بالكامل:

"أنا أثق أن كل معلومة داخل النظام صحيحة أو أن النظام يوضح بصدق درجة عدم اليقين."

لكن الوصول لها قريب إذا نُفذت عناصر P0/P1 أولاً، لأن البنية التحليلية الأساسية موجودة بالفعل، وما ينقص حالياً هو:

- إحكام الحوكمة الأمنية للهوية/المستأجر.
- فرض عقد إفصاح موحد للحقيقة وعدم اليقين.
- إظهار سلسلة الإثبات للمستخدم النهائي قبل الرقم، وليس بعده.
