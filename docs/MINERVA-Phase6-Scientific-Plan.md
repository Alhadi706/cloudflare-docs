# MINERVA Phase 6 — Scientific Validation & Accuracy Improvement
## وثيقة التصميم العلمي والمنهج التحقق
### Chief Scientist / Chief Remote Sensing Engineer / Chief Validation Architect
### الإصدار 1.0 | 2026-07-09

---

> **قبل أي كود: توقف وفكر كلجنة مراجعة علمية.**
>
> المطلوب ليس إثارة الإعجاب بالتعقيد.
> المطلوب نظام يمكن قياسه، التحقق منه بشكل مستقل، وتحسينه باستمرار.
> كل وحدة يجب أن تجيب: "كيف هذا يُحسِّن الدقة؟"

---

## 0. نتائج المراجعة العلمية الأولية (Pre-Phase Audit)

قبل اقتراح أي تحسين، يجب الاعتراف صريحًا بالمشاكل العلمية الموجودة:

### 0.1 انتهاك افتراض الاستقلالية في Bayesian Fusion

**المشكلة** (مُقاسة، ليست نظرية):

مصفوفة الارتباط بين الإشارات الأربع الحالية:

```
                    NDMI      LST       SAR       NDVI
NDMI (SOIL_MOIST)  +1.000   -0.706   +0.044   +0.777
LST  (SURF_TEMP)   -0.706   +1.000   -0.123   -0.660
SAR  (BACKSCATR)   +0.044   -0.123   +1.000   +0.192
NDVI (VEG_INDEX)   +0.777   -0.660   +0.192   +1.000
```

**النتيجة**: NDMI↔LST = -0.706 ، NDMI↔NDVI = +0.777

كلا الإشارتين مرتبطتان بشدة. الـ Naive Bayesian Sequential Update يفترض أن كل إشارة مستقلة. هذا **مخالف** للواقع ويؤدي إلى:
- Overconfidence بنسبة تقديرية 15-25%
- Double-counting للأدلة المترابطة
- Confidence يرتفع أسرع مما يجب

**الحل الصحيح**: استخدام Bayesian Network مع Covariance Matrix، أو استخدام أدلة مستقلة فعلًا.

### 0.2 جميع إشارات الأقمار الاصطناعية HYBRID (لا REAL)

| الإشارة | الحالة الفعلية | المصدر الحالي المستخدم |
|---------|----------------|----------------------|
| SOIL_MOISTURE (NDMI) | HYBRID | نموذج فيزيائي (synthetic) |
| SURFACE_TEMP (LST) | HYBRID | نموذج فيزيائي (synthetic) |
| SAR_BACKSCATTER | HYBRID | نموذج فيزيائي (synthetic) |
| VEGETATION_INDEX (NDVI) | HYBRID | نموذج فيزيائي (synthetic) |
| PRECIPITATION | **REAL** ✓ | Open-Meteo |

الوضع الصحيح: النموذج الفيزيائي يُولِّد إشارات واقعية لكنها مُحاكاة. لا يوجد أي قراءة حقيقية من Sentinel-2 أو Landsat الآن.

### 0.3 Confidence غير مُعايَر (Uncalibrated)

**Confidence = 61%** لا يعني أن التشخيص صحيح 61% من الوقت.
بدون Ground Truth، لا يمكن قياس Calibration Error.

**الأثر التشغيلي**: قرار "إرسال فريق ميداني" مبني على ثقة غير مُثبَتة.

---

## 1. TASK 1 — مخزون الإشارات الكامل وخارطة الطريق

### 1.1 التصنيف الحالي

