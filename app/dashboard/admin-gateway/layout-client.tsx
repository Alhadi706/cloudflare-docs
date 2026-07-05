'use client';
/**
 * AdminGatewayLayout — floating panel over live map (Phase 3: map-toggleable)
 * ─────────────────────────────────────────────────────────────
 * كل إدارة تملك زر تبديل بين وضعين:
 *   ① mapHidden = true  → صفحة كاملة (غطاء للخريطة) — الافتراضي لإدارات HR/مالية/مشتريات
 *   ② mapHidden = false → لوحة عائمة فوق خريطة حية — الافتراضي لإدارات تآكل/صيانة/مشاريع
 * التفضيل يحفظ في localStorage: map_pref_[deptCode]
 */
import React from 'react';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Compass } from 'lucide-react';
import FloatingSidePanel from '@/components/FloatingSidePanel';
import MapToggleButton from '@/components/MapToggleButton';
import EmbeddedAssistant from '@/components/EmbeddedAssistant';
// SharedAssetsPanel removed — GIS principal assets belong in Engineering Workspace only
import { useGisEngine } from '@/store/gisEngine';
import { useProjectStore } from '@/store/projectStore';
import { useDeptMapStore } from '@/store/deptMapStore';

function resolveTenantId(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('tenant_id') ||
    localStorage.getItem('active_tenant_id') ||
    ''
  );
}

