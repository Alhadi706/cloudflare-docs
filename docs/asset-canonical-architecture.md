# المقترح المعماري الكانوني لنظام الأصول المؤسسي
**Canonical Asset Model — Enterprise Architecture Proposal**
**تاريخ:** 2026-07-05 | **الحالة:** مقترح للاعتماد قبل التنفيذ

---

## الاكتشاف المفاجئ — الحقيقة الأولى

> قبل أي اقتراح، هذه الحقيقة التي غيّرت الاستراتيجية كلياً.

**الـ Backend لديه فعلاً جدول أصول واحد موحّد.**

```
http://localhost:7860/api/v1/workspace/assets

يدعم حالياً:
  POST   /assets              → إنشاء
  GET    /assets              → قائمة (بفلاتر project_id, site_id, layer_id)
  PUT    /assets/[id]         → تحديث
  DELETE /assets/[id]         → حذف
  POST   /assets/[id]/documents   → وثائق
  POST   /assets/[id]/employees   → موظفون مرتبطون
  POST   /assets/[id]/financials  → بيانات مالية
  GET    /assets/[id]/children    → أصول فرعية
  POST   /assets/[parentId]/children → إضافة أصل فرعي
  GET    /assets/[id]/center      → Asset Center (كل البيانات)
  PATCH  /assets/[id]/set-compound → تعيين كمجمّع
  POST   /assets/[id]/handover    → تسليم
```

**المشكلة ليست في Backend — المشكلة في Frontend تماماً.**

Frontend أنشأ مسارين مختلفين للكتابة على نفس الجدول:

```
المسار 1 (Engineering Workspace):
  يكتب كـ GeoJSON Feature → { geometry, properties: { name, classification... } }
  عبر: POST /api/engineering/workspace/principal-assets

المسار 2 (Asset Registry):
  يكتب كـ flat JSON → { asset_name, asset_type, acquisition_value... }
  عبر: GET /api/v1/workspace/assets/all
       POST /api/v1/workspace/assets

→ نفس جدول قاعدة البيانات في Backend
→ تحويلات مختلفة في Next.js proxy
→ لا يوجد ضمان أن بيانات المسار 1 مقروءة صحيحاً من المسار 2
```

**الاستراتيجية الصحيحة إذاً:** لا حاجة لإنشاء backend جديد — نُوحّد المسارات في Frontend فقط.

---

## الجزء الأول — خريطة نقاط الإنشاء الكاملة (Asset Birth Points)

### كل مكان يُنشئ أصلاً اليوم:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  نقطة 1: Engineering Workspace — CreatePrincipalAssetModal              │
│  ─────────────────────────────────────────────────────────────────────  │
│  يُرسل إلى: POST /api/engineering/workspace/principal-assets           │
│  الحقول: name, geometry_type, classification, owner_department,        │
│          status, geometry (GeoJSON)                                     │
│  المشكلة: يتطلب رسم geometry قبل الإنشاء (الخريطة أولاً)              │
│  نوع الأصل المناسب: infrastructure فقط (له شكل جغرافي)                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  نقطة 2: Engineering Workspace — AddChildAssetModal                     │
│  ─────────────────────────────────────────────────────────────────────  │
│  يُرسل إلى: POST /api/v1/workspace/assets/[parentId]/children          │
│  الحقول: asset_name, asset_type, owning_department, status,           │
│          health_score, geometry (اختياري)                               │
│  المشكلة: ينشئ child asset مرتبطاً بـ parent GIS asset                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  نقطة 3: Asset Registry — نموذج إضافة أصل                             │
│  ─────────────────────────────────────────────────────────────────────  │
│  يُرسل إلى: POST /api/v1/workspace/assets (عبر catch-all proxy)       │
│  الحقول: asset_name, asset_type, location (نص), status,               │
│          acquisition_date, acquisition_value, condition,                │
│          responsible_person, project_id, site_id, lat, lng,            │
│          health_score                                                   │
│  المشكلة: لا يشترط geometry — موقع نصي مفتوح                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  نقطة 4: Fleet Vehicles — /vehicles/vehicles                           │
│  ─────────────────────────────────────────────────────────────────────  │
│  يُرسل إلى: POST /api/v1/fleet/vehicles                               │
│  الحقول: plate, type, project_id, site_id...                          │
│  المشكلة: جدول منفصل في Backend — لا علاقة بـ assets                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  نقطة 5: Fleet Equipment — /vehicles/equipment                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  يُرسل إلى: POST /api/v1/fleet/equipment                              │
│  الحقول: name, type, project_id, serial_number...                     │
│  المشكلة: جدول منفصل — لا asset_id في جدول assets                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  نقطة 6: LRS Batch Import — LinearAssetImporter                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  يُرسل إلى: POST /api/v1/workspace/linear-assets/batch-place          │
│  التخزين: .data/linear-assets/[tenantCode].json (ملف محلي!)          │
│  المشكلة: لا يُنشئ asset_id حقيقي في Backend أبداً                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### ملخص نقاط الإنشاء:
| النقطة | مسار Frontend | مسار Backend | جدول قاعدة البيانات |
|--------|---------------|--------------|---------------------|
| GIS Principal | `/api/engineering/workspace/principal-assets` | `/api/v1/workspace/assets` | `assets` |
| GIS Child | `/api/v1/workspace/assets/[id]/children` | `/api/v1/workspace/assets/[id]/children` | `assets` (nested) |
| ERP Registry | `/api/v1/workspace/assets` (catch-all) | `/api/v1/workspace/assets` | `assets` |
| Fleet Vehicles | `/api/v1/fleet/vehicles` | `/api/v1/fleet/vehicles` | `fleet_vehicles` ← **منفصل!** |
| Fleet Equipment | `/api/v1/fleet/equipment` | `/api/v1/fleet/equipment` | `fleet_equipment` ← **منفصل!** |
| LRS Linear | `/api/v1/workspace/linear-assets/batch-place` | لا يصل للـ Backend | `.data/` ← **ملف محلي!** |

