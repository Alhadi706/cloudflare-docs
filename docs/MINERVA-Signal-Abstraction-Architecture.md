# MINERVA — Signal Abstraction Architecture
## Physical Observation as the Universal Language of Spatial Intelligence

**التاريخ**: 2026-07-09  
**الإصدار**: 2.0 — Signal-First Architecture  
**يُكمل**: PIC-Architecture-Review-2026-07-09.md  
**الحالة**: وثيقة تصميم معتمدة

---

## الحكم الافتتاحي

> **الأقمار الاصطناعية مؤقتة. الإشارات دائمة. المنطق خالد.**

المراجعة المعمارية السابقة صحّحت خطأً تقنياً (مقارنة bytes بدلاً من pixels).  
لكن خطأً معمارياً أعمق لا يزال قائماً:

**طبقة الميزات لا تزال تفهم الصور. يجب أن تفهم المعنى الفيزيائي فقط.**

---

## 1. تشخيص المشكلة الجوهرية

### 1.1 الاقتران الضمني بالصورة الحالية

في المعمارية المقترحة سابقاً:

```typescript
interface FeatureSet {
  mean_luminance:      number;   // ← متوسط سطوع قناة RGB
  edge_density:        number;   // ← حواف من Sobel على pixels
  bare_soil_fraction:  number;   // ← نسبة pixels ذات لون تربة
  vegetation_fraction: number;   // ← نسبة pixels خضراء
}
```

هذه ليست ميزات. هي **وصف لصورة RGB بكلمات مختلفة**.

إذا جاء غداً:
- صورة SAR: لا RGB، لا ألوان، لا `bare_soil_fraction` بصري
- بيانات LiDAR: نقاط ثلاثية الأبعاد، لا pixels
- حساس حرارة: درجات حرارة، لا ألوان
- SAR Interferometry: فروق طور، لا images

**طبقة الميزات ستنهار. وستحتاج لإعادة كتابة كاملة.**

---

### 1.2 الاختبار الفاضح

```
السؤال: هل يمكن لـ FeatureExtractor الحالي أن يعمل على:
  ☑ صورة Planet RGB               → نعم (مصمم لها)
  ☐ صورة Sentinel-2 (13 قناة)    → جزئياً (يفقد معظم القيمة)
  ☐ صورة SAR Sentinel-1            → لا (لا RGB)
  ☐ نقاط LiDAR                    → لا (لا pixels)
  ☐ قياسات حساس IoT               → لا (لا geometry)
  ☐ DEM تضاريس                    → لا (لا ألوان)
  ☐ صورة حرارية FLIR               → لا (ألوان تمثل حرارة لا مادة)
```

**النتيجة: النظام مربوط بـ Planet RGB. هذا يُلغي الاستقلالية.**

---

## 2. المبدأ التأسيسي

### 2.1 الإشارة كلغة عالمية

كل جهاز استشعار يقيس ظاهرة فيزيائية.  
الظواهر الفيزيائية لا تتغير.  
الأجهزة تتغير.

```
الظاهرة الفيزيائية: "رطوبة سطح الأرض"

Planet RGB:       تقدير غير مباشر من لون القناة الحمراء
Sentinel-2:       NDMI = (Band8A - Band11) / (Band8A + Band11)
Sentinel-1 SAR:   σ° VV backscatter، حساس للرطوبة الحرارية
Microwave L-band: قياس مباشر للرطوبة (SMAP, ALOS-2)
Ground Sensor:    قياس مباشر بـ Decagon EC-5

محرك الاستدلال يرى فقط:
SurfaceMoistureSignal { value: 0.45, confidence: 0.82, unit: 'fraction' }

لا يعرف من أين جاءت.
```

---

### 2.2 تعريف الإشارة

> **الإشارة** هي تمثيل رقمي لملاحظة فيزيائية قابلة للقياس، مُعيَّرة ومُوحَّدة، مستقلة عن آلية الاستشعار.

الإشارة ليست:
- ❌ قناة من صورة (لا Band4، لا Red Channel)
- ❌ مؤشر مشتق (لا NDVI — بل الظاهرة التي يقيسها NDVI)
- ❌ نتيجة خوارزمية (لا Sobel edges)

الإشارة هي:
- ✅ نشاط نباتي (ما الذي يقيسه NDVI)
- ✅ رطوبة السطح (ما الذي يقيسه SAR VV)
- ✅ ارتفاع السطح (ما الذي يقيسه LiDAR)

---

## 3. المعمارية الجديدة الكاملة

```
╔══════════════════════════════════════════════════════════════════════╗
║                        DATA SOURCE TIER                             ║
║                                                                      ║
║  [Planet]  [Sentinel-2]  [SAR]  [LiDAR]  [Drone]  [IoT]  [Future] ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │ Raw Data (provider-specific format)
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                     PROVIDER ADAPTER TIER                           ║
║                                                                      ║
║  PlanetAdapter │ Sentinel2Adapter │ SARAdapter │ LiDARAdapter │ ... ║
║                                                                      ║
║  Purpose: Transform raw provider data into canonical signal objects  ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │ RawSignalPacket (provider-aware)
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                  SIGNAL ABSTRACTION LAYER (SAL)                     ║
║                                                                      ║
║  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   ║
║  │ SignalNormalizer │  │ SignalRegistry    │  │ SignalHarmonizer │   ║
║  └────────┬────────┘  └──────────────────┘  └────────┬─────────┘   ║
║           │                                           │             ║
║  ┌────────▼──────────────────────────────────────────▼─────────┐   ║
║  │                   SignalQualityAssessor                      │   ║
║  └──────────────────────────────┬───────────────────────────────┘   ║
║                                 │                                   ║
║  ┌──────────────────────────────▼───────────────────────────────┐   ║
║  │                   NormalizedSignal Objects                    │   ║
║  │   SurfaceReflectanceSignal, VegetationActivitySignal,        │   ║
║  │   SurfaceMoistureSignal, SurfaceTemperatureSignal,           │   ║
║  │   SurfaceRoughnessSignal, SurfaceHeightSignal,               │   ║
║  │   GroundMotionSignal, BackscatterSignal, ObjectDensitySignal ║   ║
║  └──────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │ NormalizedSignal[]  ← THE INTERFACE
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                       FEATURE TIER                                   ║
║                                                                      ║
║  Receives ONLY NormalizedSignal objects                              ║
║  Never knows provider. Never touches raw data.                       ║
║                                                                      ║
║  ConstructionDisturbanceFeature(signals)                             ║
║  VegetationRecoveryFeature(signals)                                  ║
║  StructuralAppearanceFeature(signals)                                ║
║  GroundMotionFeature(signals)      ← works only if signal available ║
║  ThermalPersistenceFeature(signals)← works only if signal available ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │ FeatureBundle
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                       EVIDENCE TIER                                  ║
║  References signals by physical type. Never by band or sensor.      ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │ EvidenceBundle
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                       REASONING TIER                                 ║
║  ProgressModel, HealthEngine, InterruptionClassifier                ║
║  PhaseClassifier, AlertEngine                                        ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │ ConstructionIntelligence
                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║                     PERSISTENCE TIER                                 ║
║  pic.signals, pic.features, pic.evidence, pic.scans                 ║
╚══════════════════════════════════════════════════════════════════════╝
```

