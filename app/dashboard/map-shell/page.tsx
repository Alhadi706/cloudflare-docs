'use client';
/**
 * MapShell — القشرة التشغيلية الموحدة المتمركزة حول الخريطة
 * ═══════════════════════════════════════════════════════════════
 * 3 طبقات:
 *   1. Base Layer   — MapCenterCanvas دائم mounted (لا unmount أبداً)
 *   2. Context Overlay — شريط سياق الإدارة الحالية (يتبدل بـ state)
 *   3. Edge Widgets    — أدوات جانبية يمين/يسار قابلة للإظهار/الإخفاء
 *
 * التبديل بين الإدارات عبر setContextPack فقط — لا navigation كاملة.
 */

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { GisErrorBoundary } from '../gis-sovereignty/components/GisErrorBoundary';
import { useGisEngine } from '@/store/gisEngine';
import {
  HardHat, Building2, Banknote, Target,
  PanelRightOpen, PanelLeftOpen, ChevronRight, ChevronDown, ChevronUp,
  LayoutDashboard,
} from 'lucide-react';

// ── Context pack components ──────────────────────────────────────
import { EngineeringOverlay,     EngineeringRightWidget     } from './packs/EngineeringPack';
import { AdministrationOverlay,  AdministrationRightWidget  } from './packs/AdministrationPack';
import { FinanceOverlay,         FinanceRightWidget         } from './packs/FinancePack';
import { ExecutiveOverlay,       ExecutiveRightWidget       } from './packs/ExecutivePack';

// ── Map canvas — SSR:false, mounted ONCE, never unmounts ────────
const MapCenterCanvas = dynamic(
  () => import('../gis-sovereignty/components/MapCenterCanvas'),
  { ssr: false },
);

// ── Pack definitions ─────────────────────────────────────────────
type PackKey = 'engineering' | 'administration' | 'finance' | 'executive';

function isPackKey(value: string | null): value is PackKey {
  return value === 'engineering' || value === 'administration' || value === 'finance' || value === 'executive';
}

const PACKS: { key: PackKey; labelAr: string; icon: React.ReactNode; color: string }[] = [
  { key: 'engineering',    labelAr: 'الهندسة',         icon: <HardHat  className="w-4 h-4" />, color: 'blue'   },
  { key: 'administration', labelAr: 'الإدارة',         icon: <Building2 className="w-4 h-4" />, color: 'purple' },
  { key: 'finance',        labelAr: 'المالية',         icon: <Banknote  className="w-4 h-4" />, color: 'emerald'},
  { key: 'executive',      labelAr: 'التنفيذي',        icon: <Target    className="w-4 h-4" />, color: 'amber'  },
];

const COLOR_ACTIVE: Record<string, string> = {
  blue:    'bg-blue-600 text-white border-blue-500',
  purple:  'bg-purple-600 text-white border-purple-500',
  emerald: 'bg-emerald-600 text-white border-emerald-500',
  amber:   'bg-amber-600 text-white border-amber-500',
};
const COLOR_IDLE = 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/80';

// ── Overlay selector ─────────────────────────────────────────────
function ContextOverlay({ pack }: { pack: PackKey | null }) {
  if (pack === 'engineering')    return <EngineeringOverlay />;
  if (pack === 'administration') return <AdministrationOverlay />;
  if (pack === 'finance')        return <FinanceOverlay />;
  if (pack === 'executive')      return <ExecutiveOverlay />;
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-800/60 backdrop-blur-sm">
      <LayoutDashboard className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-sm font-semibold text-slate-300">القشرة الجغرافية الموحدة</span>
      <span className="text-xs text-slate-500 mr-auto">اختر إدارة من الشريط أعلاه</span>
    </div>
  );
}

// ── Right widget selector ────────────────────────────────────────
function RightWidgets({ pack }: { pack: PackKey | null }) {
  if (pack === 'engineering')    return <EngineeringRightWidget />;
  if (pack === 'administration') return <AdministrationRightWidget />;
  if (pack === 'finance')        return <FinanceRightWidget />;
  if (pack === 'executive')      return <ExecutiveRightWidget />;
  return null;
}

