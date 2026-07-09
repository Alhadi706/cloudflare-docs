"""
MINERVA — Asset Spatial Intelligence Engine
Central configuration: all constants, signal definitions, asset types, evidence files.
"""

# =============================================================================
# CONTEXT SPACE (ADR-003: 4 dimensions × 3 values = 27 cells)
# =============================================================================

CONTEXT_DIMENSIONS = {
    "season": ["HOT_DRY", "MILD_DRY", "COOL_WET"],
    "moisture": ["DRY", "MOIST", "WET"],
    "ops": ["NORMAL", "POST_MAINT", "NEAR_ACTIVITY"],
    "vicinity": ["NORMAL", "IRRIGATION_ACTIVE", "HIGH_TRAFFIC"],
}

# Thresholds for context resolution from raw weather data
SEASON_THRESHOLDS = {
    "HOT_DRY":  {"min_temp": 28, "max_precip_monthly": 20},
    "MILD_DRY": {"min_temp": 15, "max_precip_monthly": 50},
    "COOL_WET": {},  # default fallback
}
MOISTURE_THRESHOLDS_MM_30D = {"DRY": 5, "MOIST": 30}  # < 5 → DRY, 5-30 → MOIST, >30 → WET

# Minimum observations per context cell to trust the baseline
CONFIDENCE_THRESHOLDS = {"HIGH": 30, "MEDIUM": 10, "LOW": 0}


# =============================================================================
# PHYSICAL SIGNALS REGISTRY (ADR-002: abstract, source-agnostic)
# =============================================================================

PHYSICAL_SIGNALS = {
    "SOIL_MOISTURE": {
        "meaning": "محتوى الرطوبة في التربة السطحية (0-10cm)",
        "unit": "index (-1 to 1)",
        "valid_range": (-1.0, 1.0),
        "typical_range_arid": (0.02, 0.18),
        "temporal_decay_days": 30,      # كم يوم قبل أن يصبح الدليل قديمًا
        "sources": {
            "sentinel2_ndmi": {
                "formula": "(B08 - B11) / (B08 + B11)",
                "resolution_m": 20,
                "revisit_days": 5,
                "quality_class": "B",
            },
            "synthetic_ndmi": {                # للاختبار فقط
                "resolution_m": 20,
                "revisit_days": 5,
                "quality_class": "A",          # نعرف القيم الحقيقية
            },
        },
    },
    "SURFACE_TEMP": {
        "meaning": "درجة حرارة سطح التربة/الأرض",
        "unit": "celsius",
        "valid_range": (-10.0, 80.0),
        "typical_range_arid": (25.0, 55.0),
        "temporal_decay_days": 14,
        "sources": {
            "landsat9_lst": {
                "resolution_m": 100,
                "revisit_days": 16,
                "quality_class": "B",
            },
            "modis_lst": {
                "resolution_m": 1000,
                "revisit_days": 1,
                "quality_class": "C",
            },
            "synthetic_lst": {
                "resolution_m": 100,
                "revisit_days": 16,
                "quality_class": "A",
            },
        },
    },
    "SAR_BACKSCATTER": {
        "meaning": "شدة الانعكاس الراداري VV",
        "unit": "dB",
        "valid_range": (-30.0, 5.0),
        "typical_range_arid": (-15.0, -5.0),
        "temporal_decay_days": 12,
        "sources": {
            "sentinel1_vv": {
                "resolution_m": 10,
                "revisit_days": 6,
                "quality_class": "B",
            },
            "synthetic_sar": {
                "resolution_m": 10,
                "revisit_days": 6,
                "quality_class": "A",
            },
        },
    },
    "VEGETATION_INDEX": {
        "meaning": "مؤشر النشاط النباتي",
        "unit": "index (-1 to 1)",
        "valid_range": (-1.0, 1.0),
        "typical_range_arid": (-0.05, 0.15),
        "temporal_decay_days": 21,
        "sources": {
            "sentinel2_ndvi": {
                "formula": "(B08 - B04) / (B08 + B04)",
                "resolution_m": 10,
                "revisit_days": 5,
                "quality_class": "B",
            },
            "synthetic_ndvi": {
                "resolution_m": 10,
                "revisit_days": 5,
                "quality_class": "A",
            },
        },
    },
    "PRECIPITATION": {
        "meaning": "هطول مطري مؤخرًا",
        "unit": "mm",
        "valid_range": (0.0, 500.0),
        "temporal_decay_days": 7,
        "sources": {
            "open_meteo": {
                "resolution_m": 11000,         # ~11km
                "revisit_days": 1,
                "quality_class": "A",
            },
        },
    },
}


# =============================================================================
# ASSET TYPE DEFINITIONS + EVENT CATALOGUES
# =============================================================================

