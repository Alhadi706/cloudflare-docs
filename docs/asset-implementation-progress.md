# تقرير تقدم إعادة هيكلة نظام الأصول
**Canonical Asset Architecture — Implementation Progress Report**
**تاريخ:** 2026-07-06 | **الفرع:** feat/flutter-windows-ci

---

## المبادئ المعمارية الحاكمة (مُعتمدة 2026-07-06)

```
1. PROJECT ≠ ASSET
   المشروع أثناء التنفيذ لا يُنشئ أصولاً تشغيلية.
   الأصل يُنشأ فقط عند Commissioning (الاستلام الرسمي).

2. ASSET = كيان تشغيلي طويل العمر (30+ سنة)
   محطة ضخ، خزان، بئر، خط أنابيب، مبنى، منظومة.
   له هوية ثابتة حتى لو استُبدلت كل مكوناته.

3. COMPONENT = جزء قابل للاستبدال داخل الأصل
   مضخة، محرك، صمام، حساس، عداد تدفق.
   عند الاستبدال: لا يُنشأ asset جديد.
   يُسجَّل في component_history على نفس الـ slot.
   الأصل يبقى. التاريخ يبقى.

4. INVENTORY = مادة في المخزن (قبل التركيب)
   ليست أصلاً تشغيلياً.
   عند خروجها للتركيب → تصبح Component داخل Asset.

5. LINEAR ASSET
   خط الأنابيب = Asset رئيسي (asset_id واحد).
   الصمامات / العدادات / غرف التفتيش = Components على الخط.
   مرتبطة بـ (pipeline_id + station_m) وليس بـ site_id.

6. الهرمية المزدوجة:
   Asset → Child Assets  (هيكلية دائمة: مبنى داخل منظومة)
   Asset → Component Slots (تشغيلية قابلة للاستبدال: مضخة داخل محطة)
```

---

## ما تم إنجازه

### ✅ المرحلة الصفر — UI Restructuring
Redirects، Sidebar، Map toggle، Asset/Project 360، GM Office، GIS back button

### ✅ Phase 1 — Single Creation Path
نقطة الإنشاء الكانونية: `/admin-gateway/assets/registry → POST /api/v1/workspace/assets`
حُذف: `digital-assets/`, `assets/list/`, `assets/types/`, `finance/asset-tracking/`, JSON-based APIs

### ✅ Phase 2 — Sites Management
`GET /api/v1/workspace/all-sites` + `/admin-gateway/sites/`

### ✅ Phase 3 — GIS as Location Provider
`CreatePrincipalAssetModal` يدعم: ربط بأصل موجود / إنشاء أصل هندسي جديد

---

## المراحل القادمة

### 🔄 Phase 4A — Component Model + Enhanced Registry Form
### 🔄 Phase 4B — Component Management UI in Asset 360
### 🔄 Phase 5 — LRS كـ Component Slots
### 🔄 Phase 6 — Fleet Assets Migration
### 🔄 Phase 7 — Inventory → Component Flow
### 🔄 Phase 8 — Project → Asset Commissioning
### 🔄 Phase 9 — Full Asset 360
### 🔄 Phase 10 — Cleanup

---

## المبادئ المعمارية الحاكمة (المعتمدة)

```
1. PROJECT ≠ ASSET
   المشروع أثناء التنفيذ لا يُنشئ أصولاً تشغيلية.
   الأصل يُنشأ فقط عند Commissioning (الاستلام الرسمي).

2. ASSET = كيان تشغيلي طويل العمر (30+ سنة)
   محطة ضخ، خزان، بئر، خط أنابيب، مبنى، منظومة.
   له هوية ثابتة تبقى حتى لو استُبدلت كل مكوناته.

3. COMPONENT = جزء قابل للاستبدال داخل الأصل
   مضخة، محرك، صمام، حساس، عداد تدفق.
   عند استبداله: لا يُنشأ asset جديد. يُسجَّل في component_history.
   الأصل يبقى. التاريخ يبقى. فقط component_slot يتغير.

4. INVENTORY = مادة في المخزن (قبل التركيب)
   ليست أصلاً تشغيلياً.
   عند خروجها للتركيب: تصبح Component داخل Asset.

5. LINEAR ASSET
   خط الأنابيب = Asset رئيسي.
   الصمامات/العدادات/غرف التفتيش = Components على الخط (بـ station_m).
   ليست مرتبطة بـ site. مرتبطة بالمسار (pipeline_id + station_m).

6. الهرمية:
   Asset → Child Assets (هيكلية: مبنى داخل منظومة ← نادراً تتغير)
   Asset → Component Slots (تشغيلية: مضخة داخل محطة ← تُستبدل دورياً)
```

