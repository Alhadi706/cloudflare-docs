# المقترح المعماري لنظام الأصول المؤسسي — DSF Platform
**تاريخ:** 2026-07-05  
**النوع:** مقترح معماري — قبل أي تنفيذ  
**المبدأ المحوري:** النظام في طور التطوير — لا قيود على إعادة الهيكلة

---

## الجزء الأول — إجابات أسئلة الملكية

> "من يملك الأصل في كل مرحلة من دورة حياته؟"

```
المرحلة             المالك              الدور
─────────────────────────────────────────────────────────────────
1. الشراء            المالية/المشتريات   يسجّلون: المورد، الفاتورة، التكلفة، الكمية
                                         لا يعرفون: أين سيُركَّب أو لأي موقع
                                         
2. دخول المخزن       المواد/المستودعات  الصنف = inventory_item وليس asset بعد
                                         يسجّلون: الاستلام، الحالة، موقع الرف
                                         
3. التركيب           المشاريع/الصيانة   لحظة التحوّل الحاسمة:
                                         هنا فقط يصبح "أصلاً مشغَّلاً"
                                         يُخبر نظام الأصول بـ: الموقع، الموقع الجغرافي،
                                         التاريخ، المشروع، المسؤول
                                         
4. التشغيل           إدارة الأصول        المالكة الرسمية — الجميع يُغذّيها
                                         التحكم يُضيف: قراءات تشغيلية
                                         الصيانة تُضيف: أوامر عمل
                                         GIS يُضيف: موقع جغرافي
                                         المالية تُضيف: استهلاك، تقييم
                                         
5. الصيانة           إدارة الأصول        لا تزال المالكة الرسمية
                                         الصيانة مستهلِكة وليست مالكة
                                         
6. النقل             إدارة الأصول        تصدر طلب النقل
                                         الحوكمة تعتمد
                                         المشاريع/المواقع يستلمون
                                         
7. الشطب             إدارة الأصول        تُقدم طلب الشطب
                                         المالية تحسب القيمة المتبقية
                                         الحوكمة تعتمد القرار النهائي
```

---

## الجزء الثاني — دورة الحياة الحالية (كما هي منفَّذة)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  المشتريات                                                               │
│  POST /api/v1/procurement/requests  →  لا رابط بالأصول                  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ × لا رابط تلقائي
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  المستودعات                                                              │
│  POST /api/v1/inventory/receipts  →  يُنشئ إيصال استلام                 │
│  لا يُنشئ asset_id                                                      │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ × لا رابط تلقائي  
                                   ▼
                        ┌──────────┴───────────┐
                        │  4 مسارات منفصلة!   │
                        └──────────────────────┘
                         ↙      ↓        ↓     ↘
          ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────────┐
          │Engineering│ │Asset │ │Fleet │ │Maintenance│
          │Workspace  │ │Regist│ │ API  │ │ Assets   │
          │(GeoJSON)  │ │(flat)│ │      │ │          │
          └──────────┘ └──────┘ └──────┘ └──────────┘
               ↕ ××          ↕ ××    ↕ ××       ↕ ××
          لا ترابط فيما بينها — كل نظام يعيش في جزيرة منفصلة
```

**الخلاصة:** الأصل يُولد 4 مرات، مرة في كل نظام، بدون مفتاح مشترك.

---

## الجزء الثالث — دورة الحياة المستهدفة

```
                    ┌─────────────────────────────────┐
                    │   MASTER ASSET REGISTRY (MAR)   │
                    │   الحقيقة الوحيدة للأصل         │
                    │   asset_id: UUID الوحيد          │
                    └──────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ↓                        ↓                        ↓
   ┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
   │  STAGE 1-2   │      │    STAGE 3-4     │      │   STAGE 5-7  │
   │  PRE-ASSET   │      │  OPERATIONAL     │      │   END-OF-LIFE│
   │              │      │    ASSET         │      │              │
   │ - مشتريات   │      │ - موقع (site)   │      │ - صيانة     │
   │ - استلام    │      │ - GIS location  │      │ - نقل       │
   │ - مخزون     │──────▶ - work orders  │──────▶ - شطب       │
   │             │      │ - تشغيل        │      │ - تصفية     │
   └──────────────┘      └──────────────────┘      └──────────────┘
   
   مُغذّون (Contributors):         مالك (Owner):
   المالية → قيمة مالية           إدارة الأصول دائماً
   المواد → استلام
   GIS → موقع جغرافي
   الصيانة → أوامر عمل
   المشاريع → تركيب في موقع
   التحكم → قراءات تشغيلية