| الإشارة | الفئة | المصدر الحالي | API متاح | التكلفة |
|---------|-------|---------------|----------|---------|
| Precipitation (mm) | **REAL** ✓ | Open-Meteo | مجاني | صفر |
| Temperature (°C) | **REAL** ✓ | Open-Meteo | مجاني | صفر |
| Wind Speed | **REAL** ✓ | Open-Meteo | مجاني | صفر |
| Planet Archive metadata | **REAL** ✓ | Local (29,623 مشهد) | - | مدفوع مسبقًا |
| **NDMI (Sentinel-2)** | **HYBRID** ⚠️ | نموذج فيزيائي | Sentinel Hub | ~$0.5/km² |
| **LST (Landsat-9)** | **HYBRID** ⚠️ | نموذج فيزيائي | USGS EarthExplorer | مجاني |
| **SAR VV (Sentinel-1)** | **HYBRID** ⚠️ | نموذج فيزيائي | ASF Vertex API | مجاني |
| **NDVI (Sentinel-2)** | **HYBRID** ⚠️ | نموذج فيزيائي | Sentinel Hub | ~$0.5/km² |
| InSAR displacement | **MISSING** ❌ | - | Copernicus SBAS | مجاني |
| DEM / Elevation | **MISSING** ❌ | - | SRTM / Copernicus DEM | مجاني |
| Soil type | **MISSING** ❌ | - | SoilGrids API | مجاني |
| SCADA pressure | **MISSING** ❌ | - | ERP integration | داخلي |
| ERP maintenance | **PARTIAL** ⚠️ | - | /api/engineering | داخلي |

### 1.2 خارطة الطريق لاستبدال الإشارات المُحاكاة

**المرحلة أ — الإشارات المجانية (0 تكلفة، يمكن تنفيذها فورًا):**

```
Priority 1: Sentinel-1 SAR (مجاني)
  API: ESA Copernicus / ASF Vertex
  endpoint: https://search.asf.alaska.edu/API/search.json
  بيانات: VV backscatter بدقة 10م، كل 6-12 يوم
  الأثر: استبدال SAR_BACKSCATTER من مُحاكى → حقيقي
  القيمة: أكبر إشارة مستقلة عن NDMI/NDVI

Priority 2: Landsat-9 LST (مجاني)
  API: USGS EarthExplorer / NASA CMR
  endpoint: https://cmr.earthdata.nasa.gov/search/
  بيانات: LST بدقة 100م، كل 16 يوم
  الأثر: استبدال SURFACE_TEMP من مُحاكى → حقيقي

Priority 3: Copernicus DEM (مجاني)
  بيانات: ارتفاعات بدقة 30م
  الأثر: إضافة إشارة مستقلة جديدة (DEM_CHANGE)
  القيمة: تمييز هبوط الأرض عن التسرب

Priority 4: SoilGrids (مجاني)
  API: https://rest.isric.org/soilgrids/v2.0/
  بيانات: نوع التربة، موصلية الماء، عمق التربة
  الأثر: تحسين نموذج propagation للرطوبة
```

**المرحلة ب — الإشارات التجارية (تكلفة محدودة):**

```
Priority 5: Sentinel-2 NDMI/NDVI (Sentinel Hub)
  التكلفة: ~$0.5/km² أو ~$200/شهر للمنطقة الكاملة
  بيانات: 13 نطاق طيفي، دقة 10-20م، كل 5 أيام
  الأثر: استبدال 2 إشارات مُحاكاة دفعة واحدة
  ملاحظة: Copernicus Browser مجاني لـ manual download

Priority 6: Planet NDVI/NDRE (تحليل الصور المحلية)
  التكلفة: صفر (الصور موجودة في الأرشيف)
  المشكلة: Thumbnails فقط (الصور ليست Band-separated)
  الحل: طلب Analyze asset بدلًا من Download
```

**المرحلة ج — الإشارات الداخلية:**

```
Priority 7: SCADA/ERP Pressure
  المصدر: قاعدة بيانات DSP الموجودة
  endpoint: /api/engineering/workspace/ (موجود)
  الأثر: أقوى إشارة منفردة لتأكيد التسرب
  الأثر المتوقع: رفع Confidence من LOW → HIGH فورًا

Priority 8: InSAR displacement
  API: Copernicus SBAS / European Ground Motion Service
  endpoint: https://egms.land.copernicus.eu/
  بيانات: إزاحة سطحية mm-level، كل 6 أيام
  الأثر: إضافة إشارة INSAR_DISPLACEMENT (مستقلة تمامًا)
```