---

## الجزء الثاني — أنواع الأصول الثلاثة ومتطلباتها

### النوع الأول: Site Assets (أصول الموقع)
```
التعريف: أصل ثابت يرتبط بموقع تشغيلي محدد (محطة، مبنى، ورشة)

أمثلة:
  - محطة ضخ (Station)
  - مبنى إداري
  - مستودع
  - غرفة تحكم

متطلبات النموذج:
  - site_id: UUID ← الموقع التشغيلي (أهم من lat/lng)
  - lat/lng: اختياري (مركز الموقع)
  - gis_feature_id: اختياري (polygon على الخريطة)
  - lifecycle_stage: planned → installed → active → decommissioned

كيف يُنشأ:
  1. المالية تشتريه (PO) → status=procured
  2. المستودع يستلمه → status=in_warehouse
  3. المشاريع/الصيانة تركّبه في site → status=installed → status=active
  يمكن إنشاؤه بدون خريطة أولاً، ثم GIS يضيف الشكل لاحقاً
```

### النوع الثاني: Linear Assets (أصول الخط)
```
التعريف: أصل يرتبط بموقعه على خط/مسار وليس بموقع ثابت

أمثلة:
  - صمام هواء على خط أنبوب النهر
  - عداد تدفق عند km 47
  - غرفة تفتيش
  - نقطة غسيل

متطلبات النموذج:
  - pipeline_id: UUID ← مرجع خط الأنبوب (من gis_features)
  - station_m: FLOAT ← موقعه على الخط بالمتر (من بداية الخط)
  - lat/lng: يُحسب تلقائياً من LRS engine (interpolation)
  - site_id: NULL لهذه الأصول (ليست في موقع ثابت)
  - لا تنتمي لموقع — تنتمي للخط

ملاحظة معمارية حاسمة:
  لا يجوز إجبار linear asset على site_id
  لكن يمكن تعيينها لـ "خط النهر الصناعي" كـ parent context
  
كيف يُنشأ:
  LRS batch import → يُنشئ backend assets حقيقية بـ:
    asset_class = 'linear_component'
    pipeline_id = مرجع الخط
    station_m = موقع على الخط
    lat/lng = محسوب تلقائياً
```

