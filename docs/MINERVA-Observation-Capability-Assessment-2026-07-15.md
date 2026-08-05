# MINERVA / DSP
## Phase X — Observation Capability Assessment
### What MINERVA can truly see, and what it cannot
### التاريخ: 2026-07-15

---

## 0) Scope and Method

سؤال الدراسة:

- ما الذي يستطيع MINERVA رؤيته بدقة؟
- ما الذي لا يستطيع رؤيته بدقة أو إطلاقاً؟

منهج التقييم:

- الاعتماد على التنفيذ الفعلي داخل النظام الحالي (APIs + محركات التحليل + مصادر البيانات الموصولة الآن).
- التمييز بين:
  - قدرة مثبتة تشغيلياً اليوم.
  - قدرة ممكنة نظرياً لكن غير مفعلة/غير مستقرة.
  - قدرة غير ممكنة علمياً بسبب حدود الدقة المكانية/الطيفية/الزمنية.

أدلة مرجعية في النظام:

- [lib/pic/analyzer.ts](lib/pic/analyzer.ts)
- [lib/sal/adapters/planet.ts](lib/sal/adapters/planet.ts)
- [lib/svqe/engine.ts](lib/svqe/engine.ts)
- [lib/features/engine.ts](lib/features/engine.ts)
- [lib/reasoning/engine.ts](lib/reasoning/engine.ts)
- [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)
- [app/api/v1/satellite/leak-detector/route.ts](app/api/v1/satellite/leak-detector/route.ts)
- [app/api/v1/satellite/water-anomaly-scanner/route.ts](app/api/v1/satellite/water-anomaly-scanner/route.ts)
- [app/api/v1/satellite/fire-monitor/route.ts](app/api/v1/satellite/fire-monitor/route.ts)
- [lib/stac.ts](lib/stac.ts)
- [lib/sentinel-hub.ts](lib/sentinel-hub.ts)
- [minerva/signals/adapters/sentinel2.py](minerva/signals/adapters/sentinel2.py)
- [minerva/signals/adapters/sentinel1.py](minerva/signals/adapters/sentinel1.py)
- [minerva/signals/adapters/modis_lst.py](minerva/signals/adapters/modis_lst.py)
- [minerva/signals/adapters/landsat_thermal.py](minerva/signals/adapters/landsat_thermal.py)
- [minerva/signals/adapters/synthetic.py](minerva/signals/adapters/synthetic.py)

---

## 1) Data Sources in Current MINERVA System

### 1.1 Operational sources connected today

1. PlanetScope RGB (3m nominal), عبر أرشيف محلي + Planet API
- استخدام فعلي في PIC (تتبع نشاط الإنشاء من thumbnails).
- المصدر: [app/api/v1/satellite/planet-thumbnail/route.ts](app/api/v1/satellite/planet-thumbnail/route.ts), [lib/pic/analyzer.ts](lib/pic/analyzer.ts)

2. Sentinel-2 L2A (10m/20m) عبر CDSE/STAC/Sentinel Hub
- NDVI/NDWI/NDMI وطبقات إحصائية tile-level وpixel-level.
- المصدر: [lib/stac.ts](lib/stac.ts), [lib/sentinel-hub.ts](lib/sentinel-hub.ts)

3. Sentinel-1 GRD / RTC (10m SAR)
- استخدام في مؤشرات رطوبة/تغيرات backscatter، ومعالجة InSAR قيد الإكمال.
- المصدر: [lib/sentinel-hub.ts](lib/sentinel-hub.ts), [app/api/v1/satellite/insar-subsidence/route.ts](app/api/v1/satellite/insar-subsidence/route.ts)

4. VIIRS/MODIS FIRMS (حرائق)
- بؤر حرارية إقليمية بمرور متكرر.
- المصدر: [app/api/v1/satellite/fire-monitor/route.ts](app/api/v1/satellite/fire-monitor/route.ts), [app/api/v1/satellite/fire-archive/route.ts](app/api/v1/satellite/fire-archive/route.ts)

5. Landsat Thermal + MODIS LST
- مؤشرات حرارة سطحية واسعة النطاق.
- المصدر: [minerva/signals/adapters/landsat_thermal.py](minerva/signals/adapters/landsat_thermal.py), [minerva/signals/adapters/modis_lst.py](minerva/signals/adapters/modis_lst.py)

6. DEM (SRTM 30m/OpenElevation)
- تضاريس/انحدار/مخاطر فيضان على نطاقات متوسطة-كبيرة.
- المصدر: [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)

7. OSM/Overpass (بيانات متجهة مرجعية)
- مبانٍ/طرق كطبقات سياقية وليست رصد EO مباشر.
- المصدر: [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)