**القاعدة المطلقة**: الخط الأفقي بعد Signal Abstraction Layer هو الفاصل.  
لا شيء فوق هذا الخط يعرف من أين جاءت البيانات.  
لا شيء أسفل هذا الخط يعرف ما الذي أنتج الإشارة.

---

## 4. نموذج الإشارة العام (Generic Signal Model)

### 4.1 التعريف الكامل

```typescript
// ─────────────────────────────────────────────────────────────────
//  Physical Signal Types — لا تتغير بتغير الأقمار
// ─────────────────────────────────────────────────────────────────

export type SignalType =
  // Surface Physical Properties
  | 'SURFACE_REFLECTANCE'         // انعكاسية السطح (0-1)
  | 'SURFACE_MOISTURE'            // رطوبة السطح (0-1 fraction)
  | 'SURFACE_TEMPERATURE'         // درجة حرارة السطح (Kelvin)
  | 'SURFACE_ROUGHNESS'           // خشونة السطح (dimensionless)
  | 'SURFACE_HEIGHT'              // ارتفاع السطح (meters above datum)
  | 'SURFACE_DISPLACEMENT'        // إزاحة السطح (mm, InSAR)
  | 'SURFACE_MOTION_VELOCITY'     // سرعة حركة السطح (mm/year)

  // Vegetation
  | 'VEGETATION_ACTIVITY'         // النشاط النباتي (0-1, NDVI-equivalent)
  | 'VEGETATION_WATER_CONTENT'    // محتوى الماء في النباتات (NDMI-equivalent)
  | 'CANOPY_HEIGHT'               // ارتفاع الغطاء النباتي (meters)

  // Backscatter / Radar
  | 'BACKSCATTER_VV'              // استرداد SAR رأسي-رأسي (dB)
  | 'BACKSCATTER_VH'              // استرداد SAR رأسي-أفقي (dB)
  | 'COHERENCE'                   // تماسك الطور InSAR (0-1)

  // Structural
  | 'LINEAR_STRUCTURE_DENSITY'    // كثافة الهياكل الخطية (0-1)
  | 'OBJECT_DENSITY'              // كثافة الأجسام المميزة (objects/km²)
  | 'CONSTRUCTION_FOOTPRINT'      // مساحة الأثر الإنشائي (m²)
  | 'BUILT_SURFACE_FRACTION'      // نسبة الأسطح المبنية (0-1)

  // Thermal
  | 'THERMAL_EMISSION'            // انبعاث حراري (W/m²/sr)
  | 'LAND_SURFACE_TEMPERATURE'    // درجة حرارة سطح الأرض (Celsius)

  // Environmental Context (not remote sensing, but signal)
  | 'AIR_TEMPERATURE'             // درجة حرارة الهواء
  | 'PRECIPITATION'               // هطول الأمطار (mm)
  | 'WIND_SPEED'                  // سرعة الرياح (m/s)
  | 'SOLAR_IRRADIANCE'            // إشعاع شمسي

  // Derived / Composite
  | 'CONSTRUCTION_ACTIVITY_INDEX' // مؤشر مركّب للنشاط الإنشائي
  | 'DISTURBANCE_INDEX'           // مؤشر الاضطراب

  // Extensible — future signal types added here without breaking existing code
  | string;

// ─────────────────────────────────────────────────────────────────
//  Data Source (provider-aware — lives only in adapter tier)
// ─────────────────────────────────────────────────────────────────

export type SignalProvider =
  | 'planet_scope'
  | 'planet_skysat'
  | 'sentinel_2'
  | 'sentinel_1_sar'
  | 'landsat_8'
  | 'landsat_9'
  | 'alos_2'
  | 'lidar_drone'
  | 'lidar_airborne'
  | 'thermal_drone'
  | 'ground_sensor_iot'
  | 'synthetic_aperture_radar'
  | 'dem_copernicus'
  | 'dem_srtm'
  | 'weather_api'
  | 'ground_truth_survey'
  | 'future_unknown'
  | string;

// ─────────────────────────────────────────────────────────────────
//  The Universal Signal Object
//  كل ملاحظة في النظام تصبح هذا الكائن
// ─────────────────────────────────────────────────────────────────

export interface NormalizedSignal {
  // Identity
  signal_id:        string;        // UUID فريد لهذه الملاحظة
  signal_type:      SignalType;    // ما الذي تقيسه فيزيائياً
  physical_meaning: string;        // وصف نصي: "نشاط نباتي مقدَّر"

  // Spatiotemporal
  observation_time:   string;      // ISO timestamp
  validity_start:     string;      // بداية فترة الصلاحية
  validity_end:       string;      // نهاية فترة الصلاحية
  spatial_resolution: number;      // meters per pixel/point
  coverage_bbox:      [number, number, number, number];  // [minLon, minLat, maxLon, maxLat]
  coverage_fraction:  number;      // 0-1: ما نسبة منطقة الاهتمام المغطاة

  // Value
  value:            number;        // القيمة الرئيسية المُطبَّعة
  value_unit:       string;        // 'fraction' | 'kelvin' | 'meters' | 'dB' | ...
  value_range:      [number, number];  // [min, max] المتوقع لهذا النوع من الإشارات
  value_raw?:       number;        // القيمة الخام قبل التطبيع (للتتبع)

  // Quality
  quality_score:    number;        // 0-1: جودة هذه الملاحظة
  confidence:       number;        // 0-1: ثقة في دقة القياس
  uncertainty:      number;        // ±: هامش الخطأ بوحدة value_unit
  is_valid:         boolean;       // هل يجب استخدام هذه الإشارة
  rejection_reason: string | null; // سبب الرفض إن وجد

  // Provenance (مخفي عن طبقات الاستدلال)
  provenance: SignalProvenance;

  // Applicability
  applicable_to:  string[];  // ['road', 'building', 'all'] — أنواع المشاريع التي تنطبق عليها
  signal_version: string;    // إصدار معيار التطبيع
}

// ─────────────────────────────────────────────────────────────────
//  Signal Provenance — للتتبع العلمي الكامل
// ─────────────────────────────────────────────────────────────────

export interface SignalProvenance {
  // Source
  provider:          SignalProvider;
  dataset_name:      string;     // 'PSScene' | 'S2MSI2A' | 'GRDH' | ...
  scene_id:          string;     // المعرف الأصلي لدى المزود
  product_type:      string;     // نوع المنتج الأصلي
  satellite_id?:     string;     // رقم القمر الاصطناعي
  sensor_type?:      string;     // 'MSI' | 'SAR' | 'OLI' | 'LIDAR' | ...

  // Geometry (original, before any resampling)
  original_resolution: number;   // meters
  original_crs:        string;   // 'EPSG:4326' | 'EPSG:32633' | ...
  acquisition_geometry: any;     // GeoJSON of original scene footprint

  // Processing Chain
  processing_steps: ProcessingStep[];
  calibration_method: string;    // 'L1C' | 'L2A' | 'TOAR' | 'BOA' | ...
  normalization_algorithm: string;
  adapter_version:    string;    // إصدار الـ adapter المستخدم

  // Traceability
  ingested_at:     string;       // متى أُدخل للنظام
  raw_file_path?:  string;       // مسار الملف الأصلي (إن وجد محلياً)
  checksum?:       string;       // SHA-256 للتحقق من التكامل
}

interface ProcessingStep {
  step_name:   string;   // 'cloud_mask' | 'resampling' | 'normalization' | ...
  algorithm:   string;
  parameters:  Record<string, any>;
  applied_at:  string;
  operator:    string;   // 'system' | 'user:xxx'
}
```