```

---

## الجزء الرابع — نموذج قاعدة البيانات الموحدة (Single Source of Truth)

### الجدول المركزي: `assets`
```sql
assets
──────
id                UUID PRIMARY KEY
asset_code        VARCHAR(50) UNIQUE      -- WA-2026-00001
asset_class       ENUM:
                    'fixed_infrastructure'   -- أنابيب، طرق، أبراج
                    'fixed_equipment'        -- مضخات، صمامات، أجهزة ثابتة
                    'mobile_equipment'       -- معدات متنقلة
                    'vehicle'                -- مركبات
                    'property'               -- مباني، أراضي
                    'it_asset'               -- أجهزة تقنية
lifecycle_stage   ENUM:
                    'planned'        -- مخطط
                    'procured'       -- تم الشراء
                    'in_warehouse'   -- في المستودع
                    'staged'         -- جاهز للتركيب
                    'installed'      -- مُركَّب
                    'commissioned'   -- تم التشغيل
                    'active'         -- في التشغيل الفعلي
                    'under_maintenance'
                    'transferred'
                    'decommissioned'
                    'disposed'
name              VARCHAR(255)
description       TEXT
site_id           UUID → sites.id        -- الموقع التشغيلي
project_id        UUID → projects.id     -- المشروع إن وجد
department_id     UUID → departments.id  -- الإدارة المالكة
responsible_user  UUID → employees.id

-- الموقع الجغرافي (يُملأ عند التركيب فقط)
lat               DECIMAL(10,8)
lng               DECIMAL(11,8)
gis_feature_id    UUID → gis_features.id -- رابط للـ GIS layer
lrs_pipeline_id   UUID → gis_features.id -- للأصول الخطية
lrs_station_m     FLOAT                  -- موقع على الخط بالمتر

-- البيانات المالية
acquisition_value DECIMAL(15,2)
acquisition_date  DATE
current_value     DECIMAL(15,2)
health_score      SMALLINT (0-100)

-- معلومات تقنية (خاصة بالنوع)
specifications    JSONB                  -- مرن حسب النوع

-- للمركبات والمعدات المتنقلة
plate_number      VARCHAR(50)
license_expiry    DATE
current_odometer  FLOAT

tenant_id         UUID
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### الجداول المساندة
```sql
sites                      -- المواقع التشغيلية
──────
id, name, name_en, type    -- type: station/facility/office/field
lat, lng, municipality
parent_site_id             -- مواقع هرمية
tenant_id

asset_financial_events     -- كل الأحداث المالية للأصل
──────────────────────
id, asset_id, event_type   -- purchase/valuation/depreciation/maintenance_cost
amount, currency, date
reference_id, reference_type  -- PO رقم، أمر عمل رقم
created_by, tenant_id

asset_lifecycle_log        -- سجل انتقالات دورة الحياة
───────────────────
id, asset_id
from_stage, to_stage
from_site_id, to_site_id
reason, performed_by
approved_by, approved_at
tenant_id, created_at
```

---

## الجزء الخامس — الملكية والاستهلاك

### من يملك (Owners)
| الإدارة | ما تملكه | ما لا تملكه |
|---------|---------|------------|
| **إدارة الأصول** | دورة حياة الأصل بالكامل | — |
| **الحوكمة** | قرارات الشطب والنقل الكبرى | البيانات اليومية |

