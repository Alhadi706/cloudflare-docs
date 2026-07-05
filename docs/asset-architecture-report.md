# تقرير معمارية نظام الأصول — DSF Platform
**تاريخ التقرير:** 2026-07-05  
**الحالة:** تحليل معماري — ما قبل إعادة الهيكلة  
**المُعِد:** تحليل تقني شامل للكود والـ APIs

---

## 1. الأنظمة الموجودة (6 أنظمة منفصلة)

### النظام 1 — Principal Assets (الأصول الهندسية الجغرافية)
| البند | التفصيل |
|-------|---------|
| **API** | `GET/POST /api/engineering/workspace/principal-assets` |
| **Backend** | Python `/api/v1/workspace/assets` — يستقبل GeoJSON Feature |
| **المدخل** | Engineering Workspace (رسم يدوي أو رفع Shapefile) |
| **ما يُخزَّن** | geometry + properties (اسم، نوع، إحداثيات، طول الخط) |
| **الصفحة** | `/dashboard/gis-sovereignty/engineering-workspace` |
| **الحالة** | ✓ يعمل — لكن مفصول عن بقية الأنظمة |
| **أمثلة** | خط الأنبوب، السد، المحطة، المبنى الإداري |

### النظام 2 — Workspace Assets (أصول ERP الإدارية/المالية)
| البند | التفصيل |
|-------|---------|
| **API** | `GET /api/v1/workspace/assets/all`, `POST /api/v1/workspace/assets` |
| **Backend** | Python `/api/v1/workspace/assets` — يستقبل flat JSON |
| **المدخل** | Asset Registry (نموذج إضافة أصل) |
| **ما يُخزَّن** | اسم، نوع، قيمة مالية، مسؤول، موقع نصي، project_id, lat/lng اختياري |
| **الصفحة** | `/dashboard/admin-gateway/assets/registry` |
| **Asset 360** | `/dashboard/admin-gateway/assets/[id]` |
| **الحالة** | ✓ يعمل — لكن مفصول عن الأصول الهندسية |
| **أمثلة** | مضخة، معدة ميكانيكية، جهاز قياس |

> **⚠ تداخل خطير:** النظام 1 والنظام 2 يكتبان على نفس جدول قاعدة البيانات (`/api/v1/workspace/assets`) لكن بتنسيقات مختلفة (GeoJSON vs flat JSON). لا يوجد ضمان أن البيانات المكتوبة من جهة قابلة للقراءة بشكل صحيح من الجهة الأخرى.

### النظام 3 — Maintenance Assets (أصول قاعدة الصيانة)
| البند | التفصيل |
|-------|---------|
| **API** | `GET /api/v1/maintenance/assets` |
| **المدخل** | قاعدة بيانات الصيانة (غير واضح المدخل) |
| **الصفحة** | `/dashboard/admin-gateway/assets/list` (تجمع النظام 2 و 3 معاً!) |
| **الحالة** | ⚠ مُدمج قسرياً مع workspace assets في نفس جدول UI |

**صفحة `/assets/list` تفعل هذا:**
```javascript
const [maintRes, workspaceRes] = await Promise.all([
  fetch('/api/v1/maintenance/assets', { headers }),  // النظام 3
  fetch('/api/v1/workspace/assets', { headers }),    // النظام 2
]);
// تدمج النتيجتين في قائمة واحدة
```
→ المستخدم يرى أصولاً من مصدرين مختلفين بدون تمييز.

### النظام 4 — Fleet System (المركبات والمعدات المتنقلة)
| البند | التفصيل |
|-------|---------|
| **API** | `/api/v1/fleet/vehicles`, `/api/v1/fleet/equipment`, `/api/v1/fleet/fuel` |
| **المدخل** | `/admin-gateway/vehicles/vehicles` و `/vehicles/equipment` |
| **ما يُخزَّن** | نوع المركبة، رقم اللوح، المشروع، الموقع، سجل الوقود |
| **الصفحة** | `/dashboard/admin-gateway/vehicles/*` |
| **الحالة** | ⚠ مفصول تماماً — لا رابط بأي نظام أصول آخر |

