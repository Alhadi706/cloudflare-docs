# ARGUS — Adaptive Reasoning Geo-evidence Understanding System

> اقتراح الاسم: **ARGUS** — مستوحى من آرغوس في الأساطير الإغريقية، الكائن ذو المئة عين، الذي لا ينام ولا يفوته شيء. اختصارًا علميًا: **A**daptive **R**easoning **G**eo-evidence **U**nderstanding **S**ystem

---

## المرحلة الأولى: Research — مسح علمي وتقني شامل

### 1.1 ما الذي يوجد فعلًا؟

**المنصات العالمية الحالية:**

| المنصة | النهج | القوة | القصور |
|---|---|---|---|
| Google Earth Engine | تحليل Temporal Optical | بيانات مجانية ضخمة | لا reasoning، مجرد tools |
| IBM PAIRS | Multi-source Geo-temporal | دمج بيانات قوي | لا Explainable AI |
| Descartes Labs | Cloud ML على Satellite | سرعة معالجة | Black box كامل |
| Orbital Insight | AI على Commercial Imagery | دقة عالية | مصدر واحد |
| ESA SNAP/Sentinel | SAR + InSAR | مجاني، علمي دقيق | يحتاج خبرة بشرية |
| Capella Space / ICEYE | SAR نقي | كل الأحوال الجوية | مكلف جدًا |
| Planet Labs | تكرار يومي | Revisit ممتاز | دقة منخفضة نسبيًا |

**الخلاصة**: لا توجد منصة واحدة تجمع بين: Multi-evidence fusion + Physics reasoning + Ground truth learning loop. هذه الفجوة هي موقع ARGUS.

---

### 1.2 ما هي الآثار الفيزيائية لكل حدث؟ (First Principles)

هذا هو جوهر المنهجية. لكل حدث، نسأل: **ماذا يترك في الطبيعة؟**

#### تسرب مياه
- رطوبة تربة مرتفعة → NDMI / SWIR
- تغير LST محلي بارد (تبخر)
- تغير InSAR coherence
- نمو نباتي غير موسمي → NDVI
- تغير DEM تراكم طيني
- مؤشر ملوحة في الطيف

#### تسرب نفط
- تغير SAR backscatter
- طيف مميز في SWIR
- LST مرتفعة موضعية
- تغير لون في RGB
- غياب NDVI شامل
- تغير texture في SAR

#### هبوط أرض
- إشارة InSAR واضحة PSInSAR
- تغير DEM تراكمي
- تشقق في SAR Coherence
- لا تغير بصري في optical

#### بناء جديد
- فقدان NDVI مفاجئ
- ارتفاع SAR DSM
- تغير InSAR coherence
- زيادة impervious surface
- تغير thermal signature

#### تجريف
- تغير DEM سلبي
- تغير SAR roughness
- تغير NDVI
- تشتت طيفي للتربة
- تغير drainage pattern

#### اعتداء على الحرم
- حركة مركبات في SAR
- تغير NDVI موسمي غير مبرر
- مقارنة حدود المستهدف

---

### 1.3 البيانات المتاحة مجانًا مقابل التجارية

**البيانات المجانية (Free Tier):**

| المصدر | النوع | الدقة | التكرار |
|---|---|---|---|
| Sentinel-1 | SAR C-Band | 10m | 6-12 يوم |
| Sentinel-2 | Multispectral 13 band | 10m | 5-10 يوم |
| Landsat 8/9 | Multispectral + Thermal | 30m | 16 يوم |
| SRTM/NASADEM | DEM Elevation | 30m | مرة واحدة |
| Copernicus DEM | DEM | 30m | شبه سنوي |
| MODIS | Thermal + Vegetation | 250-1000m | يومي |
| ERA5 (ECMWF) | Weather Reanalysis | 30km | ساعي تاريخي |
| Open-Meteo | Weather Forecast/History | 1km | ساعي |
| VIIRS (NASA/NOAA) | Thermal Anomalies | 375m | يومي |
| OSM | Topography/Infrastructure | متغير | مستمر |

**البيانات التجارية:**

| المصدر | الميزة | التكلفة |
|---|---|---|
| Planet SuperDove | 3m يومي | عالية |
| Maxar WorldView | 30cm | عالية جدًا |
| ICEYE | SAR يومي | عالية |
| Airbus Pleiades | 50cm | عالية |
| SkyFi/UP42 | Archive Access | متوسطة |