---

## ما تم إنجازه

### ✅ المرحلة الصفر — UI Restructuring (مكتملة)
| المهمة | الحالة |
|--------|--------|
| إزالة ملفات .bak | ✅ | توحيد Redirects | ✅ |
| Sidebar موحد | ✅ | Map toggle اختياري | ✅ |
| Asset 360 مدمج | ✅ | Project 360 مدمج | ✅ |
| GM Office + Intelligence | ✅ | زر الرجوع من GIS | ✅ |

### ✅ Phase 1 — Single Creation Path
**نقطة الإنشاء الكانونية:** `/admin-gateway/assets/registry → POST /api/v1/workspace/assets`

محذوفات: `digital-assets/`, `assets/list/`, `assets/types/`, `finance/asset-tracking/`, `AssetGisLinkPanel`, `LinearAssetImporter`, `asset-gis-links API`, `linear-assets API`, `.data/asset-gis-links/`, `.data/linear-assets/`

### ✅ Phase 2 — Sites Management
`GET /api/v1/workspace/all-sites` + `/admin-gateway/sites/` صفحة إدارة المواقع

### ✅ Phase 3 — GIS as Location Provider
`CreatePrincipalAssetModal` يدعم خيارين: ربط بأصل موجود / إنشاء أصل هندسي

---

## المراحل القادمة (مُعدَّلة)

### 🔄 Phase 4A — Component Model
**الأولوية: الأعلى — يجب قبل أي شيء آخر**

**التمييز الجوهري:**
```
Child Asset (هيكلي - دائم):
  مبنى / ورشة / مخزن داخل منظومة
  له asset_id مستقل، نادراً يُستبدل، Parent/Child موجود ✅

Component Slot (تشغيلي - قابل للاستبدال):
  مضخة / محرك / صمام / عداد داخل محطة
  ليس له asset_id جديد عند الاستبدال
  التاريخ يُحفظ على "slot" وليس على "الجزء"
  ← مفقود حالياً، يُبنى هنا
```

**نماذج البيانات:**
```
component_slots: asset_id | slot_name | slot_code | current_inventory_item_id
component_history: slot_id | item_description | serial | installed_at | installed_via_wo | removed_at
```

**التنفيذ (بدون backend schema changes - باستخدام JSONB الموجود):**
- `asset_class`: تُضاف كحقل في properties `{asset_class: 'compound'|'linear'|'site_equipment'|'vehicle'}`
- Component Slots: تُنشأ كـ child assets بـ `{is_component_slot: true, slot_name: '...'}`
- Component History: تُحفظ في `assets/[id]/financials` مع `financial_type: 'component_replacement'`

---

### 🔄 Phase 4B — Enhanced Asset Creation
**ما يُبنى:**
- نموذج إضافة أصل يحتوي Mini Map مضمّنة للرسم (بدلاً من LocationPickerModal)
- حقل "الأصل الرئيسي" للأصول الفرعية الهيكلية
- حقل "نوع الأصل" (مجمّع / خطي / معدات / مركبة)
- رسم نقطة/مضلع/مسار مباشرة داخل النموذج

---

### 🔄 Phase 4C — Component Management UI
- تبويب "المكونات" في Asset 360
- إضافة/استبدال مكوّن (مع ربط بأمر عمل)
- سجل استبدالات المكوّن (Component Slot History)
- تمييز بصري: Child Assets vs Component Slots

---

### 🔄 Phase 5 — LRS كـ Component Slots
**التعديل الجوهري:** 32,000 معدة ليست 32,000 asset_id
```
خط النهر = Asset رئيسي (asset_id واحد)
  └── Component Slot: "صمام هواء عند km 0.6" (slot_id)
       └── V-001 (item مُركَّب حالياً، مع تاريخ الاستبدالات)
```
عند استبدال V-001 → component replacement على نفس الـ slot → نفس الأصل