### النظام 5 — HR-Structure Assets (أصول هيكل HR — خطأ تصنيفي!)
| البند | التفصيل |
|-------|---------|
| **API** | `/api/v1/hr-structure/asset-health`, `/api/v1/hr-structure/asset-valuations`, `/api/v1/hr-structure/asset-categories` |
| **الصفحات** | `/assets/health`, `/assets/valuations`, `/assets/categories`, `/finance/asset-tracking` |
| **الحالة** | ✗ **خطأ تصنيفي خطير** — asset endpoints داخل مسار HR |

### النظام 6 — Linear Assets LRS (الأصول الخطية)
| البند | التفصيل |
|-------|---------|
| **API** | `POST /api/v1/workspace/linear-assets/batch-place` (جديد) |
| **Storage** | `.data/linear-assets/[tenantCode].json` (محلي مؤقت) |
| **المدخل** | Engineering Workspace → زر "استيراد خطي (LRS)" |
| **المنطق** | `distance_from_prev` → cumulative station → interpolation على polyline |
| **الحالة** | ✓ مبني حديثاً — لكن مفصول عن الأنظمة الخمسة السابقة |
| **أمثلة** | صمام هواء V-001، صمام غسيل، محطة ضخ على امتداد خط أنبوب |

---

## 2. الـ API الإضافية التي تتعامل مع الأصول

| المسار | الوظيفة | يستخدمها |
|--------|---------|---------|
| `/api/v1/workspace/principal-assets` | GIS assets للـ SharedAssetsPanel (قديم) | SharedAssetsPanel.tsx |
| `/api/v1/workspace/principal-assets/all-children` | كل child assets | SharedAssetsPanel.tsx |
| `/api/v1/workspace/assets/[id]/asset-360` | بيانات Asset 360 الكاملة | Asset 360 pages |
| `/api/v1/review/auto-match/[id]` | مطابقة تلقائية للأصول | ReviewModal.tsx |
| `/api/v1/review/approve/[id]` | اعتماد مراجعة أصل | ReviewModal.tsx |
| `/api/v1/intelligence/high-risk-assets` | أصول عالية الخطر | Asset Intelligence page |
| `/api/gis/[...slug]` | GIS layers عامة (تشمل gis_assets) | Engineering Workspace |
| `/api/v1/workspace/asset-gis-links` | ربط ERP↔GIS (جديد، JSON) | AssetGisLinkPanel.tsx |
| `/api/v1/finance/asset-valuations` | تقييمات مالية | Valuations page |
| `/api/v1/hr-structure/asset-health` | صحة الأصول (خطأ تصنيف) | Health, Valuations pages |
| `/api/v1/hr-structure/asset-categories` | فئات الأصول (خطأ تصنيف) | Categories page |

---

## 3. خريطة صفحات Frontend وأنظمتها

```
/dashboard/
├── asset-360/                          ← ⚠ يُعاد توجيهه الآن (Phase 4)
│   └── [id]/                           ← ⚠ يُعاد توجيهه الآن
├── asset-intelligence/                 ← portal يوجه لـ asset-360 + health
├── digital-assets/                     ← portal قديم يوجه لعدة صفحات
├── fleet/                              ← يُعاد توجيهه لـ /dashboard/fleet (مستقل)
└── admin-gateway/
    ├── assets/                         ← مركز إدارة الأصول
    │   ├── page.tsx                    ← Hub page (portal)
    │   ├── [id]/page.tsx              ← Asset 360 detail (الصحيح الآن)
    │   ├── registry/page.tsx          ← النظام 2: workspace/assets/all
    │   ├── list/page.tsx              ← يجمع النظام 2 + 3 (مشكلة!)
    │   ├── categories/page.tsx        ← النظام 5: hr-structure/asset-categories
    │   ├── health/page.tsx            ← النظام 5: hr-structure/asset-health
    │   ├── valuations/page.tsx        ← النظام 5: hr-structure/asset-valuations
    │   ├── maintenance/page.tsx       ← أوامر صيانة مرتبطة بالأصول
    │   ├── reviews/page.tsx           ← مراجعة بيانات جغرافية
    │   └── types/page.tsx             ← النظام 5: hr-structure/asset-categories
    ├── vehicles/                       ← النظام 4: fleet APIs
    │   ├── vehicles/page.tsx          ← /api/v1/fleet/vehicles
    │   ├── equipment/page.tsx         ← /api/v1/fleet/equipment
    │   └── fuel/page.tsx              ← /api/v1/fleet/fuel
    ├── fleet/                          ← يُعاد توجيهه لـ /dashboard/fleet
    ├── finance/asset-tracking/        ← النظام 5: hr-structure/asset-valuations
    └── platform-intelligence/
        └── asset-intelligence/        ← intelligence/high-risk-assets
```