---

## المرحلة الثانية: Challenge — نقد الفكرة واكتشاف حدودها

### 2.1 المشكلة الحقيقية: Data Alignment

هذه هي المشكلة رقم 1 التي تقتل معظم مشاريع مماثلة:

- SAR يُصوَّر بـ Side-looking geometry → تشويه هندسي في المناطق الجبلية.
- InSAR يحتاج exact repeat orbit → لا يعمل جيدًا مع Sentinel-1 في جميع المناطق.
- Thermal (Landsat) دقة 100m → لا تكفي لكشف تسرب موضعي في أنبوب 30cm.
- Weather data spatial resolution منخفضة جدًا للتحليل المحلي.

**الحل المقترح**: بناء **Spatial Harmonization Layer** منفصلة تعمل قبل كل شيء، مهمتها الوحيدة تحويل كل مصدر بيانات إلى نفس:
- Coordinate Reference System
- Spatial Resolution (Resampling محكوم)
- Temporal Window (±N ساعة)
- Radiometric Calibration (Top-of-Atmosphere)

---

### 2.2 مشكلة Seasonal Baseline

الأرض تتغير بشكل طبيعي. NDVI في الصيف ليس مثل الشتاء. SAR backscatter بعد المطر مختلف. إذا قارنا بدون baseline صحيح، سنحصل على آلاف من False Positives.

**الحد العلمي**: يحتاج النظام من **2 إلى 3 سنوات** من البيانات التاريخية لبناء baseline موثوق. في غياب هذا، الدقة ستكون ضعيفة جدًا في السنة الأولى.

**البديل**: استخدام **Harmonic Regression (Fourier)** على time-series لتحديد النمط الموسمي المتوقع، وقياس الانحراف عنه. هذا ما تستخدمه خوارزمية CCDC (Continuous Change Detection) من USGS ويعطي نتائج مقبولة بعد 6 أشهر فقط.

---

### 2.3 مشكلة Ground Truth Scarcity

**النقد الأقسى للفكرة الأساسية**: الـ Signature Library لن تعمل بدون Ground Truth. والـ Ground Truth يحتاج:
- فريق ميداني يتحقق من كل تنبيه.
- تكلفة مرتفعة.
- تأخير زمني (قد يصل أسابيع).
- في بعض المناطق، التحقق الميداني مستحيل جغرافيًا أو أمنيًا.

**الحل**: نظام **Synthetic Ground Truth Generation** — استخدام بيانات حوادث موثقة من مصادر مفتوحة (تقارير ACLED، حوادث مسجلة، صور تجارية مُعلَّنة) لبناء initial Signature Library. وإضافة **Active Learning Prioritization** لاختيار أكثر الحالات قيمةً للتحقق الميداني.

---

### 2.4 مشكلة نقل البصمات بين البيئات (Domain Transfer)

بصمة تسرب مياه في صحراء ليبيا مختلفة عن بصمة تسرب مياه في غابات الكونغو. Signature Library مبنية في بيئة لن تعمل في بيئة أخرى.

**الحل**: بدلًا من Signature Library موحدة، بناء **Hierarchical Signatures**:
- **Universal Physical Layer**: القوانين الفيزيائية ثابتة (الماء يرفع NDMI دائمًا).
- **Biome-specific Layer**: معلمات تُعدَّل لكل نوع بيئة.
- **Asset-specific Layer**: baseline مخصص لكل أصل على حدة.

---

### 2.5 مشكلة Computational Feasibility

معالجة 10 مصادر بيانات × 1000 أصل × أسبوعيًا = كمية هائلة من الحوسبة.

**الحد العملي**: لا يمكن معالجة كل شيء في نفس الوقت. يجب بناء **Priority Queue** ذكي:
- الأصول عالية الأهمية → يومي.
- الأصول متوسطة الأهمية → أسبوعي.
- الأصول منخفضة الأهمية → شهري.
- الأصول التي كشف النظام فيها أدلة أولية → فوري escalation.

---

## المرحلة الثالثة: Innovation — ما هو أبعد مما هو موجود

### 3.1 Physics-Constrained Probabilistic Inference

بدلًا من ML خالص، نضع **قيودًا فيزيائية صارمة**. مثال:

```
IF  تسرب_مياه = محتمل
THEN يجب أن يكون NDMI مرتفع OR رطوبة_تربة مرتفعة

IF  ارتفاع_NDVI مفاجئ في منطقة جافة في موسم جاف
AND لا يوجد مطر في 30 يوم الماضية
THEN هذا دليل قوي جدًا على وجود مصدر ماء غير طبيعي
```

هذه القيود تُقلص search space وتحذف نتائج فيزيائيًا مستحيلة حتى لو أنتجها ML.

---

### 3.2 Cross-Asset Correlation Engine

إذا ظهرت أدلة مشابهة في عدة أصول على نفس خط أنابيب → تتضاعف الثقة.
إذا كان الأصل المجاور يعمل بشكل طبيعي تمامًا → تقل الثقة.

هذا مفهوم **Spatial Propagation Evidence** وهو غير موجود في أي نظام تجاري حالي.

---

### 3.3 Counterfactual Reasoning Layer

النظام لا يسأل فقط: "هل هذا يبدو كتسرب؟"
بل يسأل: "لو لم يكن هناك تسرب، ماذا كنا سنرى؟"

ثم يحسب: كم احتمال أن تكون هذه البيانات ناتجة عن *غياب* الحدث؟

هذا مأخوذ من نظرية **Bayesian Counterfactual Inference** وهو ما يجعل الـ Explainability حقيقية وليست مصطلحات فارغة.

---

### 3.4 Adaptive Signature Learning — مع حل مشكلة Class Imbalance

المشكلة: 99% من الملاحظات = طبيعية، 1% = أحداث حقيقية. النظام سيتعلم أن يقول "طبيعي" دائمًا وسيكون دقيقًا 99%.

الحل: **Few-Shot Learning with Physics Anchors** — استخدام النماذج الفيزيائية كـ anchors لتوليد Examples اصطناعية (Synthetic Augmentation) يُدرَّب عليها النظام، مع دمج كل حالة مؤكدة ميدانيًا كـ **hard example** مرجح.

---

### 3.5 Federated Signature Library

لو استخدمت شركات نفط متعددة النظام، كل شركة تحتفظ ببياناتها الخاصة، لكن **بصمة الحدث (الموقّعة فيزيائيًا)** يمكن مشاركتها بعد **anonymization و differential privacy**. هذا يبني مكتبة عالمية دون كشف بيانات تجارية حساسة.

---

## المرحلة الرابعة: Architecture — التصميم الهندسي الكامل

### 4.0 نظرة عامة على النظام

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARGUS ENGINE                             │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  INGESTION   │───▶│ HARMONIZATION│───▶│ FEATURE STORE│      │
│  │              │    │              │    │              │      │
│  │ Sentinel Hub │    │ Spatial Align│    │ Spectral     │      │
│  │ SAR Pipeline │    │ Temporal Sync│    │ SAR / InSAR  │      │
│  │ Weather API  │    │ Radiometric  │    │ Thermal      │      │
│  │ ERP Bridge   │    │ Quality Score│    │ Temporal Der.│      │
│  │ Field Gateway│    └──────────────┘    │ Enterprise   │      │
│  └──────────────┘                        └──────┬───────┘      │
│                                                 │              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────▼───────┐      │
│  │  SIGNATURE   │    │   BASELINE   │    │   EVIDENCE   │      │
│  │  LIBRARY     │───▶│   ENGINE     │───▶│   FUSION     │      │
│  │              │    │              │    │   ENGINE     │      │
│  │ Physics Rules│    │ Harmonic Reg.│    │              │      │
│  │ Biome Sigs   │    │ Seasonal Dec.│    │ Dempster-    │      │
│  │ Asset Sigs   │    │ Per-Asset    │    │ Shafer       │      │
│  │ Ground Truth │    │ Anomaly Score│    │ Physics Check│      │
│  │ Adaptive Lrn │    └──────────────┘    │ Counterfact. │      │
│  └──────▲───────┘                        └──────┬───────┘      │
│         │                                       │              │
│  ┌──────┴───────┐    ┌──────────────┐    ┌──────▼───────┐      │
│  │  GROUND      │    │  EXPLAINABLE │    │  AI REASONING│      │
│  │  TRUTH LOOP  │◀───│  AI LAYER    │◀───│  ENGINE      │      │
│  │              │    │              │    │              │      │
│  │ Field Verify │    │ Evidence Rpt │    │ XGBoost/LGBM │      │
│  │ GT Store     │    │ Confidence   │    │ Bayesian Net │      │
│  │ Model Update │    │ Uncertainty  │    │ Temporal Pat.│      │
│  └──────────────┘    │ SHAP Explain │    │ Causal Inf.  │      │
│                       └──────┬───────┘    └──────────────┘      │
│                              │                                  │
│                       ┌──────▼───────┐                         │
│                       │    OUTPUT    │                         │
│                       │              │                         │
│                       │ Alert Engine │                         │
│                       │ Field Queue  │                         │
│                       │ Report Gen.  │                         │
│                       └──────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.1 Data Model — نموذج البيانات