### من يُغذّي (Contributors)
| الإدارة | ما تُغذّيه | الـ API |
|---------|----------|--------|
| **المشتريات** | قيمة الشراء، المورد | `PATCH /assets/[id]/financial` |
| **المواد/المستودع** | تاريخ الاستلام، حالة الوصول | `POST /assets/[id]/receive` |
| **المشاريع** | الموقع، تاريخ التركيب | `POST /assets/[id]/install` |
| **الصيانة** | أوامر العمل، الحالة التقنية | `POST /work-orders` → asset_id |
| **GIS/الهندسة** | الإحداثيات، الـ geometry | `PATCH /assets/[id]/location` |
| **إدارة التحكم** | قراءات تشغيلية، SCADA | `POST /assets/[id]/readings` |
| **المالية** | الاستهلاك، التقييم الدوري | `POST /assets/[id]/valuation` |
| **HR** | المسؤول التشغيلي | `PATCH /assets/[id]/assignment` |

### من يستهلك (Consumers — قراءة فقط)
| الإدارة | ما تستهلكه |
|---------|----------|
| **مكتب المدير العام** | KPIs، صحة الأصول، التوزيع الجغرافي |
| **المالية** | قيم الأصول للميزانية والتدقيق |
| **الذكاء الاصطناعي** | تنبؤ بالأعطال، تحليل المخاطر |
| **الأقمار الاصطناعية** | مقارنة مع مواقع الأصول |

---

## الجزء السادس — خارطة الصفحات (ماذا يبقى وماذا يُحذف)

### ✅ تبقى وتُعزَّز
```
/admin-gateway/assets/registry    → THE master registry (النظام الوحيد)
/admin-gateway/assets/[id]        → Asset 360 (يُوسَّع ليشمل كل البيانات)
/admin-gateway/assets/categories  → يبقى (مبسَّط)
/gis-sovereignty/engineering-workspace → يبقى (يصبح مزوّد موقع فقط)
/admin-gateway/sites/             → يُنشأ جديد (إدارة المواقع)
```

### 🔀 تُدمج في Registry أو Asset 360
```
/admin-gateway/assets/health      → تبويب في Asset 360
/admin-gateway/assets/valuations  → تبويب في Asset 360
/admin-gateway/assets/maintenance → تبويب في Asset 360 (موجود)
/admin-gateway/assets/reviews     → تبويب في Asset 360
/admin-gateway/finance/asset-tracking → تبويب مالي في Asset 360
```

### 🚫 تُحذف نهائياً
```
/digital-assets/                  → portal مكرر
/asset-intelligence/              → portal مكرر
/admin-gateway/assets/list        → تجمع مصدرين متضاربين
/admin-gateway/assets/types       → مكرر مع categories
/dashboard/fleet/ (legacy)        → يُعاد توجيهه للـ vehicles
/admin-gateway/fleet/             → يُعاد توجيهه للـ vehicles
```

### 🔄 تُعاد هيكلتها
```
/admin-gateway/vehicles/*
  من: نظام Fleet مستقل بـ API منفصل
  إلى: فلتر "أصول متنقلة" في master registry
  
/dashboard/asset-360/* (legacy)
  من: portal منفصل (Phase 1 redirects تمت)
  إلى: حذف الملفات بعد التحقق من عدم الاستخدام
```

---

## الجزء السابع — توحيد الـ APIs

### المسارات الحالية التي تُلغى/تُوحَّد
```
يُلغى:  GET /api/engineering/workspace/principal-assets
يُستبدل بـ: POST /api/v1/assets (مع asset_class=infrastructure)
        + PATCH /api/v1/assets/[id]/location (يُعيَّن من GIS)

يُلغى:  GET /api/v1/workspace/assets/all
يُستبدل بـ: GET /api/v1/assets?class=...&site=...

يُلغى:  GET/POST /api/v1/fleet/*
يُستبدل بـ: GET /api/v1/assets?class=vehicle,mobile_equipment

يُلغى:  GET /api/v1/hr-structure/asset-health
يُستبدل بـ: GET /api/v1/assets/[id]/health

يُلغى:  GET /api/v1/hr-structure/asset-valuations
يُستبدل بـ: GET /api/v1/assets/[id]/financials

يُلغى:  GET /api/v1/maintenance/assets
يُستبدل بـ: GET /api/v1/assets?has_work_orders=true

يُلغى:  POST /api/v1/workspace/asset-gis-links (JSON file)
يُستبدل بـ: PATCH /api/v1/assets/[id]/location {gis_feature_id}
```