---

## 5. Signal Abstraction Layer (SAL) — المكونات

### 5.1 Provider Adapter Framework

```typescript
// ─────────────────────────────────────────────────────────────────
//  الواجهة التي يجب على كل مزود تطبيقها
// ─────────────────────────────────────────────────────────────────

export interface IProviderAdapter {
  provider_id:   SignalProvider;
  display_name:  string;
  version:       string;

  /**
   * الوظيفة الوحيدة التي يجب تطبيقها:
   * تحويل بيانات المزود الخام إلى حزمة إشارات مُطبَّعة
   */
  adapt(
    rawInput:    ProviderRawInput,
    projectBbox: [number, number, number, number],
    config?:     AdapterConfig,
  ): Promise<NormalizedSignal[]>;

  /**
   * أنواع الإشارات التي يستطيع هذا المزود إنتاجها
   */
  getSupportedSignalTypes(): SignalType[];

  /**
   * التحقق من صلاحية البيانات الخام قبل المعالجة
   */
  validateRawInput(rawInput: ProviderRawInput): ValidationResult;
}

interface ProviderRawInput {
  file_path?:    string;        // ملف محلي
  file_buffer?:  Buffer;        // بيانات في الذاكرة
  metadata:      Record<string, any>;  // metadata المزود الأصلي
  scene_id:      string;
  acquisition_time: string;
}
```

---

### 5.2 PlanetAdapter — النموذج التطبيقي

```typescript
/**
 * PlanetAdapter — يُحول صور Planet RGB/RGBA
 * إلى إشارات مُطبَّعة بمعنى فيزيائي
 *
 * المخرجات:
 *  SURFACE_REFLECTANCE       ← من luminance متوسط
 *  VEGETATION_ACTIVITY       ← من green/red ratio (proxy NDVI)
 *  BUILT_SURFACE_FRACTION    ← من edge_density + texture
 *  SURFACE_ROUGHNESS         ← من entropy + contrast
 *  CONSTRUCTION_FOOTPRINT    ← من bright patch detection
 */
export class PlanetAdapter implements IProviderAdapter {
  provider_id  = 'planet_scope' as const;
  display_name = 'Planet PlanetScope (RGB/RGBA)';
  version      = '1.0.0';

  getSupportedSignalTypes(): SignalType[] {
    return [
      'SURFACE_REFLECTANCE',
      'VEGETATION_ACTIVITY',      // rough proxy — limited without NIR
      'BUILT_SURFACE_FRACTION',
      'SURFACE_ROUGHNESS',
      'CONSTRUCTION_FOOTPRINT',
      'LINEAR_STRUCTURE_DENSITY',
    ];
  }

  async adapt(
    rawInput:    ProviderRawInput,
    projectBbox: [number, number, number, number],
    config?:     AdapterConfig,
  ): Promise<NormalizedSignal[]> {

    // 1. Decode pixels (using sharp)
    const decoded = await this.decodeRGB(rawInput.file_path!);
    const quality  = this.assessQuality(decoded, rawInput.metadata);

    if (!quality.is_usable) {
      // إرجاع إشارات فارغة مع تحديد السبب
      return this.generateRejectedSignals(rawInput, quality);
    }

    const now = rawInput.acquisition_time;
    const prov = this.buildProvenance(rawInput);

    // 2. Compute feature arrays from real pixels
    const reflectance  = this.computeMeanLuminance(decoded);     // 0-1
    const vegProxy     = this.computeVegetationProxy(decoded);   // (G-R)/(G+R) rough NDVI
    const roughness    = this.computeTextureRoughness(decoded);  // entropy-based
    const builtFrac    = this.computeBuiltFraction(decoded);     // edge-based
    const linDensity   = this.computeLinearDensity(decoded);     // Hough-based

    return [
      {
        signal_id:        crypto.randomUUID(),
        signal_type:      'SURFACE_REFLECTANCE',
        physical_meaning: 'متوسط انعكاسية السطح — يعكس طبيعة المواد السطحية',
        observation_time: now,
        validity_start:   now,
        validity_end:     addDays(now, 5),
        spatial_resolution: rawInput.metadata.pixel_resolution_m ?? 3,
        coverage_bbox:    projectBbox,
        coverage_fraction: quality.coverage_fraction,
        value:            reflectance.mean,
        value_unit:       'fraction',
        value_range:      [0, 1],
        value_raw:        reflectance.mean_raw,
        quality_score:    quality.quality_score,
        confidence:       quality.quality_score * 0.9,
        uncertainty:      0.05 + (1 - quality.quality_score) * 0.2,
        is_valid:         true,
        rejection_reason: null,
        provenance:       prov,
        applicable_to:    ['all'],
        signal_version:   '1.0',
      },
      {
        signal_id:        crypto.randomUUID(),
        signal_type:      'VEGETATION_ACTIVITY',
        physical_meaning: 'مستوى النشاط النباتي — تقدير تقريبي من قناتي الأحمر والأخضر فقط',
        observation_time: now,
        validity_start:   now,
        validity_end:     addDays(now, 5),
        spatial_resolution: rawInput.metadata.pixel_resolution_m ?? 3,
        coverage_bbox:    projectBbox,
        coverage_fraction: quality.coverage_fraction,
        value:            vegProxy,
        value_unit:       'fraction',
        value_range:      [-1, 1],
        quality_score:    quality.quality_score * 0.6,  // ← تخفيض مقصود
        confidence:       0.45,   // ← Planet RGB بدون NIR: ثقة محدودة في NDVI
        uncertainty:      0.25,   // ← هامش خطأ كبير للـ proxy
        is_valid:         true,
        rejection_reason: null,
        // ملاحظة: النظام يُنتج هذه الإشارة لكن يُعلن عن محدوديتها
        provenance:       { ...prov, processing_steps: [...prov.processing_steps,
          { step_name: 'vegetation_proxy', algorithm: 'visible_green_red_ratio',
            parameters: { note: 'Rough proxy without NIR band — uncertainty high' },
            applied_at: new Date().toISOString(), operator: 'system' }
        ]},
        applicable_to:    ['all'],
        signal_version:   '1.0',
      },
      // SURFACE_ROUGHNESS, BUILT_SURFACE_FRACTION, LINEAR_STRUCTURE_DENSITY ...
    ];
  }
}
```