---

## 4. العيوب المعمارية الجذرية

### العيب 1 — ازدواجية `workspace/assets` (الأشد خطورة)
```
مشكلة: نفس الـ endpoint يُكتب بتنسيقين مختلفين
  - Engineering Workspace → POST كـ GeoJSON Feature
  - Asset Registry → POST كـ flat JSON
  
التأثير:
  - بيانات مكتوبة من Engineering قد لا تظهر صحيحة في Registry
  - لا يوجد تمييز في قاعدة البيانات بين الأصلين
  - Asset 360 يقرأ البيانات بتنسيق واحد فقط
```

### العيب 2 — Asset endpoints في مسار `hr-structure`
```
المشكلة: /api/v1/hr-structure/asset-health
                              asset-valuations
                              asset-categories

هذه endpoints لا علاقة لها بـ HR.
التأثير:
  - عدم وضوح من يملك هذه البيانات (HR أم Assets؟)
  - الـ RBAC قد يمنع مدير الأصول من الوصول (لأنه يحتاج صلاحية HR)
  - صعوبة صيانة الكود وتطويره
```

### العيب 3 — Fleet مفصول عن Workspace Assets
```
المشكلة:
  مركبة مسجلة في fleet_vehicles → لا asset_id
  معدة مسجلة في fleet_equipment → لا asset_id
  
التأثير:
  - Asset 360 لا يعرض بيانات المركبة أو المعدة
  - تكاليف الوقود لا تظهر في التقارير المالية للأصل
  - Work Orders تُربط بـ asset_id (ERP) لكن المعدات لا تملك asset_id
  - نفس المركبة قد تُسجَّل مرتين: مرة كـ fleet، ومرة كـ workspace asset
```

### العيب 4 — ثلاث صفحات تعرض "قائمة الأصول"
```
/assets/registry  → workspace/assets/all (النظام 2 فقط)
/assets/list      → maintenance/assets + workspace/assets (النظامان 2 و 3 معاً)
/digital-assets   → portal قديم يوجه لـ asset-360 و registry
/asset-intelligence → portal آخر يوجه لـ health و intelligence

المستخدم لا يعرف أين يذهب ليجد أصله
قد يُضيف أصلاً في صفحة ولا يراه في صفحة أخرى
```

### العيب 5 — asset-gis-link في ملف JSON بدلاً من قاعدة بيانات
```
الحل الحالي: .data/asset-gis-links/[tenantCode].json
المشكلة:
  - مؤقت وغير موثوق
  - لا يدعم الاستعلامات المعقدة (مثلاً: كل أصول على خط النهر)
  - لا يوجد indexing → بطيء مع 32,000 أصل
  - لا يُدعم بـ foreign key constraints
  - يختلف بين deployments
```

### العيب 6 — Linear Assets (LRS) مفصولة عن Workspace Assets
```
الحل الحالي: .data/linear-assets/[tenantCode].json
المشكلة:
  - الصمام V-001 في LRS ليس له asset_id في workspace assets
  - لا يمكن إنشاء Work Order لـ V-001 (يحتاج asset_id)
  - Asset 360 لا يعمل لأصول LRS
  - أوامر العمل القديمة (25 سنة) لن تُربط تلقائياً
```

### العيب 7 — صفحتا `digital-assets` و `asset-intelligence` (مكررتان ومربكتان)
```
كلتاهما portals تشير لنفس المحتوى تقريباً
لا قيمة مضافة — تُشتت المستخدم فقط
```

---

## 5. خريطة البيانات والعلاقات الحالية (كما هي)