### الـ APIs المستهدفة (نهائية)
```
POST   /api/v1/assets                    → إنشاء أصل (minimal)
GET    /api/v1/assets                    → قائمة مع فلاتر متعددة
GET    /api/v1/assets/[id]              → كامل بيانات الأصل
PATCH  /api/v1/assets/[id]             → تحديث بيانات عامة

-- دورة الحياة
POST   /api/v1/assets/[id]/receive     → استلام من المستودع
POST   /api/v1/assets/[id]/install     → تركيب في موقع {site_id, gis_feature_id}
POST   /api/v1/assets/[id]/commission  → تشغيل
POST   /api/v1/assets/[id]/transfer    → نقل لموقع/مشروع آخر
POST   /api/v1/assets/[id]/decommission → إيقاف
POST   /api/v1/assets/[id]/dispose     → شطب

-- إثراء البيانات
PATCH  /api/v1/assets/[id]/location    → GIS يُعيّن الموقع
POST   /api/v1/assets/[id]/valuation   → المالية تُسجّل تقييم
GET    /api/v1/assets/[id]/360         → Asset 360 كامل
GET    /api/v1/assets/[id]/work-orders → تاريخ الصيانة
GET    /api/v1/assets/[id]/financials  → التاريخ المالي

-- LRS
POST   /api/v1/assets/lrs-import       → استيراد خطي يُنشئ assets حقيقية
```

---

## الجزء الثامن — مفهوم Site (الموقع التشغيلي)

### لماذا Site وليس فقط إحداثيات؟
```
الإحداثيات = حيث تقع المضخة على الأرض
الموقع = محطة حساونة التشغيلية

الفرق:
  - المضخة قد تتحرك 50م داخل المحطة → إحداثياتها تتغير
  - انتماؤها لمحطة حساونة لا يتغير
  - التقارير تُعدّ بالموقع: "كل أصول حساونة"
  - الميزانية تُخصَّص للموقع
  - الفرق الميدانية تعمل في موقع
```

### نموذج Site
```
sites
  Hassawna Station (محطة حساونة)
    ├── type: pump_station
    ├── lat/lng: (مركز الموقع)
    └── assets:
         ├── Pump #1 (fixed_equipment)
         ├── Pump #2 (fixed_equipment)
         ├── Control Panel A (fixed_equipment)
         └── Vehicle F-450 assigned here (vehicle)
         
  Shwerif Junction (تقاطع الشويرف)
    ├── type: distribution_node
    └── assets:
         ├── Valve Bank V-001 to V-015
         └── Flow Meter M-03
```

---

## الجزء التاسع — تأثير النهج على أنظمة أخرى

### Work Orders → تصبح context-aware
```
أمر العمل يحمل:
  asset_id → يعرف الأصل
  site_id  → يعرف الموقع
  
بدلاً من: location_text نصي مفتوح
```

### Asset 360 → يصبح حقيقياً
```
الآن: يعرض فقط workspace assets
المستهدف: يعرض كل ما يخص هذا الـ asset_id من أي نظام:
  - من المشتريات: تاريخ الشراء والمورد
  - من المستودع: تاريخ الاستلام
  - من GIS: الموقع الدقيق على الخريطة
  - من الصيانة: 25 سنة أوامر عمل
  - من المالية: الاستهلاك والقيمة الحالية
  - من التحكم: آخر القراءات التشغيلية
```

### GM Office Dashboard → يعكس الحقيقة
```
"إجمالي الأصول: 32,500"
بدلاً من: رقم من قاعدة واحدة فقط لا تعكس الصورة الكاملة
```

---

## الجزء العاشر — المخاطر

