import { NextResponse } from 'next/server';

const MUNICIPALITIES = [
  { key: 'tripoli',     labelEn: 'Tripoli',     labelAr: 'طرابلس',     region: 'west' },
  { key: 'benghazi',    labelEn: 'Benghazi',    labelAr: 'بنغازي',     region: 'east' },
  { key: 'misrata',     labelEn: 'Misrata',     labelAr: 'مصراتة',     region: 'west' },
  { key: 'zawiya',      labelEn: 'Zawiya',      labelAr: 'الزاوية',    region: 'west' },
  { key: 'sabha',       labelEn: 'Sabha',       labelAr: 'سبها',       region: 'south' },
  { key: 'zliten',      labelEn: 'Zliten',      labelAr: 'زليتن',      region: 'west' },
  { key: 'bani_walid',  labelEn: 'Bani Walid',  labelAr: 'بني وليد',   region: 'west' },
  { key: 'kufra',       labelEn: 'Kufra',       labelAr: 'الكفرة',     region: 'south' },
  { key: 'derna',       labelEn: 'Derna',       labelAr: 'درنة',       region: 'east' },
  { key: 'tobruk',      labelEn: 'Tobruk',      labelAr: 'طبرق',       region: 'east' },
  { key: 'gharyan',     labelEn: 'Gharyan',     labelAr: 'غريان',      region: 'west' },
  { key: 'al_jufra',    labelEn: 'Al-Jufra',    labelAr: 'الجفرة',     region: 'central' },
  { key: 'murzuq',      labelEn: 'Murzuq',      labelAr: 'مرزق',       region: 'south' },
  { key: 'al_bayda',    labelEn: 'Al-Bayda',    labelAr: 'البيضاء',    region: 'east' },
  { key: 'sirte',       labelEn: 'Sirte',       labelAr: 'سرت',        region: 'central' },
];

export async function GET() {
  return NextResponse.json({ items: MUNICIPALITIES });
}