---

### 5.3 Sentinel2Adapter — نفس الواجهة، بيانات أفضل

```typescript
/**
 * Sentinel2Adapter — يُحول صور Sentinel-2 (13 قناة)
 *
 * المخرجات (أعلى جودة من Planet لأن النطاقات الطيفية متاحة):
 *  SURFACE_REFLECTANCE   ← Band 2,3,4 (Blue, Green, Red)
 *  VEGETATION_ACTIVITY   ← NDVI حقيقي: (B8-B4)/(B8+B4)   confidence: 0.92
 *  VEGETATION_WATER_CONTENT ← NDMI: (B8A-B11)/(B8A+B11)  confidence: 0.88
 *  SURFACE_MOISTURE      ← B11 (SWIR) proxy               confidence: 0.75
 *  BUILT_SURFACE_FRACTION ← NDBI: (B11-B8)/(B11+B8)      confidence: 0.82
 *  SURFACE_ROUGHNESS     ← texture من B8 (NIR, 10m)
 */
export class Sentinel2Adapter implements IProviderAdapter {
  provider_id  = 'sentinel_2' as const;
  display_name = 'ESA Sentinel-2 MSI';
  version      = '1.0.0';

  getSupportedSignalTypes(): SignalType[] {
    return [
      'SURFACE_REFLECTANCE',
      'VEGETATION_ACTIVITY',       // NDVI حقيقي ← confidence عالٍ
      'VEGETATION_WATER_CONTENT',  // NDMI ← لا يتوفر من Planet
      'SURFACE_MOISTURE',          // SWIR-based ← لا يتوفر من Planet
      'BUILT_SURFACE_FRACTION',    // NDBI
      'SURFACE_ROUGHNESS',
      'LINEAR_STRUCTURE_DENSITY',
    ];
  }

  async adapt(rawInput: ProviderRawInput, projectBbox: BBox): Promise<NormalizedSignal[]> {
    // نفس الواجهة — مخرجات أفضل بثقة أعلى
    const bands = await this.decodeBands(rawInput);
    const ndvi  = (bands.B8 - bands.B4) / (bands.B8 + bands.B4);    // حقيقي
    const ndmi  = (bands.B8A - bands.B11) / (bands.B8A + bands.B11); // حقيقي
    const ndbi  = (bands.B11 - bands.B8) / (bands.B11 + bands.B8);  // حقيقي

    return [
      {
        signal_type:   'VEGETATION_ACTIVITY',
        value:         ndvi,
        confidence:    0.92,   // ← أعلى بكثير من Planet (0.45)
        uncertainty:   0.04,   // ← أدق بكثير
        // ... باقي الحقول
      },
      {
        signal_type:   'SURFACE_MOISTURE',
        value:         this.normalizeSWIR(ndmi),
        confidence:    0.78,
        uncertainty:   0.08,
        // ← هذه الإشارة غير موجودة في Planet adapter إطلاقاً
      },
    ];
  }
}
```

---

### 5.4 SARAdapter — مزود مختلف كلياً، نفس الواجهة

```typescript
/**
 * SARAdapter — يُحول بيانات SAR (Sentinel-1, ALOS-2)
 * لا RGB. لا ألوان. لا "luminance". فيزياء راديوية مختلفة تماماً.
 *
 * لكن المخرجات: نفس نوع NormalizedSignal
 */
export class SARAdapter implements IProviderAdapter {
  provider_id  = 'sentinel_1_sar' as const;
  display_name = 'ESA Sentinel-1 SAR (C-Band GRD)';
  version      = '1.0.0';

  getSupportedSignalTypes(): SignalType[] {
    return [
      'BACKSCATTER_VV',             // σ° VV
      'BACKSCATTER_VH',             // σ° VH
      'SURFACE_MOISTURE',           // من σ° VV (علاقة غير خطية)
      'SURFACE_ROUGHNESS',          // من σ° cross-pol
      'BUILT_SURFACE_FRACTION',     // الهياكل المبنية تعيد الموجات بشكل مميز
      'SURFACE_DISPLACEMENT',       // من InSAR إذا توفر pair
    ];
  }

  async adapt(rawInput: ProviderRawInput, projectBbox: BBox): Promise<NormalizedSignal[]> {
    // لا يُستدعى sharp هنا. معالجة SAR مختلفة كلياً.
    const backscatter = await this.processGRD(rawInput);

    return [
      {
        signal_type:      'SURFACE_MOISTURE',
        physical_meaning: 'رطوبة السطح المقدَّرة من استرداد SAR VV (C-band)',
        value:            this.backscatterToMoisture(backscatter.vv_mean),
        confidence:       0.68,  // SAR moisture retrieval has known uncertainties
        uncertainty:      0.12,
        // ← نفس SignalType 'SURFACE_MOISTURE' كما في Sentinel-2
        // محرك الاستدلال لا يهتم من أين جاءت
      },
      {
        signal_type:   'BUILT_SURFACE_FRACTION',
        value:         this.detectBuiltSurfaces(backscatter),
        confidence:    0.85,   // SAR أفضل من RGB في كشف البنية التحتية
        uncertainty:   0.08,
      },
    ];
  }
}
```