| الخطر | الاحتمال | التأثير | المعالجة |
|-------|---------|---------|---------|
| Backend لا يدعم unified assets API بعد | عالي | عالي | بناء Next.js proxy layer أولاً |
| بيانات موجودة في 6 قواعد لا يمكن توحيدها تلقائياً | متوسط | متوسط | migration script لكل نظام |
| فريق الصيانة اعتاد on-the-fly asset creation | متوسط | منخفض | UX تدريجي: نموذج جديد يستدعي API موحد |
| GIS features ليس لها asset_id في قاعدة البيانات | عالي | متوسط | phase: link-first قبل migrate |
| fleet records لا تملك asset_id | عالي | متوسط | إضافة حقل FK أولاً |

---

## الجزء الحادي عشر — خطة التنفيذ Sprint by Sprint

> **ملاحظة:** لأن النظام في طور التطوير، نتبع نهج Clean Architecture وليس Backward Compatibility.

---

### Sprint 1 — Site Management (الأساس)
**المدة:** أسبوع  
**المخرج:** Sites كـ first-class entities

```
الـ Backend المطلوب:
  جدول: sites (id, name, type, lat, lng, parent_id, tenant_id)
  
Next.js APIs:
  GET  /api/v1/sites
  POST /api/v1/sites
  GET  /api/v1/sites/[id]/assets
  
الصفحة:
  /admin-gateway/sites/  (جديدة — قائمة المواقع)
  
الفائدة:
  Work Orders تُربط بـ site_id بدلاً من نص حر
  Asset Registry يظهر "موقع" بدلاً من lat/lng مجردة
```

---

### Sprint 2 — Unified Asset Schema
**المدة:** أسبوعان  
**المخرج:** جدول assets موحد في Backend + Next.js proxy

```
Backend:
  تعديل جدول assets: + asset_class + lifecycle_stage + site_id
  
Next.js:
  الـ API الجديدة: GET/POST /api/v1/assets
  الـ proxy القديمة: /api/engineering/workspace/principal-assets
                     /api/v1/workspace/assets
                     /api/v1/fleet/*
  تُبقى كـ wrappers تستدعي الـ API الجديدة (backward compat مؤقت)

Registry تُحدَّث:
  إضافة حقل asset_class
  إضافة حقل site_id (يُختار من قائمة المواقع)
  إضافة lifecycle_stage (يتغير تلقائياً)
```

---

### Sprint 3 — Fleet Merge
**المدة:** أسبوع  
**المخرج:** المركبات والمعدات المتنقلة تُسجَّل كـ assets

```
كل vehicle في fleet → يُنشأ له asset_id في جدول assets
  asset_class = 'vehicle' or 'mobile_equipment'
  + حقول خاصة: plate_number, license_expiry
  
صفحة /admin-gateway/vehicles/ تُصبح:
  فلتر للـ master registry تعرض asset_class=vehicle OR mobile_equipment
  
صفحة /admin-gateway/fleet → تُحذف (كانت redirect أصلاً)
```

---

### Sprint 4 — GIS as Location Provider
**المدة:** أسبوع  
**المخرج:** GIS يُغذّي الأصول بالموقع، ليس يُنشئها

```
Engineering Workspace:
  لما يُرسم asset على الخريطة:
    1. إن كان له asset_id موجود → PATCH /api/v1/assets/[id]/location
    2. إن لم يكن → PROMPT: "هل تريد ربطه بأصل موجود أو إنشاء أصل جديد؟"

نتيجة:
  - asset_gis_link.json → يُحذف
  - gis_feature_id → حقل في جدول assets نفسه
```

---

### Sprint 5 — Lifecycle Transitions UI
**المدة:** أسبوعان  
**المخرج:** نموذج انتقالات دورة الحياة في Registry

```
Registry: كل أصل يعرض lifecycle_stage
  زر "استلم من المستودع" → POST /assets/[id]/receive
  زر "ركّب في موقع"    → POST /assets/[id]/install {site_id, date}
  زر "ابدأ التشغيل"    → POST /assets/[id]/commission
  زر "أوقف التشغيل"   → POST /assets/[id]/decommission

Procurement integration:
  عند اعتماد PO لمعدة → يُنشأ asset record تلقائياً بـ stage=procured
```