---

### 🔄 Phase 6 — Fleet Assets
مركبات ومعدات متنقلة تبقى كـ Assets مستقلة (ليست components).
تُربط بـ asset_id في Registry. تكاليف الوقود تظهر في Asset 360.

---

### 🔄 Phase 7 — Inventory → Component Flow
```
شراء 3 مضخات → Inventory items (ليست أصولاً)
تركيب مضخة في محطة → تصبح Component في slot محدد
استبدال مضخة معطلة → component_history يُسجَّل → نفس الأصل
```

---

### 🔄 Phase 8 — Project → Asset Commissioning
```
مشروع "محطة ضخ جديدة" → أثناء التنفيذ: لا assets تشغيلية
عند Commissioning → حدث رسمي ينشئ: asset_id للمحطة
```

---

### 🔄 Phase 9 — Full Asset 360
```
Asset 360 يعرض:
  ✓ 30 سنة تاريخ الأصل
  ✓ Component Slots وتاريخ كل slot (كل الاستبدالات)
  ✓ Child Assets الهيكلية (مبانٍ، مرافق)
  ✓ الموقع (GIS + pipeline)
  ✓ الصيانة (أوامر عمل مرتبطة بالأصل وبالـ slot)
  ✓ المالية (تراكمية طوال عمر الأصل)
```

---

### 🔄 Phase 10 — Cleanup
حذف engineering/workspace/principal-assets, operations-maintenance القديم

---

## Snapshots
| Tag | المحتوى |
|-----|---------|
| `before-ui-phase-0..3` | UI Restructuring |
| `before-asset-phase-1` | قبل Phase 1 |
| `before-asset-phase-2` | قبل Phase 2 |
| `before-asset-phase-3` | قبل Phase 3 |
| `before-asset-phase-4` | قبل Phase 4 (قادم) |

---

## ملاحظة هامة من المراجعة الميدانية

> بعد اختبار النظام على `dev.d-me.ly`، اكتشفنا أن نموذج إضافة الأصل في Registry
> يطلب اختيار مشروع من `LocationPickerModal` — وهذا غير مثالي.
>
> **التوجه الأفضل:** دمج قدرة الرسم على الخريطة مباشرة في نموذج إضافة الأصل،
> مع دعم الأصول المتداخلة (أصل داخل أصل) — مثال: "منظومة الحساونة" تحتوي
> مسجداً وورشة وشؤوناً إدارية ومخازن، كل منها أصل فرعي يُرسم داخل مضلع الأصل الرئيسي.
>
> هذا التحسين مُدرج في Phase 4 (Enhanced Asset Creation).

---

## ما تم إنجازه

---

### ✅ المرحلة الصفر — UI Restructuring (مكتملة)
**الفترة:** تاريخ سابق | **الـ Tags:** `before-ui-phase-0` → `before-ui-phase-3`

| المهمة | الحالة |
|--------|--------|
| إزالة ملفات .bak من المشروع | ✅ |
| توحيد Redirects (next.config.js) | ✅ |
| Sidebar موحد | ✅ |
| Map toggle اختياري لكل إدارة | ✅ |
| Asset 360 مدمج كصفحة تفصيل | ✅ |
| Project 360 مدمج كصفحة تفصيل | ✅ |
| GM Office + Intelligence tabs | ✅ |
| إصلاح زر الرجوع من GIS | ✅ |

---

### ✅ Phase 1 — Single Creation Path (مكتملة)
**Tag:** `before-asset-phase-1` → commit `a177ccf0a2`

