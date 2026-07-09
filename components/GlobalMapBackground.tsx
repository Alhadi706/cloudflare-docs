'use client';
/**
 * GlobalMapBackground — الخريطة كطبقة صفرية دائمة خلف كل الـ dashboard
 * الأصول التشغيلية تظهر على هذه الخريطة لكل الإدارات
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

  useEffect(() => {
    setBasemap('satellite');
    setWorkspace('satellite');
    setCenter([16.00, 28.00]); // ليبيا
    setZoom(5.5);
    // Trigger assets layer refresh so operational assets show everywhere
    window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
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
