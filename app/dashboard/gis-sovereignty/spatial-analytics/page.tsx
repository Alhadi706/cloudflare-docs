'use client';

import { GisMapShell } from '../components/GisMapShell';
import { GisErrorBoundary } from '../components/GisErrorBoundary';

export default function GisSpatialAnalyticsPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل التحليل المكاني">
      <GisMapShell
        mode="spatial"
        title="التحليل المكاني"
        subtitle="بيئة تحليل متقدمة مبنية على محرك الخرائط الموحد"
      />
    </GisErrorBoundary>
  );
}