export default function AdminGatewayLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setCenter = useGisEngine((s) => s.setCenter);
  const setZoom = useGisEngine((s) => s.setZoom);
  const setWorkspace = useGisEngine((s) => s.setWorkspace);
  const setEntityRenderMode = useGisEngine((s) => s.setEntityRenderMode);
  const setLayerVisible = useGisEngine((s) => s.setLayerVisible);
  const drawingMode = useGisEngine((s) => s.drawingMode);

  // ── Phase 3: dept map toggle ────────────────────────────────────────────
  const { mapHidden, initDept } = useDeptMapStore();

  // Extract dept code from pathname: /dashboard/admin-gateway/[deptCode]/...
  const deptCode = useMemo(() => {
    const m = pathname.match(/\/dashboard\/admin-gateway\/([^\/]+)/);
    return m ? m[1] : 'admin-gateway';
  }, [pathname]);

  // Sync dept preference whenever the route's dept changes.
  // useLayoutEffect runs synchronously before the browser paints,
  // preventing the mapHidden=true flash on first render for map-visible depts.
  useLayoutEffect(() => {
    initDept(deptCode);
  }, [deptCode, initDept]);
  // ───────────────────────────────────────────────────────────────

  const openEngineeringWorkspace = () => {
    const params = new URLSearchParams();
    if (activeProjectId) {
      params.set('project', activeProjectId);
    }
    params.set('__nav', String(Date.now()));
    const search = params.toString();
    window.location.assign(`/dashboard/gis-sovereignty/engineering-workspace${search ? `?${search}` : ''}`);
  };

  useEffect(() => {
    if (drawingMode === 'aoi-rectangle' || drawingMode === 'trace') {
      // navigate to engineering workspace when drawing tools activated from elsewhere
      openEngineeringWorkspace();
    }
  }, [drawingMode, activeProjectId]);

  useEffect(() => {
    if (pathname.includes('/dashboard/admin-gateway/unified-map')) {
      setWorkspace('engineering');
    } else if (pathname.includes('/dashboard/admin-gateway/maintenance')) {
      setWorkspace('maintenance');
      setLayerVisible('corridors', true);
      setLayerVisible('work_orders', true);
    } else if (pathname.includes('/dashboard/admin-gateway/finance')) {
      setWorkspace('executive');
    } else if (pathname.includes('/dashboard/admin-gateway/procurement')) {
      setWorkspace('monitor');
    } else {
      setWorkspace('engineering');
    }

    const tenantId = resolveTenantId();
    const hdr: Record<string, string> = {};
    if (tenantId) hdr['X-Tenant-ID'] = tenantId;

    // Procurement context: focus on most active warehouses area.
    if (pathname.includes('/dashboard/admin-gateway/procurement')) {
      setEntityRenderMode('icons');
      setLayerVisible('warehouses', true);
      setLayerVisible('employees', false);
      setLayerVisible('heatmap', false);

      (async () => {
        try {
          const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
          const res = await fetch(`/api/v1/erp-spatial/warehouses/geojson${qs}`, { headers: hdr });
          if (!res.ok) return;
          const data = await res.json();
          const features: any[] = data.features ?? [];
          if (!features.length) return;

          const sorted = [...features].sort((a, b) => {
            const av = Number(a?.properties?.receipt_count ?? 0);
            const bv = Number(b?.properties?.receipt_count ?? 0);
            return bv - av;
          });

          const best = sorted[0];
          const [lon, lat] = best?.geometry?.coordinates ?? [];
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            setCenter([lon, lat]);
            setZoom(11);
          }
        } catch {
          // no-op
        }
      })();
    }

    // Finance context: activate transaction view (density + heatmap semantics).
    if (pathname.includes('/dashboard/admin-gateway/finance')) {
      setEntityRenderMode('density');
      setLayerVisible('heatmap', true);
      setLayerVisible('employees', true);
      setLayerVisible('warehouses', true);
      setLayerVisible('contracts', true);

      (async () => {
        try {
          const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
          const res = await fetch(`/api/v1/erp-spatial/transaction-map/geojson${qs}`, { headers: hdr });
          if (!res.ok) return;
          const data = await res.json();
          const features: any[] = data.features ?? [];
          if (!features.length) return;

          const points = features
            .map((f) => f?.geometry?.coordinates)
            .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
          if (!points.length) return;

          const avgLon = points.reduce((s, c) => s + Number(c[0]), 0) / points.length;
          const avgLat = points.reduce((s, c) => s + Number(c[1]), 0) / points.length;
          setCenter([avgLon, avgLat]);
          setZoom(9);
        } catch {
          // no-op
        }
      })();
    }
  }, [pathname, setCenter, setEntityRenderMode, setLayerVisible, setWorkspace, setZoom]);

  useEffect(() => {
    const onOpen = () => {
      openEngineeringWorkspace();
    };

    window.addEventListener('admin-gateway:open-engineering-core', onOpen as EventListener);
    window.addEventListener('admin-gateway:toggle-engineering-core', onOpen as EventListener);

    return () => {
      window.removeEventListener('admin-gateway:open-engineering-core', onOpen as EventListener);
      window.removeEventListener('admin-gateway:toggle-engineering-core', onOpen as EventListener);
    };
  }, [activeProjectId]);

  // صفحات الصيانة تُعرض كاملة لضمان مساحة عمل كافية، مع استمرار التزامن مع محرك GIS الموحد.
  const isMaintenancePage = pathname.startsWith('/dashboard/admin-gateway/maintenance');

  // Phase 3: map toggle header button — shown in FloatingSidePanel header
  const mapToggleExtra = (
    <MapToggleButton showLabel={false} />
  );

  // Phase 3 (updated): full-page mode when map is hidden.
  // DashboardLayout now enables pointer-events when mapHidden=true,
  // so we render in normal flex flow — content sits beside the Sidebar.
  if (mapHidden && !isMaintenancePage) {
    return (
      <div className="flex flex-col w-full min-h-0 bg-[#080d1a] overflow-y-auto h-full">
        {/* Sticky map toggle bar — always accessible */}
        <div className="sticky top-0 z-10 flex justify-end px-4 py-2 bg-[#080d1a]/90 backdrop-blur-sm border-b border-slate-800/50 pointer-events-auto">
          <MapToggleButton />
        </div>
        <div className="flex-1 pointer-events-auto">
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      {isMaintenancePage ? (
        // عرض صفحة الصيانة مباشرة — CorridorMap مستقلة وتحتاج استقبال أحداث الماوس
        <div className="fixed inset-0 top-11 z-[40] overflow-y-auto pointer-events-auto">
          {children}
        </div>
      ) : (
        <FloatingSidePanel
          title="بوابة الإدارة"
          width={460}
          expandable
          onClose={() => router.push('/dashboard')}
          headerExtra={(
            <div className="flex items-center gap-1.5">
              {/* Map toggle — prominent, with label on sm+ */}
              <MapToggleButton showLabel={true} />
              <button
                type="button"
                onClick={openEngineeringWorkspace}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-100 shadow-sm hover:bg-emerald-500/25 transition-colors"
                title="فتح الفضاء الهندسي"
              >
                <Compass className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">الهندسي</span>
              </button>
            </div>
          )}
        >
          {/* SharedAssetsPanel removed — it showed GIS principal-assets which
              conflicted visually with the ERP asset registry (two different
              data sources, both called "assets"). Principal assets are now
              accessible only from the GIS Engineering Workspace where they
              belong contextually. */}
          <div className="flex-1 min-h-0">
            {children}
          </div>
          <EmbeddedAssistant />
        </FloatingSidePanel>
      )}
    </>
  );
}