```sql
-- الأصل (الكيان الحي)
CREATE TABLE asset (
    asset_id        UUID PRIMARY KEY,
    name_ar         TEXT NOT NULL,
    asset_type      TEXT NOT NULL,          -- pipeline, pump_station, reservoir, ...
    boundary_geom   GEOMETRY(POLYGON, 4326),
    centerline_geom GEOMETRY(LINESTRING, 4326),
    criticality_score FLOAT DEFAULT 0.5,
    commissioned_date TIMESTAMPTZ,
    metadata        JSONB
);

-- سجل الأدلة لكل أصل
CREATE TABLE asset_evidence_record (
    record_id        UUID PRIMARY KEY,
    asset_id         UUID REFERENCES asset,
    observation_time TIMESTAMPTZ NOT NULL,
    data_source      TEXT,                  -- sentinel2, sentinel1, landsat9, ...
    data_type        TEXT,                  -- optical, sar, insar, thermal, dem
    spatial_resolution_m FLOAT,
    raw_features     JSONB,
    derived_features JSONB,
    quality_score    FLOAT,
    footprint        GEOMETRY(POLYGON, 4326)
);

-- Baseline لكل معلم لكل أصل
CREATE TABLE asset_baseline (
    baseline_id      UUID PRIMARY KEY,
    asset_id         UUID REFERENCES asset,
    feature_name     TEXT,
    harmonic_mean    FLOAT,
    harmonic_amp_annual FLOAT,
    harmonic_phase_annual FLOAT,
    std_deviation    FLOAT,
    baseline_period_start TIMESTAMPTZ,
    baseline_period_end   TIMESTAMPTZ,
    n_observations   INT
);

-- نتيجة الاستنتاج
CREATE TABLE inference_result (
    result_id        UUID PRIMARY KEY,
    bundle_id        UUID,
    event_type       TEXT,                  -- water_leak, oil_spill, subsidence, ...
    probability      FLOAT,
    confidence       FLOAT,
    uncertainty      FLOAT,
    evidence_weights JSONB,
    explanation      JSONB,
    recommendation   TEXT,
    status           TEXT DEFAULT 'pending'
);

-- البصمات المتعلمة
CREATE TABLE signature (
    signature_id     UUID PRIMARY KEY,
    event_type       TEXT,
    biome_type       TEXT,
    asset_type       TEXT,
    feature_weights  JSONB,
    physics_constraints JSONB,
    precision_rate   FLOAT,
    recall_rate      FLOAT,
    n_verified_samples INT DEFAULT 0,
    last_updated     TIMESTAMPTZ
);

-- التحقق الميداني
CREATE TABLE ground_truth (
    gt_id            UUID PRIMARY KEY,
    inference_result_id UUID REFERENCES inference_result,
    was_correct      BOOLEAN,
    verified_event_type TEXT,
    field_verification_time TIMESTAMPTZ,
    verified_by      TEXT,
    field_notes      JSONB,
    exact_location   GEOMETRY(POINT, 4326)
);
```

---

### 4.2 Feature Store — قائمة المعالم الكاملة

