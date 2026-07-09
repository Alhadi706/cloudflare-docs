# مركز استخبارات المشاريع (PIC) — تقرير الوضع الحالي
**التاريخ**: 2026-07-09  
**الفرع**: `minerva-improvements-1000`  
**الخادم**: `dev.d-me.ly` → port 3000 (dev mode)  
**الرابط**: `/dashboard/gis-sovereignty/project-intelligence-center`

---

## 1. ملخص تنفيذي

تم بناء منظومة **PIC** كاملة من الصفر وتشغيلها بنجاح. النظام يحلل صور الأقمار الاصطناعية من أرشيف Planet المحلي (28,701 مشهد / صورة مصغرة) ويُقدّر تقدم مشاريع البنية التحتية تلقائياً دون الحاجة لاشتراك Planet نشط.

---

## 2. مكونات النظام

### 2.1 قاعدة البيانات — `pic` schema (PostgreSQL)

| الجدول | الوصف | الحقول |
|--------|-------|--------|
| `pic.projects` | بيانات المشاريع | 30+ حقل (اسم، نوع، حالة، geometry، bbox، إنجاز، صحة...) |
| `pic.scans` | نتائج تحليل المشاهد | activity_score، change_magnitude، activity_state، thumbnail_url |
| `pic.events` | أحداث تلقائية | work_started، stopped، resumed، completed |
| `pic.alerts` | تنبيهات | long_stoppage، delayed، slow_progress، severity |

**قيود**: UNIQUE(project_id, scan_date, source) على جدول scans (idempotent).

---

### 2.2 الطبقة Backend

#### `lib/picDB.ts` (332 سطر)
- CRUD كامل: `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`
- Scans: `listScans`, `createScan` (ON CONFLICT DO UPDATE)
- Events: `listEvents`, `createEvent`
- Alerts: `listAlerts`, `createAlert`, `acknowledgeAlert`
- Dashboard: `getDashboardStats`
- Multi-tenant بالكامل: كل query مقيّدة بـ `tenant_id`
- تطبيع تواريخ PostgreSQL → `YYYY-MM-DD` string تلقائياً

#### `lib/picAnalysis.ts` (424 سطر)
- `findScenesForBbox(bbox, dateFrom, dateTo, maxCloud)` — يبحث في أرشيف Planet المحلي، يحسب bbox من geometry عند غيابه
- `compareImages(pathA, pathB)` — مقارنة PNG بدون API خارجي (file size + byte sampling)
- `classifyActivity(magnitude)` → active / slow / stopped
- `buildTimeline(project, scans)` → نقاط، توقفات، نسبة إنجاز، health score، اتجاه
- `analyzeProject(project, tenantId, opts)` — المحرك الرئيسي الكامل

---

### 2.3 API Routes

| Method | Endpoint | الوصف | Status |
|--------|----------|-------|--------|
| GET | `/api/v1/pic/projects` | قائمة مشاريع مع فلترة (status, type, limit) | ✅ 200 |
| POST | `/api/v1/pic/projects` | إنشاء مشروع جديد (يحسب bbox تلقائياً) | ✅ 201 |
| GET | `/api/v1/pic/projects/[id]` | تفاصيل + ?include=scans,events,timeline,archive | ✅ 200 |
| PUT | `/api/v1/pic/projects/[id]` | تعديل بيانات المشروع | ✅ 200 |
| DELETE | `/api/v1/pic/projects/[id]` | حذف مشروع | ✅ 200 |
| POST | `/api/v1/pic/projects/[id]?action=analyze` | تشغيل تحليل الأقمار | ✅ 200 |
| GET | `/api/v1/pic/dashboard` | KPIs + at-risk + تنبيهات أخيرة | ✅ 200 |
| GET | `/api/v1/pic/alerts` | التنبيهات (?unread=1) | ✅ 200 |
| POST | `/api/v1/pic/alerts?ack=id` | تأكيد قراءة تنبيه | ✅ 200 |

---

### 2.4 الواجهة — `PICShell.tsx` (1,124 سطر)