8. Open-Meteo (~11km)
- سياق مناخي داعم للاستدلال، ليس رصد أجسام.
- المصدر: [minerva/signals/adapters/weather.py](minerva/signals/adapters/weather.py), [minerva/config.py](minerva/config.py)

### 1.2 Sources present but non-operational/limited for production proof

1. Synthetic physics signals
- مخصصة للاختبار والـ lab، ليست evidence تشغيلي.
- المصدر: [minerva/signals/adapters/synthetic.py](minerva/signals/adapters/synthetic.py), [minerva/config.py](minerva/config.py)

2. InSAR production-grade outputs
- HyP3 integration موجودة لكن التنفيذ مكتوب كـ قيد معالجة (jobs pending).
- المصدر: [app/api/v1/satellite/insar-subsidence/route.ts](app/api/v1/satellite/insar-subsidence/route.ts)

---

## 2) Capability Matrix by Data Source

الترميز:

- D: يمكن الاكتشاف
- M: يمكن القياس الكمي
- T: يمكن التتبع الزمني
- ?: اشتباه فقط/proxy
- N: غير ممكن علمياً بهذا المصدر

> المصفوفة التالية تمثل قدرة المصدر داخل MINERVA الحالي (code path فعلي)، وليس القدرة النظرية العامة للمصدر خارج النظام.

### 2.1 Matrix A — Infrastructure/Objects

| المصدر | الطرق | الجسور | المباني | أعمال الحفر | السدود | الأنابيب | الكهرباء | الزراعية | الموانئ | المطارات | الطائرات | السفن | السيارات | معدات ثقيلة | رافعات |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PlanetScope RGB 3m (PIC الحالي) | D/T | D/T | ? | D/T | ? | ? | N | D/T | ? | ? | N | N | N | N | N |
| Sentinel-2 10/20m | D/M/T | ? | ? (غطاء حضري) | D/M/T | ? | ? | N | D/M/T | D/T (macro) | D/T (macro) | N | ? (كبيرة فقط) | N | N | N |
| Sentinel-1 SAR 10m | D/T (macro) | ? | ? (macro) | ? | ? | ? | N | ? | ? | ? | N | ? (كبيرة) | N | N | N |
| DEM 30m | D/M (طبوغرافيا الطرق/الممرات لا الأجسام) | ? | N | ? | D/M | N | N | ? | ? | ? | N | N | N | N | N |
| OSM/Overpass | D (مرجعي) | D (مرجعي) | D (مرجعي) | N | D (مرجعي) | ? | ? | ? | D (مرجعي) | D (مرجعي) | N | N | N | N | N |
| Open-Meteo | N | N | N | N | N | N | N | ? (سياق فقط) | N | N | N | N | N | N | N |

### 2.2 Matrix B — Hazards/Change Signals

| المصدر | التسربات | الهبوطات الأرضية | الفيضانات | الحرائق | إزالة الغطاء النباتي | التوسع العمراني |
|---|---|---|---|---|---|---|
| PlanetScope RGB 3m (PIC الحالي) | ? | N | ? | ? | D/T | ? |
| Sentinel-2 10/20m | D/M/T | N | D/M/T | ? (حرارة غير مباشرة) | D/M/T | D/T (macro) |
| Sentinel-1 SAR 10m | D/M/T (رطوبة/انعكاسية) | ? (InSAR path غير مكتمل) | ? | N | ? | ? |
| VIIRS/MODIS FIRMS | N | N | N | D/M/T (حراري إقليمي) | N | N |
| Landsat Thermal 100m | ? | N | ? | ? | ? | ? |
| MODIS LST 1km | N (نطاقات واسعة فقط) | N | ? | ? | ? | N |
| DEM 30m | N | ? (مؤشرات تضاريسية فقط) | D/M (قابلية/انخفاضات) | N | N | N |
| Open-Meteo | ? (تمييز مطر/لا مطر) | N | ? (خلفية مناخية) | ? (ظروف حرارية) | ? | N |

### 2.3 Minimum Detectable Size and Confidence per Source