---

### 5.5 Signal Registry

```typescript
/**
 * السجل المركزي للإشارات المعرَّفة
 * يُعرّف: ما هي الإشارات الموجودة، وما مصادرها الممكنة
 */

export interface SignalDefinition {
  signal_type:       SignalType;
  display_name_ar:   string;
  physical_unit:     string;
  expected_range:    [number, number];
  description_ar:    string;

  // من أي مزودين يمكن إنتاج هذه الإشارة
  available_from: {
    provider:    SignalProvider;
    algorithm:   string;
    typical_confidence: number;
    typical_uncertainty: number;
    limitation_ar?: string;
  }[];

  // في أي سياقات تُستخدم هذه الإشارة
  used_in_features:  string[];  // أسماء الـ Feature classes التي تستهلكها
  applicable_phases: ConstructionPhase[];
}

export const SIGNAL_REGISTRY: Record<SignalType, SignalDefinition> = {

  'VEGETATION_ACTIVITY': {
    signal_type:     'VEGETATION_ACTIVITY',
    display_name_ar: 'النشاط النباتي',
    physical_unit:   'fraction [-1 to 1]',
    expected_range:  [-1, 1],
    description_ar:  'يعكس كثافة وصحة الغطاء النباتي. ارتفاعه = غطاء نباتي. انخفاضه المفاجئ = إزالة.',
    available_from: [
      {
        provider:            'planet_scope',
        algorithm:           'visible_green_red_ratio',
        typical_confidence:  0.45,
        typical_uncertainty: 0.25,
        limitation_ar:       'بدون NIR band — تقدير تقريبي فقط، تأثر بالإضاءة',
      },
      {
        provider:            'sentinel_2',
        algorithm:           'NDVI_B8_B4',
        typical_confidence:  0.92,
        typical_uncertainty: 0.04,
        limitation_ar:       'تأثر بالموسمية والسحاب',
      },
      {
        provider:            'landsat_8',
        algorithm:           'NDVI_B5_B4',
        typical_confidence:  0.88,
        typical_uncertainty: 0.06,
        limitation_ar:       'دقة مكانية 30m — قد تفوت تفاصيل صغيرة',
      },
    ],
    used_in_features:  ['VegetationRecoveryFeature', 'SitePreparationFeature'],
    applicable_phases: ['site_clearing', 'excavation', 'abandoned'],
  },

  'SURFACE_MOISTURE': {
    signal_type:     'SURFACE_MOISTURE',
    display_name_ar: 'رطوبة السطح',
    physical_unit:   'fraction [0 to 1]',
    expected_range:  [0, 1],
    description_ar:  'نسبة رطوبة سطح الأرض. مرتفع = رطب (مطر أو ري). منخفض = جاف.',
    available_from: [
      {
        provider:            'sentinel_2',
        algorithm:           'NDMI_B8A_B11',
        typical_confidence:  0.78,
        typical_uncertainty: 0.08,
      },
      {
        provider:            'sentinel_1_sar',
        algorithm:           'VV_backscatter_moisture_retrieval',
        typical_confidence:  0.68,
        typical_uncertainty: 0.12,
        limitation_ar:       'غير خطية، تتأثر بالخشونة السطحية',
      },
      {
        provider:            'ground_sensor_iot',
        algorithm:           'direct_measurement',
        typical_confidence:  0.97,
        typical_uncertainty: 0.02,
        limitation_ar:       'نقطية — لا تمثيل مكاني إلا بالاستيفاء',
      },
      // Planet: غير مدعوم — لا SWIR band
    ],
    used_in_features:  ['WeatherPauseDetectionFeature', 'ConstructionDisturbanceFeature'],
    applicable_phases: ['all'],
  },

  'BUILT_SURFACE_FRACTION': {
    signal_type:     'BUILT_SURFACE_FRACTION',
    display_name_ar: 'نسبة الأسطح المبنية',
    physical_unit:   'fraction [0 to 1]',
    expected_range:  [0, 1],
    description_ar:  'نسبة المنطقة المغطاة بهياكل مبنية أو أسطح صناعية (طرق، مباني، خرسانة).',
    available_from: [
      {
        provider:            'planet_scope',
        algorithm:           'edge_texture_classification',
        typical_confidence:  0.65,
        typical_uncertainty: 0.15,
        limitation_ar:       'دقة تصنيف محدودة بدون نطاقات طيفية',
      },
      {
        provider:            'sentinel_2',
        algorithm:           'NDBI_B11_B8',
        typical_confidence:  0.82,
        typical_uncertainty: 0.08,
      },
      {
        provider:            'sentinel_1_sar',
        algorithm:           'double_bounce_detection',
        typical_confidence:  0.85,
        typical_uncertainty: 0.08,
        limitation_ar:       'ارتباط موجي مع هياكل معدنية — دقة عالية للمباني',
      },
    ],
    used_in_features:  ['StructuralAppearanceFeature', 'FootprintGrowthFeature'],
    applicable_phases: ['structural_works', 'road_base', 'asphalt_paving', 'completed'],
  },

  'SURFACE_HEIGHT': {
    signal_type:     'SURFACE_HEIGHT',
    display_name_ar: 'ارتفاع السطح',
    physical_unit:   'meters',
    expected_range:  [-500, 9000],
    description_ar:  'ارتفاع سطح الأرض أو الهياكل عن مستوى مرجعي. حاسم لتقدير إنجاز المباني.',
    available_from: [
      {
        provider:            'lidar_drone',
        algorithm:           'point_cloud_DSM',
        typical_confidence:  0.97,
        typical_uncertainty: 0.05,
      },
      {
        provider:            'dem_copernicus',
        algorithm:           'GLO30_DEM',
        typical_confidence:  0.80,
        typical_uncertainty: 1.0,
        limitation_ar:       'دقة 30m، قديم، لا يعكس المباني الجديدة',
      },
      {
        provider:            'planet_scope',
        algorithm:           'NOT_AVAILABLE',
        typical_confidence:  0,
        typical_uncertainty: 999,
        limitation_ar:       '⚠️ غير متاح من Planet RGB — مستحيل استخراجه',
      },
    ],
    used_in_features:  ['BuildingHeightProgressFeature', 'ExcavationDepthFeature'],
    applicable_phases: ['excavation', 'foundation', 'structural_works'],
  },
};
```

