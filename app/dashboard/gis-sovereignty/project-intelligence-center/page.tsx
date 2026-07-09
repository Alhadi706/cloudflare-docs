'use client';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import PICShell from './components/PICShell';

export default function ProjectIntelligenceCenterPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مركز استخبارات المشاريع">
      <PICShell />
    </GisErrorBoundary>
  );
}
