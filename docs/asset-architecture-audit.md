# تقرير تحليل معمارية إدارة الأصول
**التاريخ:** 2026-07-05  
**المُعِد:** GitHub Copilot — تحليل هندسي شامل  
**النطاق:** كامل منظومة إدارة الأصول في digital-dashboard  

---

## المشكلة الجوهرية

> **خمسة أكوان أصول منفصلة بلا جسر حقيقي بينها**

النظام الحالي لا يحتوي على "مصدر حقيقة واحد" لبيانات الأصول. بدلاً من ذلك، توجد خمس منظومات مستقلة تُعرِّف الأصل بطرق مختلفة وتخزّنه في أماكن مختلفة وتُعرّضه عبر APIs مختلفة — دون canonical ID يربطها.

---

## أولاً: الأنظمة الموجودة وكيفية إضافة الأصول

```
┌─────────────────────────────────────────────────────────────────┐
│ KOON 1: GIS Principal Assets (الأصول الهندسية الجغرافية)        │
│  • المدخل  : رسم على الخريطة → CreatePrincipalAssetModal        │
│  • التخزين : Python backend → workspace/assets (GeoJSON)        │
│  • API     : /api/engineering/workspace/principal-assets         │
│  • النوع   : Polygon / LineString                               │
│  • التحكم  : governance rules — هندسة فقط                       │
│  • الملف   : engineering-workspace/CreatePrincipalAssetModal.tsx │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ KOON 2: ERP Registry Assets (سجل الأصول الإداري)                │
│  • المدخل  : نموذج AssetForm → زر "إضافة أصل"                   │
│  • التخزين : نفس جدول Python backend workspace/assets!          │
│  • API     : /api/v1/workspace/assets  (نفس الجدول، route مختلف)│
│  • النوع   : flat record، geometry اختيارية                      │
│  • التحكم  : لا governance — أي مستخدم يضيف                     │
│  • الملف   : components/forms/AssetForm.tsx                     │
│              admin-gateway/assets/registry/page.tsx             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ KOON 3: Linear Assets / LRS (الأصول الخطية الهندسية)            │
│  • المدخل  : رفع CSV → LinearAssetImporter                      │
│  • التخزين : ملف JSON محلي .data/linear-assets/[tenant].json    │
│  • API     : /api/v1/workspace/linear-assets/batch-place        │
│  • النوع   : LinearAsset بـ station + invert_level + equipment_code│
│  • الاستخدام: operations-maintenance (خطوط مواسير، كابلات...)    │
│  • الملف   : lib/linear-referencing/types.ts                    │
│              components/LinearAssetImporter.tsx                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ KOON 4: ERP-Spatial Assets (أصول ERP على الخريطة)               │
│  • المدخل  : من ERP بيانات مستقلة مع lat/lng                     │
│  • التخزين : جدول منفصل في الـ backend                           │
│  • API     : /api/v1/erp-spatial/assets/geojson                 │
│  • الاستخدام: gisEngine.loadAssets() → خريطة GIS العامة         │
│  • النوع   : MapAsset / AssetSpatial (تعريفان مختلفان لنفس الفكرة)│
│  • الملف   : lib/erpSpatialService.ts + store/gisEngine.ts      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ KOON 5: Maintenance Assets (أصول الصيانة)                        │
│  • المدخل  : مدخل مستقل في نظام الصيانة                          │
│  • API     : /api/v1/maintenance/assets                         │
│  • الاستخدام: operations/maintenance page، planning             │
│  • النوع   : asset record خاص بالصيانة، integer ID              │
└─────────────────────────────────────────────────────────────────┘
```

---

## ثانياً: آلية الربط الحالية (وسبب كونها مشكلة)

```
ERP Asset (Koon 2)  ←──── asset-gis-links ────→  Principal Asset (Koon 1)
                              ↑
                    ملف JSON محلي في:
                 .data/asset-gis-links/[tenant].json
                        (ليس جدول DB!)
```