### النوع الثالث: Mobile Assets (الأصول المتنقلة)
```
التعريف: أصل يتحرك باستمرار ولا يرتبط بموقع ثابت

أمثلة:
  - مركبة ميدانية
  - حفارة
  - مولد متنقل
  - معدة مسح

متطلبات النموذج:
  - current_site_id: UUID nullable ← أين هو الآن (قابل للتغيير)
  - current_project_id: UUID nullable ← أي مشروع يخدم
  - plate_number / serial_number
  - gps_tracking: boolean (هل يُتتبع عبر GPS؟)
  - NO fixed lat/lng (يتغير باستمرار)
  
كيف يُنشأ:
  نفس مسار Site Assets لكن بـ asset_class='vehicle' أو 'mobile_equipment'
  ليس من Fleet module منفصل
```

---

## الجزء الثالث — النموذج المستهدف للبيانات

### حقول الإضافة على جدول `assets` الموجود

الجدول موجود في Backend ويحتوي حقولاً كثيرة. نحتاج إضافة:

```sql
-- حقول تحتاج إضافة أو تأكيد وجودها:
asset_class     ENUM('infrastructure', 'site_equipment', 'linear_component',
                     'vehicle', 'mobile_equipment', 'property', 'it_asset')
lifecycle_stage ENUM('planned', 'procured', 'in_warehouse', 'staged',
                     'installed', 'commissioned', 'active', 
                     'under_maintenance', 'transferred', 'decommissioned', 'disposed')
site_id         UUID  → FK to sites table (أهم إضافة)
pipeline_id     UUID  → FK to gis_features (للـ linear assets فقط)
station_m       FLOAT → LRS position (للـ linear assets فقط)
```

### الجدول الجديد المطلوب: `sites`

```sql
sites (الغائب الأكبر عن النظام)
──────
id              UUID PRIMARY KEY
name            VARCHAR(255)      -- "محطة حساونة"
name_en         VARCHAR(255)      -- "Hassawna Station"  
type            ENUM('pump_station', 'distribution_node', 'facility',
                     'warehouse', 'office', 'field_camp', 'junction')
parent_site_id  UUID NULLABLE     -- للتسلسل الهرمي
lat             DECIMAL(10,8)
lng             DECIMAL(11,8)
municipality    VARCHAR(100)
tenant_id       UUID
is_active       BOOLEAN DEFAULT true
```

---

## الجزء الرابع — دورة حياة الأصل (State Machine)

```
                    ┌─────────────┐
                    │   PLANNED   │ ← المالية/المشتريات تُخطط
                    └──────┬──────┘
                           │ PO Approved
                           ▼
                    ┌─────────────┐
                    │  PROCURED   │ ← تم الشراء (PO صادر)
                    └──────┬──────┘
                           │ Delivery Confirmed
                           ▼
                    ┌─────────────┐
                    │ IN_WAREHOUSE│ ← المستودع استلم
                    └──────┬──────┘
                           │ Installation Order
                           ▼
                    ┌─────────────┐
                    │   STAGED    │ ← جاهز للتركيب
                    └──────┬──────┘
                           │ Installed at Site/Pipeline
                           ▼
                    ┌─────────────┐
                    │  INSTALLED  │ ← تم التركيب (site_id أو pipeline_id يُعيَّن هنا)
                    └──────┬──────┘
                           │ Commissioning Complete
                           ▼
                    ┌─────────────┐
              ┌────▶│   ACTIVE    │◀────────────────────┐
              │     └──────┬──────┘                     │
              │            │                            │
              │     Work Order Opened            Maintenance Done
              │            ▼                            │
              │     ┌─────────────┐                     │
              └─────│  UNDER_MAINT│─────────────────────┘
                    └──────┬──────┘
                           │ Transfer Order
                           ▼
                    ┌─────────────┐
                    │ TRANSFERRED │ ← نُقل لموقع/مشروع آخر
                    └──────┬──────┘
                           │ Decommission Decision
                           ▼
                    ┌─────────────────┐
                    │ DECOMMISSIONED  │ ← أُوقف تشغيله
                    └──────┬──────────┘
                           │ Disposal Approved
                           ▼
                    ┌─────────────┐
                    │  DISPOSED   │ ← شُطب نهائياً
                    └─────────────┘
```

### قاعدة حاسمة: site_id يُعيَّن عند INSTALLED فقط
```
المالية تشتري → تُنشئ asset بـ lifecycle_stage=procured, site_id=NULL
المستودع يستلم → يُحدّث إلى in_warehouse, site_id=NULL
المشاريع/الصيانة تركّب → يُحدّث إلى installed, site_id=[محطة حساونة]
GIS يُسجّل الموقع → يُضيف lat/lng أو pipeline_id+station_m
```

