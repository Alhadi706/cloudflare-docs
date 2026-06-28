/**
 * دوال التنسيق الموحدة - الدينار الليبي والأرقام الغربية
 * Unified formatters for Libyan Dinar and Western Arabic numerals
 */

/**
 * تنسيق العملة الليبية
 * @param value القيمة الرقمية
 * @param showDecimals عرض الكسور العشرية
 * @param compact اختصار للأرقام الكبيرة (1.2M بدل 1,200,000)
 * @returns نص منسق بالدينار الليبي (د.ل)
 */
export function formatCurrency(
  value: number, 
  showDecimals: boolean = false,
  compact: boolean = false
): string {
  if (value === undefined || value === null) return '0 د.ل';
  
  // استخدام ar-LY للأرقام الغربية (0-9) بدلاً من الهندية (٠-٩)
  const formatted = new Intl.NumberFormat('ar-LY', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: compact ? 1 : (showDecimals ? 2 : 0),
    notation: compact ? 'compact' : 'standard'
  }).format(value);
  
  return `${formatted} د.ل`;
}

/**
 * تنسيق الأرقام بالفاصلة (بدون رمز عملة)
 * @param value القيمة الرقمية
 * @returns نص منسق بالأرقام الغربية مع فواصل
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (value === undefined || value === null) return '0';
  
  return new Intl.NumberFormat('ar-LY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * تنسيق التاريخ والوقت
 * @param dateString النص التاريخي
 * @returns تاريخ منسق بالعربية مع أرقام غربية
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-LY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

/**
 * تنسيق التاريخ والوقت معاً
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ar-LY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

/**
 * تنسيق النسبة المئوية
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (value === undefined || value === null) return '٠٪';
  
  return new Intl.NumberFormat('ar-LY', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100);
}