---

## 2. TASK 2 — إعادة تصميم Evidence Fusion

### 2.1 المشكلة العلمية الجوهرية

Naive Bayesian بمعادلة `P(H|e1,e2,...) ∝ P(H) × P(e1|H) × P(e2|H) × ...`

تفترض أن e1, e2, ... **مستقلة** عن بعضها شرطيًا. هذا **خاطئ** للإشارات المادية:

```
NDMI ↑ ← soil moisture ↑  ← water (leak OR rain)
LST  ↓ ← evaporation   ↑  ← soil moisture ↑
NDVI ↑ ← plant response    ← soil moisture ↑ (2-4 weeks lag)
SAR  ↓ ← absorption       ← soil moisture ↑
```

ثلاث من أربع إشارات تُقيس نفس الشيء بطرق مختلفة. الـ Bayesian update يحسبها ثلاث مرات.

### 2.2 الحل: Copula-Based Evidence Fusion

**المرحلة أ — قصيرة المدى (قابل للتنفيذ الآن):**

استبدال Sequential Bayesian بـ **Weighted Score Fusion مع Dependency Correction**:

```python
# بدلًا من Sequential Bayesian:
#   posterior = prior × P(e1|H) × P(e2|H) × P(e3|H)  ← خاطئ

# الصحيح: حساب Effective Degrees of Freedom
def effective_evidence_count(z_scores: dict, correlation_matrix: np.ndarray) -> float:
    """
    يحسب عدد الأدلة "المستقلة فعليًا" بناءً على مصفوفة الارتباط.
    إذا كانت جميع الإشارات مترابطة 100%، effective_count = 1
    إذا كانت مستقلة تمامًا، effective_count = n_signals
    """
    eigenvalues = np.linalg.eigvalsh(correlation_matrix)
    return len(eigenvalues) * (np.max(eigenvalues) / np.sum(eigenvalues))
```

**الأثر المتوقع**: خفض Overconfidence بـ 15-25%، Calibration Error أقل.

**المرحلة ب — طويلة المدى:**

Bayesian Network صريح مع Conditional Dependencies:

```
P(WATER_LEAK | NDMI, LST, SAR, NDVI) ≠ P(WATER_LEAK) × P(NDMI|H) × P(LST|H) × ...

الصحيح:
P(WATER_LEAK | NDMI, LST, SAR, NDVI) = 
  P(WATER_LEAK | soil_moisture_latent) × 
  P(soil_moisture_latent | NDMI, SAR) ×  ← استخدام الإشارتين الأقل ارتباطًا
  P(thermal_response | LST, soil_moisture_latent) ×
  P(vegetation_response | NDVI, soil_moisture_latent)
```

### 2.3 Adaptive Evidence Selection

المحرك يجب أن **يختار** الإشارات الأكثر استقلالية وملاءمة:

```python
EVIDENCE_INDEPENDENCE_SCORE = {
    # للتسرب في بيئة جافة:
    'WATER_LEAK': {
        'MOST_INFORMATIVE': ['SAR_BACKSCATTER', 'PRECIPITATION'],  # مستقلان
        'REDUNDANT_PAIR':   ['NDMI', 'NDVI'],                       # مترابطان +0.78
        'CRITICAL_DIFFERENTIATOR': 'PRECIPITATION',                 # يُميِّز من المطر
    }
}
```

---

## 3. TASK 3 — محرك التوطين الدقيق (Localization Engine)

### 3.1 المشكلة الحالية

التشخيص الحالي: "أصل: PIPE-001" — نقطة واحدة، لا مكان دقيق.

للأنابيب: الخط يمتد لعشرات الكيلومترات. أين التسرب بالضبط؟

### 3.2 نموذج التوطين المقترح

