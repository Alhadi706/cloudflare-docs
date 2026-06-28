'use client';
import React, { useState, useEffect } from 'react';
import {
  FolderGit2, Layers, Upload, MapPin, ChevronDown, ChevronRight,
  Plus, Loader2, PenTool, Hexagon, ZoomIn, CheckCircle, AlertCircle, Lock, ShieldCheck, Building2, ExternalLink,
  Eye, EyeOff, Globe, Download, Database, Filter, RefreshCw, Save
} from 'lucide-react';
import { useGisEngine, LAYER_REGISTRY, type LayerId, type LayerCategory } from '@/store/gisEngine';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLayerStore } from '@/store/layerStore';
import { useProjectStore } from '@/store/projectStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useMapStore } from '@/store/mapStore';
import { useUserStore } from '@/store/useUserStore';
import { resolveTenantContext } from '@/lib/gis/tenantContext';
import { workspaceApi } from '@/store/apiService';
import { getAssetCapabilities } from '@/lib/gis/assetGovernance';
import LayerTreePanel from './LayerTreePanel';
import PathSwitcher from './PathSwitcher';

// Helper: extract all coordinate pairs from a GeoJSON geometry
function geomCoords(geom: any): number[][] {
  if (!geom) return [];
  const t: string = geom.type ?? '';
  if (t === 'Point') return [geom.coordinates];
  if (t === 'LineString' || t === 'MultiPoint') return geom.coordinates;
  if (t === 'Polygon' || t === 'MultiLineString') return (geom.coordinates as any[]).flat(1);
  if (t === 'MultiPolygon') return (geom.coordinates as any[]).flat(2);
  return [];
}

function getTenantId(): string {
  const { tenantId } = resolveTenantContext();
  return tenantId || '';
}