#### ما تم حذفه نهائياً:
| الملف/المجلد | سبب الحذف |
|-------------|----------|
| `app/dashboard/digital-assets/` | portal قديم بلا قيمة |
| `app/dashboard/asset-intelligence/` | portal مكرر |
| `app/dashboard/admin-gateway/assets/list/` | يخلط مصدرين متضاربين |
| `app/dashboard/admin-gateway/assets/types/` | مكرر مع categories |
| `app/dashboard/admin-gateway/finance/asset-tracking/` | مكرر مع valuations |
| `app/dashboard/asset-360/[id]/page.tsx` | dead code (redirect يتجاوزه) |
| `app/dashboard/asset-360/page.tsx` | redirect shell لا يُوصَل إليه |
| `components/AssetGisLinkPanel.tsx` | JSON-based مؤقت |
| `components/LinearAssetImporter.tsx` | JSON-based مؤقت |
| `app/api/v1/workspace/asset-gis-links/` | JSON file store |
| `app/api/v1/workspace/linear-assets/` | JSON file store |
| `.data/asset-gis-links/` | بيانات JSON مؤقتة |
| `.data/linear-assets/` | بيانات JSON مؤقتة |

#### نقطة الإنشاء الكانونية:
```
/dashboard/admin-gateway/assets/registry
  → POST /api/v1/workspace/assets (الـ Backend)
  هذا هو المسار الوحيد لإنشاء أصول ERP التشغيلية
```

#### مسارات إنشاء أخرى معترف بها (للمعالجة في مراحل لاحقة):
| المسار | النوع | المرحلة |
|--------|-------|---------|
| `CreatePrincipalAssetModal` | GIS infrastructure | Phase 3 ✅ |
| `vehicles/vehicles + equipment` | Fleet mobile | Phase 4 |
| LRS batch import | Linear assets | Phase 5 |

---

### ✅ Phase 2 — Sites Management (مكتملة)
**Tag:** `before-asset-phase-2` → commit `01fe1c6310`

#### ما تم بناؤه:

**API موحّدة جديدة:**
```
GET /api/v1/workspace/all-sites
  ← تجمع كل المواقع من كل المشاريع في قائمة واحدة
  ← { id, project_id, project_name, name, code, site_type, status }
  ← Parallel fetching من جميع المشاريع
```

**صفحة إدارة المواقع التشغيلية:**
```
/dashboard/admin-gateway/sites/
  ✓ قائمة المواقع مجمّعة بالمشروع
  ✓ إنشاء موقع جديد تحت مشروع محدد
  ✓ أنواع: محطة ضخ، تشغيلي، إداري، مخزن، ميداني، تقاطع
  ✓ رابط لسجل الأصول مصفّى بـ site_id
  ✓ بحث بالاسم/الرمز/المشروع
```

**ملاحظة معمارية:**
- Backend: المواقع sub-entities تحت المشاريع
- لا يوجد `/api/v1/sites` مستقل في Backend حالياً
- all-sites API تخفي هذا التعقيد عن الواجهة

---

### ✅ Phase 3 — GIS as Location Provider (مكتملة)
**Tag:** `before-asset-phase-3` → commit `22f95874a7`

#### ما تم تغييره:

**`CreatePrincipalAssetModal.tsx` — Mode Switcher مُضاف:**

```
عند فتح المودال بعد الرسم على الخريطة، يظهر خياران:

[ربط بأصل موجود في Registry]  [إنشاء أصل هندسي جديد]
```

**Mode A: ربط بأصل موجود**
- يُحمّل قائمة الأصول من `/api/v1/workspace/assets/all`
- بحث في الأصول
- عند الاختيار: يستخرج centroid من الشكل المرسوم
- يُحدّث الأصل: `PATCH /api/v1/workspace/assets/[id]` بـ `{latitude, longitude}`
- النتيجة: الأصل يحصل على إحداثيات دقيقة → يظهر في Asset 360

**Mode B: إنشاء أصل هندسي جديد (السلوك الأصلي)**
- يُنشئ Principal Asset في GIS
- للبنى التحتية (خطوط أنابيب، طرق، مسارات)

---

## ما لم يتم بعد — المراحل القادمة

---

### 🔄 Phase 4 — Enhanced Asset Creation (الأولوية القادمة)

**المشكلة المكتشفة:** نموذج إضافة الأصل في Registry يطلب اختيار مشروع فقط دون دعم:
1. رسم مباشر على الخريطة من داخل نموذج الإضافة
2. الأصول المتداخلة (أصل رئيسي ← أصول فرعية)

**مثال حقيقي:**
```
منظومة الحساونة (مضلع كبير على الخريطة)
  ├── مسجد        (مضلع صغير داخل الموقع)
  ├── شؤون إدارية (مضلع صغير داخل الموقع)
  ├── نادي         (مضلع صغير داخل الموقع)
  ├── ورشة         (مضلع صغير داخل الموقع)
  └── مخازن        (مضلع صغير داخل الموقع)
```

