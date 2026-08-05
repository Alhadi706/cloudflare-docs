type ExtractEvent = {
  eventYear?: number | null;
  eventType: string;
  component?: string | null;
  severity?: string | null;
  action?: string | null;
  evidenceText: string;
  confidence: number;
};

export type ExtractResult = {
  events: ExtractEvent[];
  tools: string[];
  safety: string[];
  summaryHints: string[];
};

function normalizeText(raw: string): string {
  return String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/[\u200f\u200e]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n\.؛!\?]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 600);
}

function detectComponent(sentence: string): string | null {
  const s = sentence.toLowerCase();
  if (/رينق|ring|gasket/.test(s)) return 'ring';
  if (/مقياس|gauge|meter/.test(s)) return 'gauge';
  if (/صمام|valve/.test(s)) return 'valve';
  if (/مضخ|pump/.test(s)) return 'pump';
  if (/انبوب|خط|pipe/.test(s)) return 'pipe';
  if (/فلتر|filter/.test(s)) return 'filter';
  return null;
}

function detectSeverity(sentence: string): string | null {
  const s = sentence.toLowerCase();
  if (/تآكل عالي|high corrosion|critical|حرج/.test(s)) return 'high';
  if (/تآكل متوسط|medium corrosion|warning|تحذير/.test(s)) return 'medium';
  if (/جيد|stable|normal|سليم/.test(s)) return 'low';
  return null;
}

function detectEventType(sentence: string): { type: string; action: string | null; confidence: number } | null {
  const s = sentence.toLowerCase();
  if (/تم تغيير|استبدال|replace|replaced/.test(s)) {
    return { type: 'replacement', action: 'replace_component', confidence: 0.86 };
  }
  if (/صيانة|maintenance|إصلاح|repair/.test(s)) {
    return { type: 'maintenance', action: 'maintenance_action', confidence: 0.8 };
  }
  if (/تآكل|corrosion/.test(s)) {
    return { type: 'corrosion_observation', action: 'corrosion_detected', confidence: 0.78 };
  }
  if (/كشف|inspection|فحص|اختبار/.test(s)) {
    return { type: 'inspection', action: 'inspection_result', confidence: 0.76 };
  }
  if (/شراء|توريد|purchase|procurement/.test(s)) {
    return { type: 'procurement', action: 'procurement_record', confidence: 0.75 };
  }
  return null;
}

function detectYear(sentence: string): number | null {
  const m = sentence.match(/(19\d{2}|20\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y)) return null;
  if (y < 1950 || y > 2100) return null;
  return y;
}

function extractListByHeading(text: string, headingRegex: RegExp): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const out: string[] = [];
  let capture = false;

  for (const line of lines) {
    if (!line) {
      if (capture) break;
      continue;
    }
    if (headingRegex.test(line.toLowerCase())) {
      capture = true;
      continue;
    }
    if (capture) {
      if (/^(\-|\*|\d+[\)\.-])\s+/.test(line) || /،/.test(line)) {
        out.push(line.replace(/^(\-|\*|\d+[\)\.-])\s+/, '').trim());
      } else if (out.length > 0) {
        break;
      }
    }
  }

  return Array.from(new Set(out)).slice(0, 20);
}

export function extractKnowledgeFromText(rawText: string): ExtractResult {
  const text = normalizeText(rawText);
  const sentences = splitSentences(text);
  const events: ExtractEvent[] = [];

  for (const sentence of sentences) {
    const kind = detectEventType(sentence);
    if (!kind) continue;

    const eventYear = detectYear(sentence);
    const component = detectComponent(sentence);
    const severity = detectSeverity(sentence);

    let confidence = kind.confidence;
    if (eventYear) confidence += 0.05;
    if (component) confidence += 0.04;
    if (severity) confidence += 0.03;
    if (confidence > 0.98) confidence = 0.98;

    events.push({
      eventYear,
      eventType: kind.type,
      component,
      severity,
      action: kind.action,
      evidenceText: sentence.slice(0, 500),
      confidence,
    });
  }

  const tools = extractListByHeading(text, /(الأدوات|tools|required tools|معدات)/i);
  const safety = extractListByHeading(text, /(السلامة|احتياطات|safety|precaution|ppe)/i);

  const summaryHints: string[] = [];
  if (events.some((e) => e.eventType === 'replacement')) summaryHints.push('تم رصد عمليات استبدال/تغيير موثقة.');
  if (events.some((e) => e.eventType === 'corrosion_observation' && e.severity === 'high')) {
    summaryHints.push('تم رصد مؤشرات تآكل عالية في بعض السجلات.');
  }
  if (events.some((e) => e.eventType === 'inspection')) summaryHints.push('يوجد سجل فحوصات/كشف دوري.');

  return {
    events,
    tools,
    safety,
    summaryHints,
  };
}

export function estimateHealthScore(events: Array<{ eventType: string; severity?: string | null }>): number {
  if (!Array.isArray(events) || events.length === 0) return 75;

  let score = 78;
  for (const ev of events) {
    if (ev.eventType === 'corrosion_observation') {
      if (ev.severity === 'high') score -= 18;
      else if (ev.severity === 'medium') score -= 10;
      else score -= 4;
    }
    if (ev.eventType === 'replacement') score += 6;
    if (ev.eventType === 'inspection') score += 3;
    if (ev.eventType === 'maintenance') score += 4;
  }

  if (score > 95) score = 95;
  if (score < 30) score = 30;
  return Math.round(score);
}