```yaml
SPECTRAL_FEATURES:
  NDVI:   "(NIR - R) / (NIR + R)"        # نشاط نباتي
  NDWI:   "(G - NIR) / (G + NIR)"        # مياه سطحية
  NDMI:   "(NIR - SWIR) / (NIR + SWIR)"  # رطوبة تربة/نبات
  NBR:    "(NIR - SWIR2) / (NIR + SWIR2)"# حرائق
  BSI:    "(SWIR + R - NIR - B) / (...)" # تربة عارية
  Clay_Index: "SWIR1 / SWIR2"            # تحليل تربة
  Iron_Oxide: "R / B"                    # تلوث تربة

SAR_FEATURES:
  - VV_backscatter_intensity
  - VH_backscatter_intensity
  - VV_VH_ratio                          # surface roughness
  - GLCM_contrast                        # texture
  - GLCM_energy
  - GLCM_homogeneity
  - dual_pol_surface_component
  - dual_pol_volume_component
  - change_log_ratio                     # بين أكوايزيشنين
  - speckle_filtered_mean
  - speckle_filtered_std

INSAR_FEATURES:
  - coherence_map                        # مؤشر تغيير هيكلي
  - LOS_displacement_velocity            # PSInSAR/SBAS
  - wrapped_phase                        # تغيير آني
  - temporal_coherence_trend

THERMAL_FEATURES:
  - LST_kelvin                           # درجة حرارة السطح
  - LST_anomaly_vs_baseline
  - UHI_intensity                        # حرارة حضرية
  - thermal_gradient_pipeline            # تأثير الأنبوب

ELEVATION_FEATURES:
  - DEM_absolute_value
  - slope_degrees
  - aspect_degrees
  - curvature
  - TPI                                  # Topographic Position Index
  - DEM_change_vs_reference              # تغير حجمي

TEMPORAL_DERIVATIVES:
  - trend_linear_slope                   # اتجاه N epochs
  - breakpoint_date                      # BFAST/CCDC
  - seasonality_deviation
  - rate_of_change                       # المشتقة الأولى
  - acceleration_of_change               # المشتقة الثانية

ENTERPRISE_CONTEXT:
  - asset_age_years
  - days_since_last_maintenance
  - historical_incident_count
  - material_type
  - pressure_sensor_reading              # إن وُجد
  - flow_sensor_reading                  # إن وُجد
  - known_risk_zones_flag
```

---

### 4.3 Baseline Engine

**المعادلة الأساسية** — Harmonic Regression:

```
y(t) = a₀ + a₁·cos(2πt/365) + b₁·sin(2πt/365)
             + a₂·cos(4πt/365) + b₂·sin(4πt/365) + ε

حيث:
  a₀        = المتوسط السنوي
  a₁, b₁   = مركبة الدورة السنوية
  a₂, b₂   = مركبة الدورة نصف السنوية
  ε         = الضجيج

anomaly_z_score = (observed - ŷ(t)) / σ_residual

التصنيف:
  |z| < 1.5    → طبيعي
  1.5 ≤ |z| < 2.5 → مراقبة
  |z| ≥ 2.5   → شذوذ
  |z| ≥ 4.0   → شذوذ حاد
```

**ملاحظة**: يجب اقتران Harmonic Regression بـ **CUSUM detector** للتغيرات المفاجئة الدائمة (كالبناء الجديد) التي لا يكتشفها الانحراف المعياري وحده.

---

### 4.4 Signature Library Architecture

```
SIGNATURES
├── UNIVERSAL_PHYSICS/               ← ثابتة، لا تتغير
│   ├── water_presence.yaml          # الماء → NDMI↑, LST↓
│   ├── oil_presence.yaml            # النفط → SAR_change, SWIR_anomaly
│   ├── subsidence.yaml              # الهبوط → InSAR_LOS↓
│   └── new_construction.yaml        # البناء → NDVI↓, DSM↑
│
├── BIOME_SPECIFIC/                  ← تُضبط لكل بيئة
│   ├── arid_desert/
│   │   ├── water_leak.yaml          # threshold أقل لـ NDMI
│   │   └── encroachment.yaml
│   ├── coastal/
│   ├── urban/
│   └── agricultural/
│
├── ASSET_SPECIFIC/                  ← مخصص لكل أصل
│   └── {asset_id}/
│       ├── baseline_params.json
│       └── known_fp_patterns.json   # False Positives معروفة
│
└── LEARNED/                         ← يتطور مع الزمن
    ├── verified_events/             # Ground Truth مؤكدة
    ├── false_positive_library/      # أنماط الإنذارات الخاطئة
    └── model_weights/               # أوزان المحرك المحدّثة
```

---

### 4.5 Evidence Fusion Engine

**نظرية Dempster-Shafer للدمج:**