- ربط **Koon 3 (LRS) بـ Koon 1**: اختياري عبر `principalAssetId` في batch-place، يُنشئ سجلاً في نفس ملف JSON.
- **Koon 4 و Koon 5**: لا ربط رسمي بأي شيء آخر.

---

## ثالثاً: العيوب الرئيسية بالتفصيل

---

### عيب 1 — تضارب الـ API endpoints على نفس الجدول

```
CreatePrincipalAssetModal  → POST /api/engineering/workspace/principal-assets
AssetForm (registry)       → POST /api/v1/workspace/assets
```

كلاهما يكتب في نفس جدول Python `workspace/assets`، لكن:
- الأول يُحوّل البيانات عبر `featureToPrincipal()` ويتوقع GeoJSON geometry.
- الثاني يكتب flat record بدون geometry.
- **النتيجة:** نفس الجدول يحتوي كيانين مختلفين هيكلياً بلا تمييز واضح، وأي query تعيد الاثنين معاً.

**الملفات المتأثرة:**
- `app/api/engineering/workspace/principal-assets/route.ts`
- `app/api/v1/workspace/[...path]/route.ts`

---

### عيب 2 — صفحة "قائمة الأصول" تجمع يدوياً من مصدرين بلا deduplication

```ts
// admin-gateway/assets/list/page.tsx
const [maintRes, workspaceRes] = await Promise.all([
  fetch('/api/v1/maintenance/assets', { headers }),
  fetch('/api/v1/workspace/assets',   { headers }),
]);
// ثم تُدمج المصفوفتين بدون فلتر تكرار
combined.push(...)
```

أصل واحد فعلي قد يظهر **مرتين** في نفس الصفحة.

**الملف المتأثر:** `app/dashboard/admin-gateway/assets/list/page.tsx`

---

### عيب 3 — Linear Assets و GIS Links مخزنة كملفات JSON محلية (خطر حرج)

```
.data/linear-assets/[tenantCode].json
.data/asset-gis-links/[tenantCode].json
```

| المشكلة | التفصيل |
|---|---|
| ضياع البيانات | لا استعادة عند إعادة النشر أو تبديل الخادم |
| Race condition | لا قفل عند الكتابة المتزامنة |
| Tenant isolation ضعيفة | تعتمد على tenant_code string فقط، لا FK |
| لا transactionality | إذا فشل write في المنتصف → بيانات فاسدة |

**الملفات المتأثرة:**
- `app/api/v1/workspace/linear-assets/batch-place/route.ts`
- `app/api/v1/workspace/asset-gis-links/route.ts`

---

### عيب 4 — أربعة تعريفات لـ "أصل على الخريطة"

| الملف | النوع | حقول مميزة |
|---|---|---|
| `store/gisEngine.ts` | `MapAsset` | `health_score`, `has_geometry` |
| `lib/erpSpatialService.ts` | `AssetSpatial` | `health_score`, `department` |
| `engineering-workspace` | `PrincipalAsset` | `geometry_type`, `classification` |
| `lib/linear-referencing/types.ts` | `LinearAsset` | `station`, `invert_level`, `equipment_code` |

لا shared interface، لا canonical ID يربطها، صعوبة صيانة متراكمة.

---

### عيب 5 — Asset 360 ليس حقاً 360°

صفحة `/admin-gateway/assets/[id]` تجمع من:

```
AssetSummaryPanel    ← /api/v1/workspace/assets/[id]/asset-360   (ERP data)
AssetGISPanel        ← يبحث في ملف asset-gis-links              (GIS data)
AssetMaintenancePanel← /api/v1/maintenance/...                   (maintenance)
```

إذا لم يكن هناك ربط مسجل في ملف JSON → `AssetGISPanel` يظهر **فارغاً تماماً**، حتى لو الأصل مرسوم جغرافياً في Koon 1.