---

### 5.6 Signal Harmonizer

```typescript
/**
 * عندما يكون لدينا إشارات من مزودين مختلفين لنفس النوع،
 * أيهما نستخدم؟ كيف نجمعهما؟
 */

export class SignalHarmonizer {

  /**
   * إذا وجدت إشارات متعددة من نفس النوع لنفس الفترة الزمنية،
   * يختار أو يجمع بناءً على الجودة
   */
  harmonize(signals: NormalizedSignal[]): HarmonizedSignal[] {

    const grouped = this.groupByTypeAndTime(signals);

    return grouped.map(group => {
      if (group.signals.length === 1) {
        return this.wrapSingle(group.signals[0]);
      }

      // إشارات متعددة — ندمجها بالوزن (quality_score)
      const best    = group.signals.reduce((a, b) =>
        a.confidence > b.confidence ? a : b
      );
      const fused   = this.qualityWeightedFusion(group.signals);

      return {
        signal_type:          group.signal_type,
        value:                fused.value,
        confidence:           fused.confidence,
        uncertainty:          fused.uncertainty,
        source_count:         group.signals.length,
        primary_source:       best.provenance.provider,
        all_sources:          group.signals.map(s => s.provenance.provider),
        fusion_method:        'quality_weighted_mean',
        // للاستدلال: نفس الواجهة
      };
    });
  }

  private qualityWeightedFusion(signals: NormalizedSignal[]): FusedValue {
    const totalWeight = signals.reduce((s, sig) => s + sig.confidence, 0);
    const value = signals.reduce((s, sig) =>
      s + sig.value * sig.confidence / totalWeight, 0
    );
    // Uncertainty propagation (simplified):
    const unc = Math.sqrt(
      signals.reduce((s, sig) =>
        s + Math.pow(sig.uncertainty * sig.confidence / totalWeight, 2), 0
      )
    );
    return { value, confidence: Math.min(...signals.map(s => s.confidence)), uncertainty: unc };
  }
}
```

---

## 6. Feature Layer الجديد — يستهلك إشارات، لا صور

### 6.1 Feature Interface الجديد

```typescript
/**
 * الميزة لا تعرف Planet. لا تعرف Sentinel. لا تعرف SAR.
 * تعرف فقط: أعطيني إشارة من نوع VEGETATION_ACTIVITY
 * إذا لم تجدها → تُعلن عن missing_evidence وتكمل
 */

export interface IFeature {
  feature_name:   string;
  required_signals: SignalType[];    // الإشارات التي تحتاجها
  optional_signals: SignalType[];    // إشارات تُحسّن الدقة لكن ليست إلزامية

  extract(
    signals: Map<SignalType, NormalizedSignal>,
    projectContext: ProjectContext,
  ): FeatureResult;
}

export interface FeatureResult {
  feature_name:  string;
  value:         number;        // 0-1
  confidence:    number;
  evidence:      Evidence[];
  missing_data:  string[];      // إشارات كانت مطلوبة لكن غير متاحة
  explanation_ar: string;
}
```

---

### 6.2 مثال: ConstructionDisturbanceFeature

```typescript
export class ConstructionDisturbanceFeature implements IFeature {
  feature_name     = 'construction_disturbance';
  required_signals = ['SURFACE_REFLECTANCE'] as SignalType[];
  optional_signals = [
    'VEGETATION_ACTIVITY',   // إذا توفرت: نستخدمها
    'SURFACE_MOISTURE',      // إذا توفرت: نميز مطر عن نشاط
    'BACKSCATTER_VV',        // إذا توفرت: تأكيد بـ SAR
    'BUILT_SURFACE_FRACTION', // إذا توفرت: تقدير أدق
  ] as SignalType[];

  extract(signals: Map<SignalType, NormalizedSignal>, ctx: ProjectContext): FeatureResult {
    const reflectance = signals.get('SURFACE_REFLECTANCE')!;  // مطلوب
    const vegetation  = signals.get('VEGETATION_ACTIVITY');   // اختياري
    const moisture    = signals.get('SURFACE_MOISTURE');      // اختياري
    const sar         = signals.get('BACKSCATTER_VV');        // اختياري
    const built       = signals.get('BUILT_SURFACE_FRACTION');// اختياري

    const evidence: Evidence[] = [];
    const missing: string[] = [];

    // ── الحساب الأساسي (من SURFACE_REFLECTANCE فقط) ──
    // ارتفاع الانعكاسية عن خط الأساس يشير لتغيير المواد السطحية
    const baselineRef = ctx.historical_baseline?.SURFACE_REFLECTANCE ?? 0.3;
    const refChange   = Math.abs(reflectance.value - baselineRef);
    let disturbance   = Math.min(1, refChange * 3);
    let confidence    = reflectance.confidence * 0.6;   // ← محدودية: مصدر واحد

    evidence.push({
      type:          'supporting',
      signal:        'انعكاسية السطح',
      value:         refChange,
      confidence:    reflectance.confidence,
      date_observed: reflectance.observation_time,
      scene_id:      reflectance.provenance.scene_id,
    });

    // ── تعزيز بالبيانات الاختيارية إن وجدت ──

    if (vegetation) {
      // انخفاض النشاط النباتي يدعم وجود نشاط إنشائي (إزالة نباتات)
      const vegDecline = Math.max(0, ctx.baseline_vegetation - vegetation.value);
      disturbance = disturbance * 0.7 + vegDecline * 0.3;
      confidence  = Math.max(confidence, vegetation.confidence * 0.8);
      evidence.push({
        type: vegDecline > 0.1 ? 'supporting' : 'contradicting',
        signal: 'تراجع النشاط النباتي',
        value: vegDecline,
        confidence: vegetation.confidence,
        date_observed: vegetation.observation_time,
        scene_id: vegetation.provenance.scene_id,
      });
    } else {
      missing.push('VEGETATION_ACTIVITY — ستُحسّن دقة كشف التغيير');
    }

    if (moisture) {
      // رطوبة عالية → احتمال مطر لا نشاط إنشائي → نُخفّض الثقة
      if (moisture.value > 0.7) {
        confidence *= 0.8;
        evidence.push({
          type: 'contradicting',
          signal: 'رطوبة عالية — احتمال تأثير مطر',
          value: moisture.value,
          confidence: moisture.confidence,
          date_observed: moisture.observation_time,
          scene_id: moisture.provenance.scene_id,
        });
      }
    } else {
      missing.push('SURFACE_MOISTURE — للتمييز بين نشاط إنشائي ومطر');
    }

    if (sar) {
      // SAR يُؤكد التغيير بشكل مستقل عن الضوء المرئي
      const sarDisturbance = this.sarDisturbanceIndex(sar.value);
      disturbance = (disturbance + sarDisturbance) / 2;
      confidence  = Math.min(0.95, confidence + 0.15); // تأكيد مستقل يرفع الثقة
      evidence.push({
        type: sarDisturbance > 0.3 ? 'supporting' : 'contradicting',
        signal: 'استرداد SAR (تغيير مستقل)',
        value: sarDisturbance,
        confidence: sar.confidence,
        date_observed: sar.observation_time,
        scene_id: sar.provenance.scene_id,
      });
    } else {
      missing.push('BACKSCATTER_VV — تأكيد مستقل بـ SAR ممكن');
    }

    return {
      feature_name:  this.feature_name,
      value:         Math.round(disturbance * 100) / 100,
      confidence:    Math.round(confidence * 100) / 100,
      evidence,
      missing_data:  missing,
      explanation_ar: `اضطراب السطح: ${Math.round(disturbance*100)}% ` +
        `(ثقة: ${Math.round(confidence*100)}%) ` +
        `استناداً إلى ${evidence.filter(e=>e.type==='supporting').length} دليل داعم`,
    };
  }
}
```