function getTenantHeader(): Record<string, string> {
  const tenantId = getTenantId();
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function LeftPanel() {
  const { projects, activeProjectId, setActiveProject, loadProjects, sites, loadSites, clearSites } = useProjectStore();
  const { layers, activeLayerId, setActiveLayer, addLayer, loadLayers, updateFeatureCount } = useLayerStore();
  const { addFeature, setEditingState, clearFeatures, loadAssets, setLastActionSummary } = useWorkspaceStore();
  const { setPendingFitExtent, triggerFit } = useMapStore();
  const { current: currentUser } = useUserStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectFromQuery = searchParams?.get('project');

  // ─── Permission helpers ──────────────────────────────────────────────────
  const [storedRole, setStoredRole] = useState<string | null>(null);

  useEffect(() => {
    setStoredRole(localStorage.getItem('user_role'));
  }, []);

  // Resolve role from the first non-empty source.
  const role =
    [currentUser?.role, currentUser?.roles?.[0], storedRole]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find((v) => v.length > 0) ??
    'viewer';
  const [myPerms, setMyPerms] = useState<any>(null);

  useEffect(() => {
    if (!activeProjectId) { setMyPerms(null); return; }
    workspaceApi.getMyPermissions(activeProjectId).then(setMyPerms);
  }, [activeProjectId, currentUser?.employeeId]);

  const roleKey = String(role).toLowerCase();
  const storedDepartment = typeof window !== 'undefined' ? localStorage.getItem('user_department') : null;
  const caps = getAssetCapabilities(currentUser, storedDepartment);
  const canCreateMain = myPerms?.permissions?.can_create_main_layer ?? ['super_admin', 'project_admin', 'site_manager', 'founder'].includes(roleKey);
  const canCreateSub  = myPerms?.permissions?.can_create_sub_layer  ?? ['super_admin', 'project_admin', 'site_manager', 'layer_owner', 'founder'].includes(roleKey);
  const canUploadFromPerm = myPerms?.permissions?.can_upload ?? (roleKey !== 'viewer');
  const canCreateMainEffective = caps.canCreateMainAsset && canCreateMain;
  const canCreateSubEffective = caps.canCreateChildAsset && canCreateSub;
  const canUploadSpatialEffective = caps.canUploadSpatialFiles && canUploadFromPerm;
  const canDrawSpatialEffective = caps.canDrawSpatial;

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [newSublayerName, setNewSublayerName] = useState('');
  const [newSublayerDeptId, setNewSublayerDeptId] = useState('');
  const [newSublayerEmpId, setNewSublayerEmpId] = useState('');
  const [isAddingSublayer, setIsAddingSublayer] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string; name_ar: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string; role: string }[]>([]);

  // ─── Site context state ───────────────────────────────────────────────────
  const [activeSiteId, setActiveSiteId] = useState<number | null>(null);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Deep-link support: /engineering-workspace?project=<id>
  useEffect(() => {
    if (!projectFromQuery || projects.length === 0) return;
    const normalized = String(projectFromQuery);
    const exists = projects.some((p) => String(p.id) === normalized);
    if (exists && activeProjectId !== normalized) {
      setActiveProject(normalized);
    }
  }, [projectFromQuery, projects, activeProjectId, setActiveProject]);

  // Restore last selected project when returning to this workspace
  useEffect(() => {
    if (projectFromQuery || projects.length === 0 || activeProjectId) return;
    const saved = window.sessionStorage.getItem('gis:lastActiveProjectId');
    if (!saved) return;
    const exists = projects.some((p) => String(p.id) === saved);
    if (exists) setActiveProject(saved);
  }, [projectFromQuery, projects, activeProjectId, setActiveProject]);

  // Persist active project across GIS workspace switches
  useEffect(() => {
    if (!activeProjectId) return;
    window.sessionStorage.setItem('gis:lastActiveProjectId', String(activeProjectId));
  }, [activeProjectId]);

  // Reload layers when project OR site changes
  useEffect(() => {
    if (activeProjectId) loadLayers(activeProjectId, activeSiteId);
  }, [activeProjectId, activeSiteId, loadLayers]);

  // Load assets strictly per active layer + site — clears first
  useEffect(() => {
    if (activeProjectId && activeLayerId) {
      loadAssets(activeProjectId, activeSiteId, activeLayerId);
    } else {
      clearFeatures(); // no layer selected → empty map
    }
  }, [activeProjectId, activeSiteId, activeLayerId, loadAssets, clearFeatures]);

  // Load sites into shared store when active project changes
  useEffect(() => {
    setActiveSiteId(null);
    clearSites();
    if (!activeProjectId) return;
    loadSites(activeProjectId);
  }, [activeProjectId, loadSites, clearSites]);
  useEffect(() => {
    const tenantHeader = getTenantHeader();
    fetch('/api/v1/workspace/departments', { headers: tenantHeader })
      .then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
    fetch('/api/v1/workspace/employees', { headers: tenantHeader })
      .then(r => r.ok ? r.json() : []).then(setEmployees).catch(() => {});
  }, []);

  // Filter layers: if a site is active, show only layers that belong to that site (or no site)
  const projectLayers = layers.filter(l => {
    if (l.projectId !== activeProjectId) return false;
    if (activeSiteId !== null && l.siteId !== undefined && l.siteId !== null) {
      return l.siteId === activeSiteId;
    }
    return true;
  });
  const mainLayers = projectLayers.filter(l => {
    const pid = String(l.parentId ?? '');
    return !pid || pid === 'null' || pid === 'undefined';
  });
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const parentOfActive = activeLayer?.parentId ? layers.find(l => l.id === String(activeLayer.parentId)) : null;
  const isMainLayer = !!(activeLayer && (!activeLayer.parentId || String(activeLayer.parentId) === 'null' || activeLayer.layer_type === 'main'));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !activeLayerId || !activeProjectId) return;
    setIsUploadingFile(true);
    setUploadFeedback(null);

    // Track whether at least one file was persisted to DB
    // (so we know whether to reload from DB or keep in-memory features)
    let anyImportedToDb = false;

    try {
      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', 'Admin');
        const res = await fetch('/api/gis/upload', { method: 'POST', body: formData });
        if (!res.ok) { console.error(`[Upload] ${res.status} for ${file.name}`); continue; }
        let result: any;
        try { result = await res.json(); } catch { continue; }

        // Detect file type for assistant explanation
        const fileExt = (file.name.split('.').pop() ?? '').toUpperCase();
        const isExcelFile = ['XLSX', 'XLS', 'CSV'].includes(fileExt);
        const isRouteFile = ['KML', 'KMZ', 'GPX', 'GEOJSON', 'JSON'].includes(fileExt);

        // Defensive feature extraction across response shapes
        const fc = result?.geojson ?? result?.data ?? result?.result ?? result;
        const rawFeatures: any[] = Array.isArray(fc?.features) ? fc.features : Array.isArray(fc) ? fc : [];

        if (rawFeatures.length === 0) {
          const hint = isExcelFile
            ? 'تأكد أن الملف يحتوي على أعمدة إحداثيات (lat/lon) أو عمود موقع مدمج.'
            : 'تأكد من أن الملف يحتوي على عناصر جغرافية صالحة.';
          setUploadFeedback({ type: 'error', message: `لم يُعثر على عناصر جغرافية في "${file.name}". ${hint}` });
          setLastActionSummary({
            type: 'upload',
            title: `فشل رفع — ${file.name}`,
            body: `**النوع**: ${fileExt}\n**السبب**: لم يُعثر على إحداثيات أو عناصر جغرافية في الملف.\n${hint}`,
            count: 0,
            timestamp: Date.now(),
          });
          continue;
        }

        // ── FIX: Merge multiple LineStrings into one MultiLineString ──────────────
        // Prevents "segmented/broken path" rendering where each GPS track segment
        // appears as a disconnected short line.
        const lineFeats = rawFeatures.filter((f: any) => f?.geometry?.type === 'LineString');

        // Enrich non-LineString features (Excel points etc.) with source/type metadata
        // so MapCanvas styles them correctly as uploaded_dataset points
        const otherFeats = rawFeatures
          .filter((f: any) => f?.geometry?.type !== 'LineString')
          .map((f: any) => ({
            ...f,
            properties: {
              ...(f.properties || {}),
              source: f.properties?.source || 'uploaded_dataset',
              asset_type: f.properties?.asset_type || (f?.geometry?.type === 'Point' ? 'ImportedPoint' : 'Imported'),
            },
          }));

        const mergedFeatures: any[] = [...otherFeats];

        if (lineFeats.length > 1) {
          // Merge all LineString coordinates into a single MultiLineString
          mergedFeatures.push({
            type: 'Feature',
            id: `path-${Date.now()}`,
            geometry: {
              type: 'MultiLineString',
              coordinates: lineFeats.map((f: any) => f.geometry.coordinates),
            },
            properties: {
              name: file.name.split('.')[0],
              asset_name: file.name.split('.')[0],
              asset_type: 'Route',
              source: 'uploaded_dataset',
            },
          });
        } else if (lineFeats.length === 1) {
          // Single LineString — preserve with uploaded_dataset source
          mergedFeatures.push({
            ...lineFeats[0],
            properties: {
              ...(lineFeats[0].properties || {}),
              source: lineFeats[0].properties?.source || 'uploaded_dataset',
              asset_type: lineFeats[0].properties?.asset_type || 'Route',
            },
          });
        }

        // ── FIX: Persist to DB first via import_geojson with site_id ─────────────
        // Include site_id so get_assets site filter returns these features correctly.
        // Old approach omitted site_id → features got site_id=NULL → invisible when
        // a site was active. Race condition was also fixed: await import_geojson, then
        // loadAssets (DB is ready, not empty).
        const geojsonForImport = { type: 'FeatureCollection', features: mergedFeatures };
        let importedToDB = false;
        try {
          const { tenantId } = resolveTenantContext();
          const importRes = await fetch('/api/v1/workspace/projects/import_geojson', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
            },
            body: JSON.stringify({
              name: file.name.split('.')[0],
              geojson: geojsonForImport,
              project_id: activeProjectId,
              layer_id: activeLayerId,
              site_id: activeSiteId ?? null,   // ← FIX: pass active site
            }),
          });
          importedToDB = importRes.ok;
          if (!importRes.ok) console.warn('[Upload] import_geojson failed:', importRes.status);
        } catch (importErr) {
          console.warn('[Upload] import_geojson error:', importErr);
        }

        if (importedToDB) {
          anyImportedToDb = true;
        } else {
          // Fallback: add directly to local store when DB import fails
          // Note: these in-memory features will NOT persist after reload.
          for (const f of mergedFeatures) {
            if (!f?.geometry) continue;
            const fid = String(f.id ?? Math.random().toString(36).slice(2));
            addFeature({
              type: 'Feature',
              id: fid,
              geometry: f.geometry,
              properties: {
                layerId: activeLayerId,
                asset_id: fid,
                asset_type: f.properties?.asset_type || 'Uploaded',
                asset_name: f.properties?.asset_name || f.properties?.name || file.name,
                status: 'Active',
                health_score: 100,
                installation_date: new Date().toISOString().split('T')[0],
                department_owner: 'Admin',
                source: 'uploaded_dataset',
                site_id: activeSiteId ?? undefined,
              } as any,
            });
          }
        }

        // Calculate bounding box for zoom (always from raw converted features)
        const allCoords: number[][] = [];
        mergedFeatures.forEach((f: any) => {
          if (f?.geometry) geomCoords(f.geometry).forEach(c => {
            if (c.length >= 2 && isFinite(c[0]) && isFinite(c[1])) allCoords.push(c);
          });
        });
        if (allCoords.length > 0) {
          const lons = allCoords.map(c => c[0]);
          const lats = allCoords.map(c => c[1]);
          setPendingFitExtent([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]);
        }

        // Count — use rawFeatures length for accurate total display
        const totalFeatures = rawFeatures.filter((f: any) => f?.geometry).length;
        updateFeatureCount(activeLayerId, totalFeatures);
        const layerPath = parentOfActive ? `${parentOfActive.name} › ${activeLayer?.name}` : (activeLayer?.name ?? '');

        // ── TRUTHFUL STAGE-BY-STAGE FEEDBACK ─────────────────────────────────────
        // Stage 1: Parsed  Stage 2: Stored  Stage 3: Loaded  Stage 4: Rendered
        // We only claim what we have EVIDENCE for at each stage.
        const fileExt2 = fileExt; // alias for clarity
        const mergeNote = lineFeats.length > 1
          ? `تم دمج **${lineFeats.length} مقطع** في MultiLineString واحد متواصل.`
          : lineFeats.length === 1 ? 'مسار خطي واحد متواصل.' : '';
        const geomTypes = rawFeatures.map((f: any) => f?.geometry?.type).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

        const stage1 = `**✅ المرحلة 1 — التحليل:** تم تحليل **${totalFeatures} عنصر** من "${file.name}".\n- نوع الهندسة: ${geomTypes || 'غير معروف'}\n- نوع الملف: ${fileExt2}${lineFeats.length > 1 ? `\n- ${mergeNote}` : ''}`;

        const stage2 = importedToDB
          ? `**✅ المرحلة 2 — الحفظ:** تم حفظ **${mergedFeatures.length} عنصر** في قاعدة البيانات بنجاح.`
          : `**⚠️ المرحلة 2 — الحفظ:** فشل الحفظ في قاعدة البيانات — البيانات مؤقتة في الجلسة الحالية فقط. (تحقق من سجلات الخادم)`;

        // Stage 3 and 4 will be resolved after loadAssets below (see post-loop summary update)
        // For now: set a preliminary summary that is HONEST about what we know
        setUploadFeedback({ type: 'success', message: `تم تحليل ${totalFeatures} عنصر من: ${file.name}` });
        setLastActionSummary({
          type: 'upload',
          title: `رفع ملف — ${file.name}`,
          body: `${stage1}\n\n${stage2}\n\n**⏳ المرحلة 3 — التحميل:** جارٍ تحميل البيانات من قاعدة البيانات...\n\n**⏳ المرحلة 4 — العرض:** سيتم التحقق بعد اكتمال التحميل.`,
          count: totalFeatures,
          timestamp: Date.now(),
          // Store metadata for the post-loadAssets update
          _pendingLayerId: activeLayerId,
          _importedToDB: importedToDB,
          _stage1: stage1,
          _stage2: stage2,
          _layerPath: layerPath,
        } as any);
      }

      // ── Reload from DB only if at least one file was persisted ───────────────
      // If ALL imports failed (importedToDB=false for every file), the features live
      // in the in-memory store via addFeature() — calling loadAssets() here would
      // wipe them, so we skip it.
      if (anyImportedToDb) {
        await loadAssets(activeProjectId, activeSiteId, activeLayerId);
      }

      // ── Post-loadAssets: verify actual rendered count and update summary ─────
      // Now we know EXACTLY how many features arrived in the map store.
      // This gives an EVIDENCE-BASED render status, not a guess.
      {
        const { features: storeFeatures, lastActionSummary: lastSummary } = useWorkspaceStore.getState();
        const renderedInLayer = storeFeatures.filter((f: any) => {
          const fLayerId = f.properties?.layerId || (f as any).layer_id;
          return fLayerId === activeLayerId;
        }).length;

        const pending = lastSummary as any;
        const s1 = pending?._stage1 || '';
        const s2 = pending?._stage2 || '';
        const layerPathFinal = pending?._layerPath || activeLayerId;
        const importedToDBFinal: boolean = pending?._importedToDB ?? anyImportedToDb;

        const stage3 = importedToDBFinal
          ? `**✅ المرحلة 3 — التحميل:** تم استرداد **${renderedInLayer} عنصر** من قاعدة البيانات.`
          : `**ℹ️ المرحلة 3 — التحميل:** البيانات في الذاكرة المؤقتة فقط (لم تُحفظ في DB).`;

        const stage4 = renderedInLayer > 0
          ? `**✅ المرحلة 4 — العرض:** تم عرض **${renderedInLayer} عنصر** على الخريطة في الطبقة "${layerPathFinal}".`
          : importedToDBFinal
          ? `**❌ المرحلة 4 — العرض:** تم حفظ البيانات لكن لم يتم عرضها بعد — تحقق من تطابق المشروع والطبقة والموقع النشط.`
          : `**⚠️ المرحلة 4 — العرض:** تم إنشاء المعالم مؤقتاً في الجلسة — ستختفي عند إعادة التحميل.`;

        setLastActionSummary({
          type: 'upload',
          title: `رفع ملف — نتيجة مؤكدة`,
          body: `${s1}\n\n${s2}\n\n${stage3}\n\n${stage4}`,
          count: renderedInLayer,
          timestamp: Date.now(),
        });

        setUploadFeedback({
          type: renderedInLayer > 0 ? 'success' : 'error',
          message: renderedInLayer > 0
            ? `تم عرض ${renderedInLayer} عنصر على الخريطة في: ${layerPathFinal}`
            : importedToDBFinal
            ? 'تم حفظ البيانات في قاعدة البيانات لكن لم تظهر على الخريطة — راجع إعدادات الطبقة والموقع.'
            : 'البيانات مؤقتة في الجلسة — فشل الحفظ في قاعدة البيانات.',
        });
      }

      loadLayers(activeProjectId, activeSiteId);

    } catch (err) {
      console.error('[Upload]', err);
      setUploadFeedback({ type: 'error', message: 'فشل الرفع — تحقق من الملف وأعد المحاولة.' });
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleAddSublayer = async () => {
    if (!newSublayerName.trim() || !activeLayerId || !activeProjectId) return;
    try {
      // Inherit site from active layer or use activeSiteId
      const parentLayer = layers.find(l => l.id === activeLayerId);
      const effectiveSiteId = (parentLayer as any)?.siteId ?? activeSiteId ?? undefined;
      await addLayer({
        name: newSublayerName,
        projectId: activeProjectId,
        parentId: activeLayerId,
        layer_type: 'sub',
        description: '',
        owner_name: 'Admin',
        owner_email: '',
        owner_phone: '',
        department_id: newSublayerDeptId ? Number(newSublayerDeptId) : undefined,
        responsible_employee_id: newSublayerEmpId ? Number(newSublayerEmpId) : undefined,
        siteId: effectiveSiteId ? Number(effectiveSiteId) : undefined,
        status: 'ACTIVE'
      });
      setNewSublayerName('');
      setNewSublayerDeptId('');
      setNewSublayerEmpId('');
      setIsAddingSublayer(false);
    } catch (e) { console.error(e); }
  };

  

  // ─── JSX ────────────────────────────────────────────────────────────────────
  const ROLE_LABELS: Record<string, string> = {
    super_admin:   'مدير النظام',
    tenant_admin:  'مدير المستأجر',
    project_admin: 'مدير مشروع',
    site_manager:  'مدير الموقع',
    layer_owner:   'مالك طبقة',
    project_manager:'مدير مشاريع',
    hr_manager:    'مدير الموارد البشرية',
    finance_manager:'مدير المالية',
    employee:      'موظف',
    operator:      'مشغّل',
    viewer:        'مشاهد',
  };
  const ROLE_COLORS: Record<string, string> = {
    super_admin:   'bg-red-900/60 text-red-300 border-red-700/40',
    tenant_admin:  'bg-emerald-900/60 text-emerald-300 border-emerald-700/40',
    project_admin: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/40',
    site_manager:  'bg-teal-900/60 text-teal-300 border-teal-700/40',
    layer_owner:   'bg-blue-900/60 text-blue-300 border-blue-700/40',
    project_manager:'bg-cyan-900/60 text-cyan-300 border-cyan-700/40',
    hr_manager:    'bg-violet-900/60 text-violet-300 border-violet-700/40',
    finance_manager:'bg-amber-900/60 text-amber-300 border-amber-700/40',
    employee:      'bg-slate-800/80 text-slate-300 border-slate-700/50',
    operator:      'bg-amber-900/60 text-amber-300 border-amber-700/40',
    viewer:        'bg-gray-800 text-gray-400 border-gray-700',
  };

  return (
    <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-y-auto shadow-2xl z-20 text-sm" dir="rtl">

      {/* Current User Display */}
      <div className="px-3 pt-2 pb-0 border-b border-gray-800/60 flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">المستخدم الحالي</span>
        </div>
        <div className={`w-full rounded px-2 py-1 text-xs border font-medium mb-2 ${ROLE_COLORS[roleKey] || ROLE_COLORS.viewer}`}>
          {currentUser?.full_name || currentUser?.username || '—'} — {ROLE_LABELS[roleKey] || 'مستخدم'}
        </div>
      </div>

      {/* Project Selector */}
      <div className="p-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <FolderGit2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">المشروع</span>
          <button
            onClick={() => router.push('/dashboard/admin-gateway/projects/list')}
            className="mr-auto flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 transition"
            title="إضافة مشروع جديد"
          >
            <Plus className="w-3 h-3" /> جديد
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="text-center py-3 space-y-2">
            <p className="text-xs text-slate-500">لا توجد مشاريع بعد</p>
            <button
              onClick={() => router.push('/dashboard/admin-gateway/projects/list')}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition font-medium"
            >
              <Plus className="w-3 h-3" /> أنشئ مشروعاً
            </button>
          </div>
        ) : (
        <select
          value={activeProjectId || ''}
          onChange={(e) => setActiveProject(e.target.value)}
          className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
        >
          <option value="" disabled>اختر المشروع...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        )}
        {activeProjectId && (
          <a
            href={`/dashboard/project-360/${activeProjectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-cyan-700/50 bg-cyan-950/30 px-2 py-1.5 text-[11px] font-semibold text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-500 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            فتح المشروع 360°
          </a>
        )}
      </div>

      {/* Site Selector — يظهر فقط إذا كان المشروع محدداً */}
      {activeProjectId && (
        <div className="p-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">الموقع</span>
            {activeSiteId && (
              <span className="mr-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400">
                {sites.find(s => s.id === activeSiteId)?.site_type || ''}
              </span>
            )}
          </div>
          {sites.length === 0 ? (
            <div className="rounded-lg bg-amber-950/30 border border-amber-700/30 p-3 text-center space-y-2">
              <p className="text-sm text-amber-400 font-medium">هذا المشروع لا يحتوي على مواقع بعد</p>
              <button
                onClick={() => router.push(`/dashboard/admin-gateway/projects/sites?project_id=${activeProjectId}`)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/40 text-amber-300 transition font-medium"
              >
                <Plus className="w-3 h-3" />
                إضافة موقع الآن
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <select
              value={activeSiteId ?? ''}
              onChange={e => setActiveSiteId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">— كل المواقع —</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.code ? ` (${s.code})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

        {/* Path Switcher — Asset Management vs Project Management */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-gray-800">
          <PathSwitcher
            userRole={typeof window !== 'undefined' ? localStorage.getItem('user_role') ?? undefined : undefined}
            userDepartment={typeof window !== 'undefined' ? localStorage.getItem('user_department') ?? undefined : undefined}
            className="w-full"
          />
        </div>

        {/* Layer Tree — using new LayerTreePanel component */}
        <div className="flex-shrink-0 p-3 border-b border-gray-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">شجرة الطبقات</span>
            </div>
            {activeProjectId && canCreateMainEffective && (
              <button
                onClick={async () => {
                  const generatedName = `طبقة جديدة ${new Date().toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`;
                  await addLayer({ name: generatedName, projectId: String(activeProjectId), siteId: activeSiteId ?? undefined, layer_type: 'main', description: '', owner_name: '', owner_email: '', owner_phone: '' });
                  loadLayers(activeProjectId, activeSiteId);
                }}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition text-xs font-bold"
                title="إنشاء طبقة جديدة"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <LayerTreePanel projectId={activeProjectId ?? undefined} canCreateLayer={canCreateMainEffective} />
        </div>

      {/* Selected Layer Panel */}
      {activeLayer ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {/* Identity card */}
          <div className="bg-indigo-950/40 border border-indigo-500/25 rounded-lg p-3">
            <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mb-1">الطبقة المختارة</p>
            <p className="text-xs text-white font-medium leading-snug">
              {parentOfActive && <span className="text-gray-400">{parentOfActive.name} <span className="text-gray-600 mx-0.5">›</span> </span>}
              <span className="text-indigo-300">{activeLayer.name}</span>
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded ${isMainLayer ? 'bg-blue-900/60 text-blue-300' : 'bg-purple-900/60 text-purple-300'}`}>
                {isMainLayer ? 'طبقة رئيسية' : 'طبقة فرعية'}
              </span>
              <span className="text-xs text-gray-500">{activeLayer.featureCount || 0} عنصر</span>
              {(activeLayer as any).siteId && (() => {
                const site = sites.find(s => s.id === (activeLayer as any).siteId);
                return site ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 flex items-center gap-0.5">
                    <Building2 className="w-2.5 h-2.5" />{site.name}
                  </span>
                ) : null;
              })()}
            </div>
          </div>

          {/* Add sublayer (main layer only, and only if canCreateSub) */}
          {isMainLayer && (
            <div>
              {!canCreateSubEffective ? (
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-800/40 border border-gray-700/40 text-gray-600 text-xs">
                  <Lock className="w-3 h-3 flex-shrink-0" />
                  <span>صلاحيتك ({ROLE_LABELS[role]}) لا تسمح بإضافة طبقات فرعية</span>
                </div>
              ) : !isAddingSublayer ? (
                <button
                  onClick={() => setIsAddingSublayer(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-indigo-500/40 text-indigo-400 hover:bg-indigo-900/20 hover:border-indigo-400 transition text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة طبقة فرعية تحت &quot;{activeLayer.name}&quot;
                </button>
              ) : (
                <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700 space-y-2">
                  <p className="text-xs text-gray-400">طبقة جديدة تحت <span className="text-white font-medium">{activeLayer.name}</span></p>
                  <input
                    type="text"
                    placeholder="اسم الطبقة الفرعية *"
                    value={newSublayerName}
                    onChange={e => setNewSublayerName(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Escape') { setIsAddingSublayer(false); setNewSublayerName(''); setNewSublayerDeptId(''); setNewSublayerEmpId(''); } }}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <select
                    value={newSublayerDeptId}
                    onChange={e => setNewSublayerDeptId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- القسم --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name_ar || d.name}</option>)}
                  </select>
                  <select
                    value={newSublayerEmpId}
                    onChange={e => setNewSublayerEmpId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- الموظف المسؤول --</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleAddSublayer} disabled={!newSublayerName.trim()} className={`flex-1 py-1 rounded text-xs transition ${newSublayerName.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-indigo-600/30 text-indigo-400 cursor-not-allowed'}`}>حفظ</button>
                    <button onClick={() => { setIsAddingSublayer(false); setNewSublayerName(''); setNewSublayerDeptId(''); setNewSublayerEmpId(''); }} className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-bold">رفع ملف إلى الطبقة</p>
            {!canUploadSpatialEffective ? (
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-800/40 border border-gray-700/40 text-gray-600 text-xs">
                <Lock className="w-3 h-3 flex-shrink-0" />
                <span>الرفع الجغرافي مخصص للإدارة الهندسية</span>
              </div>
            ) : (
              <div>
                <label className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border transition text-xs font-medium ${
                  isUploadingFile
                    ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300 cursor-not-allowed'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-indigo-500/60 hover:text-indigo-300 hover:bg-gray-800'
                }`}>
                  {isUploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploadingFile ? 'جاري الرفع...' : 'KML · GeoJSON · SHP · ZIP · CSV'}
                  <input type="file" multiple accept=".shp,.kml,.kmz,.geojson,.json,.zip,.dxf,.csv,.xlsx" className="hidden" onChange={handleFileUpload} disabled={isUploadingFile} />
                </label>
                {uploadFeedback && (
                  <div className={`mt-2 flex gap-2 items-start p-2 rounded-lg text-xs leading-snug ${
                    uploadFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-950/50 border border-red-500/30 text-red-300'
                  }`}>
                    {uploadFeedback.type === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    <span>{uploadFeedback.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawing tools */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-bold">أدوات الرسم</p>
            {!canDrawSpatialEffective ? (
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-800/40 border border-gray-700/40 text-gray-600 text-xs">
                <Lock className="w-3 h-3 flex-shrink-0" />
                <span>الرسم الجغرافي مخصص للإدارة الهندسية</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { icon: <MapPin className="w-4 h-4" />, label: 'نقطة', mode: 'point' },
                  { icon: <PenTool className="w-4 h-4" />, label: 'خط', mode: 'line' },
                  { icon: <Hexagon className="w-4 h-4" />, label: 'مساحة', mode: 'polygon' },
                ] as const).map(({ icon, label, mode }) => (
                  <button
                    key={mode}
                    onClick={() => setEditingState(mode)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:bg-indigo-900/20 hover:text-indigo-300 hover:border-indigo-500/40 transition text-xs font-medium"
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom to layer */}
          <button
            onClick={() => triggerFit()}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white transition text-xs font-medium"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            تكبير إلى بيانات الطبقة
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          {activeProjectId && mainLayers.length > 0 ? (
            // مشروع + طبقات موجودة لكن لم يختر طبقة
            <>
              <div className="w-10 h-10 rounded-full bg-indigo-900/30 border border-indigo-700/30 flex items-center justify-center">
                <Layers className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-gray-400 font-medium">لا توجد بيانات في هذه الطبقة بعد</p>
                <p className="text-xs text-gray-600">اختر طبقة من الشجرة أعلاه</p>
              </div>
              {canUploadSpatialEffective && (
                <div className="flex flex-col gap-2 w-full">
                  <label className="w-full flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer border border-dashed border-indigo-500/40 text-indigo-400 hover:bg-indigo-900/20 hover:border-indigo-400 transition text-xs font-medium">
                    <Upload className="w-3.5 h-3.5" />
                    رفع ملف
                    <input type="file" multiple accept=".shp,.kml,.kmz,.geojson,.json,.zip,.dxf,.csv,.xlsx" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([{ icon: <MapPin className="w-4 h-4" />, label: 'نقطة', mode: 'point' }, { icon: <PenTool className="w-4 h-4" />, label: 'خط', mode: 'line' }, { icon: <Hexagon className="w-4 h-4" />, label: 'مساحة', mode: 'polygon' }] as const).map(({ icon, label, mode }) => (
                      <button key={mode} onClick={() => setEditingState(mode)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-gray-800/60 border border-dashed border-gray-600 text-gray-500 hover:bg-indigo-900/20 hover:text-indigo-300 hover:border-indigo-500/40 transition text-xs font-medium">
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-600 text-center">اختر طبقة من الشجرة لعرض الأدوات</p>
          )}
        </div>
      )}

      {/* ══ قسم الطبقات الحيّة (ERP + فضائي + بنية تحتية) ══════════════════ */}
      <LiveLayersSection />

      {/* ══ عمليات الخطوط والشبكات (مسارات + عوائق + مواقع) ═══════════════════ */}
      <LinearInfrastructureSection />

      {/* ══ استخراج من OSM ══════════════════════════════════════════════════ */}
      <OsmExtractionSection />

      {/* ══ الأصول الهندسية ═══════════════════════════════════════════════ */}
      <EngineeringAssetsSection />
    </div>
  );
}

// ── مكوّن منفصل لطبقات gisEngine حتى لا تُعيد LeftPanel كلها التصيير عند التغيير ──
const CATEGORY_LABELS: Record<LayerCategory, string> = {
  erp:            'بيانات ERP',
  satellite:      'صور فضائية',
  infrastructure: 'البنية التحتية',
  admin:          'الحدود الإدارية',
};
const CATEGORY_ORDER: LayerCategory[] = ['erp', 'satellite', 'infrastructure', 'admin'];

function LiveLayersSection() {
  const [open, setOpen] = useState(false);
  const toggleLayer  = useGisEngine(s => s.toggleLayer);
  const setOpacity   = useGisEngine(s => s.setLayerOpacity);
  const workspace    = useGisEngine(s => s.workspace);
  const visibility   = useGisEngine(s => s.layerVisibility);
  const opacity      = useGisEngine(s => s.layerOpacity);

  const grouped = React.useMemo(() => {
    const map: Record<LayerCategory, typeof LAYER_REGISTRY> = {
      erp: [], satellite: [], infrastructure: [], admin: [],
    };
    LAYER_REGISTRY.forEach(l => map[l.category].push(l));
    return map;
  }, []);

  return (
    <div className="border-t border-gray-800 flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Globe className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-bold uppercase tracking-wider">الطبقات الحيّة</span>
        <span className="mr-auto text-[10px] text-gray-600">
          {LAYER_REGISTRY.filter(l => visibility[l.id]).length}/{LAYER_REGISTRY.length}
        </span>
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto pb-2">
          {CATEGORY_ORDER.map(cat => {
            const defs = grouped[cat];
            if (!defs.length) return null;
            return (
              <CategorySection
                key={cat}
                label={CATEGORY_LABELS[cat]}
                defs={defs}
                workspace={workspace}
                visibility={visibility}
                opacity={opacity}
                toggleLayer={toggleLayer}
                setOpacity={setOpacity}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function LinearInfrastructureSection() {
  const [open, setOpen] = useState(false);
  const [extractingObstacles, setExtractingObstacles] = useState(false);

  const center = useGisEngine(s => s.center);
  const zoom = useGisEngine(s => s.zoom);
  const setBasemap = useGisEngine(s => s.setBasemap);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const setLayerVisible = useGisEngine(s => s.setLayerVisible);
  const setLastActionSummary = useWorkspaceStore(s => s.setLastActionSummary);

  const setLinearInfrastructureView = () => {
    setLayerVisible('roads', true);
    setLayerVisible('assets', true);
    setLayerVisible('projects', true);
    setLayerVisible('admin_boundaries', true);
  };

  const activateTraceRoute = () => {
    setBasemap('satellite');
    setLinearInfrastructureView();
    setDrawingMode('trace');
    setLastActionSummary({
      type: 'draw',
      title: 'استنباط المسار',
      body: 'تم تفعيل وضع **التتبع الذكي** فوق الطبقات الفضائية. حرّك المؤشر فوق مسار الخط ثم ابدأ الرسم للالتقاط المغناطيسي.',
      timestamp: Date.now(),
    });
  };

  const activateProposedRoute = () => {
    setBasemap('road');
    setLinearInfrastructureView();
    setDrawingMode('line');
    setLastActionSummary({
      type: 'draw',
      title: 'اقتراح مسار جديد',
      body: 'تم تفعيل رسم خط يدوي على الخريطة الأساسية لتخطيط مسار بديل أو توسعة.',
      timestamp: Date.now(),
    });
  };

  const activateSiteDrawing = () => {
    setBasemap('satellite');
    setLinearInfrastructureView();
    setDrawingMode('point');
    setLastActionSummary({
      type: 'draw',
      title: 'رسم موقع ميداني',
      body: 'تم تفعيل وضع النقاط لتسجيل مواقع العبارات، المحطات، أو نقاط الانسداد.',
      timestamp: Date.now(),
    });
  };

  const activatePipelineDrawing = () => {
    setBasemap('satellite');
    setLinearInfrastructureView();
    setDrawingMode('line');
    setLastActionSummary({
      type: 'draw',
      title: 'رسم مسار أنبوب',
      body: 'تم تفعيل رسم خط لمسار الأنبوب. ابدأ من نقطة المنبع ثم أكمل المسار حتى المصب/الموقع المستهدف.',
      timestamp: Date.now(),
    });
  };

  const activateValvePoint = () => {
    setBasemap('satellite');
    setDrawingMode('point');
    setLastActionSummary({
      type: 'draw',
      title: 'تحديد صمام',
      body: 'تم تفعيل نقطة الصمام. انقر على موقع الصمام ثم احفظ الخصائص (رقم الصمام، الحالة، الضغط).',
      timestamp: Date.now(),
    });
  };

  const activateClampPoint = () => {
    setBasemap('satellite');
    setDrawingMode('point');
    setLastActionSummary({
      type: 'draw',
      title: 'تحديد شنبر/مشبك',
      body: 'تم تفعيل نقطة الشنبر. انقر على الموقع الفعلي وسجّل حالة التثبيت والقطر ونوع المعدن.',
      timestamp: Date.now(),
    });
  };

  const activateEquipmentPoint = () => {
    setBasemap('satellite');
    setDrawingMode('point');
    setLastActionSummary({
      type: 'draw',
      title: 'تحديد معدة ميدانية',
      body: 'تم تفعيل نقطة المعدة. انقر على المعدة (حفار، رافعة، مضخة...) ثم أضف رقمها التشغيلي.',
      timestamp: Date.now(),
    });
  };

  const extractObstacleCandidates = async () => {
    setExtractingObstacles(true);
    try {
      const bbox = getBboxFromEngine(center, zoom);
      const obstacleTypes = ['bridge', 'building', 'waterway', 'power', 'barrier'];
      const allFeatures: any[] = [];
      const tenantId = getTenantId();

      for (const assetType of obstacleTypes) {
        const res = await fetch('/api/v1/engineering/extract-from-osm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getTenantHeader() },
          body: JSON.stringify({ asset_type: assetType, bbox, ...(tenantId ? { tenant_id: tenantId } : {}) }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const geojson = data.geojson ?? data;
        const features = Array.isArray(geojson?.features) ? geojson.features : [];
        for (const f of features) {
          allFeatures.push({
            ...f,
            properties: {
              ...(f?.properties ?? {}),
              obstacle_type: assetType,
              source: 'osm_obstacle_scan',
            },
          });
        }
      }

      const merged = {
        type: 'FeatureCollection',
        features: allFeatures,
      };

      window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
        detail: { geojson: merged, assetType: 'obstacles' },
      }));

      setLastActionSummary({
        type: 'query',
        title: 'مسح عوائق المسار',
        body: `تم استنباط **${allFeatures.length}** عنصر محتمل كعوائق من OSM داخل نطاق العرض الحالي.`,
        count: allFeatures.length,
        timestamp: Date.now(),
      });
    } catch {
      setLastActionSummary({
        type: 'query',
        title: 'تعذر مسح العوائق',
        body: 'فشل طلب استنباط العوائق من OSM. جرّب مرة أخرى بعد تثبيت النطاق أو التكبير.',
        timestamp: Date.now(),
      });
    } finally {
      setExtractingObstacles(false);
    }
  };

  return (
    <div className="border-t border-gray-800 flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <PenTool className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-bold uppercase tracking-wider">عمليات الخطوط والشبكات</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <button
            onClick={activateTraceRoute}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-100 hover:bg-cyan-500/20 transition"
          >
            <span>استنباط مسار من المعالم</span>
            <span className="text-[10px] text-cyan-300/80">Trace</span>
          </button>

          <button
            onClick={activateProposedRoute}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-2 text-xs text-indigo-100 hover:bg-indigo-500/20 transition"
          >
            <span>اقتراح مسار هندسي</span>
            <span className="text-[10px] text-indigo-300/80">Line</span>
          </button>

          <button
            onClick={activateSiteDrawing}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 transition"
          >
            <span>رسم موقع / نقطة ميدانية</span>
            <span className="text-[10px] text-emerald-300/80">Point</span>
          </button>

          <div className="pt-1 mt-1 border-t border-gray-700/50" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider px-0.5">أدوات الخطوط والشبكات</p>

          <button
            onClick={activatePipelineDrawing}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-2 text-xs text-blue-100 hover:bg-blue-500/20 transition"
          >
            <span>مسار أنبوب</span>
            <span className="text-[10px] text-blue-300/80">Pipeline</span>
          </button>

          <button
            onClick={activateValvePoint}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-100 hover:bg-rose-500/20 transition"
          >
            <span>تحديد صمام</span>
            <span className="text-[10px] text-rose-300/80">Valve</span>
          </button>

          <button
            onClick={activateClampPoint}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-2.5 py-2 text-xs text-orange-100 hover:bg-orange-500/20 transition"
          >
            <span>تحديد شنبر</span>
            <span className="text-[10px] text-orange-300/80">Clamp</span>
          </button>

          <button
            onClick={activateEquipmentPoint}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-2 text-xs text-violet-100 hover:bg-violet-500/20 transition"
          >
            <span>معدة ميدانية</span>
            <span className="text-[10px] text-violet-300/80">Equipment</span>
          </button>

          <button
            onClick={extractObstacleCandidates}
            disabled={extractingObstacles}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100 hover:bg-amber-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>استنباط عوائق من صور/OSM</span>
            {extractingObstacles
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <AlertCircle className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  label, defs, workspace, visibility, opacity, toggleLayer, setOpacity,
}: {
  label: string;
  defs: typeof LAYER_REGISTRY;
  workspace: string;
  visibility: Record<string, boolean>;
  opacity: Record<string, number>;
  toggleLayer: (id: LayerId) => void;
  setOpacity: (id: LayerId, v: number) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1 text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-wider"
      >
        {open ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        {label}
      </button>
      {open && defs.map(def => {
        const available = def.minWorkspace.includes(workspace as any);
        const isOn = visibility[def.id] ?? false;
        const op   = opacity[def.id] ?? 0.8;
        return (
          <div
            key={def.id}
            className={`flex items-center gap-2 px-3 py-1 rounded mx-1 transition-colors ${
              available ? 'hover:bg-gray-800/60' : 'opacity-30 pointer-events-none'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: def.color }} />
            <span className="flex-1 text-xs text-gray-300 truncate">{def.labelAr}</span>
            {isOn && (
              <input
                type="range" min={0} max={1} step={0.05}
                value={op}
                onChange={e => setOpacity(def.id, parseFloat(e.target.value))}
                className="w-12 h-1 accent-blue-500"
                title={`${Math.round(op * 100)}%`}
              />
            )}
            <button
              onClick={() => toggleLayer(def.id)}
              className={`flex-shrink-0 ${isOn ? 'text-blue-400' : 'text-gray-600'}`}
              title={isOn ? 'إخفاء' : 'إظهار'}
            >
              {isOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// استخراج من OpenStreetMap — يُظهر نتائج على الخريطة ويحفظها في قاعدة البيانات
// ══════════════════════════════════════════════════════════════════════════════
function getBboxFromEngine(center: [number, number], zoom: number): [number,number,number,number] {
  const deg = Math.min(360 / Math.pow(2, zoom) * 2, 8);
  const [lon, lat] = center;
  return [lon - deg, lat - deg * 0.6, lon + deg, lat + deg * 0.6];
}

function OsmExtractionSection() {
  const [open, setOpen] = useState(false);
  const [assetTypes, setAssetTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ count: number; geojson: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const center = useGisEngine(s => s.center);
  const zoom = useGisEngine(s => s.zoom);

  // جلب أنواع الأصول عند فتح القسم
  useEffect(() => {
    if (!open || assetTypes.length > 0) return;
    fetch(`/api/v1/engineering/extract/asset-types`, {
      headers: getTenantHeader(),
    })
      .then(r => r.json())
      .then(d => setAssetTypes(Array.isArray(d) ? d : (d.types ?? [])))
      .catch(() => setAssetTypes(['road', 'building', 'water', 'power', 'landuse']));
  }, [open, assetTypes.length]);

  async function handleExtract() {
    if (!selectedType) return;
    setExtracting(true);
    setError(null);
    setResult(null);
    try {
      const bbox = getBboxFromEngine(center, zoom);
      const tenantId = getTenantId();
      const res = await fetch('/api/v1/engineering/extract-from-osm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getTenantHeader() },
        body: JSON.stringify({ asset_type: selectedType, bbox, ...(tenantId ? { tenant_id: tenantId } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const geojson = data.geojson ?? data;
      const count = geojson?.features?.length ?? 0;
      setResult({ count, geojson });
      // معاينة على الخريطة
      window.dispatchEvent(new CustomEvent('engineering:preview-geojson', { detail: { geojson, assetType: selectedType } }));
    } catch (e: any) {
      setError(e.message ?? 'خطأ في الاستخراج');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!result?.geojson) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/engineering/bulk-ingest', {
        method: 'POST',
        headers: getTenantHeader(),
        body: (() => {
          const fd = new FormData();
          const blob = new Blob([JSON.stringify(result.geojson)], { type: 'application/json' });
          fd.append('file', blob, `osm_${selectedType}.geojson`);
          fd.append('asset_type', selectedType);
          const tenantId = getTenantId();
          if (tenantId) fd.append('tenant_id', tenantId);
          return fd;
        })(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(prev => prev ? { ...prev, saved: true } as any : null);
    } catch (e: any) {
      setError(e.message ?? 'خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-gray-800 flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Download className="w-3.5 h-3.5 text-orange-400" />
        <span className="font-bold uppercase tracking-wider">استخراج OSM</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <select
            value={selectedType}
            onChange={e => { setSelectedType(e.target.value); setResult(null); }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
          >
            <option value="">— اختر نوع الأصل —</option>
            {assetTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            onClick={handleExtract}
            disabled={!selectedType || extracting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 text-xs py-1.5 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {extracting ? 'جارٍ الاستخراج…' : 'استخراج من المنطقة الحالية'}
          </button>

          {result && (
            <div className="bg-gray-800/50 rounded-lg px-2 py-1.5 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-300">
                <span className="text-orange-400 font-bold">{result.count}</span> عنصر مستخرج
                {(result as any).saved && <span className="mr-1 text-green-400">· محفوظ ✓</span>}
              </span>
              {!(result as any).saved && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-100"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {saving ? 'حفظ…' : 'حفظ في DB'}
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// الأصول الهندسية — عرض وتصفية الأصول المحفوظة في قاعدة البيانات
// ══════════════════════════════════════════════════════════════════════════════
const ASSET_TYPE_COLORS: Record<string, string> = {
  road: '#f97316', building: '#6366f1', water: '#38bdf8',
  power: '#facc15', landuse: '#4ade80', default: '#94a3b8',
};

interface EngAsset {
  id: string | number;
  name?: string;
  asset_type?: string;
  status?: string;
  created_at?: string;
  properties?: Record<string, any>;
}

function EngineeringAssetsSection() {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<EngAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadAssets() {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getTenantId();
      const assetsUrl = tenantId ? `/api/v1/engineering/assets?tenant_id=${tenantId}` : '/api/v1/engineering/assets';
      const res = await fetch(assetsUrl, {
        headers: getTenantHeader(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : (data.assets ?? data.features ?? []));
    } catch (e: any) {
      setError(e.message ?? 'خطأ في تحميل الأصول');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && assets.length === 0 && !loading) {
      loadAssets();
    }
  }, [open]);

  // قائمة الإدارات والأنواع والحالات الفريدة
  const uniqueDepts = [...new Set(assets.map(a => a.properties?.owner_department || a.properties?.department || '').filter(Boolean))];
  const uniqueTypes = [...new Set(assets.map(a => a.asset_type || '').filter(Boolean))];
  const uniqueStatuses = [...new Set(assets.map(a => a.properties?.status || a.status || 'active').filter(Boolean))];

  const filtered = assets.filter(a => {
    const q = searchFilter.toLowerCase();
    const matchSearch = !q || 
      String(a.name ?? '').toLowerCase().includes(q) ||
      String(a.asset_type ?? '').toLowerCase().includes(q);
    
    const matchDept = !deptFilter || 
      (a.properties?.owner_department === deptFilter || a.properties?.department === deptFilter);
    
    const matchType = !typeFilter || a.asset_type === typeFilter;
    
    const matchStatus = !statusFilter || 
      (a.properties?.status === statusFilter || a.status === statusFilter);
    
    return matchSearch && matchDept && matchType && matchStatus;
  });

  return (
    <div className="border-t border-gray-800 flex-shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Database className="w-3.5 h-3.5 text-violet-400" />
        <span className="font-bold uppercase tracking-wider">الأصول الهندسية</span>
        {assets.length > 0 && (
          <span className="mr-auto text-[10px] bg-violet-500/20 text-violet-300 rounded px-1.5 py-0.5">
            {assets.length}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); loadAssets(); }}
          className="text-gray-600 hover:text-gray-300 p-0.5 rounded"
          title="تحديث"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* البحث السريع */}
          <div className="relative">
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input
              type="text"
              placeholder="ابحث عن أصل…"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pr-7 pl-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500 placeholder-gray-600"
              dir="rtl"
            />
          </div>

          {/* الفلاتر المتقدمة */}
          <div className="grid grid-cols-3 gap-1.5">
            {/* فلتر الإدارة */}
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-blue-500"
              dir="rtl"
            >
              <option value="">الإدارة</option>
              {uniqueDepts.map(d => (
                <option key={d} value={d}>{d || 'بدون'}</option>
              ))}
            </select>

            {/* فلتر النوع */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-green-500"
              dir="rtl"
            >
              <option value="">النوع</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{t || 'بدون'}</option>
              ))}
            </select>

            {/* فلتر الحالة */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-amber-500"
              dir="rtl"
            >
              <option value="">الحالة</option>
              {uniqueStatuses.map(s => (
                <option key={s} value={s}>{s || 'بدون'}</option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</p>
          )}

          {!loading && filtered.length === 0 && !error && (
            <p className="text-xs text-gray-600 text-center py-2">لا توجد أصول مطابقة</p>
          )}

          {/* عدد الأصول المعروضة */}
          {!loading && assets.length > 0 && (
            <p className="text-[10px] text-gray-500 text-center">
              {filtered.length} من {assets.length} أصول
            </p>
          )}

          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {filtered.map((asset, idx) => {
              const color = ASSET_TYPE_COLORS[asset.asset_type ?? ''] ?? ASSET_TYPE_COLORS.default;
              const dept = asset.properties?.owner_department || asset.properties?.department || 'بدون إدارة';
              const status = asset.properties?.status || asset.status || '—';
              return (
                <div
                  key={asset.id ?? idx}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/60 transition cursor-pointer border border-transparent hover:border-gray-700"
                >
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate font-medium">
                      {asset.name ?? asset.properties?.name ?? `أصل #${asset.id}`}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {dept} • {asset.asset_type || '—'} • {status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
