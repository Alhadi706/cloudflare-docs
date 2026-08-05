import { NextRequest, NextResponse } from 'next/server';
import { extractKnowledgeFromText, estimateHealthScore } from '@/lib/knowledge/extractor';
import { listKnowledgeEvents, listKnowledgeSources } from '@/lib/knowledge/store';
import { resolveTenantIdFromRequest } from '@/lib/knowledge/http';

export const runtime = 'nodejs';

type RefItem = {
  ref: string;
  source_id: string;
  title: string;
  file_url: string;
  doc_type: string;
  extraction_status: string;
};

function buildRefMap(sources: Array<any>): { refs: RefItem[]; bySourceId: Map<string, RefItem> } {
  const refs: RefItem[] = [];
  const bySourceId = new Map<string, RefItem>();

  for (const src of sources) {
    const ref: RefItem = {
      ref: `S${refs.length + 1}`,
      source_id: String(src.id),
      title: String(src.title || src.id || 'document'),
      file_url: String(src.file_url || '#'),
      doc_type: String(src.doc_type || 'other'),
      extraction_status: String(src.extraction_status || 'pending'),
    };
    refs.push(ref);
    bySourceId.set(String(src.id), ref);
  }

  return { refs, bySourceId };
}

function isHealthQuestion(q: string): boolean {
  return /(health|حالة|صحة|تآكل|corrosion|risk|مخاطر)/i.test(q);
}

function isMaintenanceTimelineQuestion(q: string): boolean {
  return /(صيانة|maintenance|timeline|تاريخ|سنة|order|أوامر|استبدال|تغيير)/i.test(q);
}

function isRingChangeQuestion(q: string): boolean {
  return /(رينق|ring|gasket)/i.test(q) && /(تغيير|replace|استبدال|change)/i.test(q);
}

function sentenceForEvent(ev: any): string {
  const year = ev.event_year ? `في سنة ${ev.event_year}` : 'في تاريخ غير محدد';
  const comp = ev.component ? ` (${ev.component})` : '';
  const sev = ev.severity ? ` [severity=${ev.severity}]` : '';
  return `${year} تم تسجيل ${ev.event_type}${comp}${sev}: ${String(ev.evidence_text || '').slice(0, 180)}`;
}

function topEvidenceLines(text: string, keywordRegex: RegExp, limit = 4): string[] {
  const lines = String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const line of lines) {
    if (keywordRegex.test(line.toLowerCase())) {
      out.push(line.slice(0, 220));
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function POST(req: NextRequest, { params }: { params: { assetId: string } }) {
  try {
    const tenantId = resolveTenantIdFromRequest(req);
    const assetId = String(params.assetId || '').trim();
    if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant_id_required' }, { status: 400 });
    if (!assetId) return NextResponse.json({ ok: false, error: 'asset_id_required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || '').trim();
    if (!question) return NextResponse.json({ ok: false, error: 'question_required' }, { status: 400 });

    const [sources, events] = await Promise.all([
      listKnowledgeSources(tenantId, assetId),
      listKnowledgeEvents(tenantId, assetId),
    ]);

    const { refs, bySourceId } = buildRefMap(sources);

    if (sources.length === 0) {
      return NextResponse.json({
        ok: true,
        answer: 'لا توجد بعد مصادر معرفة مهيكلة لهذا الأصل. شغّل ingestion أولاً ثم أعد السؤال.',
        references: [],
        health_score: null,
        events_count: 0,
      });
    }

    const answerLines: string[] = [];
    const evidenceRefs = new Set<string>();

    if (isMaintenanceTimelineQuestion(question)) {
      const timeline = [...events]
        .sort((a, b) => {
          const ay = Number(a.event_year || 0);
          const by = Number(b.event_year || 0);
          if (ay === by) return 0;
          return ay - by;
        })
        .slice(-12);

      if (timeline.length > 0) {
        answerLines.push('التسلسل الصياني المستخرج من السجلات:');
        for (const ev of timeline) {
          answerLines.push(`- ${sentenceForEvent(ev)}`);
          const ref = bySourceId.get(String(ev.source_id));
          if (ref) evidenceRefs.add(ref.ref);
        }
      } else {
        answerLines.push('لا توجد أحداث صيانة مستخرجة حتى الآن من النصوص المتاحة.');
      }
    }

    if (isHealthQuestion(question)) {
      const score = estimateHealthScore(events.map((e) => ({ eventType: e.event_type, severity: e.severity })));
      answerLines.push(`تقدير صحة الأصل الحالي (مبني على الوقائع المستخرجة فقط): ${score}%.`);
      if (events.some((e) => String(e.severity || '') === 'high')) {
        answerLines.push('يوجد سجل يذكر تآكل عالي؛ يُنصح بفحص ميداني قبل اتخاذ قرار نهائي.');
      }
    }

    if (isRingChangeQuestion(question)) {
      const manualSources = sources.filter((s) => ['manual', 'technical', 'drawing', 'other'].includes(String(s.doc_type || '')) && s.content_text);
      const tools = new Set<string>();
      const safety = new Set<string>();
      const ringEvidence: string[] = [];

      for (const src of manualSources) {
        const txt = String(src.content_text || '');
        const ext = extractKnowledgeFromText(txt);
        ext.tools.forEach((t) => tools.add(t));
        ext.safety.forEach((s) => safety.add(s));
        const lines = topEvidenceLines(txt, /(رينق|ring|gasket|seal)/i, 2);
        if (lines.length > 0) {
          ringEvidence.push(...lines);
          const ref = bySourceId.get(String(src.id));
          if (ref) evidenceRefs.add(ref.ref);
        }
      }

      answerLines.push('إرشادات تغيير الرينق من الوثائق المتاحة:');
      if (tools.size > 0) {
        answerLines.push(`- الأدوات المذكورة: ${Array.from(tools).slice(0, 8).join(' | ')}`);
      } else {
        answerLines.push('- الأدوات: لا توجد قائمة أدوات صريحة مستخرجة، يلزم توثيق أفضل من الكتيب.');
      }

      if (safety.size > 0) {
        answerLines.push(`- احتياطات السلامة: ${Array.from(safety).slice(0, 8).join(' | ')}`);
      } else {
        answerLines.push('- السلامة: لا توجد قائمة سلامة صريحة مستخرجة، يلزم إدخال نص السلامة من الكتيب.');
      }

      if (ringEvidence.length > 0) {
        answerLines.push('- مقتطفات داعمة:');
        ringEvidence.slice(0, 5).forEach((line) => answerLines.push(`  • ${line}`));
      }
    }

    if (answerLines.length === 0) {
      answerLines.push('تم العثور على بيانات معرفة مخزنة، لكن السؤال غير محدد كفاية.');
      answerLines.push('جرّب صياغة مثل: "ملخص الصيانة التاريخي" أو "ما صحة الأصل؟" أو "تعليمات تغيير الرينق".');
    }

    const references = refs.filter((r) => evidenceRefs.has(r.ref));

    return NextResponse.json({
      ok: true,
      asset_id: assetId,
      question,
      answer: answerLines.join('\n'),
      references,
      health_score: isHealthQuestion(question)
        ? estimateHealthScore(events.map((e) => ({ eventType: e.event_type, severity: e.severity })))
        : null,
      events_count: events.length,
      sources_count: sources.length,
      note: 'الرد مبني فقط على البيانات المستخرجة المخزنة. لا يتم توليد وقائع غير موجودة.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'ask_failed' }, { status: 500 });
  }
}
