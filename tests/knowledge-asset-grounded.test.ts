import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetGroundedBrief, buildAttachmentPacket } from '@/lib/knowledge/asset-grounded';

test('buildAssetGroundedBrief returns answer with source refs', () => {
  const out = buildAssetGroundedBrief({
    assetId: 'asset-1',
    asset: {
      asset_name: 'محطة ضخ 7',
      classification: 'pump_station',
      status: 'active',
      owner_department: 'operations',
    },
    documents: [
      {
        id: 'doc-1',
        title: 'محضر استلام نهائي',
        doc_type: 'admin',
        file_url: '/api/engineering/workspace/files/doc-1',
        created_at: '2026-08-01T10:00:00.000Z',
      },
    ],
    employees: [{ id: 'e1', employee_name: 'Ali' }],
    financial_summary: { grand_total: 120000, currency: 'LYD' },
    doc_counts: { total: 1 },
  });

  assert.equal(Array.isArray(out.sources), true);
  assert.ok(out.sources.length >= 2);
  assert.equal(Array.isArray(out.sentences), true);
  assert.ok(out.sentences.length >= 4);
  assert.ok(out.sentences.some((s) => Array.isArray(s.source_refs) && s.source_refs.length > 0));
  assert.match(out.answer, /\[S1\]/);
  assert.match(out.answer, /محطة ضخ 7/);
});

test('buildAttachmentPacket returns checklist with urls', () => {
  const out = buildAttachmentPacket({
    assetId: 'asset-2',
    asset: { asset_name: 'خزان توزيع 4' },
    documents: [
      {
        id: 'doc-a',
        title: 'مخطط تنفيذي',
        doc_type: 'drawing',
        file_url: '/api/engineering/workspace/files/doc-a',
        created_at: '2026-07-30T08:00:00.000Z',
      },
    ],
    employees: [],
  });

  assert.equal(out.attachments.length, 1);
  assert.match(out.checklist_text, /doc-a|مخطط تنفيذي/);
  assert.match(out.checklist_text, /\/api\/engineering\/workspace\/files\/doc-a/);
});