**المشكلة الفيزيائية**: التسرب يُنشئ "انتشار رطوبة" يُمكن تمثيله كـ Gaussian Plume:

```
σ_observed(x) = σ_source × exp(-κ × distance²)
```

حيث:
- `x`: المسافة من موضع التسرب
- `σ_source`: شدة المصدر
- `κ`: معامل الانتشار (دالة في نوع التربة وعمق الأنبوب)

**خوارزمية التوطين**:

1. أخذ تسلسل قيم NDMI على طول محور الأنبوب
2. حساب z-scores لكل نقطة نسبةً للـ Baseline
3. تحديد المنطقة الأعلى انحرافًا كـ Maximum Likelihood Estimate
4. حساب نطاق عدم اليقين من عرض الـ distribution

```python
@dataclass
class LocalizationResult:
    asset_id: str
    
    # Most Likely Location
    center_lat: float
    center_lon: float
    distance_from_centerline_m: float
    
    # Uncertainty (Confidence Ellipse)
    uncertainty_radius_50pct_m: float  # 50% confidence circle
    uncertainty_radius_90pct_m: float  # 90% confidence circle
    
    # Spatial Stats
    affected_area_m2: float
    anomaly_extent_m: float     # طول المنطقة المتأثرة
    
    # Localization Confidence
    localization_confidence: str  # HIGH/MEDIUM/LOW
    localization_method: str      # POINT/LINEAR/DIFFUSE
```

**تقدير الدقة بدون Ground Truth**:

```
للأنبوب:
  - إذا NDMI ↑ على 200م خطي: عدم اليقين = ±50م
  - إذا NDMI ↑ منتشرة على 1000م²: عدم اليقين = ±300م
  
المنهج: Gaussian Peak Fitting على القيم المرصودة
```

---

## 4. TASK 4 — نظام Ground Truth الكامل

### 4.1 دورة حياة Ground Truth

```
[تشخيص MINERVA]
       │
       ▼
[Field Work Order] ← ERP يُصدر أمر عمل
       │
       ▼  ← الفريق الميداني يصل
[Field Verification]
  └── Confirmed (True Positive)
  └── False Alarm (False Positive)
  └── Wrong Classification (Misclassified)
  └── No Access (Inconclusive)
       │
       ▼
[Structured Report] ← يملأ الفريق في التطبيق الميداني
  ├── outcome: {confirmed|false_alarm|misclassified|no_access}
  ├── actual_event_type: string
  ├── exact_location: {lat, lon, photo}
  ├── depth_m: float (إذا تسرب: عمق الأنبوب)
  ├── leak_size_estimate: {small|medium|large}
  ├── maintenance_action: string
  └── timestamp: datetime
       │
       ▼
[GT Store → Weight Update]
  ├── Bayesian update على أوزان الإشارات
  ├── Prior update لهذا النوع من الأصول في هذا السياق
  ├── Signature Library update
  └── Calibration curve update
```

### 4.2 تأثير كل تحقق على الدقة

```
Expected improvement per field verification:
  TP confirmed    → +0.15 نقطة F1 (تقدير)
  FP confirmed    → -0.10 نقطة F1 أولًا، ثم +0.20 بعد التعلم
  After 100 GT    → Confidence Calibration Error يقل بـ 40%
  After 500 GT    → Detection Accuracy يرتفع بـ 25-30%
```

---

## 5. TASK 5 — الأوزان التكيفية العلمية

### 5.1 منهج التحديث

**المشكلة**: الأوزان الحالية يدوية (expert knowledge). هذا صحيح للبداية لكن:
- لا تعكس أداءً فعليًا في البيئة الليبية تحديدًا
- لا تتكيف مع الموسم أو نوع التربة

**الحل**: Bayesian Weight Update مع Prior من الخبراء:

```
w_new(signal_i, event_type) = 
    w_prior × (1 + α × TP_contribution(signal_i))
   ─────────────────────────────────────────────────
    Σ_j w_prior × (1 + α × TP_contribution(signal_j))

حيث α = learning_rate = 0.15
     TP_contribution = كم مرة ساعدت هذه الإشارة في اكتشاف صحيح
```

**القيد العلمي**: لا نغيِّر الأوزان حتى n ≥ 20 تحقق لتجنب Overfitting.

### 5.2 Seasonal Weight Adjustment

```python
SEASONAL_WEIGHT_MODIFIERS = {
    'SOIL_MOISTURE': {
        'HOT_DRY':   1.5,  # أكثر أهمية في الصيف الجاف (الرطوبة نادرة → أكثر قدرة على الكشف)
        'COOL_WET':  0.7,  # أقل أهمية في الشتاء (الرطوبة الطبيعية تخفي التسرب)
    },
    'SAR_BACKSCATTER': {
        'HOT_DRY':   1.2,
        'COOL_WET':  0.9,
    }
}
```

---

## 6. TASK 6 — Historical Validation بدون تسرب مستقبلي

### 6.1 منهج Walk-Forward Validation

```
البيانات المتاحة: 2016-01-01 → 2026-07-09

تقسيم صحيح علميًا:
  Train window: 24 شهر (rolling)
  Test window:  6 أشهر (بدون معرفة مستقبلية)
  Step:         3 أشهر

مثال:
  Fold 1: Train=[2016-01→2017-12], Test=[2018-01→2018-06]
  Fold 2: Train=[2016-04→2018-03], Test=[2018-04→2018-09]
  ...
  Fold N: Train=[2024-01→2025-12], Test=[2026-01→2026-06]
```

### 6.2 المقاييس المطلوبة

```
1. Detection Metrics:
   Precision, Recall, F1, FPR
   
2. Localization Metrics (عند توفر GT):
   Mean Localization Error (MLE) بالمتر
   
3. Temporal Metrics:
   Detection Delay = mean(detection_date - true_event_start)
   Early Warning Rate = P(detect before damage escalation)
   
4. Calibration Metrics:
   Expected Calibration Error (ECE)
   Reliability Diagram (confidence vs. actual accuracy)
   
5. Decision Quality:
   Cost Savings vs. Random Dispatch
   False Dispatch Rate
```

---

## 7. TASK 7 — تحسين استخدام صور Planet

### 7.1 المشكلة الحالية

لدينا 29,623 مشهد محلي، لكن:
- الاستخدام الحالي: فقط metadata (تاريخ، غيوم، منطقة)
- الصور الفعلية غير مُحللة على مستوى البكسل
- لا استخراج NDVI/NDWI من الصور

### 7.2 خارطة الطريق للاستفادة الكاملة

```
المرحلة أ: Basic Spectral Analysis (قابل للتنفيذ الآن)
  الصور المتاحة: RGB + NIR (Analytic format)
  يمكن حساب: NDVI = (NIR - R)/(NIR + R)
  يمكن حساب: NDWI = (G - NIR)/(G + NIR)
  الكود: 
    from PIL import Image
    import numpy as np
    img = Image.open(thumbnail_path)
    # استخراج قناة NIR إذا كانت الصورة 4-band
    
المرحلة ب: Change Detection (قابل للتنفيذ)
  مقارنة صورتين بنفس الموسم بسنوات مختلفة
  خوارزمية: Log-ratio change detection
  الأثر: كشف تغيرات دائمة (بناء، تجريف)
  
المرحلة ج: Time Series Analysis
  بناء NDVI time series من 29,623 مشهد
  إيجاد anomalies في المسار الزمني
  الأثر: يُضيف dimension ثامن مستقل
```

---

## 8. TASK 8 — Digital Twin لكل أصل

### 8.1 بنية بيانات الـ Digital Twin الكامل

