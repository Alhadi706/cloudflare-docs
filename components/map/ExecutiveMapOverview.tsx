'use client';
/**
 * Executive Map Overview — read-only situational awareness map
 * Shows all executive-visible layers, alerts, hot areas, high-level summaries.
 * Suitable for GMs, presidents, executive board.
 * ⚠️ All markers and summary numbers are DEMO data until real projects are added.
 */
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Shield, Activity, AlertTriangle, CheckCircle, Info,
  TrendingUp, Map as MapIcon, RefreshCw, Maximize2,
} from 'lucide-react';
import { getExecutiveLayers, DEMO_MARKERS, MASTER_LAYERS } from '@/lib/masterMapConfig';

const SharedMasterMap = dynamic(() => import('./SharedMasterMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <MapIcon className="w-8 h-8 text-blue-400 animate-pulse" />
    </div>
  ),
});

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl p-3 bg-slate-800/60 border border-slate-700/40">
      <div className="text-[10px] text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ marker }: { marker: typeof DEMO_MARKERS[0] }) {
  const colors = { alert: 'text-red-400', warning: 'text-amber-400', active: 'text-emerald-400', info: 'text-blue-400' };
  const icons  = {
    alert:   <AlertTriangle className="w-3.5 h-3.5" />,
    warning: <AlertTriangle className="w-3.5 h-3.5" />,
    active:  <CheckCircle className="w-3.5 h-3.5" />,
    info:    <Info className="w-3.5 h-3.5" />,
  };
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs ${colors[marker.status]} bg-slate-800/40 border border-slate-700/30`}>
      {icons[marker.status]}
      <span className="flex-1 text-right">{marker.nameAr}</span>
      {marker.value && <span className="text-slate-500 text-[10px]">{marker.value}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ExecutiveMapOverviewProps {
  role?: 'executive' | 'admin';
}

export default function ExecutiveMapOverview({ role = 'executive' }: ExecutiveMapOverviewProps) {
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const execLayers   = getExecutiveLayers();
  const alertMarkers = DEMO_MARKERS.filter(m => m.status === 'alert' || m.status === 'warning');
  const activeMarkers = DEMO_MARKERS.filter(m => m.status === 'active');

  return (
    <div className={`flex flex-col bg-slate-950 ${fullscreen ? 'fixed inset-0 z-50' : 'h-full'}`} dir="rtl">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div>
          <h2 className="text-sm font-bold text-white">الخريطة التنفيذية الموحدة</h2>
          <p className="text-[10px] text-slate-400">نظرة عامة · قراءة فقط · جميع الإدارات</p>
        </div>

        {/* Status pills */}
        <div className="flex gap-2 mr-4 flex-wrap">
          {/* ⚠️ Demo data badge — always shown */}
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-400 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            بيانات تجريبية
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400">
            {execLayers.length} طبقة تنفيذية
          </span>
          {alertMarkers.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {alertMarkers.length} تنبيه تجريبي
            </span>
          )}
        </div>

        <button
          onClick={() => setFullscreen(v => !v)}
          className="mr-auto p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          title={fullscreen ? 'خروج من الشاشة الكاملة' : 'شاشة كاملة'}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map — takes the bulk of space */}
        <div className="flex-1 relative">
          <SharedMasterMap
            viewMode="executive"
            role={role}
            department="executive"
            onMarkerClick={m => setSelectedMarkerId(m.id)}
            className="w-full h-full"
          />
        </div>

        {/* ── Right summary panel ── */}
        <div className="w-64 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">ملخص تنفيذي</div>

            {/* Demo data warning */}
            <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <p className="text-[10px] text-amber-400 leading-snug">
                الأرقام أدناه <strong>تجريبية</strong> — ستُستبدل بالبيانات الحقيقية عند إضافة مشاريع
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SummaryCard label="مشاريع نشطة"   value="—"   color="#4ade80" sub="لا مشاريع بعد" />
              <SummaryCard label="تنبيهات"        value={alertMarkers.length} color="#f87171" sub="تجريبية" />
              <SummaryCard label="البلديات"       value={22}  color="#60a5fa" sub="نموذجي" />
              <SummaryCard label="الأصول"         value="—"   color="#fb923c" sub="لا أصول بعد" />
            </div>
          </div>

          {/* Alerts section */}
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> تنبيهات تجريبية
            </div>
            <div className="space-y-1.5">
              {DEMO_MARKERS.filter(m => m.status !== 'active').map(m => (
                <AlertRow key={m.id} marker={m} />
              ))}
            </div>

            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 mt-4 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> مواقع تجريبية نشطة
            </div>
            <div className="space-y-1.5">
              {activeMarkers.slice(0, 5).map(m => (
                <AlertRow key={m.id} marker={m} />
              ))}
            </div>
          </div>

          {/* Layer summary */}
          <div className="p-3 border-t border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">الطبقات المُفعَّلة</div>
            <div className="flex flex-wrap gap-1">
              {execLayers.slice(0, 8).map(l => (
                <span key={l.id}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: l.color + '22', color: l.color, border: `1px solid ${l.color}44` }}
                >
                  {l.labelAr}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
