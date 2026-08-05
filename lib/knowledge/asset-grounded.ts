export type BriefDocument = {
  id: string;
  title?: string;
  doc_type?: string;
  file_url?: string;
  created_at?: string;
  uploaded_by?: string;
  department?: string;
};

export type AssetCenterBriefInput = {
  assetId: string;
  asset: Record<string, any>;
  documents: BriefDocument[];
  employees: Array<Record<string, any>>;
  financial_summary?: {
    grand_total?: number;
    currency?: string;
  };
  doc_counts?: {
    total?: number;
  };
};

export type GroundedSource = {
  ref: string;
  type: 'record' | 'document';
  title: string;
  url: string;
  note?: string;
  created_at?: string;
};

export type GroundedBrief = {
  answer: string;
  sources: GroundedSource[];
  sentences: Array<{
    id: string;
    text: string;
    source_refs: string[];
    priority: 'core' | 'support' | 'audit';
  }>;
  generated_at: string;
};

function asText(value: unknown, fallback = 'غير متاح'): string {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(value?: string): string {
  if (!value) return 'غير متاح';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Date(ts).toLocaleDateString('ar-LY');
}

export function buildAssetGroundedBrief(input: AssetCenterBriefInput): GroundedBrief {
  const sources: GroundedSource[] = [];

  const addSource = (source: Omit<GroundedSource, 'ref'>): string => {
    const existing = sources.find((s) => s.url === source.url && s.title === source.title);
    if (existing) return existing.ref;
    const ref = `S${sources.length + 1}`;
    sources.push({ ref, ...source });
    return ref;
  };

  const centerRef = addSource({
    type: 'record',
    title: 'سجل الأصل المهيكل',
    url: `/api/v1/workspace/assets/${encodeURIComponent(input.assetId)}/center`,
    note: 'المصدر البنيوي الأساسي لبيانات الأصل',
  });

  const sortedDocs = [...(input.documents || [])].sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0;
    const bTs = b.created_at ? Date.parse(b.created_at) : 0;
    return bTs - aTs;
  });

  const topDocs = sortedDocs.filter((d) => !!d.file_url).slice(0, 5);
  const topDocRefs = topDocs.map((doc) =>
    addSource({
      type: 'document',
      title: asText(doc.title || doc.id),
      url: asText(doc.file_url, '#'),
      note: `نوع الوثيقة: ${asText(doc.doc_type, 'other')}`,
      created_at: doc.created_at,
    })
  );

  const name = asText(input.asset?.asset_name || input.asset?.name);
  const classification = asText(input.asset?.classification || input.asset?.asset_type);
  const status = asText(input.asset?.handover_status || input.asset?.status);
  const owner = asText(input.asset?.owner_department || input.asset?.owning_department);
  const docCount = asNumber(input.doc_counts?.total, sortedDocs.length);
  const employeeCount = Array.isArray(input.employees) ? input.employees.length : 0;
  const grandTotal = asNumber(input.financial_summary?.grand_total, 0);
  const currency = asText(input.financial_summary?.currency || 'LYD', 'LYD');

  const sentences: Array<{
    id: string;
    text: string;
    source_refs: string[];
    priority: 'core' | 'support' | 'audit';
  }> = [];

  sentences.push({
    id: 'overview',
    text: `ملخص الأصل: ${name} (${classification}).`,
    source_refs: [centerRef],
    priority: 'core',
  });

  sentences.push({
    id: 'status',
    text: `الحالة الحالية: ${status}، والجهة المالكة: ${owner}.`,
    source_refs: [centerRef],
    priority: 'core',
  });

  sentences.push({
    id: 'metrics',
    text: `مؤشرات فورية: ${docCount} وثيقة، ${employeeCount} مسؤول/موظف مرتبط، وإجمالي مالي ${grandTotal.toLocaleString('ar-LY')} ${currency}.`,
    source_refs: [centerRef],
    priority: 'support',
  });

  if (topDocs.length > 0) {
    const docHints = topDocs
      .map((d) => `${asText(d.title || d.id)} (${asText(d.doc_type, 'other')})`)
      .join('، ');
    sentences.push({
      id: 'docs',
      text: `أحدث المستندات الداعمة: ${docHints}.`,
      source_refs: topDocRefs,
      priority: 'support',
    });
  } else {
    sentences.push({
      id: 'docs-empty',
      text: 'لا توجد حالياً وثائق أصلية مرتبطة بهذا الأصل يمكن فتحها مباشرة.',
      source_refs: [],
      priority: 'support',
    });
  }

  sentences.push({
    id: 'audit-note',
    text: 'ملاحظة تدقيقية: هذا النص مؤسس فقط على السجلات والمرفقات المرتبطة، وليس توليداً حراً بدون مصادر.',
    source_refs: [centerRef],
    priority: 'audit',
  });

  const lines = sentences.map((s) => {
    if (!s.source_refs.length) return s.text;
    return `${s.text} [${s.source_refs.join(', ')}]`;
  });

  return {
    answer: lines.join('\n'),
    sources,
    sentences,
    generated_at: new Date().toISOString(),
  };
}

export function buildAttachmentPacket(input: AssetCenterBriefInput): {
  title: string;
  asset_id: string;
  generated_at: string;
  attachments: Array<{
    index: number;
    title: string;
    doc_type: string;
    created_at: string;
    url: string;
  }>;
  checklist_text: string;
} {
  const docs = [...(input.documents || [])]
    .filter((d) => !!d.file_url)
    .sort((a, b) => {
      const aTs = a.created_at ? Date.parse(a.created_at) : 0;
      const bTs = b.created_at ? Date.parse(b.created_at) : 0;
      return bTs - aTs;
    });

  const attachments = docs.map((d, i) => ({
    index: i + 1,
    title: asText(d.title || d.id),
    doc_type: asText(d.doc_type, 'other'),
    created_at: formatDate(d.created_at),
    url: asText(d.file_url, '#'),
  }));

  const checklistLines = [
    `قائمة إرفاق للأصل: ${asText(input.asset?.asset_name || input.assetId)}`,
    `Asset ID: ${input.assetId}`,
    `تاريخ الإنشاء: ${new Date().toLocaleString('ar-LY')}`,
    '---',
    ...attachments.map((a) => `${a.index}. [ ] ${a.title} | ${a.doc_type} | ${a.created_at} | ${a.url}`),
  ];

  return {
    title: `Attachment Packet - ${asText(input.asset?.asset_name || input.assetId)}`,
    asset_id: input.assetId,
    generated_at: new Date().toISOString(),
    attachments,
    checklist_text: checklistLines.join('\n'),
  };
}