```
┌─────────────────────┐           ┌─────────────────────┐
│   GIS Principal     │  asset-   │   Workspace Assets  │
│   Assets (System 1) │◀-gis-link▶│   (System 2)        │
│                     │  (JSON!)  │                     │
│  - geometry         │           │  - financial data   │
│  - name, type       │           │  - health score     │
│  - lat/lng          │           │  - project_id       │
└─────────────────────┘           └─────────┬───────────┘
                                             │  عبر asset_id
                                             ▼
                                   ┌─────────────────────┐
                                   │   Work Orders       │
                                   │   (Maintenance)     │
                                   └─────────────────────┘

┌─────────────────────┐           ┌─────────────────────┐
│  Fleet Vehicles     │  ×لا ربط │  Maintenance Assets  │
│  (System 4)         │           │  (System 3)          │
│  - plate, type      │           │  - maintenance db    │
│  - project_id       │           └─────────────────────┘
└─────────────────────┘

┌─────────────────────┐           ┌─────────────────────┐
│  Linear Assets LRS  │  ×لا ربط │  HR-Structure        │
│  (System 6)         │           │  Asset Health        │
│  - .data/json       │           │  Valuations (Sys 5)  │
│  - station + lat/lng│           └─────────────────────┘
└─────────────────────┘
```

---

## 6. مقترحات إعادة الهيكلة

### الهدف: نموذج موحد للأصول (Unified Asset Model)

**المبدأ الجوهري:** كل شيء يُسمى "أصل" يجب أن يكون له `asset_id` واحد في جدول مركزي.

#### جدول مقترح: `unified_assets`
```sql
CREATE TABLE unified_assets (
  id              UUID PRIMARY KEY,
  asset_code      VARCHAR(50) UNIQUE,   -- رمز موحد (مثل: AST-2026-00001)
  asset_class     ENUM(
    'infrastructure',   -- بنية تحتية (أنابيب، طرق)
    'equipment',        -- معدات ثابتة (مضخات، صمامات)
    'vehicle',          -- مركبات ومعدات متنقلة
    'property',         -- عقارات ومباني
    'inventory_item'    -- مواد في المستودع
  ),
  name            VARCHAR(255),
  description     TEXT,
  
  -- الربط بالأنظمة الأخرى
  gis_feature_id  UUID REFERENCES principal_assets(id),  -- النظام 1
  fleet_id        UUID REFERENCES fleet_vehicles(id),    -- النظام 4
  maintenance_id  UUID REFERENCES maintenance_assets(id),-- النظام 3
  
  -- الموقع الجغرافي
  lat             DECIMAL(10,8),
  lng             DECIMAL(11,8),
  lrs_station_m   FLOAT,    -- موقع على الخط الخطي (LRS)
  pipeline_id     UUID,     -- مرجع خط الأنبوب (LRS)
  
  -- البيانات المالية
  acquisition_value  DECIMAL(15,2),
  current_value      DECIMAL(15,2),
  
  -- الحالة
  status          VARCHAR(50),
  health_score    SMALLINT,
  
  -- السياق التشغيلي
  project_id      UUID,
  site_id         UUID,
  department_owner VARCHAR(50),
  responsible_person VARCHAR(255),
  tenant_id       UUID
);
```

#### مسارات API الموحدة المقترحة
```
/api/v1/assets                    ← قائمة كل الأصول (بكل أنواعها)
/api/v1/assets/[id]               ← تفصيل أصل
/api/v1/assets/[id]/360           ← Asset 360 (ملخص + GIS + صيانة + مالية)
/api/v1/assets/[id]/health        ← صحة الأصل (نقل من hr-structure)
/api/v1/assets/[id]/valuations    ← تقييم مالي (نقل من hr-structure + finance)
/api/v1/assets/[id]/work-orders   ← أوامر العمل المرتبطة
/api/v1/assets/[id]/gis-link      ← الربط الجغرافي

/api/v1/assets/search?class=vehicle&project=X  ← بحث متقدم
/api/v1/assets/lrs-batch          ← استيراد خطي (LRS)
```

---

## 7. خطة العلاج بالأولوية