---

## الجزء الخامس — الملكية والمساهمة لكل إدارة

### خارطة المالك والمُغذّين

```
┌──────────────────────────────────────────────────────────────────────┐
│ إدارة الأصول — OWNER (المالك الوحيد)                                │
│ تملك دورة الحياة الكاملة من planned حتى disposed                    │
│ لا أحد يستطيع إنشاء أصل دون مرور بـ Master Asset Registry           │
└──────────────────────────────────────────────────────────────────────┘

المشتريات → تُنشئ asset عند اعتماد PO (stage=procured)
            تُضيف: acquisition_value, supplier_id, po_number

المواد/المستودع → تُحدّث stage إلى in_warehouse عند الاستلام
                 تُضيف: receipt_date, warehouse_id, condition

المشاريع → تُحدّث stage إلى installed عند التركيب
           تُضيف: site_id, installation_date, installer

الصيانة → تُنشئ work orders مرتبطة بـ asset_id
          لا تُنشئ أصولاً جديدة
          تُحدّث: health_score بعد الصيانة

GIS/الهندسة → تُضيف: lat/lng, gis_feature_id, pipeline_id, station_m
              لا تُنشئ أصولاً بالرسم على الخريطة
              
المالية → تُضيف: depreciation records, current_value
          لا تُنشئ أصولاً مالية منفصلة

إدارة التحكم → تُضيف: operational_readings, scada_tags
               تستهلك فقط — لا تُنشئ

الحوكمة → تعتمد: التنازلات، النقل، الشطب
```

---

## الجزء السادس — قرارات الصفحات

### ✅ تبقى وتُعزَّز (Keep & Enhance)
```
/admin-gateway/assets/registry
  → THE master registry للكل
  → يُضاف إليه: asset_class selector + lifecycle_stage badge + site selector
  
/admin-gateway/assets/[id]
  → Asset 360 الكامل (يُوسَّع)
  → 8 تبويبات: ملخص + موقع + صيانة + مالية + وثائق + تشغيل + حوكمة + timeline
  
/admin-gateway/assets/categories
  → يبقى (يُبسَّط)
  
/gis-sovereignty/engineering-workspace
  → يبقى كـ GIS Location Provider
  → لا ينشئ asset مستقلاً — يُغذّي registry بالموقع فقط
  
/admin-gateway/sites/ (جديد)
  → إدارة المواقع التشغيلية
  → CRUD للمواقع، عرض أصول كل موقع
```

### 🔀 تُدمج في أماكن صحيحة (Merge)
```
/admin-gateway/assets/health
  → تبويب داخل Asset 360
  
/admin-gateway/assets/valuations
  → تبويب داخل Asset 360
  
/admin-gateway/assets/maintenance
  → تبويب داخل Asset 360 (موجود جزئياً)
  
/admin-gateway/assets/reviews
  → تبويب في Asset 360 أو workflow panel
  
/admin-gateway/finance/asset-tracking
  → يُدمج في تبويب "المالية" داخل Asset 360
  
/admin-gateway/vehicles/*
  → يُعاد هيكلته كـ "فلتر أصول متنقلة" في registry
  → /admin-gateway/assets/registry?class=vehicle
```

### 🚫 تُحذف نهائياً (Delete Completely)
```
/digital-assets/           → portal مكرر بلا قيمة
/asset-intelligence/       → portal مكرر بلا قيمة
/admin-gateway/assets/list → يجمع مصدرين متضاربين
/admin-gateway/assets/types → مكرر مع categories
/dashboard/fleet/          → redirect أصلاً — يُحذف
/admin-gateway/fleet/      → redirect أصلاً — يُحذف
/dashboard/asset-360/      → redirects تمت (Phase 1) — يُحذف الكود
```

---

## الجزء السابع — توحيد الـ APIs

### المسار الوحيد للإنشاء (Single Creation Path)