**الملفات المتأثرة:**
- `app/dashboard/admin-gateway/assets/[id]/page.tsx`
- `app/dashboard/asset-360/components/AssetGISPanel.tsx`

---

### عيب 6 — تصنيف الأصول غير موحّد

| النظام | حقل التصنيف | أمثلة القيم |
|---|---|---|
| GIS Principal | `classification` | بنية تحتية مائية، شبكة كهرباء |
| ERP Registry | `asset_type` | infrastructure, equipment |
| LRS | `equipment_type` | (من CSV، حر التنسيق) |
| Maintenance | `category` | (من backend، حر التنسيق) |

لا mapping، لا taxonomy مشتركة → تقارير غير موثوقة، فلاتر لا تعمل عبر الأنظمة.

---

### عيب 7 — information layers وقائية frontend فقط

`lib/gis/assetInformationLayers.ts` يحدد من يكتب في أي تاب (مالي/هندسي/صيانة) — لكن هذا منفّذ **فقط في UI** (tabs مخفية). أي POST مباشر على API يتجاوز الحماية بالكامل.

---

### عيب 8 — لا معرّف كانوني موحّد

```
workspace.assets.id     ← UUID من Python backend
asset_id (ERP)          ← رمز يدخله المستخدم (نص حر)
LinearAsset.id          ← UUID مستقل يُولَّد محلياً
LinearAsset.equipment_code ← رمز منفصل من CSV
maintenance.id          ← integer تسلسلي مستقل
```

لا يمكن القول "هذا الأصل رقم X" بشكل واحد معترف به في كل الأنظمة.

---

## رابعاً: جدول الأولويات

| # | العيب | الخطورة | الأثر الفعلي |
|---|---|---|---|
| 1 | Linear Assets + GIS Links في ملفات JSON محلية | 🔴 حرج | ضياع بيانات عند إعادة النشر |
| 2 | 5 كيانات أصول بلا canonical ID موحّد | 🔴 حرج | تكرار، تعارض، Asset 360 مكسور |
| 3 | نفس الـ endpoint لأغراض هيكلية مختلفة | 🟠 عالي | تلوث الجدول، queries غير موثوقة |
| 4 | AssetList يدمج يدوياً بلا deduplication | 🟠 عالي | تكرار في الواجهة |
| 5 | لا taxonomy موحدة لأنواع الأصول | 🟠 عالي | تقارير غير دقيقة، فلاتر عمياء |
| 6 | information layers frontend only | 🟡 متوسط | تجاوز الصلاحيات عبر API مباشر |
| 7 | GIS panel في Asset 360 يظهر فارغاً | 🟡 متوسط | تجربة مستخدم مكسورة |
| 8 | MapAsset مُعرَّف 4 مرات | 🟡 متوسط | صعوبة صيانة وتوسعة الكود |

---

## خامساً: مقترحات الإصلاح

---

### المقترح الاستراتيجي: نموذج "مصدر الحقيقة الواحد"

```
                    ┌────────────────────────────┐
                    │     canonical_assets        │  ← جدول واحد في DB
                    │     id (UUID canonical)     │
                    │     name                    │
                    │     asset_class: AssetClass │  ← taxonomy موحدة
                    │     tenant_id (FK)          │
                    └────────────┬───────────────┘
                                 │
          ┌──────────────────────┼─────────────────────────┐
          ↓                      ↓                          ↓
   asset_geometry         asset_lrs_position         asset_erp_data
   (GeoJSON, nullable)    (station, nullable)        (value, condition)
   FK → canonical_assets  FK → canonical_assets      FK → canonical_assets
```

---

### خطوة 1 — توحيد taxonomy الأصول

أنشئ `AssetClass` enum مشتركاً يُستخدم في كل الأنظمة:

```ts
export type AssetClass =
  | 'infrastructure_water'
  | 'infrastructure_power'
  | 'infrastructure_road'
  | 'infrastructure_telecom'
  | 'equipment_fixed'
  | 'equipment_mobile'
  | 'real_estate'
  | 'vehicle'
  | 'facility'
  | 'other';
```