ASSET_TYPES = {
    "WATER_PIPELINE": {
        "name_ar": "خط المياه",
        "possible_events": [
            "WATER_LEAK",
            "SUBSIDENCE",
            "EXCAVATION_DAMAGE",
            "ENCROACHMENT",
            "CONSTRUCTION_NEARBY",
            "IRRIGATION_EFFECT",       # ← تأثير الري المجاور (ليس تسرب)
            "MAINTENANCE_SPILLAGE",    # ← رش ماء أثناء الصيانة
            "NATURAL_RAIN_EFFECT",     # ← أثر المطر الطبيعي
            "DATA_ERROR",              # ← دائمًا (ADR-005)
        ],
        "impossible_events": [
            "OIL_SPILL",
            "GAS_LEAK",
            "FIRE_FROM_PIPE",
        ],
        "key_signals": [
            "SOIL_MOISTURE",
            "SURFACE_TEMP",
            "SAR_BACKSCATTER",
            "VEGETATION_INDEX",
            "PRECIPITATION",
        ],
        "feature_weights": {           # أهمية كل إشارة لهذا النوع من الأصول
            "SOIL_MOISTURE": 0.35,
            "SURFACE_TEMP": 0.25,
            "SAR_BACKSCATTER": 0.20,
            "VEGETATION_INDEX": 0.10,
            "PRECIPITATION": 0.10,
        },
    },
    "OIL_PIPELINE": {
        "name_ar": "خط النفط",
        "possible_events": [
            "OIL_SPILL",
            "FIRE",
            "SUBSIDENCE",
            "EXCAVATION_DAMAGE",
            "ENCROACHMENT",
            "DATA_ERROR",
        ],
        "impossible_events": [
            "WATER_LEAK",
            "IRRIGATION_EFFECT",
        ],
        "key_signals": [
            "SAR_BACKSCATTER",
            "SURFACE_TEMP",
            "VEGETATION_INDEX",
            "SOIL_MOISTURE",
        ],
        "feature_weights": {
            "SAR_BACKSCATTER": 0.35,
            "SURFACE_TEMP": 0.30,
            "VEGETATION_INDEX": 0.20,
            "SOIL_MOISTURE": 0.15,
        },
    },
}


# =============================================================================
# EVIDENCE FILES (ADR-004: Physics-based, manually defined for Phase 0)
# =============================================================================

