'use client';
/**
 * GlobalMapBackground — الخريطة كطبقة صفرية دائمة خلف كل الـ dashboard
 * ═══════════════════════════════════════════════════════════════
 * تُعرض كـ fixed inset-0 z-0 خلف كل صفحات /dashboard بدون استثناء.
 * لا تظهر في /entry أو صفحات التسجيل.
 * يُحمَّل MapCenterCanvas ديناميكياً لتجنب SSR.
 */
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useGisEngine } from '@/store/gisEngine';

const MapCenterCanvas = dynamic(
  () => import('@/app/dashboard/gis-sovereignty/components/MapCenterCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-950" /> },
);

export default function GlobalMapBackground() {
  const setBasemap   = useGisEngine((s) => s.setBasemap);
  const setWorkspace = useGisEngine((s) => s.setWorkspace);
  const setCenter    = useGisEngine((s) => s.setCenter);
  const setZoom      = useGisEngine((s) => s.setZoom);

  // تهيئة المحرك بـ Libya view عند أول تحميل
  useEffect(() => {
    setBasemap('satellite');
    setWorkspace('satellite');
    setCenter([17.00, 26.00]);
    setZoom(5);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <MapCenterCanvas />
    </div>
  );
}
