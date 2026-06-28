'use client';

import { GisMapShell } from '../components/GisMapShell';
import { GisErrorBoundary } from '../components/GisErrorBoundary';

export default function GisSatelliteMonitorPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مراقبة الأقمار الأولية">
      <GisMapShell
        mode="monitor"
        title="مراقبة الأقمار الأولية"
        subtitle="رؤية خام متعددة المصادر ضمن محرك الخرائط الموحد"
      />
    </GisErrorBoundary>
  );
}
