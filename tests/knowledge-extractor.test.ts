import test from 'node:test';
import assert from 'node:assert/strict';
import { extractKnowledgeFromText, estimateHealthScore } from '@/lib/knowledge/extractor';

test('extractKnowledgeFromText captures timeline events and component hints', () => {
  const text = `
في سنة 2017 تم تغيير رينق المضخة بعد ظهور تآكل عالي.
في سنة 2022 كشف الفحص أن المعدة تعمل بشكل جيد.
في سنة 2025 تم استبدال مقياس الضغط.
`;

  const out = extractKnowledgeFromText(text);
  assert.ok(out.events.length >= 3);
  assert.ok(out.events.some((e) => e.eventYear === 2017 && e.component === 'ring'));
  assert.ok(out.events.some((e) => e.eventYear === 2025 && e.component === 'gauge'));
});

test('estimateHealthScore reacts to high corrosion and replacements', () => {
  const score = estimateHealthScore([
    { eventType: 'corrosion_observation', severity: 'high' },
    { eventType: 'replacement', severity: null },
    { eventType: 'inspection', severity: null },
  ]);
  assert.ok(score <= 80);
  assert.ok(score >= 30);
});