---

### Sprint 6 — LRS Integration
**المدة:** أسبوع  
**المخرج:** LRS batch import يُنشئ assets حقيقية في المسجل

```
حالياً: LRS يحفظ في .data/linear-assets/[tenant].json
بعد Sprint 6: LRS يُنشئ assets عبر POST /api/v1/assets
  - كل صمام/معدة → asset_id حقيقي في Master Registry
  - lrs_station_m + lrs_pipeline_id → حقول في assets
  - Work Orders القديمة → تُربط بـ asset_id تلقائياً عبر equipment_code
  - .data/linear-assets/ → يُحذف
```

---

### Sprint 7 — Full Asset 360
**المدة:** أسبوعان  
**المخرج:** Asset 360 يعرض كل البيانات من كل الأنظمة

```
تبويبات Asset 360 بعد Sprint 7:
  [ملخص]      → اسم، نوع، موقع، مرحلة دورة الحياة، health score
  [الموقع]    → خريطة (gis_feature_id)، site_name، lrs_station
  [الصيانة]  → work orders مرتبة زمنياً (من maintenance DB عبر asset_id)
  [المالية]  → تاريخ الشراء، الاستهلاك، القيمة الحالية، تكاليف الصيانة
  [التشغيل]  → قراءات من إدارة التحكم (إن وُجدت)
  [الوثائق]  → مرفقات ووثائق
  [الحوكمة]  → سجل انتقالات دورة الحياة
  [الجدول الزمني] → timeline مترابط لكل الأحداث
```

---

### Sprint 8 — Cleanup
**المدة:** أسبوع  
**المخرج:** حذف كل الكود القديم

```
تُحذف هذه الملفات نهائياً:
  app/dashboard/digital-assets/
  app/dashboard/asset-intelligence/
  app/dashboard/admin-gateway/assets/list/
  app/dashboard/admin-gateway/assets/types/
  app/dashboard/admin-gateway/finance/asset-tracking/
  app/dashboard/fleet/ (legacy)
  .data/asset-gis-links/
  .data/linear-assets/
  
تُحذف هذه الـ APIs:
  /api/engineering/workspace/principal-assets/* (بعد migration)
  /api/v1/hr-structure/asset-*
  /api/v1/fleet/* (بعد merge)
  /api/v1/maintenance/assets (بعد migration)
```

---

## الجزء الثاني عشر — ملخص تنفيذي للقرار

```
السؤال: هل نرقّع أم نعيد بناء؟
الجواب: نعيد بناء — لأن النظام في طور التطوير

السؤال: ما الذي يُحذف؟
الجواب:
  - 4 صفحات portal مكررة
  - نظام Fleet كـ module مستقل
  - hr-structure/asset-* endpoints
  - asset-gis-links JSON files
  - linear-assets JSON files
  
السؤال: ما الذي يبقى؟
الجواب:
  - Asset Registry (يُعزَّز ليصبح master registry)
  - Asset 360 (يُوسَّع ليشمل كل البيانات)
  - Engineering Workspace (يُحوَّل لمزوّد موقع فقط)
  - Work Orders (تُربط بـ asset_id)
  
السؤال: ما المفتاح المعماري؟
الجواب: Site كـ unit تشغيلي
  الأصل ينتمي لـ site, وليس لإحداثيات فقط
  
السؤال: من يملك الأصل؟
الجواب: إدارة الأصول دائماً. الجميع مغذّون.

عدد Sprints: 8
المدة التقديرية: 10-12 أسبوعاً
الفائدة: نظام أصول مؤسسي موحد يدعم 32,000+ أصل
```

---

*هذا المقترح يُقدَّم للمراجعة والاعتماد قبل بدء أي تنفيذ*  
*الملف: `/home/alhadi/digital-dashboard/docs/asset-enterprise-architecture.md`*