**وضع الخريطة:**
- خريطة OpenLayers تفاعلية (صور فضائية / طرق / داكن)
- عرض مشاريع كـ **مضلعات ملوّنة** (extractionLayers) أو **خطوط** للطرق (satelliteRouteLines)
- **overlay تاريخي حقيقي**: عند اختيار تاريخ، صورة الأرشيف تُعرض مُسجَّلة جغرافياً على الخريطة (ImageLayer + ImageStatic)
- **رسم مشروع جديد**: ارسم مضلع ← أدخل البيانات ← أنشئ
- أزرار الطيران إلى موقع المشروع

**لوحة التفاصيل (يمين):**
- معلومات المشروع الكاملة (مقاول، جهة، تواريخ)
- مقاييس: إنجاز % + health score + توقفات
- **مسار النشاط**: بياني شريطي بألوان الحالة (أخضر/أصفر/أحمر) لآخر 30 قراءة
- **فترات التوقف**: مع عدد الأيام وإشارة المستمر
- **المؤشر الزمني التاريخي**: شريط منزلق عبر 1,200-1,500+ مشهد من 2016 إلى اليوم، مع صورة مصغرة للمشهد المحدد
- **Lightbox**: الضغط على أي صورة يفتحها بالحجم الكامل
- أزرار تنقل ← → بين المشاهد

**لوحة KPIs:**
- 8 مؤشرات: إجمالي، نشطة، متوقفة، متأخرة، مكتملة، في خطر، متوسط إنجاز، متوسط صحة
- مشاريع تحتاج متابعة (health < 50)
- التنبيهات الأخيرة

---

## 3. الأرشيف المحلي

```
.data/planet-archive/
├── metadata/     28,701 ملف JSON
└── thumbnails/   28,701 صورة PNG
```

| المدينة / المنطقة | عدد المشاهد (تقريبي) |
|-------------------|---------------------|
| طرابلس (tripoli, tripoli_2025) | ~3,131 |
| قرقارش-أبوسليم (مشروع الطريق) | ~1,519 مشهد 2016-2026 |
| منطقة المستشفى | ~1,197 مشهد 2016-2026 |
| درنة (derna) | المتبقي |
| مشروع محطة الصرف الصحي | ~1,200+ |

---

## 4. البيانات الحالية في قاعدة البيانات

| المشروع | الكود | النوع | الحالة | scans | الإنجاز | الصحة |
|---------|-------|-------|--------|-------|---------|-------|
| طريق الدائري الثالث — قرقارش-أبوسليم | RD-TRP-041 | road | active | 1,841 | 85% | 91 |
| توسعة مستشفى طرابلس التعليمي | BLD-TRP-027 | building | active | 2,933 | 77% | 93 |
| محطة معالجة الصرف الصحي — أبوسليم | UTL-TRP-013 | utility | active | 5,007 | 97% | 94 |
| مشروع طريق السريع الساحلي | — | road | unknown | 0 | 0% | 50 |

**إجمالي dashboard**: 4 مشاريع، 3 نشطة، متوسط إنجاز 65%، متوسط صحة 82.

---

## 5. الأخطاء التي اكتُشفت وأُصلحت

| # | الخطأ | السبب الجذري | الإصلاح |
|---|-------|-------------|---------|
| 1 | `duplicate key 23505` → 500 بدون body | `existingDates.has()` يقارن `Date object` بـ `string` فيفشل دائماً | تطبيع التواريخ قبل المقارنة في `analyzeProject` |
| 2 | `scan_date.localeCompare is not a function` | PostgreSQL `DATE` → JS `Date object` | `toDateStr()` helper في `listScans` |
| 3 | نفس الخطأ للمشاريع الجديدة | `createScan` يُرجع الصف الخام | إضافة `toDateStr` في return `createScan` |
| 4 | `start_date` يُرجع `T00:00:00.000Z` | PostgreSQL `DATE` كـ timestamp في JSON | `normalizeProject()` helper في كل query |
| 5 | لا try-catch في analyze route | استثناء يصعّد إلى Next.js → 500 فارغة | إضافة try-catch + رسالة عربية |
| 6 | مشاريع لا تُرسم على الخريطة | `projectExtractionLayers` و`projectRouteLines` لم تُمرَّر | إضافة `extractionLayers` و`satelliteRouteLines` props |
| 7 | حالة `'delayed'` غير معرَّفة | غير موجودة في `ProjectStatus` union | إضافة `'delayed'` للنوع والـ STATUS_CONFIG |
| 8 | `findScenesForBbox` تُرجع جميع المشاهد (25,439!) | `meta.bbox` غير موجود في metadata فيتجاوز التصفية | حساب bbox من `geometry.coordinates` عند غيابه + جعل التصفية إلزامية |
| 9 | مجلدان فارغان `/analyze/` | أثر جانبي من agent سابق | حذفهما |