يحلّ محلّ: `classification` (GIS) + `asset_type` (ERP) + `category` (Maintenance).

---

### خطوة 2 — نقل Linear Assets و GIS Links من JSON إلى DB

```sql
-- جدول الربط بين ERP assets وGIS assets
CREATE TABLE asset_gis_links (
  id            UUID PRIMARY KEY,
  erp_asset_id  UUID NOT NULL REFERENCES canonical_assets(id),
  gis_asset_id  UUID NOT NULL REFERENCES canonical_assets(id),
  link_type     VARCHAR(50) NOT NULL,  -- physical_location|part_of|serves
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- جدول الأصول الخطية
CREATE TABLE linear_assets (
  id                  UUID PRIMARY KEY,
  canonical_asset_id  UUID NOT NULL REFERENCES canonical_assets(id),
  station             NUMERIC NOT NULL,
  invert_level        NUMERIC,
  equipment_code      VARCHAR(100),
  pipeline_id         UUID,
  tenant_id           UUID NOT NULL REFERENCES tenants(id)
);
```

---

### خطوة 3 — فصل API endpoints بوضوح

```
POST /api/v1/assets              ← إنشاء أصل عادي (ERP/registry)
POST /api/v1/assets/spatial      ← إنشاء أصل بـ GeoJSON geometry
POST /api/v1/assets/lrs          ← إنشاء أصل خطي LRS
GET  /api/v1/assets/[id]/full    ← Asset 360 كامل (يجمع كل الطبقات)
GET  /api/v1/assets/map          ← الأصول على الخريطة (canonical interface)
```

---

### خطوة 4 — interface موحّد لـ "أصل على الخريطة"

```ts
// بدلاً من: MapAsset + AssetSpatial + PrincipalAsset + LinearAsset
interface CanonicalMapAsset {
  id: string;               // UUID canonical — نفسه في كل الأنظمة
  name: string;
  asset_class: AssetClass;  // taxonomy موحدة
  geometry?: GeoJSON;       // إذا رُسم على الخريطة
  station?: number;         // إذا LRS
  lat?: number;
  lon?: number;
  health_score?: number;
  status: string;
  tenant_id: string;
}
```

---

### خطوة 5 — ربط GIS تلقائي عند إنشاء الأصل

عند إنشاء أصل عبر الرسم على الخريطة، يُنشأ تلقائياً سجل `canonical_asset` + سجل `asset_geometry` في نفس الـ transaction — وليس اختيارياً لاحقاً.

```python
# في Python backend
with db.transaction():
    canonical = create_canonical_asset(name, class, tenant_id)
    create_asset_geometry(canonical.id, geojson)
    # لا حاجة لخطوة ربط منفصلة
```

---

### خطوة 6 — backend enforcement لـ information layers

```python
# في كل write endpoint
def enforce_layer_write_permission(user_dept: str, asset_id: str, fields: list[str]):
    layer = resolve_asset_info_layer(user_dept)
    writable = get_writable_fields(layer)
    forbidden = [f for f in fields if f not in writable]
    if forbidden:
        raise PermissionError(f"Layer {layer} لا تملك صلاحية تعديل: {forbidden}")
```

---

## ملاحظات ختامية

الهيكل الحالي تطور بشكل عضوي وليس بتصميم مسبق — كل وحدة بنت نظام أصولها الخاص عند الحاجة. هذا طبيعي في مراحل التطوير السريع، لكنه وصل لنقطة يصعب فيها إضافة تقارير موثوقة أو ربط بين الوحدات دون مراجعة هيكلية.

الأولوية الفورية هي **عيب 3** (نقل JSON files إلى DB) لأنه يمثل خطر فقدان بيانات في الإنتاج. باقي العيوب يمكن معالجتها تدريجياً ضمن sprints مخططة.