---

## 7. Evidence Layer — يُرجع إلى الإشارات لا القنوات

### قبل (مرفوض):

```typescript
// ❌ هذا مرفوض — يذكر Band8، SAR VV، NDVI
evidence.push({
  signal: 'تغيير في Band8 Sentinel-2',
  signal: 'ارتفاع SAR VV من -8dB إلى -5dB',
  signal: 'NDVI تراجع من 0.4 إلى 0.1',
});
```

### بعد (مقبول):

```typescript
// ✅ صحيح — يذكر الظاهرة الفيزيائية
evidence.push({
  signal: 'نشاط نباتي',       // VEGETATION_ACTIVITY — أي مصدر
  value: -0.3,                 // تراجع
  confidence: 0.88,
  source_description: 'قياس مباشر عالي الثقة',  // عام — لا ذكر للمزود
});
```

---

## 8. اختبار الاستقلالية المستقبلية

### السيناريو: إطلاق قمر اصطناعي جديد في 2029

```
HyperSat-1:
  - 250 قناة طيفية (Hyperspectral)
  - دقة 0.5m
  - يقيس: SURFACE_MOISTURE, MINERAL_COMPOSITION,
    CONSTRUCTION_MATERIAL_TYPE مباشرة
```

**ما الذي يحتاج تغييراً؟**

```
✅ يُنشأ: HyperSat1Adapter (يُحول 250 قناة → NormalizedSignal[])
✅ يُحدَّث: SIGNAL_REGISTRY (إضافة MINERAL_COMPOSITION, CONSTRUCTION_MATERIAL_TYPE)
✅ يُنشأ: MaterialTypeFeature (ميزة جديدة تستهلك الإشارة الجديدة)

✗ لا يتغير: ConstructionDisturbanceFeature
✗ لا يتغير: EvidenceGenerator
✗ لا يتغير: RoadProgressModel
✗ لا يتغير: HealthEngine
✗ لا يتغير: PICShell
✗ لا يتغير: قاعدة البيانات (pic.features, pic.evidence)
✗ لا يتغير: API
```

**الشرط تحقق:** adapter جديد فقط. كل طبقات الاستدلال ثابتة.

---

## 9. تحليل أثر الهجرة (Migration Impact)

### 9.1 ما يتغير تقنياً

| الملف | الحالة | الإجراء |
|-------|--------|---------|
| `lib/picAnalysis.ts` | يُلغى | تُنقل `findScenesForBbox` إلى `SceneDiscovery` class |
| `lib/picAnalysis.ts::compareImages()` | يُحذف | يُستبدل بـ `PlanetAdapter::adapt()` |
| `lib/picAnalysis.ts::classifyActivity()` | يُلغى | يُستبدل بـ `ConstructionDisturbanceFeature::extract()` |
| `lib/picAnalysis.ts::buildTimeline()` | يُعاد كتابته | يستهلك `FeatureBundle[]` بدلاً من `PICScan[]` |
| **جديد** `lib/sal/signals.ts` | جديد | تعريفات `NormalizedSignal`, `SignalType`, `SignalRegistry` |
| **جديد** `lib/sal/adapters/planet.ts` | جديد | `PlanetAdapter` |
| **جديد** `lib/sal/adapters/sentinel2.ts` | مستقبلي | `Sentinel2Adapter` |
| **جديد** `lib/sal/harmonizer.ts` | جديد | `SignalHarmonizer` |
| **جديد** `lib/features/disturbance.ts` | جديد | `ConstructionDisturbanceFeature` |
| **جديد** `lib/features/vegetation.ts` | جديد | `VegetationRecoveryFeature` |
| `lib/picDB.ts` | إضافة | جداول `pic.signals`, `pic.features_v2` |

### 9.2 ما لا يتغير

- `app/api/v1/pic/**` — لا تغيير في API contracts
- `PICShell.tsx` — لا تغيير في الواجهة
- `pic.projects` — لا تغيير في جدول المشاريع
- `pic.alerts` — لا تغيير في التنبيهات
- `pic.events` — لا تغيير في الأحداث

---

## 10. هيكل الملفات المقترح

```
lib/
├── sal/                          ← Signal Abstraction Layer
│   ├── types.ts                  ← NormalizedSignal, SignalType, SignalProvenance
│   ├── registry.ts               ← SIGNAL_REGISTRY
│   ├── harmonizer.ts             ← SignalHarmonizer
│   ├── quality.ts                ← SignalQualityAssessor
│   └── adapters/
│       ├── base.ts               ← IProviderAdapter interface
│       ├── planet.ts             ← PlanetAdapter (صور RGB)
│       ├── sentinel2.ts          ← [مستقبلي] Sentinel2Adapter
│       ├── sar.ts                ← [مستقبلي] SARAdapter
│       ├── lidar.ts              ← [مستقبلي] LiDARAdapter
│       ├── weather.ts            ← WeatherAdapter (open-meteo API)
│       └── ground_sensor.ts      ← [مستقبلي] IoTAdapter
│
├── features/                     ← Feature Layer (لا تعرف المزودين)
│   ├── base.ts                   ← IFeature interface
│   ├── disturbance.ts            ← ConstructionDisturbanceFeature
│   ├── vegetation.ts             ← VegetationRecoveryFeature
│   ├── structural.ts             ← StructuralAppearanceFeature
│   ├── ground_motion.ts          ← [مستقبلي] GroundMotionFeature
│   └── thermal.ts                ← [مستقبلي] ThermalPersistenceFeature
│
├── evidence/                     ← Evidence Layer
│   ├── generator.ts              ← EvidenceGenerator
│   └── explainer.ts              ← ExplainabilityChain
│
├── reasoning/                    ← Reasoning Layer
│   ├── progress/
│   │   ├── base.ts               ← IProgressModel
│   │   ├── road.ts               ← RoadProgressModel
│   │   ├── building.ts           ← BuildingProgressModel
│   │   └── utility.ts            ← UtilityProgressModel
│   ├── health.ts                 ← HealthEngine (configurable)
│   ├── interruption.ts           ← InterruptionClassifier
│   └── temporal.ts               ← RollingWindowAnalyzer
│
├── picDB.ts                      ← (محدّث — جداول جديدة)
└── picAnalysis.ts                ← (يُعاد كتابته تدريجياً)
```

