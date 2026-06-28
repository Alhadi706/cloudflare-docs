// ─── Corrosion Module Constants ───────────────────────────────────────────────

export const API = '/api/v1/corrosion';

export const RLE_COLOR: Record<string, string> = {
  good:     'bg-emerald-900/30 border-emerald-600/40 text-emerald-300',
  moderate: 'bg-amber-900/30 border-amber-600/40 text-amber-300',
  severe:   'bg-red-900/30 border-red-600/40 text-red-300',
  unknown:  'bg-slate-800/60 border-slate-600/40 text-slate-400',
};

export const RISK_COLOR: Record<string, string> = {
  low:      'text-emerald-400',
  medium:   'text-amber-400',
  high:     'text-red-400',
  critical: 'text-red-500',
};

export const RISK_BG: Record<string, string> = {
  low:      'bg-emerald-900/20 border-emerald-500/30',
  medium:   'bg-amber-900/20 border-amber-500/30',
  high:     'bg-red-900/20 border-red-500/30',
  critical: 'bg-red-900/40 border-red-600/50',
};

export const TYPE_LABELS: Record<string, string> = {
  external_corrosion: 'تآكل خارجي',
  internal_corrosion: 'تآكل داخلي',
  coating_damage:     'تلف الطلاء',
  cp_deficiency:      'نقص الحماية الكاثودية',
};

export const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300',
  partial: 'bg-amber-900/30 border-amber-500/40 text-amber-300',
  error:   'bg-red-900/30 border-red-500/40 text-red-300',
};

