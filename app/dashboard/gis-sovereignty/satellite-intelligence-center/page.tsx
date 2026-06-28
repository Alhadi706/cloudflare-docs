'use client';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import SatelliteIntelLegacyShell from './components/SatelliteIntelLegacyShell';

export default function SatelliteIntelligenceCenterPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مركز الاستخبارات الفضائية">
      <SatelliteIntelLegacyShell />
    </GisErrorBoundary>
  );
}