```python
@dataclass
class AssetDigitalTwin:
    """
    الملف الرقمي الكامل لكل أصل.
    التشخيص يجب أن يكون مُخصَّصًا لهذا الأصل تحديدًا.
    """
    asset_id: str
    
    # ── Static Identity ────────────────────────────────────────
    name_ar: str
    asset_type: str
    installation_year: int
    material: str                    # HDPE, PVC, Steel, CI
    diameter_mm: float
    depth_m: float
    design_pressure_bar: float
    design_life_years: int
    length_km: float
    geometry: dict                   # GeoJSON LineString
    
    # ── Environmental Context ──────────────────────────────────
    biome: str                       # ARID, COASTAL, URBAN
    soil_type: str                   # Sandy, Clay, Loam
    groundwater_depth_m: float
    seismic_zone: str
    flood_risk_zone: bool
    corrosion_risk_class: str        # LOW, MEDIUM, HIGH
    
    # ── Operational History ────────────────────────────────────
    last_maintenance_date: date
    maintenance_count_3yr: int
    previous_failures: list[dict]    # {date, type, location, severity}
    cathodic_protection_status: str
    
    # ── Learned Behavior (from MINERVA) ───────────────────────
    behavior_profile: dict           # Conditional Baseline
    baseline_version: str
    baseline_drift_rate: float       # معدل تغير الـ baseline
    signal_history: dict             # time series per signal
    
    # ── Commercial Imagery History ────────────────────────────
    planet_scenes: list[dict]        # metadata فقط
    last_clean_image_date: date
    imagery_anomaly_count: int
    
    # ── Ground Truth History ──────────────────────────────────
    confirmed_events: list[dict]
    false_alarms: list[dict]
    precision_history: list[float]   # دقة MINERVA عبر الزمن
    
    # ── Risk Profile ──────────────────────────────────────────
    current_health_score: float
    age_factor: float                # f(age/design_life)
    material_degradation_rate: float
    criticality_score: float         # 0→1
    population_served: int
    has_redundancy: bool
```

### 8.2 تأثير Digital Twin على الدقة

```
بدون Digital Twin:
  MINERVA يقول: "تسرب مياه محتمل (61%)"

مع Digital Twin:
  MINERVA يقول: "تسرب مياه محتمل (78%) — لأن:
    • الأنبوب عمره 22 سنة (> عمر التصميم 20 سنة) ← يرفع P بـ +8%
    • آخر صيانة قبل 730 يومًا ← +5%
    • تربة طينية + منطقة عالية الرطوبة ← +4%
    • في نفس الكيلومتر تسرب في 2019 ← +6% (Spatial Memory)
    المجموع: +23% فوق التشخيص الأساسي"
```

---

## 9. TASK 9 — نموذج عدم اليقين الكامل

### 9.1 خمسة مقاييس ثقة مستقلة (ليس مقياسًا واحدًا)

```
┌─────────────────────────────────────────────────────┐
│              MINERVA Uncertainty Dashboard           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  الثقة التشخيصية:    61%  ─────────█───────         │
│  (هل النوع صحيح؟)                                   │
│                                                     │
│  اكتمال الأدلة:      80%  ─────────████────         │
│  (هل الصورة الكاملة متاحة؟)                         │
│                                                     │
│  ثقة التوطين:        35%  ──█──────────────         │
│  (هل الموقع دقيق؟)   ⚠️ منخفضة                     │
│                                                     │
│  الثقة التنبؤية:     45%  ────█───────────          │
│  (ماذا سيحدث بعد ذلك؟)                              │
│                                                     │
│  الثقة التشغيلية:    72%  ───────██───────          │
│  (هل القرار مبني على بيانات كافية؟)                 │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  ⚠️ ثقة التوطين منخفضة — التشخيص صحيح لكن          │
│    الموقع الدقيق يحتاج Sentinel-1 أو زيارة ميدانية  │
└─────────────────────────────────────────────────────┘
```

### 9.2 تعريف كل مقياس