```
كل شيء يمر عبر: POST /api/v1/assets

هذا الـ endpoint يحل محل:
  - POST /api/engineering/workspace/principal-assets
  - POST /api/v1/workspace/assets (catch-all)
  - POST /api/v1/fleet/vehicles
  - POST /api/v1/fleet/equipment
  - POST /api/v1/workspace/linear-assets/batch-place (LRS)

الـ payload الموحّد:
{
  "name": "مضخة رقم 5",
  "asset_class": "site_equipment",        ← النوع الجديد
  "lifecycle_stage": "procured",           ← المرحلة
  "site_id": null,                         ← NULL حتى التركيب
  "classification": "pump",
  "acquisition_value": 45000,
  
  // للـ linear assets فقط:
  "pipeline_id": "uuid-خط-النهر",
  "station_m": 47000,
  
  // للـ GIS assets (يُضاف لاحقاً):
  "geometry": { "type": "Point", "coordinates": [13.5, 32.8] }
}
```

### APIs التي تُلغى
```
POST /api/engineering/workspace/principal-assets
  → يُعاد توجيهه: POST /api/v1/assets مع asset_class=infrastructure + geometry

GET /api/v1/workspace/assets/all
  → يُعاد توجيهه: GET /api/v1/assets

GET/POST /api/v1/fleet/*
  → بعد migration: GET /api/v1/assets?class=vehicle,mobile_equipment

GET /api/v1/hr-structure/asset-health
  → يُعاد توجيهه: GET /api/v1/assets/[id]/health

GET /api/v1/hr-structure/asset-valuations
  → يُعاد توجيهه: GET /api/v1/assets/[id]/financials

GET /api/v1/maintenance/assets
  → يُعاد توجيهه: GET /api/v1/assets?has_work_orders=true

POST /api/v1/workspace/asset-gis-links
  → يُدمج في: PATCH /api/v1/assets/[id] { gis_feature_id }

POST /api/v1/workspace/linear-assets/batch-place
  → يُعاد بناؤه ليُنشئ assets حقيقية في Backend
```

### APIs المستهدفة النهائية
```
-- CRUD أساسي
POST   /api/v1/assets                     → إنشاء (مصدر الحقيقة الوحيد)
GET    /api/v1/assets?class=X&stage=Y&site=Z  → قائمة مع فلاتر شاملة
GET    /api/v1/assets/[id]                → تفصيل كامل
PATCH  /api/v1/assets/[id]               → تحديث (أي إدارة تُغذّي)
DELETE /api/v1/assets/[id]               → حذف (admin only)

-- دورة الحياة (Lifecycle Transitions)
POST /api/v1/assets/[id]/receive       → المستودع يُسجّل الاستلام
POST /api/v1/assets/[id]/install       → تركيب في موقع { site_id, date }
POST /api/v1/assets/[id]/commission    → بدء التشغيل الرسمي
POST /api/v1/assets/[id]/transfer      → نقل لموقع آخر { to_site_id }
POST /api/v1/assets/[id]/decommission  → إيقاف التشغيل
POST /api/v1/assets/[id]/dispose       → شطب نهائي (يحتاج governance approval)

-- إثراء البيانات (Enrichment — كل إدارة تُغذّي)
PATCH /api/v1/assets/[id]/location     → GIS يُعيّن الموقع الجغرافي
POST  /api/v1/assets/[id]/financials   → المالية: تقييم/استهلاك
GET   /api/v1/assets/[id]/work-orders  → قراءة تاريخ الصيانة
GET   /api/v1/assets/[id]/360          → Asset 360 كامل

-- المواقع
GET  /api/v1/sites                     → قائمة المواقع
POST /api/v1/sites                     → إنشاء موقع
GET  /api/v1/sites/[id]/assets         → أصول موقع محدد

-- LRS (موحّد مع assets)
POST /api/v1/assets/lrs-batch          → استيراد خطي ← ينشئ assets حقيقية
GET  /api/v1/assets?pipeline_id=X      → أصول خط محدد
```

---

## الجزء الثامن — تأثير التغيير على GIS

### القاعدة الجديدة لـ GIS

```
قبل: Engineering Workspace = مكان إنشاء الأصول
بعد: Engineering Workspace = مكان تحديد موقع الأصول الموجودة

التغيير العملي في الواجهة:
  بدلاً من: "ارسم مضلعاً ثم اسمّ الأصل"
  يصبح:     "اختر أصلاً موجوداً من Registry، ثم ارسم موقعه"
  
أو: "ارسم أولاً → النظام يسألك: هل تريد ربطه بأصل موجود أم إنشاء أصل جديد؟"
  
الحالة الوحيدة التي يُنشئ GIS أصلاً فيها:
  Infrastructure أصول ضخمة لا يُشتريها أحد (خطوط الأنابيب نفسها، الطرق)
  وفي هذه الحالة: النموذج يبقى كما هو لكن يُكمل البيانات المطلوبة
```