```
m₁ ⊕ m₂ (A) = Σ_{B∩C=A} m₁(B)·m₂(C) / (1 - K)

K = Σ_{B∩C=∅} m₁(B)·m₂(C)  ← مقياس التعارض

ميزة على Bayesian:
  - إذا تعارضت الأدلة → يُعلن عدم اليقين صراحةً (K عالية)
  - لا يُفرز نتيجة مصطنعة من أدلة متناقضة
```

**مثال كود Python مبسط:**

```python
from dataclasses import dataclass
from typing import Dict

@dataclass
class Evidence:
    source: str
    hypothesis: str          # water_leak, oil_spill, normal, ...
    belief: float            # 0-1
    source_reliability: float # جودة المصدر

def dempster_combination(m1: Dict, m2: Dict) -> Dict:
    """دمج دليلين باستخدام قاعدة Dempster"""
    combined = {}
    K = 0.0  # مقياس التعارض
    
    for h1, v1 in m1.items():
        for h2, v2 in m2.items():
            if h1 == h2:
                combined[h1] = combined.get(h1, 0) + v1 * v2
            else:
                K += v1 * v2  # تعارض
    
    # تطبيع
    normalization = 1 - K
    if normalization < 0.01:
        return {"uncertain": 1.0, "conflict_score": K}
    
    return {h: v / normalization for h, v in combined.items()}

def apply_physics_constraints(belief: Dict, asset_context: Dict) -> Dict:
    """حذف النتائج الفيزيائيًا المستحيلة"""
    if belief.get("water_leak", 0) > 0.5:
        # تسرب مياه يستلزم وجود NDMI مرتفع أو رطوبة مرتفعة
        if asset_context.get("ndmi_zscore", 0) < 1.0 and \
           asset_context.get("soil_moisture_anomaly", 0) < 1.0:
            belief["water_leak"] *= 0.1  # تخفيض حاد
    return belief
```

---

### 4.6 AI Reasoning Engine

**ثلاثة نماذج متوازية:**

```
1. XGBoost / LightGBM
   - المدخلات: Feature vector كامل (70+ feature)
   - المخرجات: Multi-label probabilities
   - القوة: يجيد الأنماط الإحصائية المعقدة
   - الضعف: لا يفهم السببية

2. Bayesian Network
   - يُعبّر صراحةً عن:
     P(water_leak | NDMI_high, LST_low, no_rain)
   - القوة: تفسير سببي واضح
   - الضعف: يحتاج تعريف structure يدوي

3. Temporal Pattern Matcher
   - يتعرف على تسلسل الأدلة عبر الزمن
   - تسرب مياه: NDMI↑ (أسبوع 1) → LST↓ (أسبوع 2) → NDVI↑ (أسبوع 4)
   - بناء جديد: NDVI↓ (مفاجئ) → SAR DSM↑ (أسبوع 3)
   - القوة: يكتشف الأنماط الزمنية التي يفوتها snapshot analysis

Meta-Ensemble:
   - يجمع مخرجات النماذج الثلاثة
   - مع Physics Constraints كفلتر نهائي
```

---

### 4.7 مخرج التنبيه الكامل (JSON Schema)

