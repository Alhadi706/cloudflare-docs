# MINERVA — تقرير المرحلة 9 (تنفيذ) + المرحلة 10 (تصميم)
**تاريخ الإنجاز:** 9 يوليو 2026  
**الفرع:** `minerva-improvements-1000`  
**المستوى:** تقرير تقني تنفيذي

---

## جدول المحتويات
1. [Phase 9 — التنفيذ الحقيقي](#phase-9--التنفيذ-الحقيقي)
2. [الاختبار والتحقق](#الاختبار-والتحقق)
3. [الملفات المُنشأة](#الملفات-المنشأة)
4. [Phase 10 — تصميم الذكاء المرتكز على الأصل](#phase-10--تصميم-الذكاء-المرتكز-على-الأصل)
5. [خارطة الطريق النهائية](#خارطة-الطريق-النهائية)

---

## Phase 9 — التنفيذ الحقيقي

### 9.1 المشكلة المحلولة

قبل Phase 9، كانت MINERVA تعمل على **نموذج فيزيائي محاكاة** لأربع إشارات رئيسية:

| الإشارة | الحالة قبل Phase 9 | المصدر |
|---------|-------------------|--------|
| NDMI (رطوبة التربة) | **محاكاة** | `synthetic.py` |
| NDVI (النشاط النباتي) | **محاكاة** | `synthetic.py` |
| SAR Backscatter | **محاكاة** | `synthetic.py` |
| LST (حرارة السطح) | **محاكاة** | `synthetic.py` |
| هطل الأمطار | ✅ حقيقي | Open-Meteo |

**المشكلة الجوهرية:** قيمة المرحلة العاشرة (تاريخ الأصل الحقيقي) مستحيلة إذا كانت الإشارات مزيفة.

### 9.2 الحل المُنفَّذ

تم استبدال المصادر الاصطناعية بثلاثة Adapters حقيقية تقرأ من أقمار اصطناعية فعلية:

```
minerva/signals/adapters/
├── sentinel2.py          ← جديد (Phase 9) — Sentinel-2 L2A via Planetary Computer
├── sentinel1.py          ← جديد (Phase 9) — Sentinel-1 RTC via Planetary Computer
├── landsat_thermal.py    ← جديد (Phase 9) — Landsat 8/9 LST via Planetary Computer
├── weather.py            ← موجود — Open-Meteo (حقيقي منذ Phase 1)
└── synthetic.py          ← موجود — يُستخدم فقط لخط الأساس التاريخي حتى Phase 10
```

---

### 9.3 Sentinel-2 Adapter (sentinel2.py)

**المصدر:** Microsoft Planetary Computer STAC API — مجموعة `sentinel-2-l2a`  
**التردد:** كل 5 أيام (مدار مشترك 2A+2C+2B قريباً)  
**الإشارات:** NDMI، NDVI، NDWI، NBR

**خوارزمية الاستخراج:**
```
STAC Search → أفضل مشهد (سحاب < 15%)
  ↓
رابط COG لكل نطاق (B03/B04/B08/B11/B12)
  ↓
planetary_computer.sign() → توقيع الرابط بـ SAS Token
  ↓
rasterio.open(COG_URL) → قراءة Patch 1000m × 1000m
  ↓
تحويل CRS: WGS84 → UTM (لضمان دقة المسافات)
  ↓
Median(البكسلات الصالحة) / 10000 → Reflectance
  ↓
NDMI = (B08 - B11) / (B08 + B11)
NDVI = (B08 - B04) / (B08 + B04)
NDWI = (B03 - B08) / (B03 + B08)
```

---

### 9.4 Sentinel-1 SAR Adapter (sentinel1.py)

**المصدر:** Microsoft Planetary Computer STAC API — مجموعة `sentinel-1-rtc`  
**التردد:** كل 6-12 يوماً  
**الإشارات:** VV_dB، VH_dB، Cross-Ratio (CR)

**تحويل القيم:**
```
Linear Power (RTC) → dB: σ° = 10 × log₁₀(linear)

تفسير VV:
  σ°VV < -20 dB → مياه سطحية
  σ°VV ≈ -12 dB → تربة جافة
  σ°VV ≈ -6  dB → تربة رطبة (أو حضري طرابلس)
  σ°VV > -3  dB → حضري كثيف / double-bounce
```

---

### 9.5 Landsat LST Adapter (landsat_thermal.py)

**المصدر:** Microsoft Planetary Computer — مجموعة `landsat-c2-l2`  
**النطاق:** ST_B10 (TIRS 10.6–11.19 µm)  
**الحالة في الاختبار:** المشاهد موجودة لكن ST_B10 غير متاح في الكتالوج الحالي

**معادلة التحويل (USGS):**
```
LST_K = DN × 0.00341802 + 149.0
LST_C = LST_K - 273.15
```

> **ملاحظة:** سيتم إصلاح مسألة توفر ST_B10 في الإصدار القادم. حتى ذلك الحين، يُبلَّغ عن LST كـ **MISSING** (وليس محاكاة، وفق ADR-027).

---

## الاختبار والتحقق

### نتائج الاختبار الحقيقي — طرابلس ليبيا (32.89°N, 13.18°E)
**الفترة:** 1 يونيو 2026 → 9 يوليو 2026

```
==========================================================
[1] Sentinel-2 L2A — NDMI / NDVI / NDWI
  2026-07-02  cloud=12.6%  NDMI=-0.04948  NDVI=0.05422  NDWI=-0.12108
  2026-06-30  cloud= 5.9%  NDMI=-0.05577  NDVI=0.05172  NDWI=-0.12326
  2026-06-25  cloud=10.9%  NDMI=-0.04093  NDVI=0.05669  NDWI=-0.13022

[2] Sentinel-1 RTC — SAR Backscatter
  2026-07-08  VV=-6.535 dB  VH=-11.939 dB  CR=-5.404 dB
  2026-07-07  VV=-5.211 dB  VH=-12.099 dB  CR=-6.888 dB
  2026-07-06  VV=-5.184 dB  VH=-12.685 dB  CR=-7.500 dB

[3] Landsat 9 LST:  MISSING (ST_B10 غير متاح في الكتالوج)
==========================================================
```

### تفسير القيم الحقيقية

| المؤشر | القيمة (متوسط الفترة) | التفسير |
|--------|----------------------|---------|
| NDMI = -0.038 | سالب متوسط | تربة جافة — منطق لمنطقة شبه جافة كطرابلس |
| NDVI = +0.056 | قريب من الصفر | غطاء نباتي ضئيل جداً — متوقع لمنطقة حضرية ساحلية |
| NDWI = -0.124 | سالب واضح | لا توجد مياه سطحية مكشوفة |
| VV = -5.77 dB | منتصف الطيف | مزيج من الحضري والتربة — مطابق لطرابلس |

### حالة إشارات MINERVA بعد Phase 9

```
signal_status = {
  'NDMI':            'REAL_S2',     ← Sentinel-2 حقيقي ✅
  'NDVI':            'REAL_S2',     ← Sentinel-2 حقيقي ✅
  'NDWI':            'REAL_S2',     ← Sentinel-2 حقيقي ✅
  'SAR_BACKSCATTER': 'REAL_S1',     ← Sentinel-1 حقيقي ✅
  'SURFACE_TEMP':    'MISSING',     ← LST ليس متاحاً حالياً ⚠️
}
→ 4/5 إشارات حقيقية (80%)
```

---

## الملفات المُنشأة

| الملف | الحجم | الوصف |
|-------|-------|-------|
| `minerva/signals/adapters/sentinel2.py` | 185 سطر | Sentinel-2 NDMI/NDVI Adapter |
| `minerva/signals/adapters/sentinel1.py` | 152 سطر | Sentinel-1 SAR Adapter |
| `minerva/signals/adapters/landsat_thermal.py` | 148 سطر | Landsat LST Adapter |
| `scripts/minerva_analyze.py` | +75 سطر | دمج EO الحقيقي في pipeline |

---

## Phase 10 — تصميم الذكاء المرتكز على الأصل

### 10.1 الفرضية المحورية

> **"كل أصل يجب أن يتعلم نمطه الطبيعي الخاص، لا النمط العالمي"**

في الأنظمة التقليدية (Phase 0-9)، يُحلَّل كل أصل بنفس خط الأساس. هذا خطأ منهجي:  
- **خط أنابيب عمره 5 سنوات** يختلف اختلافاً جذرياً عن خط عمره 20 سنة  
- **مضخة تعمل في منطقة جبلية** لها بصمة NDMI مختلفة عن مضخة في السهل  
- **أصل صُيِّن مؤخراً** له موقف مختلف من خط أساس أصل لم يُصَن منذ سنوات  

**Phase 10 الحل:** كل أصل يبني **نسخة رقمية** (Digital Twin) تتعلم ذاتياً من تاريخه الفعلي.

---

### 10.2 بنية Digital Twin لكل أصل

```
AssetDigitalTwin {
  ─── الهوية ───────────────────────────────────────
  asset_id       : str          "PIPE-WTR-032"
  asset_type     : str          "WATER_PIPELINE"
  location       : (lat, lon)
  installation_date: date
  material       : str
  design_pressure : float (bar)
  diameter_mm     : int
  
  ─── التاريخ الحقيقي ──────────────────────────────
  observations   : List[EOObservation]    ← Sentinel-2/1 حقيقية
  weather_record : List[DailyWeather]     ← Open-Meteo حقيقية
  maintenance_log: List[MaintenanceEvent] ← ERP حقيقية
  alert_history  : List[AlertEvent]       ← MINERVA سابقاً
  
  ─── الشخصية المتعلَّمة ───────────────────────────
  personal_baseline: ConditionalProfile   ← مبني على تاريخه هو
  seasonal_pattern : SeasonalModel        ← NDMI صيف/شتاء خاص به
  drift_trend      : TrendModel           ← تراجع الأداء مع الزمن
  anomaly_memory   : List[AnomalyRecord]  ← كل شذوذ مر به
  
  ─── التقييم الحي ────────────────────────────────
  health_score     : float (0-1)          ← يتحدث مع كل مشهد جديد
  remaining_life_est: int (days)          ← تقدير العمر المتبقي
  next_alert_risk  : AlertRisk            ← احتمال التنبيه القادم
}
```

---

### 10.3 مسار بناء التاريخ الكامل

```
Phase 10 Bootstrap (لكل أصل جديد):

1. استيراد موقع الأصل من ERP
   ↓
2. استعادة تاريخ Sentinel-2 (2017→اليوم):
   • ~500 مشهد على مدى 5 سنوات = 500 × NDMI/NDVI/SAR
   • زمن الاستخراج: ~15 دقيقة لكل أصل
   ↓
3. استرداد سجل الطقس (Open-Meteo Historical)
   ↓
4. ربط سجلات الصيانة من ERP (تاريخ الإصلاحات)
   ↓
5. بناء ConditionalProfile الشخصي:
   • 12 حالة × 8 إشارات = 96 خلية سلوك خاصة بالأصل
   ↓
6. تدريب SeasonalModel (ما هو NDMI الطبيعي في أغسطس؟)
   ↓
7. حفظ AssetDigitalTwin في PostgreSQL
   ↓
8. الآن: كل مشهد Sentinel-2 جديد يُحدِّث الـ Twin فوراً
```

---

### 10.4 مؤشر صحة الأصل (Asset Health Score)

```
health_score = Σ wᵢ × componentᵢ

المكونات:
  w₁=0.30 : eo_trend_score     → هل NDMI يتحسن أم يتراجع؟
  w₂=0.25 : anomaly_frequency  → كم شذوذاً في آخر 180 يوم؟
  w₃=0.20 : age_factor         → العمر النسبي = actual_age / design_life
  w₄=0.15 : maintenance_gap    → كم يوم منذ آخر صيانة؟
  w₅=0.10 : pressure_stress    → هل الضغط الحالي أعلى من التصميم؟

القراءة:
  0.8 - 1.0 : ممتاز (أخضر)
  0.6 - 0.8 : جيد (أصفر فاتح)
  0.4 - 0.6 : تحذير (برتقالي)
  0.0 - 0.4 : حرج (أحمر)
```

---

### 10.5 الخط الزمني للأصل (Asset Timeline)

```
─────────────────────────────────────────────────────────────────→ الزمن
2017    2018    2019    2020    2021    2022    2023    2024    2025  2026

███ تركيب الأصل ████████████████████████████████████████████████████ 9 سنوات

    ·  ·  ·  ·  · ✦ · ·  · ✦ · ·  · ·  · ✦ ·  ·   Sentinel-2 مشاهد (كل 5 أيام)
    
                  ☁ شتاء    ☀ صيف    ☁ شتاء    ☀ صيف    ☁ شتاء   موسمية
    
              🔧صيانة              🔧صيانة              🔧 صيانة   ERP
              
                        ⚠ تنبيه أول         ⚠ تنبيه ثاني          MINERVA
                        
    ████████▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░                          Health Score
    1.0    0.85  0.70  0.65  0.60  0.55                           (تراجع تدريجي)
```

كل سطر في الخط الزمني مصدره بيانات حقيقية وليس تخميناً.

---

### 10.6 نموذج التعلم الذاتي (Personal Baseline Learning)

المشكلة في Phase 0-9: خط الأساس مبني من **نافذة ثابتة** (سنتان من البداية).  
Phase 10 يستخدم **نافذة منزلقة ذكية**:

```python
# Pseudo-code — AssetPersonalBaseline
class AssetPersonalBaseline:
    
    def update(self, new_observation: EOObservation):
        """
        تُستدعى مع كل مشهد Sentinel-2 جديد (كل 5 أيام).
        """
        # 1. إضافة الملاحظة الجديدة
        self.history.append(new_observation)
        
        # 2. تحديد حالة السياق (موسم × طقس × صيانة)
        ctx = self.context_resolver.resolve(new_observation.date)
        
        # 3. تحديث الخلية المقابلة فقط
        cell = self.get_cell(ctx)
        cell.update_welford(new_observation.NDMI)  # Welford online algorithm
        
        # 4. الخلايا القديمة تتراجع وزنها تدريجياً (forgetting factor)
        for old_cell in self.cells.values():
            old_cell.weight *= 0.9995  # ~6 أشهر لتراجع 50%
        
        # 5. كشف الانجراف (drift detection)
        if self.detect_drift(new_observation):
            self.emit_drift_alert()
```

**خوارزمية Welford:** تتيح تحديث المتوسط والتباين تدريجياً بدون إعادة حساب كامل.  
**Forgetting Factor:** يضمن أن البيانات القديمة (قبل إصلاح كبير) لا تلوث الخط الجديد.

---

### 10.7 صفحة MINERVA Center — Asset Intelligence

```
┌─────────────────────────────────────────────────────────────────┐
│  MINERVA Center                              [🗺 خريطة] [📊 تقرير]│
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌──────────────────────────────────────────┐│
│  │   خريطة        │  │  PIPE-WTR-032 — خط مياه السواحل          ││
│  │   المنطقة      │  │                                          ││
│  │               │  │  صحة الأصل:  ████████░░  78%  [جيد]      ││
│  │  🔴 أصل       │  │  آخر مشهد:   2026-07-02 (Sentinel-2A)    ││
│  │  حرج           │  │                                          ││
│  │               │  ├──────────────────────────────────────────┤│
│  │  🟡 تحذير    │  │  الخط الزمني   ↗ NDMI  ↗ VV  ↗ صيانة    ││
│  │               │  │  ──────────────────────────────────────  ││
│  │  🟢 جيد      │  │  Jul 02: NDMI=-0.049  VV=-6.5dB          ││
│  │               │  │  Jun 30: NDMI=-0.056  VV=-5.2dB ⚡تغيّر  ││
│  │               │  │  Jun 25: NDMI=-0.041  VV=-5.1dB          ││
│  │               │  ├──────────────────────────────────────────┤│
│  │               │  │  التشخيص: احتمال تسرب 67% [توصية: فحص]  ││
│  └───────────────┘  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

### 10.8 بنية قاعدة البيانات الجديدة

```sql
-- التوأم الرقمي للأصل
CREATE TABLE asset_digital_twins (
    id              UUID PRIMARY KEY,
    asset_id        TEXT UNIQUE NOT NULL,
    asset_type      TEXT,
    location        GEOMETRY(Point, 4326),
    metadata        JSONB,         -- المادة، القطر، الضغط...
    health_score    FLOAT,
    health_updated  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- تاريخ المشاهدات EO لكل أصل
CREATE TABLE asset_eo_observations (
    id          UUID PRIMARY KEY,
    asset_id    TEXT REFERENCES asset_digital_twins(asset_id),
    obs_date    DATE NOT NULL,
    source      TEXT,             -- 'sentinel-2-l2a' / 'sentinel-1-rtc'
    scene_id    TEXT,
    cloud_pct   FLOAT,
    NDMI        FLOAT,
    NDVI        FLOAT,
    NDWI        FLOAT,
    VV_dB       FLOAT,
    VH_dB       FLOAT,
    LST_C       FLOAT,
    raw_json    JSONB,
    UNIQUE(asset_id, obs_date, source)
);

-- الخط الأساسي الشخصي لكل أصل
CREATE TABLE asset_personal_baselines (
    id          UUID PRIMARY KEY,
    asset_id    TEXT REFERENCES asset_digital_twins(asset_id),
    context_key TEXT,             -- 'HOT_DRY|DRY|NORMAL|NORMAL'
    signal      TEXT,             -- 'NDMI' / 'NDVI' / ...
    mean        FLOAT,
    std         FLOAT,
    n_obs       INT,
    last_updated TIMESTAMPTZ
);
```

---

### 10.9 الوحدات المطلوب بناؤها في Phase 10

| الوحدة | الملف | الأولوية |
|--------|-------|----------|
| Asset Digital Twin Manager | `minerva/assets/digital_twin.py` | عالية جداً |
| Personal Baseline Builder | `minerva/assets/personal_baseline.py` | عالية جداً |
| Asset Health Scorer | `minerva/assets/health_score.py` | عالية |
| Historical Bootstrap | `scripts/minerva_bootstrap_asset.py` | عالية |
| Asset Timeline Builder | `minerva/assets/timeline.py` | متوسطة |
| Drift Detector | `minerva/assets/drift.py` | متوسطة |
| MINERVA Center Asset Page | `app/.../asset-intelligence/page.tsx` | متوسطة |
| Asset Intelligence API | `app/api/minerva/asset/[id]/route.ts` | متوسطة |

---

### 10.10 التحديث التلقائي (Real-time Loop)

```
كل يوم (Cron Job):
  لكل أصل مُسجَّل:
    1. استعلام STAC: هل هناك مشاهد Sentinel-2/1 جديدة منذ آخر تحقق؟
    2. إذا نعم:
       a. استخراج NDMI/NDVI/SAR من المشهد الجديد
       b. حفظ في asset_eo_observations
       c. تحديث AssetPersonalBaseline (Welford update)
       d. إعادة حساب health_score
       e. تشغيل AnomalyEngine على القراءة الجديدة
       f. إرسال تنبيه إذا تجاوز العتبة
  
→ النتيجة: كل أصل يتلقى تحديثاً حقيقياً كل 5 أيام تلقائياً
```

---

## خارطة الطريق النهائية

```
Phase 0  ██████ مكتمل — Conditional Baseline (F1=0.769)
Phase 1  ██████ مكتمل — Diagnostic Reasoning + Physical Facts
Phase 2  ██████ مكتمل — Living Knowledge Graph + Root Cause
Phase 3  ██████ مكتمل — Decision Intelligence (VoI)
Phase 4  ██████ مكتمل — MINERVA Center UI
Phase 5  ██████ مكتمل — Planet Labs Commercial Imagery
Phase 6  ██████ مكتمل — تصميم (متقدم)
Phase 7  ██████ مكتمل — تصميم (SCADA)
Phase 8  ██████ مكتمل — تصميم (إنذار)
Phase 9  ██████ مكتمل — ✅ EO حقيقية: Sentinel-2 + Sentinel-1
Phase 10 ░░░░░░ قادم  — Asset Digital Twin + Personal Baseline
```

### الوضع الحالي بعد Phase 9

| المعيار | قبل Phase 9 | بعد Phase 9 |
|---------|-------------|-------------|
| إشارات حقيقية | 1/5 (20%) | 4/5 (80%) |
| مصادر البيانات | محاكاة + طقس | S2+S1+طقس حقيقية |
| قيمة تاريخ الأصل | لا قيمة (مزيف) | قيمة حقيقية ✅ |
| جاهزية Phase 10 | مستحيل | ممكن ✅ |

---

*MINERVA Spatial Intelligence Engine — نظام ذكاء مكاني يقوم على بيانات حقيقية*  
*البنية: Next.js 14 + Python + PostgreSQL/PostGIS + Sentinel-2/1 + Planet Labs*