---

## الجزء التاسع — مقارنة النهجين

### النهج القديم (ما هو موجود)
```
مستخدم يريد إضافة "مضخة رقم 5 في محطة حساونة":

الخيار A (Registry): يفتح Asset Registry → يملأ نموذج flat
  → يُنشئ workspace asset بدون geometry
  
الخيار B (GIS): يفتح Engineering Workspace → يرسم نقطة على الخريطة
  → يُنشئ principal asset بـ GeoJSON
  
النتيجة: أصلان في نفس قاعدة البيانات بدون علاقة بينهما
```

### النهج الجديد (المستهدف)
```
مستخدم يريد إضافة "مضخة رقم 5 في محطة حساونة":

خطوة 1 (المالية عند الشراء):
  Asset Registry → "أصل جديد" → يملأ: الاسم، النوع، القيمة، lifecycle=procured
  → يُنشئ asset_id موحّد

خطوة 2 (المستودع عند الاستلام):
  ينقر "استلام" على نفس الأصل → stage=in_warehouse

خطوة 3 (عند التركيب):
  ينقر "تركيب" → يختار: محطة حساونة من قائمة المواقع
  → stage=installed, site_id=[حساونة UUID]

خطوة 4 (GIS تُكمل):
  مهندس GIS يفتح Engineering Workspace → يرى الأصل بدون geometry
  ينقر "حدد على الخريطة" → يرسم نقطة → يحفظ
  → lat/lng + gis_feature_id تُضاف للأصل الموجود
  
النتيجة: أصل واحد بـ ID واحد يُثري من كل الإدارات
```

---

## الجزء العاشر — مخطط التنفيذ المرحلي

---

### Phase 1 — Sites Management (الأساس)
**المدة:** أسبوع  
**يُنجز قبل كل شيء**

```
المشكلة التي يحلها:
  الأصول ترتبط بـ project_id أو lat/lng مجردة
  لا يوجد "محطة حساونة" كـ entity في قاعدة البيانات
  
ما يُبنى:
  Backend (إن لم يكن موجوداً):
    جدول sites (id, name, type, lat, lng, parent_site_id, tenant_id)
    GET/POST /api/v1/sites
    GET /api/v1/sites/[id]/assets
    
  Frontend:
    صفحة /admin-gateway/sites/ (قائمة + إنشاء + تعديل)
    
  تأثير على Registry:
    حقل site_id يُضاف للنموذج (اختياري حالياً، يصبح إلزامياً عند stage=installed)
    
مؤشر النجاح:
  المستخدم يستطيع إنشاء موقع "محطة حساونة" واختياره عند ربط أصل
```

---

### Phase 2 — Unified Asset Class & Lifecycle Stage
**المدة:** أسبوعان

```
المشكلة التي يحلها:
  لا يوجد تصنيف موحّد للأصل (site/linear/mobile)
  لا توجد مرحلة دورة حياة

ما يُبنى:
  Backend:
    إضافة حقول لجدول assets:
      asset_class ENUM
      lifecycle_stage ENUM
      site_id UUID FK
    
  Next.js proxy:
    /api/v1/assets → يُنسّق ويُعيد توجيه (unified endpoint)
    
  Frontend:
    Asset Registry: إضافة asset_class selector
    Asset Registry: إضافة lifecycle_stage badge
    Asset Registry: إضافة site_id picker (من قائمة Sites)
    
مؤشر النجاح:
  أصل يمر بـ stages مرئية في UI
  المستخدم يعرف بنظرة واحدة: هل الأصل في المستودع أم مركّب؟
```

---

### Phase 3 — GIS Becomes Location Provider
**المدة:** أسبوع

```
المشكلة التي يحلها:
  Engineering Workspace يُنشئ أصولاً مستقلة عن Registry
  
ما يُبنى:
  Engineering Workspace — CreatePrincipalAssetModal:
    يُعدَّل ليسأل: "ربط بأصل موجود؟" (مع dropdown من Registry)
    أو: "إنشاء أصل جديد في Registry مع الشكل الجغرافي"
    
  API جديد:
    PATCH /api/v1/assets/[id]/location { geometry, lat, lng, gis_feature_id }
    
  نتيجة:
    الرسم على الخريطة = تحديد موقع أصل موجود
    لا إنشاء مستقل من GIS
    
مؤشر النجاح:
  رسم polygon على الخريطة لا ينشئ asset مستقلاً
  بل يُسأل المستخدم عن الأصل الذي يُمثله
```