```json
{
  "asset_id": "PIPE-LY-0044",
  "asset_name_ar": "خط الأنابيب الرئيسي - القطاع الشمالي",
  "analysis_time": "2026-07-07T06:00:00Z",
  "event_type": "water_leak",
  "probability": 0.82,
  "confidence": 0.74,
  "uncertainty": 0.18,
  "conflict_score": 0.06,
  
  "evidence": [
    {
      "source": "Sentinel-2 NDMI",
      "acquisition_date": "2026-07-05",
      "value": 0.31,
      "baseline_expected": 0.08,
      "z_score": 4.2,
      "weight": 0.35,
      "direction": "strongly_supports",
      "interpretation_ar": "رطوبة تربة مرتفعة بشكل استثنائي (4.2 انحراف معياري فوق المتوسط الموسمي)"
    },
    {
      "source": "Landsat-9 LST",
      "acquisition_date": "2026-07-04",
      "value_celsius": 32.1,
      "baseline_expected_celsius": 38.5,
      "z_score": -2.8,
      "weight": 0.28,
      "direction": "supports",
      "interpretation_ar": "انخفاض غير طبيعي في درجة حرارة السطح متوافق مع التبخر من تسرب مائي"
    },
    {
      "source": "Sentinel-1 SAR VV",
      "acquisition_date": "2026-07-03",
      "value_db": -12.3,
      "baseline_expected_db": -8.1,
      "z_score": -3.1,
      "weight": 0.22,
      "direction": "supports",
      "interpretation_ar": "تغير في backscatter SAR متوافق مع زيادة رطوبة السطح"
    },
    {
      "source": "Open-Meteo Precipitation",
      "value": "0mm (last 21 days)",
      "weight": 0.15,
      "direction": "critical_differentiator",
      "interpretation_ar": "لا يوجد هطول مطري يفسر الرطوبة المرصودة — يُقوي فرضية المصدر الاصطناعي بشكل حاسم"
    }
  ],
  
  "physics_check": {
    "passed": true,
    "constraints_verified": [
      "NDMI_elevation_consistent",
      "LST_depression_in_arid_zone",
      "no_precipitation_rules_out_natural_cause"
    ]
  },
  
  "counterfactual": {
    "probability_without_event": 0.03,
    "interpretation_ar": "احتمالية رصد هذه البيانات مجتمعةً في غياب تسرب = 3% فقط"
  },
  
  "temporal_analysis": {
    "anomaly_start_estimated": "2026-06-20",
    "days_before_alert": 17,
    "trend": "increasing",
    "interpretation_ar": "بدأ التغيير قبل 17 يومًا — التسرب قائم قبل هذا التنبيه"
  },
  
  "recommendation": {
    "action": "field_verification_urgent",
    "priority": "HIGH",
    "priority_score": 0.91,
    "suggested_inspection_radius_m": 50,
    "estimated_hotspot": {"lat": 32.891, "lon": 13.207},
    "reasoning_ar": "نقطة أعلى قيم NDMI تتمركز في هذه الإحداثيات — الفريق الميداني يتجه إليها أولًا"
  },
  
  "signature_used": {
    "signature_id": "SIG-water-leak-arid-pipeline",
    "n_verified_samples": 147,
    "precision_rate": 0.89,
    "recall_rate": 0.82,
    "biome": "arid_desert"
  }
}
```

---

### 4.8 Confidence Scoring Formula

```
Confidence = w_q · Q_data  ×  w_e · N_evidence  ×  w_p · P_physics  ×  w_s · S_signature

المعاملات:
  Q_data      = متوسط جودة مصادر البيانات المستخدمة  (0→1)
  N_evidence  = عدد الأدلة المستقلة (normalized)       (0→1)
  P_physics   = 1.0 إذا تجاوزت Physics Check
                0.3 إذا تعارضت مع القوانين الفيزيائية  (0.3 or 1.0)
  S_signature = precision_rate للـ Signature المستخدمة  (0→1)

مثال:
  Q_data=0.85, N_evidence=0.80, P_physics=1.0, S_signature=0.89
  Confidence = 0.85 × 0.80 × 1.0 × 0.89 = 0.605

  مع ضعف بيانات:
  Q_data=0.40, N_evidence=0.50, P_physics=1.0, S_signature=0.89
  Confidence = 0.40 × 0.50 × 1.0 × 0.89 = 0.178 → "بيانات غير كافية"
```

---

### 4.9 Ground Truth Feedback Loop

```
[ARGUS Engine]
      │
      │ Alert با confidence < 0.9
      ▼
[Active Learning Queue]
      │
      │ اختيار الحالات الأعلى Information Gain
      ▼
[Field Team Work Order]
      │ إحداثيات دقيقة + ملخص الأدلة
      ▼
[Field Verification]
      │ {confirmed: true/false, actual_event, photos, GPS}
      ▼
[Ground Truth Store]
      │
      ├──▶ [Signature Library Update] ← Bayesian Weight Update
      ├──▶ [False Positive Library]   ← لو كان خاطئًا
      └──▶ [Model Re-training Trigger] ← كل 50 تحقق جديد

القيمة المتراكمة:
  بعد 500 تحقق:   signature precision ~75%
  بعد 2,000 تحقق: signature precision ~85%
  بعد 5,000 تحقق: signature precision ~92%+ (أعلى من أي منافس عالمي في هذه البيئة)
```

---

### 4.10 Alert Prioritization Engine