| المصدر | أقل حجم/دقة فعالة داخل النظام الحالي | هل يمكن القياس؟ | الثقة التشغيلية الحالية | القيود المعروفة |
|---|---|---|---|---|
| PlanetScope RGB 3m (thumbnail workflow) | رصد تغيّر موقعي عادةً عندما يكون العنصر > 9-15m تقريباً | قياس نسبي للنشاط (ليس قياس هندسي مباشر) | متوسطة | اعتماد على RGB thumbnail وليس multispectral/raw full scene في PIC الحالي |
| Sentinel-2 | 10m للأحزمة/الكتل، و20m لبعض المؤشرات (SWIR) | نعم (NDVI/NDWI/NDMI) | متوسطة إلى عالية عند توفر CDSE/SH | لا يمكن كشف الأجسام الصغيرة (سيارات/معدات/رافعات) |
| Sentinel-1 SAR | ~10m للأنماط الكبيرة | قياس backscatter | متوسطة | صعوبة تفسير حضري معقد بدون معايرة + InSAR لم يكتمل إنتاجياً |
| VIIRS FIRMS | 375m pixel | FRP واتجاه زمني | عالية للحرائق الإقليمية، منخفضة للحرائق الصغيرة | دقة مكانية خشنة؛ غير مناسب للحوادث الحضرية الدقيقة |
| Landsat Thermal | 100m thermal | حرارة سطحية | متوسطة | coarse للأجسام الصغيرة والتمييز الموضعي |
| MODIS LST | 1km thermal | حرارة واسعة النطاق | منخفضة-متوسطة للأصول الخطية | غير صالح للتشخيص الموضعي للبنية الدقيقة |
| DEM SRTM | 30m | انحدار/منسوب | متوسطة | ليس رصداً ديناميكياً للأجسام؛ مناسب للمخاطر الجيومورفولوجية |
| OSM/Overpass | متجه مرجعي | نعم (إحصاءات مرجعية) | متغيرة | اكتمال البيانات يختلف مكانياً وزمنياً |
| Open-Meteo | ~11km grid | قياس مناخي سياقي | متوسطة | ليس مصدراً بصرياً أو كاشف أجسام |

---

## 3) Current MINERVA Capability — Prove vs Suspect vs Cannot See

## 3.1 What MINERVA can prove today

1. نشاط/تباطؤ/توقف مشاريع على مستوى الموقع العام (وليس على مستوى جسم فردي)
- مع سجل زمني وربط بالمشاهد في PIC.

2. تغيرات طيفية واسعة مرتبطة بالماء/التربة/النبات
- NDWI/NDVI/NDMI مع مقارنة زمنية (عند توفر CDSE/SH).

3. رصد حرائق إقليمية وتواترها الزمني
- عبر VIIRS/MODIS FIRMS مع FRP.

4. تقييم مخاطر تضاريسية عامة (انحدار/منخفضات)
- عبر DEM/SRTM في نطاقات متوسطة-كبيرة.

## 3.2 What MINERVA can only suspect today

1. تسربات مياه دقيقة في الأنابيب
- النظام ينتج اشتباه متعدد الأدلة جيد، لكنه ليس إثباتاً ميدانياً نهائياً بدون ground truth/ضغط SCADA/تأكيد حقلي.

2. هبوط أرضي دقيق (mm-cm)
- يوجد مسار InSAR مطروح لكنه ليس production-evidence متاحاً باستمرار الآن.

3. تصنيف حضري تفصيلي (مبنى/معدات/مركبات)
- في بعض المسارات يتم استخدام proxies طيفية، وليس كشف أجسام عالي الدقة.

## 3.3 What MINERVA cannot see today (scientifically)

1. السيارات والمعدات الثقيلة والرافعات والطائرات كأجسام فردية
- غير ممكن بدقة 10m/3m thumbnail workflow.

2. خطوط الكهرباء الرفيعة وأعمدةها بدقة موثوقة
- تتطلب دقة أعلى بكثير (sub-meter) أو LiDAR.

3. تشخيص تفصيلي للبنية المينائية/المطار على مستوى العناصر الصغيرة
- الممكن حالياً هو مؤشرات macro-level فقط.

---

## 4) Scientific Errors Detected (Data-Resolution Mismatch)

1. بناء/مركبات في object-detection عبر proxies غير كافية مكانياً
- يوجد تصريح صريح في الكود أن المركبات/المباني الفردية غير ممكنة بهذه الدقة، ومع ذلك تُعاد تقديرات لبعض الحالات.
- المرجع: [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)

2. Suitability scores حتمية seeded وليست رصداً علمياً مباشراً
- ناتج ملائم للسيناريو التحليلي السريع، لكنه ليس evidence observation ground truth.
- المرجع: [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)

3. Network design outputs تتضمن قيماً مولدة في بعض المسارات
- تحتاج وسم صريح دائم بأنها planning estimates لا observation evidence.
- المرجع: [app/api/gis/[...slug]/route.ts](app/api/gis/[...slug]/route.ts)