---

## 11. جداول قاعدة البيانات الجديدة

```sql
-- الإشارات المُطبَّعة لكل مشهد
CREATE TABLE pic.signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES pic.projects(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL,          -- 'VEGETATION_ACTIVITY' | ...
  observation_time TIMESTAMPTZ NOT NULL,
  validity_start  DATE NOT NULL,
  validity_end    DATE NOT NULL,

  -- القيمة
  value           NUMERIC(10,6) NOT NULL,
  value_unit      TEXT NOT NULL,
  uncertainty     NUMERIC(8,6),
  quality_score   NUMERIC(4,3),
  confidence      NUMERIC(4,3),
  is_valid        BOOLEAN NOT NULL DEFAULT true,
  rejection_reason TEXT,

  -- الأصل (مخزن لكن لا يُستهلك من طبقات الاستدلال مباشرة)
  provider        TEXT NOT NULL,
  scene_id        TEXT,
  processing_chain JSONB,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, signal_type, observation_time, provider)
);

-- الميزات المستخرجة من الإشارات
CREATE TABLE pic.feature_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES pic.projects(id) ON DELETE CASCADE,
  feature_name    TEXT NOT NULL,
  observation_date DATE NOT NULL,
  value           NUMERIC(6,4),
  confidence      NUMERIC(4,3),
  signal_ids_used UUID[],          -- الإشارات المستخدمة (للتتبع)
  missing_signals TEXT[],          -- إشارات كانت مطلوبة ولم تتوفر
  explanation_ar  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, feature_name, observation_date)
);

-- سلسلة الأدلة
CREATE TABLE pic.evidence_chain (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID REFERENCES pic.projects(id) ON DELETE CASCADE,
  feature_obs_id UUID REFERENCES pic.feature_observations(id),
  evidence_type  TEXT NOT NULL,   -- 'supporting'|'contradicting'|'missing'
  signal_type    TEXT NOT NULL,   -- ما الإشارة التي أنتجت هذا الدليل
  signal_id      UUID REFERENCES pic.signals(id),
  value          NUMERIC,
  confidence     NUMERIC(4,3),
  reasoning_ar   TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 12. خارطة الطريق المحدَّثة

### المرحلة 0 — Signal Types (أسبوع 1)
1. إنشاء `lib/sal/types.ts` — تعريفات `NormalizedSignal`, `SignalType`
2. إنشاء `lib/sal/registry.ts` — `SIGNAL_REGISTRY` لـ 6 أنواع أساسية
3. تثبيت `sharp`: `npm install sharp @types/sharp`
4. بناء `PlanetAdapter` — يحوّل PNG إلى 5 إشارات مُطبَّعة
5. تشغيل اختبار: `PlanetAdapter.adapt(thumbnail)` → `NormalizedSignal[]`

**معيار النجاح**: `compareImages()` لم تعد تُستدعى. الكود يمرر إشارات لا bytes.

---

### المرحلة 1 — Feature Layer (أسبوع 2)
1. بناء `IFeature` interface
2. بناء `ConstructionDisturbanceFeature(signals)` — بدون أي ذكر لـ RGB أو Planet
3. بناء `VegetationRecoveryFeature(signals)`
4. تحديث `analyzeProject()` لاستدعاء `adapter → signals → features`

---

### المرحلة 2 — Evidence + Progress (أسبوع 3-4)
1. بناء `EvidenceGenerator` يستهلك `FeatureBundle`
2. بناء `RoadProgressModel` و `BuildingProgressModel`
3. حذف `rawProgress = activeDays/totalDays`
4. إضافة `explanation_ar` لكل مخرج

---

### المرحلة 3 — Health + Temporal (أسبوع 5)
1. بناء `RollingWindowAnalyzer` (regression على 30/90/365 يوم)
2. بناء `HealthEngine` مع `HealthConfig` قابل للتخصيص
3. إضافة `SignalHarmonizer` للجمع بين مزودين

---

### المرحلة 4 — Second Provider (أسبوع 6)
1. بناء `WeatherAdapter` (open-meteo → SurfaceMoistureSignal)
2. ربطه في `InterruptionClassifier` لتمييز weather_pause
3. اختبار: نفس `ConstructionDisturbanceFeature` يعمل بشكل أفضل مع بيانات الطقس
4. **اختبار الاستقلالية**: التحقق أن إضافة WeatherAdapter لم يُغيّر أي كود استدلال

---

## 13. القاعدة النهائية

```
if (code.mentions('planet'))     → code belongs in an Adapter only
if (code.mentions('rgb'))        → code belongs in an Adapter only
if (code.mentions('band_4'))     → code belongs in an Adapter only
if (code.mentions('sar_vv'))     → code belongs in an Adapter only
if (code.mentions('ndvi'))       → use VEGETATION_ACTIVITY signal instead

if (reasoning.layer.mentions(provider)) → architecture is incomplete
```

**الاختبار الحاسم:**  
خذ أي ملف من `lib/features/` أو `lib/reasoning/`.  
ابحث عن كلمة "planet" أو "sentinel" أو "sar" أو "rgb".  
إذا وجدتها → الملف في الطبقة الخطأ.

---

*هذه الوثيقة تُعرّف حداً لا يُتجاوز:*  
*الأقمار الاصطناعية تعيش في الـ Adapters.*  
*الفيزياء تعيش في الإشارات.*  
*الاستدلال يعيش فوق الاثنين — لا يرى أياً منهما.*
