// ─── sceneLabels ──────────────────────────────────────────────────────────────
// Converts technical satellite scene UIDs into human-readable Arabic labels.
// Pure utility — no React, no API calls.
//
// Supports Sentinel-2 UID patterns like:
//   S2A_MSIL2A_20260310_T33SUU_TRIPOLI_CURRENT
//   S2B_33SUS_20250309_0_L2A

// ─── Arabic month names ───────────────────────────────────────────────────────

const AR_MONTHS: Record<number, string> = {
  1:  'يناير',  2:  'فبراير',  3:  'مارس',
  4:  'أبريل',  5:  'مايو',     6:  'يونيو',
  7:  'يوليو',  8:  'أغسطس',   9:  'سبتمبر',
  10: 'أكتوبر', 11: 'نوفمبر',  12: 'ديسمبر',
};

// ─── Known area mappings ──────────────────────────────────────────────────────

const TILE_AREA: Record<string, string> = {
  // طرابلس — كل التايلات الممكنة
  T33SUU: 'طرابلس', T33SUS: 'طرابلس', T33SUR: 'طرابلس', T33SUT: 'طرابلس',
  '33SUU': 'طرابلس', '33SUS': 'طرابلس', '33SUR': 'طرابلس', '33SUT': 'طرابلس',
  TRIPOLI: 'طرابلس',
  // بنغازي
  T33TUL: 'بنغازي', T33TUM: 'بنغازي', T34SFH: 'بنغازي',
  '33TUL': 'بنغازي', '33TUM': 'بنغازي',
  BENGHAZI: 'بنغازي',
  // مدن أخرى
  MISRATA: 'مصراتة', T33TVL: 'مصراتة',
  SIRTE:   'سرت',    T33TVM: 'سرت',
  SEBHA:   'سبها',   T33SWS: 'سبها',
  TOBRUK:  'طبرق',
};

// ─── Satellite source names ───────────────────────────────────────────────────

function parseSatellite(uid: string): string {
  if (/^S2A/.test(uid)) return 'Sentinel-2A';
  if (/^S2B/.test(uid)) return 'Sentinel-2B';
  if (/^S2C/.test(uid)) return 'Sentinel-2C';
  if (/^S2/.test(uid))  return 'Sentinel-2';
  if (/^LC0?8/.test(uid)) return 'Landsat-8';
  if (/^LC0?9/.test(uid)) return 'Landsat-9';
  return 'قمر صناعي';
}

// ─── Date extraction ──────────────────────────────────────────────────────────

function parseDateFromUid(uid: string): { day: number; month: number; year: number } | null {
  // Try YYYYMMDD patterns
  const patterns = [
    /(\d{4})(\d{2})(\d{2})/,                    // 20260310
    /[_-](\d{4})[_-](\d{2})[_-](\d{2})/,       // 2026-03-10 or 2026_03_10
  ];
  for (const p of patterns) {
    const m = uid.match(p);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      if (year > 2000 && year < 2050 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { day, month, year };
      }
    }
  }
  return null;
}

function parseArea(uid: string): string {
  const upper = uid.toUpperCase();
  for (const [key, name] of Object.entries(TILE_AREA)) {
    if (upper.includes(key.toUpperCase())) return name;
  }
  return 'منطقة مجهولة';
}

// ─── Exported types ───────────────────────────────────────────────────────────

export interface SceneLabel {
  area:       string;   // طرابلس
  dateAr:     string;   // 10 مارس 2026
  dateShort:  string;   // مارس 2026
  satellite:  string;   // Sentinel-2B
  isReal:     boolean;
  uid:        string;   // full UID (secondary)
  tileId:     string;   // T33SUR — tile code extracted from UID
}

// ─── Main export ──────────────────────────────────────────────────────────────

function parseTileId(uid: string): string {
  // Match Sentinel-2 tile code: T33SUR, 33SUR, etc.
  const m = uid.match(/\b(T?\d{2}[A-Z]{3})\b/);
  return m ? m[1].replace(/^T/, 'T') : '';
}

export function parseSceneLabel(uid: string, data_is_real?: boolean): SceneLabel {
  const date = parseDateFromUid(uid);
  const satellite = parseSatellite(uid);
  const area = parseArea(uid);
  const tileId = parseTileId(uid);

  let dateAr = 'تاريخ غير معروف';
  let dateShort = '';
  if (date) {
    const month = AR_MONTHS[date.month] ?? '';
    dateAr    = `${date.day} ${month} ${date.year}`;
    dateShort = `${month} ${date.year}`;
  }

  return {
    area,
    dateAr,
    dateShort,
    satellite,
    isReal: !!data_is_real,
    uid,
    tileId,
  };
}

/** Single-line short label for dropdowns */
export function sceneShortLabel(uid: string, data_is_real?: boolean): string {
  const lbl = parseSceneLabel(uid, data_is_real);
  return `${lbl.area} · ${lbl.dateShort}`;
}