// ════════════════════════════════════════════════════════════════
// Main Shell
// ════════════════════════════════════════════════════════════════
export default function MapShell() {
  const router            = useRouter();
  const searchParams      = useSearchParams();
  const activeContextPack = useGisEngine(s => s.activeContextPack);
  const setContextPack    = useGisEngine(s => s.setContextPack);
  const widgetVisibility  = useGisEngine(s => s.widgetVisibility);
  const toggleWidget      = useGisEngine(s => s.toggleWidget);
  const setWorkspace      = useGisEngine(s => s.setWorkspace);
  const refreshAll        = useGisEngine(s => s.refreshAll);
  const loadUnifiedGeojson = useGisEngine(s => s.loadUnifiedGeojson);
  const loadDepartmentInventory = useGisEngine(s => s.loadDepartmentInventory);
  const entityDetails = useGisEngine(s => s.entityDetails);
  const entityDetailsLoading = useGisEngine(s => s.entityDetailsLoading);
  const selectedEntityType = useGisEngine(s => s.selectedEntityType);
  const selectedEntityId = useGisEngine(s => s.selectedEntityId);
  const packFromQuery     = searchParams.get('pack');

  // Sync pack from query; default to engineering when query is missing/invalid.
  useEffect(() => {
    if (isPackKey(packFromQuery)) {
      setContextPack(packFromQuery);
      return;
    }
    setContextPack('engineering');
    router.replace('/dashboard/map-shell?pack=engineering', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packFromQuery]);

  // Activate the corresponding GIS workspace when pack changes
  useEffect(() => {
    const wsMap: Record<PackKey, 'engineering' | 'executive' | 'maintenance' | 'satellite' | 'spatial' | 'monitor'> = {
      engineering:    'engineering',
      administration: 'maintenance',
      finance:        'executive',
      executive:      'executive',
    };
    if (activeContextPack) {
      setWorkspace(wsMap[activeContextPack]);
      loadDepartmentInventory();
      loadUnifiedGeojson({
        entityTypes: ['project', 'asset', 'work_order', 'employee'],
        department: activeContextPack,
        limit: 1500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContextPack]);

  // Initial data load on mount
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GisErrorBoundary title="تعذر تحميل القشرة الجغرافية">
      <div
        className="flex flex-col h-[calc(100vh-80px)] w-full bg-slate-950 text-slate-200 overflow-hidden"
        dir="rtl"
      >
        {/* ── Department selector bar ───────────────────────────── */}
        <div className="h-11 shrink-0 bg-slate-900/90 border-b border-slate-800 px-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest shrink-0 ml-1">سياق الإدارة:</span>
          {PACKS.map(p => {
            const isActive = activeContextPack === p.key;
            const colorCls = isActive ? COLOR_ACTIVE[p.color] : COLOR_IDLE;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  const next = isActive ? p.key : p.key;
                  setContextPack(next);
                  router.replace(`/dashboard/map-shell?pack=${next}`, { scroll: false });
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0 ${colorCls}`}
              >
                {p.icon}
                {p.labelAr}
              </button>
            );
          })}

          <div className="mr-auto flex items-center gap-1">
            <button
              type="button"
              title="تبديل الشريط العلوي"
              onClick={() => toggleWidget('top')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="تبديل الشريط السفلي"
              onClick={() => toggleWidget('bottom')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="تبديل الشريط الجانبي الأيسر"
              onClick={() => toggleWidget('left')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="تبديل الشريط الجانبي الأيمن"
              onClick={() => toggleWidget('right')}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Context overlay (department header) ──────────────── */}
        <ContextOverlay pack={activeContextPack} />

        {/* Top widget zone */}
        {widgetVisibility.top && activeContextPack && (
          <div className="shrink-0 border-b border-slate-800 bg-slate-900/70 px-4 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Top Zone</div>
            <div className="text-xs text-slate-400 mt-1">حزمة معلومات علوية (Skeleton - Phase 1)</div>
          </div>
        )}

        {/* ── Main canvas area ──────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden relative">

          {/* Left widget zone (placeholder for future phase) */}
          {widgetVisibility.left && activeContextPack && (
            <aside className="w-52 shrink-0 bg-slate-900/80 border-l border-slate-800 overflow-y-auto flex flex-col">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">طبقات الخريطة</span>
                <button
                  type="button"
                  onClick={() => toggleWidget('left')}
                  className="text-slate-500 hover:text-slate-200 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 p-3 space-y-1 text-xs text-slate-500 text-center mt-4">
                <p>سيتم تفعيل</p>
                <p>مدير الطبقات</p>
                <p>في المرحلة الثانية</p>
              </div>
            </aside>
          )}

          {/* ─── Base Map Layer — ALWAYS mounted, NEVER unmounts ── */}
          <main className="flex-1 relative overflow-hidden">
            {/*
              MapCenterCanvas is rendered unconditionally here.
              The pack switcher only changes overlays/widgets via state.
              No full-page navigation occurs inside this shell.
            */}
            <MapCenterCanvas />
          </main>

          {/* Right widget zone — pack-dependent tools */}
          {widgetVisibility.right && activeContextPack && (
            <aside className="w-56 shrink-0 bg-slate-900/80 border-r border-slate-800 overflow-y-auto">
              <RightWidgets pack={activeContextPack} />
            </aside>
          )}
        </div>

        {/* Bottom widget zone */}
        {widgetVisibility.bottom && activeContextPack && (
          <div className="shrink-0 border-t border-slate-800 bg-slate-900/70 px-4 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Bottom Zone</div>
            <div className="text-xs text-slate-400 mt-1">شريط سفلي للسياق الزمني/التنبيهات (Skeleton - Phase 1)</div>
          </div>
        )}

        {/* Entity drill-down panel (Phase 2) */}
        {(selectedEntityType && selectedEntityId != null) && (
          <div className="absolute left-3 bottom-12 z-30 w-80 max-h-[40vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-sm p-3" dir="rtl">
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Entity Drill-down</div>
            <div className="text-sm text-slate-200 mt-1">
              {selectedEntityType} #{String(selectedEntityId)}
            </div>

            {entityDetailsLoading && (
              <div className="text-xs text-slate-400 mt-2">جاري تحميل تفاصيل الكيان...</div>
            )}

            {!entityDetailsLoading && entityDetails && (
              <div className="mt-2 space-y-2 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                  <div className="text-slate-500 mb-1">Details</div>
                  <pre className="text-slate-300 whitespace-pre-wrap break-words">{JSON.stringify(entityDetails.details, null, 2)}</pre>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                  <div className="text-slate-500 mb-1">Related</div>
                  <pre className="text-slate-300 whitespace-pre-wrap break-words">{JSON.stringify(entityDetails.related_entities, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GisErrorBoundary>
  );
}