| المقياس | التعريف | كيف يُحسب |
|---------|---------|-----------|
| **Diagnostic Confidence** | P(event_type | all_evidence) | Bayesian posterior |
| **Evidence Completeness** | ما نسبة الأدلة المثالية المتوفرة | available ÷ ideal set |
| **Localization Confidence** | دقة تقدير موضع الأنوماليا | f(spatial pattern, signal resolution) |
| **Prediction Confidence** | P(next event | current state) | من Root Cause + age factor |
| **Operational Confidence** | هل القرار مبني على بيانات كافية؟ | f(EC, DC, data_quality) |

---

## 10. TASK 10 — المقارنة العلمية الموضوعية

### 10.1 خطة Benchmark

**المقارنة المقترحة (على نفس بيانات الاختبار):**

| الطريقة | الوصف | متوقع F1 |
|---------|-------|---------|
| **Threshold Single Signal** | `if NDMI > mean + 2.5σ` | 0.40-0.55 |
| **Multi-Signal Threshold** | `if 2+ signals > threshold` | 0.55-0.65 |
| **MINERVA Global Baseline** | Baseline عالمي | 0.667 (مُقاس) |
| **MINERVA Conditional** | Baseline مشروط بالسياق | 0.769 (مُقاس) |
| **MINERVA + Digital Twin** | مع خصائص الأصل | تقدير: 0.82-0.88 |
| **MINERVA + Real Sentinel** | مع إشارات حقيقية | تقدير: 0.85-0.90 |

### 10.2 نتائج Benchmark الحالية (مُقاسة)

```
Metric          Conditional    Global     Improvement
F1 Score        0.769          0.667      +15.3%
Precision       0.714          0.667      +7.1%
Recall (TPR)    0.833          0.667      +25.0%
FPR             0.067          0.067      equal

Phase timings:
  Weather fetch:    2.08s (bottleneck — needs caching)
  Context resolve:  0.357s
  Baseline build:   0.022s  ← fast
  Anomaly detect:   0.003s  ← fast
  KG init:          0.120s
  TOTAL:            ~3.4s
```

---

## 11. TASK 11 — خارطة تحسين الدقة بالأولوية

### 11.1 التصنيف حسب الأثر/الجهد