4. Super-resolution fallback لا يرفع دقة فيزيائياً لكنه قد يُفهم بصرياً كتحسين قياسي
- يجب تمييز صارم بين SR الحقيقي وfallback.
- المرجع: [app/api/v1/satellite/super-resolution/route.ts](app/api/v1/satellite/super-resolution/route.ts)

---

## 5) Gap Analysis and Best Data Source per Gap

| الفجوة | أثرها على القرار | أفضل مصدر لسد الفجوة | لماذا هذا المصدر | أولوية |
|---|---|---|---|---|
| كشف الأجسام الصغيرة (سيارات، رافعات، معدات) | إنذارات غير دقيقة في مواقع الأعمال | Maxar WorldView / Airbus Pléiades (0.3-0.5m) | دقة تسمح object-level detection | P0 |
| إثبات هبوط أرضي بدقة mm-cm | عدم القدرة على تأكيد subsidence | Sentinel-1 InSAR (HyP3/ISCE) + GNSS نقاط مرجعية | InSAR يعطي deformation rates عند تماسك كافٍ | P0 |
| تأكيد التسربات ميدانياً | بقاء النتائج في مستوى الاشتباه | SCADA pressure/flow + acoustic logs + field validation app | دمج EO + OT + Ground truth يحول الاشتباه إلى إثبات | P0 |
| كشف خطوط الكهرباء/الأعمدة | blind spot للبنية الكهربائية | LiDAR جوي/Drone + imagery sub-meter | الهندسة الخطية الرفيعة لا تكفيها Sentinel/Planet 3m | P1 |
| تمييز التحضر بدقة parcel/building | ضعف التخطيط الحضري الدقيق | VHR optical + government cadastre/building permits | يمنح truth layer قانونية/مرجعية | P1 |
| flood hydraulics عالية الدقة | تقدير flood susceptibility فقط | DEM أدق (LiDAR/ALOS 12.5m) + هيدرولوجيا + rainfall radar | يحسن depth/extent modeling | P1 |
| مراقبة الموانئ/المطارات التكتيكية | macro only | SAR high-res (TerraSAR-X/ICEYE) + VHR optical | عمل ليلي/غيوم + تفاصيل أصغر | P2 |

---

## 6) Minimal Additional Dataset Set (Highest ROI)

أقل حزمة بيانات إضافية لرفع الدقة/الموثوقية بشكل جوهري:

1. VHR Optical (0.3-0.5m) لمناطق الأولوية فقط
- يغطي: سيارات، معدات، رافعات، طائرات، تفاصيل مبانٍ.

2. InSAR operational pipeline + calibration points
- يغطي: هبوطات أرضية، استقرار جسور/طرق/سدود.

3. OT/SCADA evidence bridge
- ضغط، تدفق، إنذارات لحظية، وربط زمني مكاني مع EO.

4. Ground truth protocol إلزامي
- فريق ميداني + تطبيق تحقق + SLA لإغلاق كل alert عالي.

هذه الأربعة هي أقصر طريق من “اشتباه ذكي” إلى “إثبات هندسي قابل للمساءلة”.

---

## 7) Final Capability Classification for Requested Targets