**ما سيُبنى في Phase 4:**

**4A — Integrated Map Drawing في Registry:**
- نموذج "أصل جديد" يحتوي قسم "الرسم على الخريطة" مباشرة
- المستخدم يرسم نقطة/مضلع/مسار داخل النموذج
- لا حاجة للانتقال لـ Engineering Workspace
- يُستخدم نفس MapCanvas الموجود في GIS

**4B — Parent Asset Support:**
- حقل "الأصل الرئيسي" في نموذج الإضافة
- اختيار من قائمة الأصول الموجودة
- عند تحديد أصل رئيسي → يصبح child asset
- يُنشئ compound structure تلقائياً
- الأصل الرئيسي يُعلَّم كـ "مجمّع"

**4C — Compound Asset View في Asset 360:**
- تبويب "الأصول الفرعية" في Asset 360
- شجرة هرمية للأصول المتداخلة
- كل أصل فرعي قابل للنقر

---

### 🔄 Phase 5 — Fleet Migration

**المهمة:**
- مركبات ومعدات Fleet ترتبط بـ `asset_id` حقيقي في Registry
- `/admin-gateway/vehicles/*` تُصبح فلتر "أصول متنقلة"
- تكاليف الوقود تظهر في Asset 360

---

### 🔄 Phase 6 — LRS Integration

**المهمة:**
- LRS batch import يُنشئ assets حقيقية في Backend (ليس JSON)
- كل صمام/معدة خطية → asset_id حقيقي
- أوامر العمل القديمة تُربط بـ asset_id عبر equipment_code

---

### 🔄 Phase 7 — Finance & Procurement Integration

**المهمة:**
- عند اعتماد PO لشراء أصل → يُنشئ draft asset تلقائياً
- استلام المستودع → stage=in_warehouse
- المستخدم لا يُضيف الأصل مرتين

---

### 🔄 Phase 8 — Full Asset 360

**المهمة:**
- تبويبات Asset 360 تعرض بيانات من كل الأنظمة:
  - المالية (تاريخ الشراء، الاستهلاك)
  - الصيانة (25 سنة أوامر عمل)
  - الموقع (GIS + موقع تشغيلي)
  - الأصول الفرعية (compound tree)
  - التشغيل (قراءات Control Center)

---

### 🔄 Phase 9 — Cleanup

**المهمة:**
- حذف `/api/engineering/workspace/principal-assets/*` (بعد migration)
- حذف `app/dashboard/operations-maintenance/` (LRS قديم)
- حذف `lib/linear-referencing/` (إعادة استخدامها في Phase 6)

---

## الوضع الحالي للـ Snapshots

| Tag | المحتوى |
|-----|---------|
| `before-ui-phase-0` | قبل أي تغيير UI |
| `before-ui-phase-1` | قبل Redirects |
| `before-ui-phase-2` | قبل Sidebar |
| `before-ui-phase-3` | قبل Map toggle + DeptShell |
| `before-asset-phase-1` | قبل إعادة هيكلة الأصول |
| `before-asset-phase-2` | قبل Sites Management |
| `before-asset-phase-3` | قبل GIS Location Provider |

---

## ملخص المبدأ المعماري الحاكم

```
من يُنشئ الأصل؟
  ← إدارة الأصول فقط (Registry)
  ← أي إدارة أخرى تُغذّي البيانات، لا تُنشئ أصولاً جديدة

من يُحدد موقع الأصل؟
  ← المشاريع/الصيانة عند التركيب (site_id)
  ← GIS يُضيف إحداثيات دقيقة لاحقاً (lat/lng)
  ← LRS يحسب الموقع من المسافة على الخط

كيف تُبنى الأصول المتداخلة؟
  ← مضلع كبير (الموقع الرئيسي) = parent asset
  ← مضلعات صغيرة داخله = child assets
  ← كل طبقة تُنشأ من نفس Registry بـ parent_asset_id
```

---

*الملف: `/home/alhadi/digital-dashboard/docs/asset-implementation-progress.md`*