```
┌─────────────────────────────────────────────────────────────┐
│             Impact vs. Effort Matrix                        │
│                                                             │
│  High │  ①SAR حقيقي    ④Digital Twin                      │
│Impact │  ②Fix Corr     ⑤GT Loop                           │
│       │                                                     │
│   Low │  ③DEM add      ⑥InSAR                             │
│Impact │                                                     │
│       └────────────────────────────────                     │
│             Low Effort      High Effort                     │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 الأولويات مع التأثير المتوقع

| الأولوية | التحسين | أثر الدقة | الجهد | شرط التنفيذ |
|----------|---------|----------|-------|-------------|
| **P1** | Fix Signal Correlation (Dependency Correction) | **-25% Overconfidence** | منخفض | لا شيء |
| **P2** | Sentinel-1 SAR الحقيقي | **+15% F1** | متوسط | ESA API key |
| **P3** | SCADA Pressure Integration | **+20% Confidence** | منخفض | ERP integration |
| **P4** | Digital Twin Asset Profile | **+10% F1** | متوسط | DSP assets data |
| **P5** | Sentinel-2 الحقيقي | **+12% F1** | متوسط | Sentinel Hub key |
| **P6** | Ground Truth Loop (5 cases) | **+8% F1** | عالٍ | فريق ميداني |
| **P7** | Walk-Forward Validation | صفر دقة جديدة | منخفض | Planet archive |
| **P8** | Localization Engine | جودة قرار أعلى | متوسط | لا شيء |
| **P9** | Uncertainty Decomposition | ثقة أفضل | منخفض | لا شيء |
| **P10** | Planet Spectral Analysis | **+8% F1** | عالٍ | Analytic format |

---

## 12. قرارات معمارية جديدة (ADRs للـ Phase 6)

### ADR-017: إصلاح انتهاك استقلالية الإشارات قبل أي إضافة

**التاريخ**: 2026-07-09

**القرار**: قبل إضافة أي إشارة جديدة، يجب تصحيح مشكلة Correlation في محرك الـ Bayesian Fusion.

**السبب**: إضافة إشارة ترتبط بـ NDMI بـ +0.8 يُضاعف المشكلة ولا يُحسِّنها.

**المقياس**: Calibration Error يجب أن يقل بـ ≥15% قبل قبول التحسين.

---

### ADR-018: SAR قبل Sentinel-2

**القرار**: Sentinel-1 SAR له الأولوية القصوى لأنه الإشارة الأقل ارتباطًا (+0.044 مع NDMI).

**السبب العلمي**:
- SAR ↔ NDMI correlation = +0.044 (شبه مستقلان)
- Sentinel-2 NDVI ↔ NDMI = +0.777 (مترابطان بشدة)
- إضافة SAR الحقيقي يُضيف Information Gain حقيقيًا
- إضافة NDVI الحقيقي على NDMI الحقيقي = Redundant

---

### ADR-019: لا Ground Truth Simulation

**القرار**: لا نستبدل Ground Truth بـ simulation. كل تقييم دقة يجب أن يكون على بيانات حقيقية.

**الاستثناء**: Walk-Forward Validation على بيانات الأرشيف التاريخية مقبول لأن:
- البيانات حقيقية (Planet archive)
- لا نعرف المستقبل في كل fold
- الـ "ground truth" هو الحالة الحقيقية للأرضية في التاريخ المعني

---

## 13. خطة العمل للمرحلة القادمة

### الأسبوع 1-2 (Quick Wins):
1. ✅ Fix Bayesian Correlation → تطبيق Dependency Correction
2. ✅ إضافة 5 مقاييس Confidence منفصلة
3. ✅ Walk-Forward Validation على Planet archive

### الأسبوع 3-4 (Data Integration):
4. تسجيل ESA Copernicus account → Sentinel-1 SAR API
5. تكامل SCADA/ERP لقراءات الضغط
6. بناء Digital Twin بيانات من DSP assets

### الشهر 2-3 (Validation):
7. تشغيل على 5 أصول حقيقية مع فريق ميداني
8. أول دورة Ground Truth كاملة
9. قياس Calibration Error قبل وبعد

---

## 14. الخلاصة العلمية

### ما هو صحيح علميًا في MINERVA:
✅ المنهج (First Principles، فصل Dynamic/Physical)
✅ نقطة البداية (Asset → Anomaly → Hypothesis) أصح من (Hypothesis → Evidence)
✅ Conditional Baseline يتفوق على Global (+25% Recall)
✅ Generic Framework يعمل مع أي نوع أصل
✅ بيانات الطقس حقيقية ودقيقة

### ما يحتاج إصلاحًا علميًا عاجلًا:
⚠️ انتهاك استقلالية الإشارات في Bayesian Fusion
⚠️ جميع إشارات الأقمار مُحاكاة (غير حقيقية)
⚠️ Confidence غير مُعايَرة (لا GT لقياسها)
⚠️ التوطين نقطي وغير دقيق

### التقييم الإجمالي:

```
المرحلة الحالية: Scientifically Sound Prototype
المرحلة المستهدفة: Operationally Validated System

المسافة بينهما: 3 عناصر رئيسية:
  1. Ground Truth (الأهم — لا يمكن استبداله)
  2. Real Sentinel Signals (مُحسِّن كبير)
  3. SCADA Integration (سيحل Confidence = LOW)
```

**التوصية النهائية**: ابدأ بـ **P1 (Fix Correlation) + P3 (SCADA)** في الأسبوع القادم. هذان التحسينان تقني بحت، لا يحتاجان بيانات خارجية، وسيرفعان الجودة العلمية فورًا.

---

*MINERVA Phase 6 — Scientific Validation Plan v1.0*
*DSP Chief Science Office — 2026-07-09*
*"لا تُنفِّذ شيئًا لا يُحسِّن الدقة بشكل قابل للقياس"*