| العنصر | الحالة الحالية | أفضل مصدر فعلي اليوم في MINERVA | هل يمكن القياس؟ | هل يمكن التتبع؟ | الثقة | أقل حجم قابل للرصد حالياً |
|---|---|---|---|---|---|---|
| الطرق | يمكن إثباته جزئياً (macro) | Planet 3m + Sentinel-2 | جزئي | نعم | متوسطة | عرض ~10m+ عادة |
| الجسور | اشتباه غالباً | Planet/S2 | محدود | نعم | منخفضة-متوسطة | جسر كبير نسبياً |
| المباني | اشتباه (غطاء حضري) | S2 NDVI proxy + OSM مرجعي | محدود | نعم (macro) | منخفضة | كتل حضرية لا مبنى فردي |
| أعمال الحفر | يمكن إثباته جزئياً | S2 BSI/NDMI + Planet disturbance | جزئي | نعم | متوسطة | ~20-30m+ |
| السدود | اشتباه/إثبات جزئي للسدود الكبيرة | S2 + DEM | جزئي | نعم | متوسطة | منشآت كبيرة |
| خطوط الأنابيب | اشتباه قوي لا إثبات قاطع | S2/S1 + leak pipelines | جزئي | نعم | متوسطة | Corridor-level |
| خطوط الكهرباء | لا يمكن رؤيتها بدقة | — | لا | لا | منخفضة جداً | غير متاح |
| الأراضي الزراعية | يمكن إثباته | S2 NDVI/NDMI | نعم | نعم | عالية نسبياً | حقول متوسطة+
| الموانئ | اشتباه macro | S2/S1 | محدود | نعم | منخفضة-متوسطة | نطاقات كبيرة |
| المطارات | اشتباه macro | S2/SAR | محدود | نعم | منخفضة-متوسطة | منشآت كبيرة |
| الطائرات | لا يمكن | — | لا | لا | منخفضة جداً | غير متاح |
| السفن | اشتباه للسفن الكبيرة فقط | FIRMS/SAR جزئي | محدود | محدود | منخفضة | كبيرة جداً |
| السيارات | لا يمكن | — | لا | لا | منخفضة جداً | غير متاح |
| المعدات الثقيلة | لا يمكن | — | لا | لا | منخفضة جداً | غير متاح |
| الرافعات | لا يمكن | — | لا | لا | منخفضة جداً | غير متاح |
| التسربات | اشتباه قوي متعدد الأدلة | leak-detector + water-anomaly + SAR/NDMI | جزئي | نعم | متوسطة | corridor/site scale |
| الهبوطات الأرضية | اشتباه فقط حالياً | S1 + InSAR path قيد التفعيل | محدود | محدود | منخفضة-متوسطة | يتطلب InSAR فعّال |
| الفيضانات | يمكن إثباته جزئياً | NDWI + DEM | نعم (extent) | نعم | متوسطة | مساحات مائية ملحوظة |
| الحرائق | يمكن إثباته إقليمياً | VIIRS/MODIS FIRMS | نعم (FRP/عدّ) | نعم | عالية إقليمياً | ~375m pixel |
| إزالة الغطاء النباتي | يمكن إثباته | S2 NDVI | نعم | نعم | متوسطة-عالية | 10m+
| التوسع العمراني | اشتباه macro | S2 + OSM | محدود | نعم | متوسطة | أحياء/كتل لا مبانٍ فردية |

---

## 8) How MINERVA becomes one of the world's most reliable infrastructure monitoring systems

### Stage 1 — Scientific Integrity Baseline (0-3 months)

1. Enforce Observation Truth Labels platform-wide
- كل نتيجة تحمل: Real / Estimated / Simulated / Unavailable.

2. Block unsupported inferences by resolution gates
- Rule engine يمنع تلقائياً أي claim لا تدعمه دقة المصدر.

3. Standardize Evidence Contract in all APIs
- provenance_sources + uncertainty + min_detectable_size + limitations mandatory.

### Stage 2 — Evidence Upgrade (3-9 months)

1. Add VHR optical for priority corridors and assets
- object-level monitoring where Sentinel/Planet are insufficient.

2. Operationalize InSAR deformation production
- batch + QA + coherence thresholds + GNSS calibration.

3. Integrate OT/SCADA streams with EO timelines
- move from anomaly indication to root-cause evidence.

### Stage 3 — Verification Loop (9-15 months)

1. Field validation protocol with closure SLAs
- every high-risk alert must be validated or rejected with audit trail.

2. Continuous calibration by asset class and biome
- per-domain thresholds (pipelines, roads, dams, ports) with periodic retraining.

3. Reliability scorecard per capability
- publish precision/recall/FAR by phenomenon and region.

### Stage 4 — Government-Grade Assurance (15-24 months)

1. Independent technical audits and blind challenges
- third-party verification of claims vs ground truth.

2. Regulatory evidence packaging
- exportable decision dossier: claim -> evidence -> uncertainty -> action history.

3. Mission-specific service tiers
- “Can Prove”, “Can Suspect”, “Cannot Observe” as contractual boundaries.

---

## 9) Bottom-Line Answer

ما الذي يستطيع النظام رؤيته اليوم بدقة؟

- تغيّرات مكانية وزمنية واسعة/متوسطة في النشاط الإنشائي، الغطاء النباتي، المؤشرات المائية، والحرائق الإقليمية.

ما الذي لا يستطيع رؤيته اليوم بدقة؟

- الأجسام الصغيرة الفردية (سيارات، رافعات، معدات، طائرات) وخطوط الكهرباء الدقيقة، وهبوطات mm-cm دون InSAR إنتاجي مكتمل.

ما أقل إضافة بيانات لبلوغ أعلى موثوقية ممكنة؟

1. VHR optical (sub-meter) لمناطق الأولوية.
2. InSAR production + GNSS calibration.
3. OT/SCADA integration.
4. Ground-truth closure workflow.

بدون هذه الحزمة، MINERVA يبقى ممتازاً في الاشتباه الهندسي واسع النطاق، لكنه لا يصل إلى إثبات تشغيلي شامل لكل فئة هدف.