---

### Phase 4 — Fleet → Asset Registry Migration
**المدة:** أسبوع

```
المشكلة التي يحلها:
  مركبات ومعدات في جداول fleet منفصلة
  لا asset_id — لا Asset 360 — لا work orders

ما يُبنى:
  Migration script:
    كل vehicle في fleet_vehicles → ينشئ asset في assets
      asset_class = 'vehicle'
      + حقل fleet_id للرجوع للسجل القديم
      
    كل equipment في fleet_equipment → ينشئ asset
      asset_class = 'mobile_equipment'
      + حقل fleet_id
      
  /admin-gateway/vehicles/* تُعدَّل:
    تُصبح view على /api/v1/assets?class=vehicle,mobile_equipment
    نموذج إنشاء vehicle يُنشئ asset جديد بـ asset_class=vehicle
    
  Fleet module القديم:
    يُبقى كـ wrapper لبيانات الوقود فقط (fuel logs)
    Vehicles و Equipment تُدار من Registry
    
مؤشر النجاح:
  مركبة تظهر في Asset 360
  Work Order يمكن ربطه بمركبة
```

---

### Phase 5 — LRS → Real Backend Assets
**المدة:** أسبوع

```
المشكلة التي يحلها:
  الأصول الخطية في .data/linear-assets/*.json
  لا asset_id حقيقي — لا Asset 360 — لا Work Orders

ما يُبنى:
  إعادة بناء /api/v1/workspace/linear-assets/batch-place:
    بدلاً من: تخزين في JSON file
    يصبح: POST /api/v1/assets لكل أصل خطي
      asset_class = 'linear_component'
      pipeline_id = مرجع الخط
      station_m = موقع على الخط
      lat/lng = محسوب من LRS engine
      
  .data/linear-assets/ → يُحذف
  
  تكامل مع Work Orders القديمة:
    Work orders الموجودة بها equipment_code
    migration يربطها بـ asset_id الجديد عبر equipment_code
    
مؤشر النجاح:
  V-001 لها asset_id حقيقي
  يمكن إنشاء Work Order لـ V-001
  Asset 360 يعمل لـ V-001
```

---

### Phase 6 — Finance & Procurement Integration
**المدة:** أسبوعان

```
المشكلة التي يحلها:
  المالية تسجل مشتريات منفصلة عن الأصول
  لا رابط بين PO وأصل مستقبلاً
  
ما يُبنى:
  عند اعتماد PO لشراء أصل:
    يُنشئ draft asset تلقائياً بـ stage=procured
    
  نموذج الشراء يحتوي:
    is_asset_purchase: boolean
    asset_class: (للمشتريات الرأسمالية)
    عدد الوحدات (يُنشئ 3 assets للمضخات الثلاث مثلاً)
    
  عند استلام المستودع:
    يُحدّث stage إلى in_warehouse
    يُضيف receipt_date
    
مؤشر النجاح:
  شراء مضخة → ينشئ asset تلقائياً بـ stage=procured
  استلام المستودع → stage=in_warehouse
  المستخدم لا يحتاج إضافة نفس الأصل مرتين
```

---

### Phase 7 — Full Asset 360 (All Data Sources)
**المدة:** أسبوعان

```
المشكلة التي يحلها:
  Asset 360 يعرض جزءاً فقط من البيانات

تبويبات Asset 360 المستهدفة:
  [ملخص]       lifecycle_stage badge, site, class, health
  [الموقع]     GIS map (gis_feature_id), site_id, lrs_station
  [الصيانة]   work orders (من maintenance DB عبر asset_id)
  [المالية]   acquisition, depreciation, current_value, cost_to_maintain
  [التشغيل]   readings من Control Center (إن وُجدت)
  [الوثائق]   مرفقات، وثائق فنية
  [الحوكمة]  lifecycle transitions log
  [الجدول الزمني] timeline مترابط لكل الأحداث
  
مؤشر النجاح:
  الضغط على أي أصل → يرى كل شيء في مكان واحد
```