export const CP_STATUS_CONFIG = {
  PROTECTED:     { label: 'محمية — NACE ≤ −850 mV',       color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-500/40', dot: '#10b981', bar: 'bg-emerald-500' },
  MARGINAL:      { label: 'هامشية — NACE −700↔−850 mV',   color: 'text-amber-400',   bg: 'bg-amber-900/30 border-amber-500/40',   dot: '#f59e0b', bar: 'bg-amber-500'   },
  NOT_PROTECTED: { label: 'غير محمية — NACE > −700 mV',   color: 'text-red-400',     bg: 'bg-red-900/30 border-red-500/40',       dot: '#ef4444', bar: 'bg-red-500'     },
  UNKNOWN:       { label: 'غير معروف',                     color: 'text-slate-400',   bg: 'bg-slate-800/60 border-slate-600/40',  dot: '#64748b', bar: 'bg-slate-600'   },
};

export const OVERALL_STATUS_CONFIG = {
  GOOD:     { label: 'جيد',    bg: 'bg-emerald-900/30 border-emerald-500/40', text: 'text-emerald-200', icon: '✅' },
  WARNING:  { label: 'تحذير', bg: 'bg-amber-900/30 border-amber-500/40',    text: 'text-amber-200',   icon: '⚠️' },
  CRITICAL: { label: 'خطير',  bg: 'bg-red-900/30 border-red-500/40',        text: 'text-red-200',     icon: '🚨' },
};

export const CHANGE_CONFIG: Record<string, { label: string; color: string }> = {
  stable:                    { label: 'مستقر',               color: 'text-slate-400' },
  improved:                  { label: '▲ تحسن',               color: 'text-emerald-400' },
  degraded:                  { label: '▼ تدهور',              color: 'text-amber-400' },
  degraded_to_not_protected: { label: '▼▼ تدهور — فقدان حماية NACE', color: 'text-red-400' },
  protection_loss:           { label: '⚠ فقدان حماية',      color: 'text-red-400' },
};

export const SEG_ACTION: Record<string, string> = {
  PROTECTED:     'استمرار المراقبة الدورية وفق NACE SP0169 — فحص سنوي مقبول',
  MARGINAL:      'مراقبة مكثفة وفق NACE SP0169 — إعادة فحص خلال 90 يوماً — مراجعة التيار المطبوع',
  NOT_PROTECTED: 'تدخل فوري وفق NACE SP0169 — مراجعة محولات التيار المطبوع وإعادة التأريض الجزئي',
  UNKNOWN:       'غير محدد — تحقق من اكتمال بيانات القياس',
};

export const SEG_RISK_LEVEL: Record<string, { label: string; color: string; bg: string }> = {
  PROTECTED:     { label: 'منخفض',      color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/30' },
  MARGINAL:      { label: 'متوسط',      color: 'text-amber-400',   bg: 'bg-amber-900/20 border-amber-500/30'   },
  NOT_PROTECTED: { label: 'عالٍ',       color: 'text-red-400',     bg: 'bg-red-900/20 border-red-500/30'       },
  UNKNOWN:       { label: 'غير معروف', color: 'text-slate-400',   bg: 'bg-slate-800 border-slate-700'         },
};

export const CP_RISK_EXPLANATIONS = {
  PROTECTED:     'الجهد أقل من −850 mV — حماية كاثودية كاملة وفق معيار NACE SP0169',
  MARGINAL:      'الجهد بين −700 و −850 mV — حماية هامشية وفق NACE SP0169، يُوصى بمراجعة نظام CP خلال 90 يوماً',
  NOT_PROTECTED: 'الجهد أعلى من −700 mV — لا توجد حماية كاثودية فعالة وفق NACE SP0169، خطر تآكل مباشر',
};

export const SCENARIOS = [
  {
    id: 'delay',
    icon: '⏳',
    title: 'تأجيل الصيانة 6 أشهر',
    color: 'border-amber-500/30 bg-amber-900/15',
    headerColor: 'text-amber-300',
    technical:    'احتمالية توسع المقاطع الهامشية إلى غير محمية بمعدل 25–40% وفق NACE SP0169',
    risk:         'ارتفاع منطقي في احتمالية الكسر الجزئي للغلاف الواقي في المناطق الحرجة',
    operational:  'لا توقف متوقع على المدى القصير — المراقبة المكثفة أسبوعياً إلزامية',
    budget:       'توفير مؤقت في التكاليف — لكن مخاطر تصعيد التكلفة في الفترة 7–12 شهر',
    cost_estimate_usd: null,
    cost_note:     'تكلفة العلاج التصاعدي 2–5× أعلى من التدخل المبكر',
    timeline_months: 6,
    risk_reduction_pct: 0,
    recommended:  false,
  },
  {
    id: 'partial',
    icon: '🔧',
    title: 'معالجة أسوأ المقاطع (NACE-targeted)',
    color: 'border-blue-500/30 bg-blue-900/15',
    headerColor: 'text-blue-300',
    technical:    'استهداف المقاطع غير المحمية (> −700 mV) — تحسين 65–75% من مناطق الخطر وفق NACE SP0169',
    risk:         'تخفيض فوري للمخاطر في النقاط الحرجة — المقاطع الهامشية تظل تحت المراقبة',
    operational:  'تعطل جزئي خلال فترة العمل على المقاطع المستهدفة فقط',
    budget:       'تكلفة متوسطة — توزيع ذكي للموارد بأعلى عائد من تخفيض المخاطر',
    cost_estimate_usd: null,
    cost_note:     'تقدير التكلفة يعتمد على طول المقاطع غير المحمية المكتشفة',
    timeline_months: 3,
    risk_reduction_pct: 70,
    recommended:  true,
  },
  {
    id: 'full',
    icon: '🚨',
    title: 'تدخل طارئ شامل — NACE Remediation',
    color: 'border-red-500/30 bg-red-900/15',
    headerColor: 'text-red-300',
    technical:    'إعادة تأهيل كاملة لنظام CP على طول الخط — فحص شامل لمحولات التيار المطبوع وإعادة تحقيق معيار NACE SP0169',
    risk:         'أقصى تخفيض للمخاطر — إعادة الخط إلى ≥80% محمية وفق NACE SP0169',
    operational:  'إيقاف مؤقت للخط أو تشغيل محدود خلال فترة التدخل',
    budget:       'أعلى تكلفة مباشرة — الأدنى كلياً على المدى البعيد',
    cost_estimate_usd: null,
    cost_note:     'تشمل: محولات CP + تأريض + فحص الغلاف + التوثيق NACE',
    timeline_months: 1,
    risk_reduction_pct: 95,
    recommended:  false,
  },
];
