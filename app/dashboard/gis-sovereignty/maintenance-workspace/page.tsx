'use client';

import { GisMapShell } from '../components/GisMapShell';
import { GisErrorBoundary } from '../components/GisErrorBoundary';

export default function GisMaintenanceWorkspacePage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مساحة الصيانة الجغرافية">
      <GisMapShell
        mode="maintenance"
        title="مساحة الصيانة الجغرافية"
        subtitle="فرق الصيانة، الأصول، وأوامر العمل على خريطة موحدة"
      />
    </GisErrorBoundary>
  );
}