---

### Phase 8 — Cleanup (حذف كل الكود القديم)
**المدة:** أسبوع

```
تُحذف هذه الصفحات:
  app/dashboard/digital-assets/
  app/dashboard/asset-intelligence/
  app/dashboard/admin-gateway/assets/list/
  app/dashboard/admin-gateway/assets/types/
  app/dashboard/admin-gateway/finance/asset-tracking/
  app/dashboard/fleet/ (legacy)
  
تُحذف هذه الـ APIs في Next.js:
  app/api/engineering/workspace/principal-assets/* (بعد migration كاملة)
  (fleet يُبقى فقط لـ fuel logs)
  
تُحذف هذه الملفات المؤقتة:
  .data/asset-gis-links/
  .data/linear-assets/
  
تُحذف هذه الـ API calls من Frontend:
  /api/v1/hr-structure/asset-health → يُستبدل بـ /api/v1/assets/[id]/health
  /api/v1/hr-structure/asset-valuations → يُستبدل بـ /api/v1/assets/[id]/financials
  /api/v1/maintenance/assets → يُستبدل بـ /api/v1/assets?class=*&has_work_orders=true
```

---

## الجزء الحادي عشر — المخاطر وكيفية معالجتها

| الخطر | الاحتمال | التأثير | المعالجة |
|-------|---------|---------|---------|
| Backend لا يدعم asset_class/lifecycle_stage بعد | متوسط | عالي | Sprint 2 يبدأ بـ Backend أولاً |
| Fleet records لا يمكن ربطها بـ asset_id تلقائياً | عالي | متوسط | Migration script يستخدم name+type matching |
| LRS work orders القديمة لا يوجد equipment_code موحد | عالي | متوسط | Manual mapping sheet + migration batch |
| GIS team معتادة على "ارسم ثم سمّ" | متوسط | منخفض | UX تدريجي: الطريقتان مقبولتان في Phase 3 |
| Procurement لا يملك آلية إنشاء asset تلقائياً | عالي | متوسط | يُبنى في Phase 6 كـ optional feature |

---

## الجزء الثاني عشر — ملخص تنفيذي للقرار

### ما اكتشفناه
```
1. Backend يملك فعلاً جدول assets موحّداً ✓
2. المشكلة في Frontend — مسارات متعددة للنفس الجدول ✗
3. Fleet وحده يملك جدول منفصل فعلاً ✗
4. LRS يخزن محلياً بدلاً من Backend ✗
5. HR-Structure يملك asset endpoints خطأ تصنيفي ✗
```

### القرارات الثلاثة الكبرى
```
القرار 1: توحيد مسار الإنشاء
  من: 6 مسارات مختلفة
  إلى: POST /api/v1/assets للجميع
  
القرار 2: Site كوحدة تنظيمية أولى
  من: lat/lng مجردة
  إلى: site_id + كيان sites مستقل
  
القرار 3: GIS = Location Provider فقط
  من: GIS ينشئ أصولاً
  إلى: GIS يضيف geometry لأصول موجودة
```

### مقياس النجاح النهائي
```
بعد انتهاء Phase 8:

سؤال: "أين مضخة رقم 5؟"
الجواب: asset_id واحد في جدول assets
        site_id = محطة حساونة
        lat=32.43, lng=13.62 (من GIS)
        stage = active
        25 سنة work orders مرتبطة بنفس الـ ID
        cost to maintain آخر 5 سنوات من financials
        health_score حالي من آخر صيانة
        كل هذا في Asset 360 بضغطة واحدة
```

---

```
الجدول الزمني الإجمالي:
  Phase 1: Sites         — أسبوع
  Phase 2: Schema        — أسبوعان
  Phase 3: GIS Fix       — أسبوع
  Phase 4: Fleet Merge   — أسبوع
  Phase 5: LRS Fix       — أسبوع
  Phase 6: Finance       — أسبوعان
  Phase 7: Full 360      — أسبوعان
  Phase 8: Cleanup       — أسبوع
  ─────────────────────────────────
  المجموع:              11-12 أسبوعاً
```

---
*ملف: /home/alhadi/digital-dashboard/docs/asset-canonical-architecture.md*  
*هذا المقترح يُقدَّم للمراجعة والاعتماد قبل بدء أي تنفيذ*