---

## 6. ما يمكن تطويره (Roadmap)

### 🔴 أولوية عالية
1. **تحسين `compareImages`**: استبدال المقارنة بالحجم+bytes بمقارنة pixel حقيقية عبر `sharp` → دقة أعلى بكثير في تقدير النشاط
2. **معايرة threshold الكشف**: `ACTIVE_THRESHOLD=0.20` يحتاج ضبطاً بناءً على مناطق مرجعية معروفة النشاط في طرابلس

### 🟠 أولوية متوسطة
3. **Pagination في archive scenes**: الآن يُرجع 1,500 مشهد كاملاً في request واحد (بطيء) — يجب `?limit=50&offset=N`
4. **Cron job للتحليل التلقائي**: حالياً التحليل يدوي — يجب job أسبوعي يعيد تحليل جميع المشاريع النشطة تلقائياً
5. **DELETE في الواجهة**: موجود في API لكن غير مربوط في PICShell
6. **ربط `projects_core_id`**: ربط المشاريع بجدول المشاريع الرئيسي في ERP

### 🟡 تحسينات UX
7. **تحسين overlay الخريطة**: الصورة المعروضة على الخريطة هي thumbnail منخفض الدقة — يمكن استخدام tile XYZ من Planet عند توفر مفتاح API
8. **Compare mode**: تقسيم الخريطة يسار/يمين لمقارنة تاريخين مختلفين (before/after)
9. **تصدير تقرير PDF**: تقرير تنفيذي لكل مشروع
10. **اتجاه Timeline**: `trend: declining` لجميع المشاريع يرجع لمقارنة 3 vs 3 نقاط فقط — يجب sliding window أكبر (30 يوماً)

---

## 7. الملفات الرئيسية

```
lib/
├── picDB.ts           (332 سطر) — قاعدة البيانات
└── picAnalysis.ts     (424 سطر) — محرك التحليل

app/api/v1/pic/
├── projects/route.ts            (65 سطر) — GET/POST
├── projects/[id]/route.ts      (131 سطر) — GET/PUT/DELETE/POST(analyze)
├── dashboard/route.ts           (49 سطر) — KPIs
└── alerts/route.ts              (38 سطر) — التنبيهات

app/dashboard/gis-sovereignty/project-intelligence-center/
├── page.tsx                     (11 سطر) — entry point
└── components/PICShell.tsx    (1124 سطر) — الواجهة الكاملة

app/dashboard/gis-sovereignty/satellite-intelligence-center/components/
└── SceneMapPanel.tsx — أضيف إليه staticImageOverlay prop
```

---

## 8. الأمان والمصادقة

- جميع API endpoints تتطلب `X-Tenant-ID` header (multi-tenant isolation)
- `/api/v1/pic/` معرَّفة في `PUBLIC_API_PATHS` بـ middleware — لكن كل route handler يستدعي `extractTenantId()` ويُرجع 401 إن لم يُرسل tenant
- SQL queries مُقيَّدة بـ `tenant_id = $1` في كل استعلام
- لا SQL injection: parametrized queries في كل مكان
- الـ `updateProject` يستخدم allowlist للحقول القابلة للتعديل

---

*تم إنشاء هذا التقرير: 2026-07-09*