EVIDENCE_FILES = {
    # =========================================================================
    # WATER_LEAK in WATER_PIPELINE in ARID biome
    # =========================================================================
    ("WATER_LEAK", "WATER_PIPELINE", "ARID"): {
        "confirming": [
            {
                "signal": "SOIL_MOISTURE",
                "direction": "INCREASE",
                "min_zscore": 2.0,
                "weight": 0.32,
                "spatial_pattern": "LINEAR_NEAR_CENTERLINE",
                "temporal_lag_days": (0, 7),
                "physical_reason": "الماء المتسرب يرفع رطوبة التربة تدريجيًا",
            },
            {
                "signal": "SURFACE_TEMP",
                "direction": "DECREASE",
                "min_zscore": 1.5,
                "weight": 0.25,
                "temporal_lag_days": (1, 10),
                "physical_reason": "التبخر من الرطوبة يُبرِّد السطح",
            },
            {
                "signal": "SAR_BACKSCATTER",
                "direction": "DECREASE",
                "min_zscore": 1.2,
                "weight": 0.18,
                "temporal_lag_days": (0, 10),
                "physical_reason": "التربة الرطبة تمتص الإشارة الرادارية",
            },
            {
                "signal": "VEGETATION_INDEX",
                "direction": "INCREASE",
                "min_zscore": 1.0,
                "weight": 0.10,
                "temporal_lag_days": (14, 35),
                "physical_reason": "النبات الانتهازي يستجيب للرطوبة بعد أسبوعين",
            },
            {
                "signal": "PRECIPITATION",
                "direction": "NEAR_ZERO",
                "max_value_mm": 5,
                "weight": 0.15,
                "temporal_lag_days": (0, 7),
                "physical_reason": "غياب المطر يُبرز الرطوبة كمصدر اصطناعي",
            },
        ],
        "refuting": [
            {
                "signal": "PRECIPITATION",
                "condition": "HIGH",
                "threshold_mm_7d": 20,
                "effect": "NULLIFIES",          # يُلغي الفرضية
                "reason": "المطر يُفسِّر الرطوبة بشكل طبيعي",
            },
            {
                "context_dimension": "ops",
                "condition": "POST_MAINT",
                "effect": "REDUCES_50PCT",
                "reason": "الصيانة تتضمن رش وغسيل عادةً",
            },
            {
                "context_dimension": "vicinity",
                "condition": "IRRIGATION_ACTIVE",
                "effect": "REDUCES_40PCT",
                "reason": "الري القريب يُفسِّر الرطوبة جزئيًا",
            },
        ],
        "causal_chain": [
            {"step": 1, "signal": "SOIL_MOISTURE",   "direction": "INCREASE", "lag_range": (0, 5)},
            {"step": 2, "signal": "SURFACE_TEMP",    "direction": "DECREASE", "lag_range": (1, 8)},
            {"step": 3, "signal": "SAR_BACKSCATTER", "direction": "DECREASE", "lag_range": (0, 10)},
            {"step": 4, "signal": "VEGETATION_INDEX","direction": "INCREASE", "lag_range": (14, 30)},
        ],
        "expected_spatial_pattern": "LINEAR",
        "expected_onset": "GRADUAL",         # vs INSTANT for rain
        "expected_persistence": "PERSISTENT_OR_GROWING",
        "base_prior": 0.20,                  # احتمال مبدئي في غياب أدلة
    },

    # =========================================================================
    # IRRIGATION_EFFECT — يشبه التسرب لكن موسمي ومتوقع
    # =========================================================================
    ("IRRIGATION_EFFECT", "WATER_PIPELINE", "ARID"): {
        "confirming": [
            {
                "signal": "SOIL_MOISTURE",
                "direction": "INCREASE",
                "min_zscore": 1.5,
                "weight": 0.40,
                "spatial_pattern": "DIFFUSE_AGRICULTURAL",
                "physical_reason": "مياه الري تنتشر على مساحة واسعة",
            },
            {
                "context_dimension": "vicinity",
                "condition": "IRRIGATION_ACTIVE",
                "weight": 0.35,
                "physical_reason": "الـ context يؤكد وجود ري نشط",
            },
        ],
        "refuting": [
            {
                "context_dimension": "vicinity",
                "condition": "NORMAL",
                "effect": "NULLIFIES",
                "reason": "لا ري قريب → لا يمكن أن يكون تأثير ري",
            },
        ],
        "expected_spatial_pattern": "DIFFUSE",
        "expected_onset": "SEASONAL",
        "base_prior": 0.25,
    },

    # =========================================================================
    # NATURAL_RAIN_EFFECT
    # =========================================================================
    ("NATURAL_RAIN_EFFECT", "WATER_PIPELINE", "ARID"): {
        "confirming": [
            {
                "signal": "PRECIPITATION",
                "condition": "HIGH",
                "threshold_mm_7d": 10,
                "weight": 0.60,
                "physical_reason": "المطر يُسبِّب الرطوبة مباشرة",
            },
            {
                "signal": "SOIL_MOISTURE",
                "direction": "INCREASE",
                "weight": 0.25,
                "spatial_pattern": "AREA_WIDE",
                "physical_reason": "المطر يرفع الرطوبة على مساحة واسعة",
            },
        ],
        "refuting": [
            {
                "signal": "PRECIPITATION",
                "condition": "NEAR_ZERO",
                "max_value_mm": 5,
                "effect": "NULLIFIES",
                "reason": "لا مطر → لا يمكن أن يكون تأثير مطر",
            },
        ],
        "base_prior": 0.15,
    },

    # =========================================================================
    # MAINTENANCE_SPILLAGE
    # =========================================================================
    ("MAINTENANCE_SPILLAGE", "WATER_PIPELINE", "ARID"): {
        "confirming": [
            {
                "context_dimension": "ops",
                "condition": "POST_MAINT",
                "weight": 0.55,
                "physical_reason": "الصيانة تشمل رش وغسيل",
            },
            {
                "signal": "SOIL_MOISTURE",
                "direction": "INCREASE",
                "weight": 0.30,
                "temporal_lag_days": (0, 14),
                "physical_reason": "مياه الصيانة في التربة",
            },
        ],
        "refuting": [
            {
                "context_dimension": "ops",
                "condition": "NORMAL",
                "effect": "NULLIFIES",
                "reason": "لا صيانة مسجلة → لا يمكن أن يكون spillage من صيانة",
            },
        ],
        "base_prior": 0.10,
    },

    # =========================================================================
    # DATA_ERROR (ADR-005: always in competition)
    # =========================================================================
    ("DATA_ERROR", "WATER_PIPELINE", "ARID"): {
        "confirming": [
            {
                "signal": "SOIL_MOISTURE",
                "condition": "SINGLE_SOURCE_ONLY",
                "weight": 0.40,
                "physical_reason": "شذوذ في مصدر واحد فقط يُشير لخطأ",
            },
        ],
        "refuting": [
            {
                "condition": "MULTIPLE_SOURCES_AGREE",
                "effect": "REDUCES_70PCT",
                "reason": "تأكيد من مصادر متعددة يُقلل احتمال الخطأ كثيرًا",
            },
        ],
        "base_prior": 0.10,
    },
}


# =============================================================================
# HEALTH SCORE COMPONENT WEIGHTS (per asset type)
# =============================================================================

HEALTH_WEIGHTS = {
    "WATER_PIPELINE": {
        "anomaly_health": 0.40,
        "trend_health": 0.25,
        "historical_health": 0.20,
        "maintenance_health": 0.15,
    },
}

# Health grade thresholds
HEALTH_GRADES = {
    "A": (85, 100),
    "B": (70, 85),
    "C": (55, 70),
    "D": (40, 55),
    "F": (0, 40),
}