/**
 * Classify a scene into a human-facing Arabic data-type label.
 * Rules:
 *  - "بيانات حالية"                    → real data, acquired within last 30 days
 *  - "بيانات تاريخية"                  → real data, older than 30 days
 *  - "تقدير مبني على بيانات حقيقية"   → processed/estimated from real scenes (data_is_real=false, has date)
 *  - "نموذج تقريبي"                    → synthetic, no date, no real source
 * "توقع مستقبلي" is ONLY used by SimulationPanel for future forecast years — NEVER here.
 */
export function classifyDataType(uid: string, data_is_real?: boolean): {
  label: string;
  labelClass: string;
} {
  const date = parseDateFromUid(uid);

  if (data_is_real) {
    // Confirmed real satellite capture
    if (!date) {
      return { label: 'بيانات فضائية', labelClass: 'bg-blue-900/50 text-blue-300' };
    }
    const today     = new Date();
    const sceneDate = new Date(date.year, date.month - 1, date.day);
    const daysDiff  = (today.getTime() - sceneDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 30) {
      return { label: 'بيانات حالية', labelClass: 'bg-emerald-900/50 text-emerald-400' };
    }
    return { label: 'بيانات تاريخية', labelClass: 'bg-blue-900/50 text-blue-300' };
  }

  // data_is_real = false
  if (date) {
    // Has a parseable scene date → it's estimated/processed data derived from real captures,
    // not a purely synthetic model. Show it as an estimate, not a simulation.
    return { label: 'تقدير مبني على بيانات حقيقية', labelClass: 'bg-amber-900/40 text-amber-400' };
  }
  // No date → purely synthetic model
  return { label: 'نموذج تقريبي', labelClass: 'bg-slate-700/60 text-slate-400' };
}

/** Returns true if this scene UID appears to be the most recent (by date) */
export function selectBestScene(scenes: { scene_uid: string; acquisition_date?: string; data_is_real?: boolean }[]): string | null {
  if (!scenes.length) return null;
  // Prefer real data, then most recent acquisition_date
  const sorted = [...scenes].sort((a, b) => {
    const aReal = a.data_is_real ? 1 : 0;
    const bReal = b.data_is_real ? 1 : 0;
    if (bReal !== aReal) return bReal - aReal;
    const aDate = a.acquisition_date ?? '';
    const bDate = b.acquisition_date ?? '';
    return bDate.localeCompare(aDate);
  });
  return sorted[0]?.scene_uid ?? null;
}

// ─── Sensor type information ──────────────────────────────────────────────────

export interface SensorInfo {
  /** نوع المستشعر بالعربية — مثال: بصري متعدد الأطياف */
  typeAr:        string;
  /** وصف مختصر جداً */
  shortDesc:     string;
  /** ماذا يصلح لـ */
  usesAr:        string[];
  /** الدقة المكانية */
  resolutionAr:  string;
  /** عدد الأطياف */
  bandsAr:       string;
  /** هل يخترق الغيوم؟ */
  allWeather:    boolean;
  /** لون الشارة */
  badgeClass:    string;
  /** رمز بسيط */
  icon:          string;
}

/**
 * ترجمة اسم القمر الصناعي إلى معلومات المستشعر الواضحة.
 * يعمل على pixel_type أو scene_uid.
 */
export function parseSensorInfo(uid: string, pixelType?: string): SensorInfo {
  const src = (pixelType ?? uid).toUpperCase();

  if (/SENTINEL-?1|S1[AB]/.test(src)) {
    return {
      typeAr:       'رادار SAR',
      shortDesc:    'يخترق الغيوم والظلام — مثالي للفيضانات والتغير الأرضي',
      usesAr:       ['رصد الفيضانات', 'تشوه الأرض (InSAR)', 'ساعات الليل', 'خلف الغيوم'],
      resolutionAr: '10 متر',
      bandsAr:      'C-Band (5.4 GHz)',
      allWeather:   true,
      badgeClass:   'bg-purple-900/60 text-purple-300 border border-purple-700/40',
      icon:         '📡',
    };
  }

  if (/LANDSAT-?[89]|LC0?[89]/.test(src)) {
    return {
      typeAr:       'بصري + حراري',
      shortDesc:    'رؤية بصرية مع قناة حرارية لقياس درجات الحرارة السطحية',
      usesAr:       ['درجات الحرارة السطحية', 'الجفاف', 'التوسع العمراني', 'المياه'],
      resolutionAr: '30 متر (بصري) · 100 متر (حراري)',
      bandsAr:      '11 طيفاً (مرئي + NIR + SWIR + حراري)',
      allWeather:   false,
      badgeClass:   'bg-orange-900/60 text-orange-300 border border-orange-700/40',
      icon:         '🌡️',
    };
  }

  // Default: Sentinel-2 (S2A, S2B, S2C)
  return {
    typeAr:       'بصري متعدد الأطياف',
    shortDesc:    'صورة بصرية عالية الدقة — يتأثر بالغيوم',
    usesAr:       ['تغطية المدن والبنية', 'الغطاء النباتي', 'رصد المياه', 'تحليل التغيير'],
    resolutionAr: '10 متر',
    bandsAr:      '13 طيفاً (مرئي + NIR + SWIR)',
    allWeather:   false,
    badgeClass:   'bg-blue-900/60 text-blue-300 border border-blue-700/40',
    icon:         '🛰️',
  };
}