### الأولوية 1 — فورية (Frontend فقط، لا تغيير Backend)
| المهمة | الفائدة | الجهد |
|--------|---------|-------|
| ربط Fleet بـ Workspace Assets عبر حقل `asset_id` في نموذج المركبة | مركبات تظهر في Asset 360 | يوم واحد |
| إزالة صفحتي `digital-assets` و `asset-intelligence` الـ portals المكررة | تبسيط التنقل | ساعات |
| توحيد `/assets/list` لاستخدام مصدر واحد فقط | نهاية التضارب | يوم واحد |

### الأولوية 2 — قصيرة المدى (تتطلب Backend)
| المهمة | الفائدة | الجهد |
|--------|---------|-------|
| نقل asset-health و asset-valuations من `hr-structure` إلى `assets` | صحة تصنيفية | يوم واحد |
| ترقية asset-gis-link من JSON إلى جدول قاعدة بيانات | موثوقية واستعلام | أسبوع |
| بعد LRS batch import: إنشاء workspace asset تلقائياً لكل أصل خطي | work orders لـ V-001 | أسبوع |

### الأولوية 3 — طويلة المدى (إعادة هيكلة كاملة)
| المهمة | الفائدة | الجهد |
|--------|---------|-------|
| جدول `unified_assets` مع FKs لكل الأنظمة | نموذج بيانات نظيف | شهر |
| توحيد API تحت `/api/v1/assets/*` | سهولة الصيانة | شهر |
| Asset 360 يعرض بيانات من كل الأنظمة (fleet + LRS + maintenance) | تجربة متكاملة | شهر |

---

## 8. الأثر على المستخدم النهائي

### المشكلة كما يراها مدير الأصول
```
سيناريو: البحث عن "مضخة رقم 5 في محطة النهر"

الوضع الحالي:
  1. يفتح /assets/registry → لا يجدها (لم تُضف بعد من هنا)
  2. يفتح /assets/list → يرى شيئاً من maintenance assets لكن بدون تفصيل
  3. يفتح Engineering Workspace → يرى "محطة الضخ" كنقطة على الخريطة
     لكن لا بيانات تشغيلية
  4. يفتح Fleet/equipment → يجد المضخة كمعدة
     لكن لا موقع على الخريطة ولا تاريخ صيانة
  5. يفتح Work Orders → يجد أوامر عمل لكن بدون ربط بالخريطة

→ المستخدم يحتاج 5 صفحات مختلفة للحصول على صورة كاملة عن أصل واحد
```

### الوضع المطلوب
```
المستخدم يفتح /assets/registry → يجد "مضخة رقم 5"
يضغط 360° → يرى في تبويب واحد:
  ✓ موقعها على الخريطة (من GIS Principal Asset)
  ✓ بياناتها المالية (قيمة الاستهلاك، تاريخ الشراء)
  ✓ 25 سنة من أوامر العمل
  ✓ km 47 من خط النهر (من LRS)
  ✓ ساعات التشغيل وتكلفة الوقود (من Fleet)
  ✓ صحتها الحالية (health score)
```

---

## 9. ملخص تنفيذي

| البُعد | التقييم |
|--------|---------|
| عدد أنظمة الأصول المنفصلة | 6 أنظمة |
| عدد APIs تتعامل مع الأصول | 15+ endpoint |
| عدد صفحات Frontend للأصول | 12+ صفحة |
| وجود نموذج بيانات موحد | ✗ لا يوجد |
| ربط Fleet بـ Asset 360 | ✗ غير موجود |
| ربط LRS بـ Work Orders | ✗ غير موجود |
| صحة تصنيف API paths | ⚠ asset endpoints في hr-structure |
| موثوقية asset-gis-link | ⚠ JSON محلي مؤقت |
| جاهزية للإنتاج مع 32,000 أصل | ⚠ تحتاج ترقية |

**الخلاصة:** النظام يعمل جزئياً لكل نوع أصول على حدة، لكن لا يوجد نموذج موحد يجمعها. Asset 360 يعرض جزءاً فقط من البيانات الحقيقية لأي أصل. الأولوية الفورية هي ربط Fleet بـ Workspace Assets وتوحيد صفحات القائمة.

---

*تم إنشاء هذا التقرير بتحليل شامل لكل الكود والـ APIs في `/home/alhadi/digital-dashboard`*
