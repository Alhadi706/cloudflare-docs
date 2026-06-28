export interface LibyaMunicipalityItem {
  key: string;
  labelEn: string;
  labelAr: string;
  /** Approximate center — used as Nominatim viewbox to avoid wrong-area matches */
  lon?: number;
  lat?: number;
  queries?: string[];
}

export const LIBYA_MUNICIPALITIES: LibyaMunicipalityItem[] = [
  { key: 'libya',        labelEn: 'Libya',           labelAr: 'ليبيا',          lon: 17.0,  lat: 27.0,  queries: ['Libya'] },
  { key: 'tripoli',      labelEn: 'Tripoli',          labelAr: 'طرابلس',         lon: 13.18, lat: 32.9,  queries: ['Tripoli Municipality, Libya', 'بلدية طرابلس ليبيا', 'Tripoli, Libya'] },
  { key: 'jafara',       labelEn: 'Al Jafara',        labelAr: 'الجفارة',        lon: 12.85, lat: 32.45, queries: ['Al Jafara District, Libya', 'الجفارة ليبيا'] },
  { key: 'zawiya',       labelEn: 'Az Zawiyah',       labelAr: 'الزاوية',        lon: 12.73, lat: 32.75, queries: ['Az Zawiyah Municipality, Libya', 'الزاوية ليبيا'] },
  { key: 'murqub',       labelEn: 'Al Marqab',        labelAr: 'المرقب',         lon: 14.0,  lat: 32.5,  queries: ['Al Marqab District, Libya', 'المرقب ليبيا'] },
  { key: 'misrata',      labelEn: 'Misrata',          labelAr: 'مصراتة',         lon: 15.09, lat: 32.37, queries: ['Misrata Municipality, Libya', 'بلدية مصراتة ليبيا', 'Misrata District, Libya'] },
  { key: 'zliten',       labelEn: 'Zliten',           labelAr: 'زليتن',          lon: 14.57, lat: 32.47, queries: ['Zliten Municipality, Libya', 'زليتن ليبيا'] },
  { key: 'nalut',        labelEn: 'Nalut',            labelAr: 'نالوت',          lon: 10.98, lat: 31.87, queries: ['Nalut District, Libya', 'نالوت ليبيا'] },
  { key: 'jabal_gharbi', labelEn: 'Jabal al Gharbi',  labelAr: 'الجبل الغربي',   lon: 12.8,  lat: 31.5,  queries: ['Jabal al Gharbi District, Libya', 'الجبل الغربي ليبيا'] },
  { key: 'sirte',        labelEn: 'Sirte',            labelAr: 'سرت',            lon: 16.59, lat: 31.21, queries: ['Sirte Municipality, Libya', 'بلدية سرت ليبيا', 'Surt District, Libya'] },
  { key: 'jufra',        labelEn: 'Al Jufra',         labelAr: 'الجفرة',         lon: 15.9,  lat: 29.1,  queries: ['Al Jufra District, Libya', 'الجفرة ليبيا', 'Jufra, Libya'] },
  { key: 'benghazi',     labelEn: 'Benghazi',         labelAr: 'بنغازي',         lon: 20.07, lat: 32.12, queries: ['Benghazi Municipality, Libya', 'بلدية بنغازي ليبيا', 'Benghazi, Libya'] },
  { key: 'marj',         labelEn: 'Al Marj',          labelAr: 'المرج',          lon: 20.83, lat: 32.5,  queries: ['Al Marj District, Libya', 'المرج ليبيا'] },
  { key: 'jabal_akhdar', labelEn: 'Jabal al Akhdar',  labelAr: 'الجبل الأخضر',   lon: 21.7,  lat: 32.7,  queries: ['Jabal al Akhdar District, Libya', 'الجبل الأخضر ليبيا'] },
  { key: 'beida',        labelEn: 'Al Bayda',         labelAr: 'البيضاء',        lon: 21.75, lat: 32.76, queries: ['Al Bayda Municipality, Libya', 'البيضاء ليبيا', 'Bayda, Libya'] },
  { key: 'derna',        labelEn: 'Derna',            labelAr: 'درنة',           lon: 22.64, lat: 32.76, queries: ['Derna Municipality, Libya', 'درنة ليبيا', 'Derna District, Libya'] },
  { key: 'tobruk',       labelEn: 'Tobruk',           labelAr: 'طبرق',           lon: 23.98, lat: 32.08, queries: ['Tobruk Municipality, Libya', 'طبرق ليبيا'] },
  { key: 'wahat',        labelEn: 'Al Wahat',         labelAr: 'الواحات',        lon: 21.5,  lat: 29.5,  queries: ['Al Wahat District, Libya', 'الواحات ليبيا'] },
  { key: 'kufra',        labelEn: 'Al Kufrah',        labelAr: 'الكفرة',         lon: 23.3,  lat: 24.2,  queries: ['Al Kufrah District, Libya', 'الكفرة ليبيا'] },
  { key: 'sebha',        labelEn: 'Sabha',            labelAr: 'سبها',           lon: 14.43, lat: 27.04, queries: ['Sabha Municipality, Libya', 'سبها ليبيا', 'Sebha District, Libya'] },
  { key: 'ubari',        labelEn: 'Ubari',            labelAr: 'أوباري',         lon: 12.82, lat: 26.59, queries: ['Ubari District, Libya', 'أوباري ليبيا'] },
  { key: 'murzuq',       labelEn: 'Murzuq',           labelAr: 'مرزق',           lon: 13.92, lat: 25.92, queries: ['Murzuq District, Libya', 'مرزق ليبيا'] },
  { key: 'ghat',         labelEn: 'Ghat',             labelAr: 'غات',            lon: 10.18, lat: 24.96, queries: ['Ghat District, Libya', 'غات ليبيا'] },
  { key: 'wadi_shati',   labelEn: 'Wadi al Shatii',   labelAr: 'وادي الشاطئ',    lon: 13.37, lat: 27.5,  queries: ['Wadi al Shatii District, Libya', 'وادي الشاطئ ليبيا'] },
];

export function getMunicipalityLookup(): Record<string, { label: string; lon?: number; lat?: number; queries?: string[] }> {
  return LIBYA_MUNICIPALITIES.reduce<Record<string, { label: string; lon?: number; lat?: number; queries?: string[] }>>((acc, item) => {
    acc[item.key] = {
      label: item.labelEn,
      ...(item.lon !== undefined ? { lon: item.lon } : {}),
      ...(item.lat !== undefined ? { lat: item.lat } : {}),
      ...(item.queries ? { queries: item.queries } : {}),
    };
    return acc;
  }, {});
}