```
Priority Score = P_event × C_asset × (1 - T_maintenance_factor) × E_impact

حيث:
  P_event              = احتمالية الحدث (0→1)
  C_asset              = criticality score للأصل (0→1)
  T_maintenance_factor = 1 إذا صُيِّن مؤخرًا, 0 إذا مضى وقت طويل
  E_impact             = تقدير الأثر البيئي/المالي/الأمني (0→1)

تصنيف الأولوية:
  > 0.85  → CRITICAL  → تنبيه فوري + فريق ميداني خلال 24 ساعة
  0.60-0.85 → HIGH   → تنبيه في اليوم + توثيق
  0.35-0.60 → MEDIUM → مراقبة أسبوعية
  < 0.35  → LOW      → تسجيل فقط + مراجعة شهرية
```

---

### 4.11 Technology Stack المقترح

```
DATA LAYER:
  ├── PostGIS            ← Vector data + Asset metadata
  ├── Zarr / COG         ← Cloud-Optimized Raster store
  ├── TimescaleDB        ← Time series features per asset
  └── Redis              ← Realtime cache + Alert queue

PROCESSING LAYER:
  ├── Dask               ← Distributed raster processing
  ├── rasterio / GDAL    ← Raster I/O
  ├── PyTorch + Pyro     ← Bayesian Networks
  ├── LightGBM           ← Multi-label classification
  ├── SHAP               ← Explainability
  └── statsmodels        ← Harmonic regression + BFAST

ORCHESTRATION:
  ├── Apache Airflow     ← Pipeline scheduling per asset tier
  └── Celery + RabbitMQ  ← Task queue for on-demand analysis

API LAYER:
  ├── GraphQL            ← Flexible asset/alert querying
  ├── WebSocket          ← Realtime alert streaming
  └── OGC WMS/WFS        ← GIS standards compliance

SATELLITE DATA ACCESS:
  ├── sentinelhub-py     ← Sentinel-1, Sentinel-2
  ├── earthengine-api    ← Landsat, MODIS, SRTM
  └── planetary-computer ← Microsoft Planetary Computer (free)
```

---

## الخلاصة الاستراتيجية

### ما الذي يجعل ARGUS مختلفًا؟

| الجانب | المنافسون | ARGUS |
|---|---|---|
| مصادر البيانات | 1-3 مصادر | 10+ مصادر متكاملة |
| نوع المخرج | "تم اكتشاف تغيير" | "مجموعة أدلة متوافقة مع نمط X بثقة Y لأسباب Z" |
| التفسير | Black box | كل دليل موثق بوزنه وتفسيره |
| التعلم | Static models | يتحسن مع كل تحقق ميداني |
| القوانين الفيزيائية | غائبة | مدمجة كـ hard constraints |
| Cross-asset | غائب | علاقات الأصول المترابطة |

### الميزة التنافسية غير القابلة للنسخ

الخوارزميات متاحة للجميع. البيانات الفضائية متاحة للجميع.

**لكن Ground Truth Library التي تبنيها تحقق بعد تحقق — هذه لا تُشترى.**

```
بعد 3 سنوات من العمل الميداني:
  ARGUS = أدق نظام في العالم لهذه البيئات الجغرافية المحددة
  
لأن كل تحقق ميداني = بيانات فريدة لا يملكها Google ولا Maxar ولا أي منافس
```

---

## الخطوة التالية المقترحة

**Proof of Concept في 4 أسابيع:**

```
الأسبوع 1: Baseline Engine
  - استخراج Sentinel-2 time series لـ 5 أصول من النظام الحالي
  - Harmonic Regression + Anomaly Scoring
  - مقارنة بالحوادث التاريخية المسجلة في ERP

الأسبوع 2: Feature Store
  - NDVI, NDMI, NDWI, SAR backscatter, LST
  - TimescaleDB schema + ingestion pipeline

الأسبوع 3: Simple Fusion + Explainability
  - Weighted Evidence Combiner (مبسط)
  - JSON report generator
  - Physics constraints أساسية

الأسبوع 4: UI Integration
  - Alert panel في المنصة الحالية
  - Field verification workflow
  - Ground Truth form
```

> **البداية من هذا النظام الحالي** — الأصول موجودة، ERP موجود، الخرائط موجودة.
> ARGUS ليس مشروعًا جديدًا من الصفر، بل طبقة استدلال تُضاف فوق ما تم بناؤه.

---

*ARGUS Architecture v1.0 — DSP R&D Division — 2026-07-07*
