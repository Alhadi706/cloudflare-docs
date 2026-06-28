// ─────────────────────────────────────────────────────────────
// Daily Operations – Station Configuration & Design Values
// إعدادات المحطات والقيم التصميمية المرجعية
// ─────────────────────────────────────────────────────────────

export const PUMP_STATION_CONFIG = [
  {
    id: 'nejh_n' as const,
    nameEn: 'NEJH(n)',
    nameAr: 'NEJH (الشمالية)',
    designOutletPressure: 9.1,  // bar – from design file
    maxPumps: 4,
    warnPressureLow: 8.5,
    warnPressureHigh: 10.0,
  },
  {
    id: 'nejh_s' as const,
    nameEn: 'NEJH(s)',
    nameAr: 'NEJH (الجنوبية)',
    designOutletPressure: 6.9,
    maxPumps: 2,
    warnPressureLow: 6.5,
    warnPressureHigh: 7.5,
  },
  {
    id: 'ejh' as const,
    nameEn: 'EJH',
    nameAr: 'EJH',
    designOutletPressure: 6.9,
    maxPumps: 4,
    warnPressureLow: 6.5,
    warnPressureHigh: 7.5,
  },
] as const;

export type PumpStationId = typeof PUMP_STATION_CONFIG[number]['id'];

/** Eastern Branch – الفرع الشرقي */
export const EASTERN_CONFIG = [
  {
    id: 'ashShwayrifFCS' as const,
    nameEn: 'Ash Shwayrif FCS',
    nameAr: 'محطة تحكم الشويرف',
    valveLabels: ['51%', '71%', '81%', '91%'],
    hasLevel: true,
    hasInletPressure: true,
    hasOutletPressure: false,
    hasPumps: false,
    designInletPressure: 5.0,
  },
  {
    id: 'sidiSaiahFCS' as const,
    nameEn: 'Sidi Saiah FCS',
    nameAr: 'محطة تحكم سيدي سعية',
    valveLabels: ['1', '2', '3'],
    hasLevel: false,
    hasInletPressure: true,
    hasOutletPressure: true,
    hasPumps: false,
    designInletPressure: 5.4,
    designOutletPressure: 3.84,
  },
  {
    id: 'garabulliFT' as const,
    nameEn: 'Garabulli R.T',
    nameAr: 'خزان قرة بولي',
    valveLabels: [] as string[],
    hasLevel: true,
    hasInletPressure: false,
    hasOutletPressure: false,
    hasPumps: false,
  },
  {
    id: 'wadiTumallahFCS' as const,
    nameEn: 'Wadi Tumallah FCS',
    nameAr: 'محطة تحكم وادي تميلة',
    valveLabels: ['1', '2', '3'],
    hasLevel: true,
    hasInletPressure: true,
    hasOutletPressure: true,
    hasPumps: false,
    designInletPressure: 5.4,
  },
  {
    id: 'airportFCV' as const,
    nameEn: 'Air Port FCV',
    nameAr: 'صمام تحكم المطار',
    valveLabels: ['%'],
    hasLevel: false,
    hasInletPressure: true,
    hasOutletPressure: false,
    hasPumps: false,
  },
] as const;

export type EasternId = typeof EASTERN_CONFIG[number]['id'];

/** Central Branch – الفرع الأوسطى */
export const CENTRAL_CONFIG = [
  {
    id: 'crossConnections' as const,
    nameEn: 'Cross Connections FCV',
    nameAr: 'وصلات التقاطع',
    valveLabels: ['1', '2', '3'],
    hasLevel: false,
    hasInletPressure: true,
    hasOutletPressure: true,
    hasPumps: false,
    designInletPressure: 5.4,
  },
  {
    id: 'sidiSiedRT' as const,
    nameEn: 'Sidi Sied R.T',
    nameAr: 'خزان سيدي سيد',
    valveLabels: [] as string[],
    hasLevel: true,
    hasInletPressure: false,
    hasOutletPressure: false,
    hasPumps: false,
  },
  {
    id: 'tarhunah' as const,
    nameEn: 'Tarhunah R.T & Pump Station',
    nameAr: 'خزان ترهونة ومحطة الضخ',
    valveLabels: [] as string[],
    hasLevel: true,
    hasInletPressure: false,
    hasOutletPressure: true,
    hasPumps: true,
    designOutletPressure: 3.1,
  },
  {
    id: 'ashShwayrifCentral' as const,
    nameEn: 'Ash Shwayrif FCS (Central)',
    nameAr: 'محطة تحكم الشويرف (الوسطى)',
    valveLabels: ['40%', '45%', '48%', '50%'],
    hasLevel: true,
    hasInletPressure: true,
    hasOutletPressure: false,
    hasPumps: false,
    designInletPressure: 5.4,
  },
] as const;

export type CentralId = typeof CENTRAL_CONFIG[number]['id'];

/** Consumption Areas – مناطق الاستهلاك (الكميات التصميمية م³/يوم) */
export const CONSUMPTION_AREAS = [
  { id: 'shorouk',          nameAr: 'الشروق',                        designQty: 20000 },
  { id: 'morh3',            nameAr: 'المرحلة الثالثة (الافتراضية)',  designQty: 20000 },
  { id: 'msrata_tebna',     nameAr: 'مصراتة – طبينة',               designQty: 120000 },
  { id: 'zelten',           nameAr: 'زليتن',                         designQty: 30000 },
  { id: 'souk_khamis',      nameAr: 'سوق الخميس – القصبات',         designQty: 20000 },
  { id: 'khamis_tasbi',     nameAr: 'الخمس – التصبيات',             designQty: 20000 },
  { id: 'alhoush_ghina',    nameAr: 'الحوض – غينية',                designQty: 4000 },
  { id: 'qasr_khiar',       nameAr: 'قصر الخيار',                    designQty: 2000 },
  { id: 'qaroboli',         nameAr: 'القرو بولي',                    designQty: 20000 },
  { id: 'tripoli',          nameAr: 'طرابلس',                        designQty: 430000 },
  { id: 'bni_walid',        nameAr: 'بني وليد',                      designQty: 40000 },
  { id: 'trhouna_mussalata',nameAr: 'ترهونة المقيع – المصيد',       designQty: 20000 },
  { id: 'gharian_madnj',    nameAr: 'غريان – مدنج الجبل',           designQty: 115200 },
  { id: 'alrabta',          nameAr: 'الرابطة',                       designQty: 5000 },
  { id: 'trhouna_zerai',    nameAr: 'مشروع ترهونة الزراعي',         designQty: 20000 },
  { id: 'abohashisha_zerai',nameAr: 'مشروع أبوهشيشة الزراعي',      designQty: 40000 },
  { id: 'ghina_asbatani',   nameAr: 'مشروع غينة الزراعي الأسباطاني',designQty: 20000 },
  { id: 'forouj_zerai',     nameAr: 'مشروع الفروج الزراعي',         designQty: 10000 },
  { id: 'sana3_zerai',      nameAr: 'مشروع الساناع الزراعي',        designQty: 20000 },
  { id: 'masna3_52',        nameAr: 'مصنع (52) والقاعدة البحرية',   designQty: 3000 },
  { id: 'masna3_rabta',     nameAr: 'مصنع الرابطة',                  designQty: 500 },
  { id: 'khazanat_saqaya',  nameAr: 'خزانات السقاية',               designQty: 1500 },
];
