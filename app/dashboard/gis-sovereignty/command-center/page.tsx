'use client';

import { GisMapShell } from '../components/GisMapShell';
import { GisErrorBoundary } from '../components/GisErrorBoundary';

export default function GisCommandCenterPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مركز القيادة التنفيذي">
      <GisMapShell
        mode="executive"
        title="مركز القيادة التنفيذي"
        subtitle="رؤية تنفيذية موحدة للمؤشرات الجغرافية الحرجة"
      />
    </GisErrorBoundary>
  );
}
