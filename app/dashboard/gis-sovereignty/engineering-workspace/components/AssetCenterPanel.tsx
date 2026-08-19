'use client';
/**
 * AssetCenterPanel — مركز الأصل المتكامل
 * ═══════════════════════════════════════════════════════════════
 * ينزلق من اليمين عند النقر على أي أصل على الخريطة.
 * يعرض 4 تبويبات:
 *   1. الجغرافي   — الموقع، نوع الهندسة، الإحداثيات، الطبقة
 *   2. الإداري    — الوثائق والعقود والمراسلات
 *   3. التقني     — الأدلة والتعليمات وأوامر الصيانة
 *   4. المالي     — تكاليف الإنشاء والصيانة والتشغيل
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  X, MapPin, FileText, Wrench, DollarSign, Building2,
  User, Plus, Trash2, Loader2, RefreshCw, ChevronRight,
  Calendar, Hash, Layers, Activity, LayoutGrid, Package,
  ChevronDown, Boxes, Pencil, Check, Cpu, TrendingUp, ShoppingCart,
  Zap, Wind, Wifi, Monitor, GitBranch, ArrowRight,
} from 'lucide-react';
import { workspaceApi } from '@/store/apiService';
import { useToast } from '@/components/ToastProvider';
import { getAllowedDocumentTypes, getInfoLayerLabel, getWritableTabs, resolveAssetInfoLayer } from '@/lib/gis/assetInformationLayers';
import {
  InfoCard,
  Row,
  DocCard,
  SectionHeader,
  EmptyState,
  AddDialog,
  CompoundChildrenTab,
  Field,
} from './AssetCenterPanelSections';

// ── Types ────────────────────────────────────────────────────────────────────

interface AssetCenterData {
  asset: Record<string, any>;
  coordinates: { lon: number; lat: number } | null;
  geometry_type: string | null;
  documents: DocumentRecord[];
  employees: EmployeeRecord[];
  financials: FinancialRecord[];
  financial_summary: {
    totals_by_type: Record<string, number>;
    grand_total: number;
    currency: string;
  };
  doc_counts: {
    admin: number;
    technical: number;
    financial: number;
    total: number;
  };
}

interface DocumentRecord {
  id: string;
  doc_type: string;
  title: string;
  file_url?: string;
  file_size?: number;
  department?: string;
  notes?: string;
  uploaded_by?: string;
  created_at: string;
}

interface EmployeeRecord {
  id: string;
  employee_id?: number;
  employee_name?: string;
  role: string;
  department?: string;
  linked_by?: string;
  created_at: string;
}

function getTenantHeader(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

interface FinancialRecord {
  id: string;
  financial_type: string;
  amount?: number;
  currency: string;
  description?: string;
  financial_date?: string;
  reference_number?: string;
  created_by?: string;
  created_at: string;
}

interface ChildAsset {
  id: string;
  asset_name: string;
  asset_type: string;
  owning_department: string;
  status: string;
  health_score: number;
  total_cost: number;
  doc_count: number;
  emp_count: number;
  installation_date?: string;
  created_at?: string;
}

interface ChildrenData {
  parent: Record<string, any>;
  children_by_department: Record<string, ChildAsset[]>;
  total_children: number;
  total_cost: number;
  currency: string;
  departments: string[];
}

interface AssetComponent {
  id: string;
  asset_id: string;
  component_name: string;
  component_type: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  currency: string;
  condition: string;
  description?: string;
  purchase_order_ref?: string;
  purchase_date?: string;
  created_at?: string;
}

interface ComponentsData {
  items: AssetComponent[];
  total_count: number;
  grand_total: number;
  currency: string;
  by_type: Record<string, number>;
}

interface CompletionScore {
  score: number;
  breakdown: Record<string, number>;
  is_center: boolean;
  label: string;
}

interface AuditEvent {
  id: string;
  kind: 'asset' | 'document' | 'employee' | 'financial' | 'component' | 'child';
  title: string;
  subtitle: string;
  at?: string;
  by?: string;
}

interface Props {
  assetId: string | null;
  panelWidth?: number;
  onClose: () => void;
  onSelectChild?: (childId: string) => void;
  onRedrawGeometry?: (geometryType: string | null) => void;
}
const FALLBACK_ASSET_CENTER = (assetId: string): AssetCenterData => ({
  asset: {
    id: assetId,
    asset_name: 'الأصل غير متاح',
    asset_type: 'غير متوفر',
    status: 'legacy',
    created_at: null,
  },
  coordinates: null,
  geometry_type: null,
  documents: [],
  employees: [],
  financials: [],
  financial_summary: { totals_by_type: {}, grand_total: 0, currency: 'LYD' },
  doc_counts: { admin: 0, technical: 0, financial: 0, total: 0 },
});

// ── Constants ────────────────────────────────────────────────────────────────

const TABS_BASE = [
  { id: 'geo',        label: 'الجغرافي',   icon: MapPin,      color: 'text-sky-400',     bg: 'bg-sky-500/20 border-sky-500/40' },
  { id: 'admin',      label: 'الإداري',    icon: FileText,    color: 'text-amber-400',   bg: 'bg-amber-500/20 border-amber-500/40' },
  { id: 'technical',  label: 'التقني',     icon: Wrench,      color: 'text-violet-400',  bg: 'bg-violet-500/20 border-violet-500/40' },
  { id: 'financial',  label: 'المالي',     icon: DollarSign,  color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40' },
  { id: 'components', label: 'المكونات',   icon: Cpu,         color: 'text-cyan-400',    bg: 'bg-cyan-500/20 border-cyan-500/40' },
] as const;

const TAB_COMPOUND = { id: 'children', label: 'الأصول الداخلية', icon: Boxes, color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40' } as const;
const TAB_AUDIT = { id: 'audit', label: 'التتبع', icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-500/20 border-indigo-500/40' } as const;

type TabId = 'geo' | 'admin' | 'technical' | 'financial' | 'components' | 'children' | 'audit';
const ALL_TABS: TabId[] = ['geo', 'admin', 'technical', 'financial', 'components', 'audit'];
const READABLE_TABS: TabId[] = ['geo', 'admin', 'technical', 'financial', 'components', 'children', 'audit'];

const DEPT_LABELS: Record<string, { label: string; color: string }> = {
  technical:  { label: 'فنية / تشغيل',   color: 'text-violet-400 bg-violet-500/20 border-violet-500/30' },
  facilities: { label: 'مباني / منشآت',  color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
  services:   { label: 'خدمات / مركبات', color: 'text-sky-400 bg-sky-500/20 border-sky-500/30' },
  hr:         { label: 'شؤون الموظفين',  color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
  maintenance:{ label: 'صيانة',           color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' },
  finance:    { label: 'مالية',           color: 'text-green-400 bg-green-500/20 border-green-500/30' },
  general:    { label: 'عام',             color: 'text-slate-400 bg-slate-500/20 border-slate-500/30' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  admin:     'إداري',
  technical: 'تقني',
  financial: 'مالي',
  contract:  'عقد',
  manual:    'دليل تشغيل',
  drawing:   'رسم هندسي',
  photo:     'صورة',
  other:     'أخرى',
};

const FIN_TYPE_LABELS: Record<string, string> = {
  construction: 'تكلفة إنشاء',
  maintenance:  'صيانة',
  operation:    'تشغيل',
  purchase:     'شراء',
  contract:     'عقد',
  other:        'أخرى',
};

const EMP_ROLE_LABELS: Record<string, string> = {
  responsible: 'مسؤول',
  operator:    'مشغّل',
  supervisor:  'مشرف',
  maintainer:  'فني صيانة',
};

const GEOM_TYPE_LABELS: Record<string, string> = {
  Point:      'نقطة',
  LineString: 'خط',
  Polygon:    'مضلع',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:       { label: 'نشط',            color: 'text-emerald-400 bg-emerald-500/20' },
  handed_over:  { label: 'تم التسليم',     color: 'text-blue-400 bg-blue-500/20' },
  legacy:       { label: 'موروث',          color: 'text-slate-400 bg-slate-500/20' },
  in_progress:  { label: 'قيد التنفيذ',    color: 'text-amber-400 bg-amber-500/20' },
  completed:    { label: 'مكتمل',          color: 'text-emerald-400 bg-emerald-500/20' },
  planned:      { label: 'مخطط',           color: 'text-sky-400 bg-sky-500/20' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, decimals = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('ar-LY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('ar-LY');
  } catch {
    return s;
  }
}

type DocConflictDecision = 'replace' | 'add' | 'cancel';

function normalizeDocText(input: unknown): string {
  return String(input || '').trim().toLowerCase();
}

async function askDocConflictDecision(title: string): Promise<DocConflictDecision> {
  if (typeof window === 'undefined') return 'cancel';
  const userInput = window.prompt(
    [
      `الملف "${title || 'بدون عنوان'}" موجود مسبقًا على هذا الأصل.`,
      'اختر الإجراء:',
      '1 = استبدال الملف الحالي',
      '2 = إضافة نسخة جديدة',
      '3 = إلغاء الرفع',
    ].join('\n'),
    '3'
  );

  if (userInput == null) return 'cancel';
  const normalized = String(userInput).trim();
  if (normalized === '1') return 'replace';
  if (normalized === '2') return 'add';
  return 'cancel';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AssetCenterPanel({ assetId, panelWidth = 300, onClose, onSelectChild, onRedrawGeometry }: Props) {
  const { showToast } = useToast();
  const [data, setData]                     = useState<AssetCenterData | null>(null);
  const [childrenData, setChildrenData]     = useState<ChildrenData | null>(null);
  const [componentsData, setComponentsData] = useState<ComponentsData | null>(null);
  const [completion, setCompletion]         = useState<CompletionScore | null>(null);
  const [address, setAddress]               = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);
  const [activeTab, setActiveTab]           = useState<TabId>('geo');

  // Add-record dialog state
  const [addMode, setAddMode]         = useState<'doc' | 'emp' | 'fin' | 'child' | 'comp' | null>(null);
  const [formData, setFormData]       = useState<Record<string, string>>({});
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [saving, setSaving]           = useState(false);

  // Edit principal asset
  const [editMode, setEditMode]       = useState(false);
  const [editFields, setEditFields]   = useState<{ name: string; classification: string; owner_department: string; status: string }>({ name: '', classification: '', owner_department: '', status: '' });
  const [editSaving, setEditSaving]   = useState(false);

  const isAdminMode = typeof window !== 'undefined' && localStorage.getItem('admin_mode') === '1';
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
  const userDept = typeof window !== 'undefined' ? localStorage.getItem('user_department') : null;
  const userName = typeof window !== 'undefined'
    ? (localStorage.getItem('user_name') || localStorage.getItem('full_name') || localStorage.getItem('username'))
    : null;
  const infoLayer = resolveAssetInfoLayer(userRole, userDept);
  const infoLayerLabel = getInfoLayerLabel(infoLayer);
  const writableTabs = getWritableTabs(infoLayer, isAdminMode);
  const allowedTabIds = READABLE_TABS;
  const allowedDocTypes = getAllowedDocumentTypes(infoLayer, isAdminMode);
  const sourceDept = userDept || infoLayer;
  const actorLabel = userName || userRole || 'unknown';
  const buildAuditStamp = (action: string) =>
    `[source:${sourceDept}|layer:${infoLayer}|by:${actorLabel}|at:${new Date().toISOString()}|action:${action}]`;

  useEffect(() => {
    if (addMode !== 'doc') setSelectedDocFile(null);
  }, [addMode]);

  const auditEvents = React.useMemo<AuditEvent[]>(() => {
    if (!data) return [];
    const events: AuditEvent[] = [];
    events.push({
      id: `asset-${assetId}`,
      kind: 'asset',
      title: 'إنشاء الأصل',
      subtitle: data.asset?.asset_name ?? 'الأصل',
      at: data.asset?.created_at,
      by: data.asset?.created_by,
    });
    data.documents.forEach((d) => {
      events.push({
        id: `doc-${d.id}`,
        kind: 'document',
        title: `وثيقة: ${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}`,
        subtitle: d.title,
        at: d.created_at,
        by: d.uploaded_by || d.department,
      });
    });
    data.employees.forEach((e) => {
      events.push({
        id: `emp-${e.id}`,
        kind: 'employee',
        title: 'ربط موظف',
        subtitle: `${e.employee_name ?? '—'} (${EMP_ROLE_LABELS[e.role] ?? e.role})`,
        at: e.created_at,
        by: e.linked_by || e.department,
      });
    });
    data.financials.forEach((f) => {
      events.push({
        id: `fin-${f.id}`,
        kind: 'financial',
        title: `قيد مالي: ${FIN_TYPE_LABELS[f.financial_type] ?? f.financial_type}`,
        subtitle: `${fmt(f.amount, 3)} ${f.currency}`,
        at: f.created_at,
        by: f.created_by,
      });
    });
    componentsData?.items.forEach((c) => {
      events.push({
        id: `comp-${c.id}`,
        kind: 'component',
        title: `مكوّن: ${COMP_TYPE_LABELS[c.component_type]?.label ?? c.component_type}`,
        subtitle: c.component_name,
        at: c.created_at,
      });
    });
    Object.values(childrenData?.children_by_department ?? {}).flat().forEach((c) => {
      events.push({
        id: `child-${c.id}`,
        kind: 'child',
        title: 'إضافة أصل داخلي',
        subtitle: c.asset_name,
        at: c.created_at,
      });
    });
    return events.sort((a, b) => {
      const aTs = a.at ? Date.parse(a.at) : 0;
      const bTs = b.at ? Date.parse(b.at) : 0;
      return bTs - aTs;
    });
  }, [data, componentsData, childrenData, assetId]);

  const openEdit = () => {
    if (!data) return;
    const a = data.asset;
    setEditFields({
      name: a.asset_name ?? '',
      classification: a.classification ?? '',
      owner_department: a.owner_department ?? '',
      status: a.handover_status ?? a.status ?? 'active',
    });
    setEditMode(true);
  };

  const handleDeleteAsset = async () => {
    if (!assetId) return;
    const assetName = data?.asset?.asset_name ?? 'الأصل';
    if (!window.confirm(`هل تريد حذف "${assetName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    
    try {
      let res: Response;
      try {
        res = await fetch(`/api/v1/workspace/assets/${assetId}`, { method: 'DELETE' });
      } catch {
        res = await fetch(`/api/engineering/workspace/principal-assets/${assetId}`, {
          method: 'DELETE',
          headers: getTenantHeader(),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `خطأ ${res.status}`);
      }
      showToast(`✅ تم حذف "${assetName}" بنجاح`, 'success');
      onClose();
    } catch (e: any) {
      showToast(`فشل الحذف: ${e.message}`, 'error');
    }
  };

  const handleDeleteChildAsset = async (childId: string, childName: string) => {
    if (!childId) return;
    if (!window.confirm(`هل تريد حذف "${childName}"؟`)) return;

    try {
      let res: Response;
      try {
        res = await fetch(`/api/v1/workspace/assets/${childId}`, { method: 'DELETE' });
      } catch {
        res = await fetch(`/api/engineering/workspace/principal-assets/${childId}`, {
          method: 'DELETE',
          headers: getTenantHeader(),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `خطأ ${res.status}`);
      }
      showToast(`✅ تم حذف "${childName}"`, 'success');
      load();
    } catch (e: any) {
      showToast(`فشل حذف العنصر: ${e.message}`, 'error');
    }
  };

  const saveEdit = async () => {
    if (!assetId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/engineering/workspace/principal-assets/${assetId}`, {
        method: 'PATCH',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editFields),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `خطأ ${res.status}`);
      showToast('✅ تم تحديث بيانات الأصل', 'success');
      setEditMode(false);
      load();
    } catch (e: any) {
      showToast(`فشل التحديث: ${e.message}`, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const d = await workspaceApi.getAssetCenter(assetId);
      setData(d);
      // Always load children (not just for compound)
      try {
        const ch = await workspaceApi.getAssetChildren(assetId);
        setChildrenData(ch.total_children > 0 ? ch : null);
      } catch { setChildrenData(null); }
      // Load components & completion score in parallel
      const [compRes, scoreRes] = await Promise.allSettled([
        fetch(`/api/v1/workspace/assets/${assetId}/components`, { headers: getTenantHeader() }).then(r => r.json()),
        fetch(`/api/v1/workspace/assets/${assetId}/completion-score`, { headers: getTenantHeader() }).then(r => r.json()),
      ]);
      if (compRes.status === 'fulfilled') setComponentsData(compRes.value);
      if (scoreRes.status === 'fulfilled') setCompletion(scoreRes.value);
      // Reverse geocoding for address
      if (d.coordinates?.lat && d.coordinates?.lon) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${d.coordinates.lat}&lon=${d.coordinates.lon}&accept-language=ar&zoom=14`, {
          headers: { 'User-Agent': 'DigitalSovereigntyGIS/1.0' }
        })
          .then(r => r.json())
          .then(geo => {
            const a = geo.address || {};
            const parts = [
              a.road || a.pedestrian || a.highway,
              a.suburb || a.neighbourhood || a.quarter,
              a.city || a.town || a.village || a.municipality,
              a.county || a.state_district,
            ].filter(Boolean);
            setAddress(parts.length ? parts.join('، ') : geo.display_name?.split(',').slice(0, 3).join('،') || null);
          })
          .catch(() => setAddress(null));
      }
    } catch (e: any) {
      const message = String(e?.message ?? e);
      if (/404|Asset not found/i.test(message)) {
        setData(FALLBACK_ASSET_CENTER(assetId));
        setChildrenData(null);
        setComponentsData(null);
        setCompletion(null);
        setAddress(null);
        setActiveTab('geo');
        showToast('الأصل موجود لكن بيانات المركز غير مكتملة. يمكنك حذفه أو تعديل بياناته الأساسية.', 'warning');
      } else {
        showToast(`خطأ في تحميل بيانات الأصل: ${message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [assetId, showToast]);

  // Shared asset model: all departments can read all tabs; writes are restricted by info layer.

  useEffect(() => {
    if (assetId) {
      setData(null);
      setChildrenData(null);
      setComponentsData(null);
      setCompletion(null);
      setAddress(null);
      // Jump to first allowed tab instead of always 'geo'
      setActiveTab(allowedTabIds[0] ?? 'geo');
      load();
    }
  }, [assetId]);

  if (!assetId) return null;

  const isCompound = data?.asset?.asset_category === 'compound';
  const TABS = (isCompound ? [...TABS_BASE, TAB_COMPOUND, TAB_AUDIT] : [...TABS_BASE, TAB_AUDIT])
    .filter(t => allowedTabIds.includes(t.id as TabId));

  // ── Save handlers ──────────────────────────────────────────────────────────

  const handleSaveDoc = async () => {
    if (!formData.title) { showToast('أدخل عنوان الوثيقة', 'error'); return; }
    if (!writableTabs.includes('admin') && !writableTabs.includes('technical') && !writableTabs.includes('financial')) {
      showToast('صلاحيتك لا تسمح بإضافة وثائق على هذا الأصل', 'error');
      return;
    }
    if (!allowedDocTypes.includes(formData.doc_type || 'other')) {
      showToast(`نوع الوثيقة غير مسموح ضمن ${infoLayerLabel}`, 'error');
      return;
    }
    setSaving(true);
    try {
      let resolvedFileUrl: string | undefined = formData.file_url || undefined;
      let resolvedFileSize: number | undefined;

      if (selectedDocFile) {
        const uploadForm = new FormData();
        uploadForm.append('file', selectedDocFile);
        uploadForm.append('docType', formData.doc_type || 'other');

        const uploadRes = await fetch('/api/engineering/workspace/uploads', {
          method: 'POST',
          headers: getTenantHeader(),
          body: uploadForm,
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData?.fileUrl) {
          throw new Error(uploadData?.error || `فشل رفع الملف (HTTP ${uploadRes.status})`);
        }

        resolvedFileUrl = String(uploadData.fileUrl);
        resolvedFileSize = Number(uploadData.fileSize) || undefined;
      }

      const latestCenter = await workspaceApi.getAssetCenter(assetId);
      const existingDocs = Array.isArray(latestCenter?.documents) ? latestCenter.documents : [];
      const targetTitle = String(formData.title || selectedDocFile?.name || '').trim();
      const targetTitleNorm = normalizeDocText(targetTitle);
      const conflicts = existingDocs.filter((d: any) => {
        const sameFile = resolvedFileUrl && String(d?.file_url || '').trim() === resolvedFileUrl;
        const sameTitle = targetTitleNorm.length > 0 && normalizeDocText(d?.title) === targetTitleNorm;
        return Boolean(sameFile || sameTitle);
      });

      if (conflicts.length > 0) {
        const decision = await askDocConflictDecision(targetTitle || 'وثيقة');
        if (decision === 'cancel') {
          showToast('تم إلغاء عملية الرفع.', 'info');
          setSaving(false);
          return;
        }

        if (decision === 'replace') {
          for (const doc of conflicts) {
            const docId = String(doc?.id || '').trim();
            if (!docId) continue;
            await workspaceApi.deleteAssetDocument(assetId, docId);
          }
          showToast(`تمت إزالة ${conflicts.length} ملف قديم وسيتم الاستبدال الآن.`, 'info');
        }
      }

      await workspaceApi.addAssetDocument(assetId, {
        doc_type:   formData.doc_type   || 'other',
        title:      formData.title,
        file_url:   resolvedFileUrl,
        file_size:  resolvedFileSize,
        department: formData.department || infoLayerLabel,
        notes:      [formData.notes, buildAuditStamp('document.create')].filter(Boolean).join(' '),
      });

      let ingestStats: { ingested: number; needsOcr: number } | null = null;
      try {
        const ingestRes = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/ingest`, {
          method: 'POST',
          headers: getTenantHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(resolvedFileUrl ? { onlyFileUrls: [resolvedFileUrl] } : {}),
        });
        const ingestData = await ingestRes.json().catch(() => ({}));
        if (ingestRes.ok && ingestData?.ok) {
          ingestStats = {
            ingested: Number(ingestData?.stats?.ingested_sources || 0),
            needsOcr: Number(ingestData?.stats?.needs_ocr_sources || 0),
          };
        }
      } catch {
        // Keep document save successful even if indexing fails.
      }

      window.dispatchEvent(new CustomEvent('engineering:asset-doc-updated', {
        detail: { assetId, delta: 1 },
      }));
      showToast('تم إرفاق الوثيقة', 'success');
      if (ingestStats) {
        showToast(`تم تحديث معرفة الأصل: ${ingestStats.ingested} معالجة نصية، ${ingestStats.needsOcr} تحتاج OCR`, 'info');
      }
      setAddMode(null);
      setFormData({});
      setSelectedDocFile(null);
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmp = async () => {
    if (!formData.employee_name) { showToast('أدخل اسم الموظف', 'error'); return; }
    if (!writableTabs.includes('technical')) { showToast('ربط الموظفين متاح للطبقة الفنية فقط', 'error'); return; }
    setSaving(true);
    try {
      await workspaceApi.linkAssetEmployee(assetId, {
        employee_name: formData.employee_name,
        role:          formData.role       || 'responsible',
        department:    formData.department || infoLayerLabel,
        linked_by:     buildAuditStamp('employee.link'),
      });
      showToast('تم ربط الموظف بالأصل', 'success');
      setAddMode(null);
      setFormData({});
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFin = async () => {
    if (!formData.amount) { showToast('أدخل المبلغ', 'error'); return; }
    if (!writableTabs.includes('financial')) { showToast('القيود المالية متاحة للطبقة المالية فقط', 'error'); return; }
    setSaving(true);
    try {
      await workspaceApi.addAssetFinancial(assetId, {
        financial_type:   formData.financial_type   || 'other',
        amount:           parseFloat(formData.amount),
        currency:         formData.currency          || 'LYD',
        description:      [formData.description, buildAuditStamp('financial.create')].filter(Boolean).join(' '),
        financial_date:   formData.financial_date    || undefined,
        reference_number: formData.reference_number  || undefined,
        created_by:       buildAuditStamp('financial.author'),
      });
      showToast('تم تسجيل القيد المالي', 'success');
      setAddMode(null);
      setFormData({});
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComp = async () => {
    if (!formData.component_name) { showToast('أدخل اسم المكوّن', 'error'); return; }
    if (!writableTabs.includes('components')) { showToast('إضافة المكونات متاحة لطبقة الصيانة/المباني/المواد', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/workspace/assets/${assetId}/components`, {
        method: 'POST',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          component_name:     formData.component_name,
          component_type:     formData.component_type     || 'general',
          quantity:           parseFloat(formData.quantity     || '1'),
          unit:               formData.unit               || 'قطعة',
          unit_cost:          parseFloat(formData.unit_cost    || '0'),
          currency:           formData.currency           || 'LYD',
          condition:          formData.condition          || 'good',
          description:        [formData.description, buildAuditStamp('component.create')].filter(Boolean).join(' '),
          purchase_order_ref: formData.purchase_order_ref || undefined,
          purchase_date:      formData.purchase_date      || undefined,
        }),
      });
      if (!res.ok) throw new Error(`خطأ ${res.status}`);
      showToast('تم إضافة المكوّن', 'success');
      setAddMode(null);
      setFormData({});
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComp = async (compId: string) => {
    try {
      await fetch(`/api/v1/workspace/assets/${assetId}/components/${compId}`, {
        method: 'DELETE',
        headers: getTenantHeader(),
      });
      showToast('تم حذف المكوّن', 'success');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await workspaceApi.deleteAssetDocument(assetId, docId);
      showToast('تم حذف الوثيقة', 'success');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleUnlinkEmp = async (empId: string) => {
    try {
      await workspaceApi.unlinkAssetEmployee(assetId, empId);
      showToast('تم إلغاء الربط', 'success');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleDeleteFin = async (finId: string) => {
    try {
      await workspaceApi.deleteAssetFinancial(assetId, finId);
      showToast('تم حذف القيد المالي', 'success');
      load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const asset = data?.asset ?? {};
  const statusInfo = STATUS_LABELS[asset.handover_status ?? asset.status] ?? { label: asset.status ?? '—', color: 'text-slate-400 bg-slate-500/20' };

  return (
    <div
      dir="rtl"
      className="flex flex-col h-full shrink-0 z-10
                 bg-slate-900 border-l border-slate-700 shadow-xl
                 transition-[border] duration-150 overflow-hidden"
      style={{ width: panelWidth }}
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-800/60">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <h2 className="text-base font-bold text-white truncate">
                {loading ? 'جارٍ التحميل...' : (asset.asset_name ?? 'مركز الأصل')}
              </h2>
              {completion?.is_center && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold flex-shrink-0">
                  مركز ✓
                </span>
              )}
            </div>
            {/* Address line */}
            {address && (
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="text-sm text-sky-300 truncate">{address}</span>
              </div>
            )}
            {!loading && asset.asset_type && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-300">{asset.asset_type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!loading && assetId && (
              <>
                <a
                  href={`/dashboard/asset-360/${assetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="أصل 360°"
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/15 border border-cyan-700/40 hover:border-cyan-500/60 transition-colors"
                >
                  360°
                </a>
                <button
                  onClick={openEdit}
                  title="تعديل الاسم والتصنيف والإدارة المالكة (اضغط هنا)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/15 transition-colors group"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden group-hover:block absolute bottom-full left-0 bg-slate-800 text-amber-300 text-xs rounded px-2 py-1 whitespace-nowrap mb-1 border border-amber-500/30">
                  تعديل الأصل
                </span>
              </button>
              <button
                onClick={handleDeleteAsset}
                title="حذف هذا الأصل نهائياً"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-colors group"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden group-hover:block absolute bottom-full left-0 bg-slate-800 text-red-400 text-xs rounded px-2 py-1 whitespace-nowrap mb-1 border border-red-500/30">
                  حذف الأصل
                </span>
              </button>
              </>
            )}
            <button
              onClick={load}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* ── Completion bar ── */}
        {completion && (
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">اكتمال التوثيق</span>
              <span className={`text-xs font-bold ${completion.score >= 80 ? 'text-emerald-400' : completion.score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {completion.score}% — {completion.label}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  completion.score >= 80 ? 'bg-emerald-500' :
                  completion.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${completion.score}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editMode && (
        <div className="absolute inset-0 z-[9100] flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[340px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">تعديل الأصل الرئيسي</h3>
              </div>
              <button onClick={() => setEditMode(false)} className="text-slate-500 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="text-xs text-amber-300/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 mb-2">
                ✎ يمكنك تحديث اسم الأصل والتصنيف والإدارة المالكة والحالة
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">الاسم</label>
                <input
                  type="text"
                  value={editFields.name}
                  onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">التصنيف</label>
                <select
                  value={editFields.classification}
                  onChange={e => setEditFields(f => ({ ...f, classification: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">— بدون —</option>
                  <option value="water_infrastructure">بنية تحتية مائية</option>
                  <option value="electricity_infrastructure">بنية تحتية كهربائية</option>
                  <option value="road_infrastructure">بنية تحتية طرق</option>
                  <option value="building">مبنى / منشأة</option>
                  <option value="industrial">صناعي</option>
                  <option value="residential">سكني</option>
                  <option value="commercial">تجاري</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">الإدارة المالكة</label>
                <select
                  value={editFields.owner_department}
                  onChange={e => setEditFields(f => ({ ...f, owner_department: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="engineering">الهندسة</option>
                  <option value="services">الخدمات</option>
                  <option value="electricity">الكهرباء</option>
                  <option value="maintenance">الصيانة</option>
                  <option value="communications">الاتصالات</option>
                  <option value="hr">الموارد البشرية</option>
                  <option value="facilities">المرافق</option>
                  <option value="technical">التقني</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">الحالة</label>
                <div className="flex gap-2">
                  {['active','in_progress','planned','handed_over'].map(s => (
                    <button
                      key={s}
                      onClick={() => setEditFields(f => ({ ...f, status: s }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                        editFields.status === s
                          ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {STATUS_LABELS[s]?.label ?? s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-700 flex gap-2">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold transition"
              >
                {editSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                  : <><Check className="w-4 h-4" /> حفظ التعديلات</>
                }
              </button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex border-b border-slate-700/60 bg-slate-800/40">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          // Badge counts
          let badge: number | null = null;
          if (tab.id === 'admin'      && data)           badge = data.doc_counts.admin;
          if (tab.id === 'technical'  && data)           badge = data.doc_counts.technical;
          if (tab.id === 'financial'  && data) {
            const finDocs = data.documents.filter((d) => d.doc_type === 'financial').length;
            badge = data.financials.length + finDocs;
          }
          if (tab.id === 'children'   && childrenData)   badge = childrenData.total_children;
          if (tab.id === 'components' && componentsData) badge = componentsData.total_count;
          if (tab.id === 'audit')                          badge = auditEvents.length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-all
                ${isActive
                  ? `${tab.color} border-b-2 border-current`
                  : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'}`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 text-[9px] px-1 rounded-full bg-sky-500 text-white font-bold leading-none py-0.5">
                    {badge}
                  </span>
                )}
              </div>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500 text-sm">
            <Building2 className="w-8 h-8 opacity-40" />
            <span>لا توجد بيانات</span>
          </div>
        ) : (
          <>
            {activeTab === 'geo'       && (
              <GeoTab
                data={data}
                isCompound={isCompound}
                childrenData={childrenData}
                address={address}
                onMarkCompound={async () => { await workspaceApi.markAsCompound(assetId); load(); }}
                onRedraw={() => onRedrawGeometry?.(data.geometry_type)}
                onSelectChild={id => onSelectChild?.(id)}
                onDeleteChild={handleDeleteChildAsset}
              />
            )}
            {activeTab === 'admin'     && (
              <DocsTab
                docs={data.documents.filter(d => ['admin','contract','other'].includes(d.doc_type))}
                photos={data.documents.filter(d => d.doc_type === 'photo')}
                onDelete={handleDeleteDoc}
                onAdd={writableTabs.includes('admin') ? () => { setFormData({ doc_type: 'admin' }); setAddMode('doc'); } : undefined}
              />
            )}
            {activeTab === 'technical' && (
              <TechnicalTab
                docs={data.documents.filter(d => ['technical','manual','drawing'].includes(d.doc_type))}
                employees={data.employees}
                onDeleteDoc={handleDeleteDoc}
                onUnlinkEmp={handleUnlinkEmp}
                onAddDoc={writableTabs.includes('technical') ? () => { setFormData({ doc_type: 'manual' }); setAddMode('doc'); } : undefined}
                onAddEmp={writableTabs.includes('technical') ? () => { setFormData({ role: 'responsible' }); setAddMode('emp'); } : undefined}
              />
            )}
            {activeTab === 'financial' && (
              <FinancialTab
                financials={data.financials}
                docs={data.documents.filter(d => d.doc_type === 'financial')}
                summary={data.financial_summary}
                onDelete={handleDeleteFin}
                onDeleteDoc={handleDeleteDoc}
                onAdd={writableTabs.includes('financial') ? () => { setFormData({ financial_type: 'maintenance', currency: 'LYD' }); setAddMode('fin'); } : undefined}
                onAddDoc={writableTabs.includes('financial') ? () => { setFormData({ doc_type: 'financial' }); setAddMode('doc'); } : undefined}
              />
            )}
            {activeTab === 'components' && (
              <ComponentsTab
                data={componentsData}
                onDelete={handleDeleteComp}
                onAdd={writableTabs.includes('components') ? () => { setFormData({ component_type: 'electrical', quantity: '1', currency: 'LYD', condition: 'good' }); setAddMode('comp'); } : undefined}
              />
            )}
            {activeTab === 'children' && childrenData && (
              <CompoundChildrenTab
                data={childrenData}
                onSelectChild={id => onSelectChild?.(id)}
                onAdd={writableTabs.includes('children') ? () => { setFormData({ owning_department: 'technical', status: 'active' }); setAddMode('child'); } : undefined}
                deptLabels={DEPT_LABELS}
              />
            )}
            {activeTab === 'audit' && (
              <AuditTab assetId={assetId} events={auditEvents} />
            )}
          </>
        )}
      </div>

      {/* ── Add dialogs ── */}
      {addMode === 'doc' && (
        <AddDialog
          title="إرفاق وثيقة"
          onClose={() => setAddMode(null)}
          onSave={handleSaveDoc}
          saving={saving}
        >
          <Field label="نوع الوثيقة">
            <select
              value={formData.doc_type || 'other'}
              onChange={e => setFormData(f => ({ ...f, doc_type: e.target.value }))}
              className="input-field"
            >
              {Object.entries(DOC_TYPE_LABELS).filter(([k]) => allowedDocTypes.includes(k)).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="العنوان *">
            <input
              type="text"
              value={formData.title || ''}
              onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="عنوان الوثيقة"
              className="input-field"
            />
          </Field>
          <Field label="رابط الملف (URL)">
            <input
              type="url"
              value={formData.file_url || ''}
              onChange={e => setFormData(f => ({ ...f, file_url: e.target.value }))}
              placeholder="https://..."
              className="input-field"
            />
          </Field>
          <Field label="أو رفع ملف من الجهاز">
            <input
              type="file"
              onChange={e => {
                const next = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
                setSelectedDocFile(next);
                if (next && !formData.title) {
                  setFormData(f => ({ ...f, title: next.name }));
                }
              }}
              className="input-field file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-xs file:text-slate-100"
            />
            {selectedDocFile && (
              <p className="mt-1 text-[11px] text-emerald-300">
                ملف مختار: {selectedDocFile.name} ({Math.round(selectedDocFile.size / 1024)} KB)
              </p>
            )}
          </Field>
          <Field label="القسم / الجهة">
            <input
              type="text"
              value={formData.department || ''}
              onChange={e => setFormData(f => ({ ...f, department: e.target.value }))}
              placeholder="اسم الجهة"
              className="input-field"
            />
          </Field>
          <Field label="ملاحظات">
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="input-field resize-none"
            />
          </Field>
        </AddDialog>
      )}

      {addMode === 'emp' && (
        <AddDialog
          title="ربط موظف / مسؤول"
          onClose={() => setAddMode(null)}
          onSave={handleSaveEmp}
          saving={saving}
        >
          <Field label="اسم الموظف *">
            <input
              type="text"
              value={formData.employee_name || ''}
              onChange={e => setFormData(f => ({ ...f, employee_name: e.target.value }))}
              placeholder="الاسم الكامل"
              className="input-field"
            />
          </Field>
          <Field label="الدور / الصفة">
            <select
              value={formData.role || 'responsible'}
              onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
              className="input-field"
            >
              {Object.entries(EMP_ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="القسم / الإدارة">
            <input
              type="text"
              value={formData.department || ''}
              onChange={e => setFormData(f => ({ ...f, department: e.target.value }))}
              placeholder="الإدارة أو القسم"
              className="input-field"
            />
          </Field>
        </AddDialog>
      )}

      {addMode === 'fin' && (
        <AddDialog
          title="تسجيل قيد مالي"
          onClose={() => setAddMode(null)}
          onSave={handleSaveFin}
          saving={saving}
        >
          <Field label="نوع القيد">
            <select
              value={formData.financial_type || 'other'}
              onChange={e => setFormData(f => ({ ...f, financial_type: e.target.value }))}
              className="input-field"
            >
              {Object.entries(FIN_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="المبلغ *">
            <input
              type="number"
              value={formData.amount || ''}
              onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.000"
              className="input-field"
            />
          </Field>
          <Field label="العملة">
            <select
              value={formData.currency || 'LYD'}
              onChange={e => setFormData(f => ({ ...f, currency: e.target.value }))}
              className="input-field"
            >
              <option value="LYD">دينار ليبي (LYD)</option>
              <option value="USD">دولار أمريكي (USD)</option>
              <option value="EUR">يورو (EUR)</option>
            </select>
          </Field>
          <Field label="الوصف">
            <input
              type="text"
              value={formData.description || ''}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="وصف مختصر"
              className="input-field"
            />
          </Field>
          <Field label="التاريخ">
            <input
              type="date"
              value={formData.financial_date || ''}
              onChange={e => setFormData(f => ({ ...f, financial_date: e.target.value }))}
              className="input-field"
            />
          </Field>
          <Field label="رقم المرجع">
            <input
              type="text"
              value={formData.reference_number || ''}
              onChange={e => setFormData(f => ({ ...f, reference_number: e.target.value }))}
              placeholder="رقم الفاتورة / المرجع"
              className="input-field"
            />
          </Field>
        </AddDialog>
      )}

      {addMode === 'child' && (
        <AddDialog
          title="إضافة أصل داخل المجمع"
          onClose={() => setAddMode(null)}
          onSave={async () => {
            if (!formData.asset_name) { showToast('أدخل اسم الأصل', 'error'); return; }
            if (!formData.asset_type) { showToast('أدخل نوع الأصل', 'error'); return; }
            setSaving(true);
            try {
              await workspaceApi.addChildAsset(assetId, {
                asset_name:         formData.asset_name,
                asset_type:         formData.asset_type,
                owning_department:  formData.owning_department || 'technical',
                status:             formData.status || 'active',
                health_score:       parseInt(formData.health_score || '100'),
                installation_date:  formData.installation_date || undefined,
                department_owner:   formData.department_owner || infoLayerLabel,
                notes:              buildAuditStamp('child.create'),
              });
              showToast(`تم إضافة "${formData.asset_name}" داخل المجمع`, 'success');
              setAddMode(null);
              setFormData({});
              load();
            } catch (e: any) {
              showToast(e.message, 'error');
            } finally {
              setSaving(false);
            }
          }}
          saving={saving}
        >
          <Field label="اسم الأصل *">
            <input type="text" value={formData.asset_name || ''}
              onChange={e => setFormData(f => ({ ...f, asset_name: e.target.value }))}
              placeholder="مضخة المياه الرئيسية" className="input-field" />
          </Field>
          <Field label="نوع الأصل *">
            <input type="text" value={formData.asset_type || ''}
              onChange={e => setFormData(f => ({ ...f, asset_type: e.target.value }))}
              placeholder="pump / valve / building / vehicle ..." className="input-field" />
          </Field>
          <Field label="الإدارة المالكة">
            <select value={formData.owning_department || 'technical'}
              onChange={e => setFormData(f => ({ ...f, owning_department: e.target.value }))}
              className="input-field">
              {Object.entries(DEPT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <select value={formData.status || 'active'}
              onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}
              className="input-field">
              <option value="active">نشط</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="planned">مخطط</option>
              <option value="on_hold">موقوف مؤقتاً</option>
            </select>
          </Field>
          <Field label="الجهة المالكة (نص)">
            <input type="text" value={formData.department_owner || ''}
              onChange={e => setFormData(f => ({ ...f, department_owner: e.target.value }))}
              placeholder="إدارة التشغيل والصيانة" className="input-field" />
          </Field>
          <Field label="تاريخ التركيب">
            <input type="date" value={formData.installation_date || ''}
              onChange={e => setFormData(f => ({ ...f, installation_date: e.target.value }))}
              className="input-field" />
          </Field>
          <Field label="نسبة الصحة (0-100)">
            <input type="number" min="0" max="100" value={formData.health_score || '100'}
              onChange={e => setFormData(f => ({ ...f, health_score: e.target.value }))}
              className="input-field" />
          </Field>
        </AddDialog>
      )}

      {addMode === 'comp' && (
        <AddDialog
          title="إضافة مكوّن / عنصر"
          onClose={() => setAddMode(null)}
          onSave={handleSaveComp}
          saving={saving}
        >
          <Field label="اسم المكوّن *">
            <input type="text" value={formData.component_name || ''}
              onChange={e => setFormData(f => ({ ...f, component_name: e.target.value }))}
              placeholder="شبكة كهربائية / مكيفات / مكاتب ..."
              className="input-field" />
          </Field>
          <Field label="نوع المكوّن">
            <select value={formData.component_type || 'general'}
              onChange={e => setFormData(f => ({ ...f, component_type: e.target.value }))}
              className="input-field">
              <option value="electrical">كهربائي</option>
              <option value="hvac">تكييف وتهوية</option>
              <option value="telecom">اتصالات وشبكات</option>
              <option value="offices">مكاتب وأثاث</option>
              <option value="equipment">معدات وأجهزة</option>
              <option value="vehicles">مركبات</option>
              <option value="plumbing">سباكة ومياه</option>
              <option value="security">أمن وحماية</option>
              <option value="hr">موارد بشرية</option>
              <option value="general">عام</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="الكمية">
              <input type="number" min="1" value={formData.quantity || '1'}
                onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))}
                className="input-field" />
            </Field>
            <Field label="الوحدة">
              <input type="text" value={formData.unit || 'قطعة'}
                onChange={e => setFormData(f => ({ ...f, unit: e.target.value }))}
                placeholder="قطعة / م / م²"
                className="input-field" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="سعر الوحدة">
              <input type="number" min="0" value={formData.unit_cost || '0'}
                onChange={e => setFormData(f => ({ ...f, unit_cost: e.target.value }))}
                className="input-field" />
            </Field>
            <Field label="العملة">
              <select value={formData.currency || 'LYD'}
                onChange={e => setFormData(f => ({ ...f, currency: e.target.value }))}
                className="input-field">
                <option value="LYD">دينار ليبي</option>
                <option value="USD">دولار</option>
                <option value="EUR">يورو</option>
              </select>
            </Field>
          </div>
          <Field label="الحالة">
            <select value={formData.condition || 'good'}
              onChange={e => setFormData(f => ({ ...f, condition: e.target.value }))}
              className="input-field">
              <option value="good">جيدة</option>
              <option value="fair">مقبولة</option>
              <option value="poor">متردية</option>
              <option value="new">جديدة</option>
            </select>
          </Field>
          <Field label="رقم أمر الشراء">
            <input type="text" value={formData.purchase_order_ref || ''}
              onChange={e => setFormData(f => ({ ...f, purchase_order_ref: e.target.value }))}
              placeholder="PO-2026-001"
              className="input-field" />
          </Field>
          <Field label="تاريخ الشراء">
            <input type="date" value={formData.purchase_date || ''}
              onChange={e => setFormData(f => ({ ...f, purchase_date: e.target.value }))}
              className="input-field" />
          </Field>
          <Field label="وصف">
            <textarea value={formData.description || ''}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={2} className="input-field resize-none" />
          </Field>
          {formData.quantity && formData.unit_cost && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 text-center">
              الإجمالي: {(parseFloat(formData.quantity || '1') * parseFloat(formData.unit_cost || '0')).toLocaleString('ar-LY')} {formData.currency || 'LYD'}
            </div>
          )}
        </AddDialog>
      )}
    </div>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

const COMP_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  electrical: { label: 'كهربائي',        icon: Zap,         color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  hvac:       { label: 'تكييف وتهوية',   icon: Wind,        color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' },
  telecom:    { label: 'اتصالات وشبكات', icon: Wifi,        color: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
  offices:    { label: 'مكاتب وأثاث',    icon: Building2,   color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  equipment:  { label: 'معدات وأجهزة',   icon: Monitor,     color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' },
  vehicles:   { label: 'مركبات',         icon: Package,     color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
  plumbing:   { label: 'سباكة ومياه',    icon: Activity,    color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
  security:   { label: 'أمن وحماية',     icon: Layers,      color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  hr:         { label: 'موارد بشرية',    icon: User,        color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  general:    { label: 'عام',            icon: Package,     color: 'text-slate-400 bg-slate-500/15 border-slate-500/30' },
};

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  new:  { label: 'جديدة',   color: 'text-emerald-300' },
  good: { label: 'جيدة',    color: 'text-emerald-400' },
  fair: { label: 'مقبولة',  color: 'text-amber-400' },
  poor: { label: 'متردية',  color: 'text-red-400' },
};

function ComponentsTab({
  data,
  onDelete,
  onAdd,
}: {
  data: ComponentsData | null;
  onDelete: (id: string) => void;
  onAdd?: () => void;
}) {
  const fmtN = (n: number) => n.toLocaleString('ar-LY', { maximumFractionDigits: 3 });

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      {data && data.grand_total > 0 && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
          <p className="text-xs text-cyan-400 mb-1 font-medium">إجمالي قيمة المكونات</p>
          <p className="text-xl font-bold text-cyan-300">{fmtN(data.grand_total)} {data.currency}</p>
          {Object.keys(data.by_type).length > 1 && (
            <div className="mt-2 space-y-1">
              {Object.entries(data.by_type).map(([type, total]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-slate-400">{COMP_TYPE_LABELS[type]?.label ?? type}</span>
                  <span className="text-slate-200 font-mono">{fmtN(total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SectionHeader title="المكونات والعناصر" onAdd={onAdd} />

      {!data || data.items.length === 0 ? (
        <EmptyState icon={<Cpu className="w-7 h-7" />} text="لا توجد مكونات مسجلة — أضف الشبكات والمعدات والعناصر التقنية" />
      ) : (
        <div className="space-y-2">
          {data.items.map(comp => {
            const typeInfo = COMP_TYPE_LABELS[comp.component_type] ?? COMP_TYPE_LABELS.general;
            const TypeIcon = typeInfo.icon;
            const condInfo = CONDITION_LABELS[comp.condition] ?? { label: comp.condition, color: 'text-slate-400' };
            return (
              <div key={comp.id} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 hover:border-cyan-500/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{comp.component_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${typeInfo.color}`}>{typeInfo.label}</span>
                        <span className={`text-xs font-medium ${condInfo.color}`}>{condInfo.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-400">{comp.quantity} {comp.unit}</span>
                        {comp.unit_cost > 0 && (
                          <span className="text-xs text-slate-400">{fmtN(comp.unit_cost)} / {comp.unit}</span>
                        )}
                        <span className="text-sm font-bold text-cyan-300">{fmtN(comp.total_cost)} {comp.currency}</span>
                      </div>
                      {comp.purchase_order_ref && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" />
                          {comp.purchase_order_ref}
                          {comp.purchase_date && ` — ${comp.purchase_date}`}
                        </p>
                      )}
                      {comp.description && (
                        <p className="text-xs text-slate-400 mt-1">{comp.description}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onDelete(comp.id)}
                    className="p-1.5 rounded text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GeoTab({
  data,
  isCompound,
  childrenData,
  address,
  onMarkCompound,
  onRedraw,
  onSelectChild,
  onDeleteChild,
}: {
  data: AssetCenterData;
  isCompound: boolean;
  childrenData: ChildrenData | null;
  address: string | null;
  onMarkCompound: () => void;
  onRedraw: () => void;
  onSelectChild?: (id: string) => void;
  onDeleteChild?: (id: string, name: string) => void;
}) {
  const { asset, coordinates, geometry_type } = data;
  const { showToast } = useToast();
  const [linkingMode, setLinkingMode] = React.useState(false);
  const [parentAssets, setParentAssets] = React.useState<Array<{id:string;name:string}>>([]);
  const [linking, setLinking] = React.useState(false);
  const [trimFromEnd, setTrimFromEnd] = React.useState(0);
  const [trimFromStart, setTrimFromStart] = React.useState(0);
  const [trimming, setTrimming] = React.useState(false);

  const handleTrim = async () => {
    if (trimFromEnd === 0 && trimFromStart === 0) return;
    if (!confirm(`حذف ${trimFromStart > 0 ? `${trimFromStart} نقطة من البداية` : ''}${trimFromStart > 0 && trimFromEnd > 0 ? ' و' : ''}${trimFromEnd > 0 ? `${trimFromEnd} نقطة من النهاية` : ''}؟`)) return;
    setTrimming(true);
    try {
      const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenant_id') || '') : '';
      const res = await fetch(`/api/v1/workspace/assets/${data.asset.id}/trim-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
        body: JSON.stringify({ from_end: trimFromEnd, from_start: trimFromStart }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.detail || `خطأ ${res.status}`);
      showToast(`✅ ${result.message}`, 'success');
      setTrimFromEnd(0);
      setTrimFromStart(0);
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      void load();
    } catch (e: any) {
      showToast(`فشل التقليص: ${e.message}`, 'error');
    } finally { setTrimming(false); }
  };

  const openLinkMode = async () => {
    setLinkingMode(true);
    if (parentAssets.length === 0) {
      try {
        const tenantId = typeof window !== 'undefined'
          ? (localStorage.getItem('tenant_id') || '') : '';
        const res = await fetch('/api/engineering/workspace/principal-assets', {
          headers: tenantId ? { 'X-Tenant-ID': tenantId } : {},
        });
        const list = res.ok ? await res.json() : [];
        setParentAssets((list as any[])
          .filter((a: any) => a.id !== data.asset.id)
          .map((a: any) => ({ id: a.id, name: a.name })));
      } catch { /* silent */ }
    }
  };

  const handleLinkAsParent = async (parentId: string, parentName: string) => {
    setLinking(true);
    try {
      const tenantId = typeof window !== 'undefined'
        ? (localStorage.getItem('tenant_id') || '') : '';
      // Set parent AND mark as consolidated_branch so it disappears from main list
      const res = await fetch(`/api/engineering/workspace/principal-assets/${data.asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
        body: JSON.stringify({ parent_asset_id: parentId, asset_category: 'consolidated_branch' }),
      });
      if (!res.ok) throw new Error(`خطأ ${res.status}`);
      showToast(`✅ تم ربط "${data.asset.asset_name}" كفرع من "${parentName}" — سيختفي من القائمة ويندمج في الشبكة`, 'success');
      setLinkingMode(false);
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      // Close this panel and select the parent
      window.dispatchEvent(new CustomEvent('engineering:select-asset', { detail: { assetId: parentId } }));
    } catch (e: any) {
      showToast(`فشل الربط: ${e.message}`, 'error');
    } finally { setLinking(false); }
  };

  const handleMergeNetwork = async () => {
    if (!confirm(`دمج كل مسارات شبكة "${data.asset.asset_name}" في هندسة موحدة؟\nسيتحول الأصل الرئيسي إلى MultiLineString يشمل جميع الفروع وتختفي الفروع من القائمة.`)) return;
    setLinking(true);
    try {
      const tenantId = typeof window !== 'undefined'
        ? (localStorage.getItem('tenant_id') || '') : '';
      const res = await fetch(`/api/v1/workspace/assets/${data.asset.id}/merge-network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.detail || `خطأ ${res.status}`);
      showToast(`✅ ${result.message} — فروع الشبكة اندمجت في مسار واحد`, 'success');
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      // Close panel after merge (asset list will refresh)
      onClose();
    } catch (e: any) {
      showToast(`فشل الدمج: ${e.message}`, 'error');
    } finally { setLinking(false); }
  };

  // Note: the extend draw listener lives in page.tsx (engineering:feature-drawn handler)
  // to avoid duplicate listeners from AssetCenterPanel re-renders.

  return (
    <div className="p-4 space-y-4">
      {/* Compound badge or promote button */}
      {isCompound ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <Boxes className="w-4 h-4 flex-shrink-0" />
          هذا الأصل مجمع — يحتوي على {childrenData?.total_children ?? 0} أصل داخلي
        </div>
      ) : (
        <button
          onClick={onMarkCompound}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                     text-sm text-slate-400 border border-dashed border-slate-600/60
                     hover:text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors"
        >
          <Boxes className="w-4 h-4" />
          تحويل هذا الأصل إلى مجمع (Compound)
        </button>
      )}
      <InfoCard icon={<MapPin className="w-4 h-4 text-sky-400" />} title="الموقع الجغرافي">
        {address && (
          <div className="flex items-start gap-2 px-1 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 mb-2">
            <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-sky-200 leading-snug">{address}</span>
          </div>
        )}
        <Row label="نوع الهندسة"    value={GEOM_TYPE_LABELS[geometry_type ?? ''] ?? geometry_type ?? '—'} />
        {coordinates && (
          <>
            <Row label="خط الطول (Lon)"  value={coordinates.lon.toFixed(6)} mono />
            <Row label="دائرة العرض (Lat)" value={coordinates.lat.toFixed(6)} mono />
          </>
        )}
        <div className="pt-2 space-y-2">
          <button
            onClick={onRedraw}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                       text-sm text-cyan-300 border border-cyan-500/40 bg-cyan-500/10
                       hover:bg-cyan-500/20 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            إعادة رسم هندسة الأصل
          </button>

          {/* ── تمديد المسار (خاص بالمسارات فقط) ───────────── */}
          {(geometry_type === 'path' || geometry_type === 'LineString' || geometry_type === 'MultiLineString') && (
            <button
              onClick={() => {
                (window as any).__extendingAssetId = data.asset.id;
                (window as any).__childGeometryPicking = false;
                window.dispatchEvent(new CustomEvent('engineering:start-extend', { detail: { assetId: data.asset.id } }));
                showToast('ارسم الامتداد الجديد على الخريطة ← انقر مرتين للإنهاء', 'info');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                         text-sm text-sky-300 border border-sky-500/40 bg-sky-500/10
                         hover:bg-sky-500/20 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              إضافة امتداد للمسار
            </button>
          )}

          {/* ── ربط كفرع من مسار آخر ───────────────────────── */}
          {!linkingMode ? (
            <div className="space-y-1.5">
              <button
                onClick={openLinkMode}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                           text-sm text-violet-300 border border-violet-500/40 bg-violet-500/10
                           hover:bg-violet-500/20 transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                ربط هذا المسار كفرع من مسار آخر
              </button>
              {/* Show merge button only when this is a parent path with branches */}
              {(geometry_type === 'path' || geometry_type === 'LineString' || geometry_type === 'MultiLineString') &&
               childrenData && childrenData.total_children > 0 && (
                <button
                  onClick={handleMergeNetwork}
                  disabled={linking}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                             text-sm text-emerald-300 border border-emerald-500/40 bg-emerald-500/10
                             hover:bg-emerald-500/20 transition-colors"
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  دمج مسارات الشبكة في هندسة موحدة
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-violet-500/30 bg-violet-900/10 p-3 space-y-2">
              <p className="text-xs text-violet-300 font-semibold flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                اختر الأصل الرئيسي (الجذع)
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {parentAssets.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">لا توجد أصول أخرى</p>
                ) : parentAssets.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleLinkAsParent(a.id, a.name)}
                    disabled={linking}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-violet-800/40 hover:text-violet-200 transition-colors"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setLinkingMode(false)}
                className="text-xs text-slate-500 hover:text-slate-300 transition w-full text-center"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      </InfoCard>

      {/* Asset info card */}
      <InfoCard icon={<Building2 className="w-4 h-4 text-amber-400" />} title="معلومات الأصل">
        <Row label="معرّف الأصل"   value={asset.asset_id  ?? '—'} mono />
        <Row label="نوع الأصل"    value={asset.asset_type ?? '—'} />
        <Row label="الحالة"        value={asset.status     ?? '—'} />
        <Row label="نسبة الصحة"   value={asset.health_score != null ? `${asset.health_score}%` : '—'} />
        <Row label="تاريخ التركيب" value={fmtDate(asset.installation_date)} />
        <Row label="الجهة المالكة" value={asset.department_owner ?? '—'} />
      </InfoCard>

      {/* Children quick list — always show when children exist */}
      {childrenData && childrenData.total_children > 0 && (
        <InfoCard icon={<Boxes className="w-4 h-4 text-rose-400" />} title={`الأصول الفرعية (${childrenData.total_children})`}>
          <div className="space-y-1 py-1">
            {Object.values(childrenData.children_by_department).flat().map(child => (
              <div key={child.id} className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200 truncate">{child.asset_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {child.total_cost > 0 && (
                    <span className="text-xs text-emerald-400">{child.total_cost.toLocaleString()} LYD</span>
                  )}
                  <button
                    onClick={() => onDeleteChild?.(child.id, child.asset_name)}
                    className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-colors"
                    title="حذف العنصر"
                  >
                    حذف
                  </button>
                  <button onClick={() => onSelectChild?.(child.id)}
                    className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-colors">
                    فتح
                  </button>
                </div>
              </div>
            ))}
          </div>
        </InfoCard>
      )}

      {/* Layer info */}
      <InfoCard icon={<Layers className="w-4 h-4 text-violet-400" />} title="الطبقة والمشروع">
        <Row label="اسم الطبقة"   value={asset.layer_name    ?? '—'} />
        <Row label="تصنيف الطبقة" value={asset.layer_category === 'asset' ? 'أصل ✓' : 'مشروع'} />
        <Row label="اسم المشروع"  value={asset.project_name  ?? '—'} />
        <Row label="تاريخ الإنشاء" value={fmtDate(asset.created_at)} />
      </InfoCard>
    </div>
  );
}

function DocsTab({
  docs,
  photos,
  onDelete,
  onAdd,
}: {
  docs: DocumentRecord[];
  photos: DocumentRecord[];
  onDelete: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <SectionHeader title="الوثائق والمراسلات" onAdd={onAdd} />
      {docs.length === 0 && photos.length === 0 ? (
        <EmptyState icon={<FileText className="w-6 h-6" />} text="لا توجد وثائق إدارية" />
      ) : (
        <>
          {docs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">الوثائق الإدارية</p>
              {docs.map(d => (
                <DocCard key={d.id} doc={d} onDelete={onDelete} docTypeLabels={DOC_TYPE_LABELS} />
              ))}
            </div>
          )}
          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-cyan-300">الصور</p>
              {photos.map(d => (
                <DocCard key={d.id} doc={d} onDelete={onDelete} docTypeLabels={DOC_TYPE_LABELS} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TechnicalTab({
  docs,
  employees,
  onDeleteDoc,
  onUnlinkEmp,
  onAddDoc,
  onAddEmp,
}: {
  docs: DocumentRecord[];
  employees: EmployeeRecord[];
  onDeleteDoc: (id: string) => void;
  onUnlinkEmp: (id: string) => void;
  onAddDoc?: () => void;
  onAddEmp?: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Technical docs */}
      <SectionHeader title="الوثائق التقنية" onAdd={onAddDoc} />
      {docs.length === 0 ? (
        <EmptyState icon={<Wrench className="w-5 h-5" />} text="لا توجد وثائق تقنية" />
      ) : (
        <div className="space-y-2 mb-4">
          {docs.map(d => <DocCard key={d.id} doc={d} onDelete={onDeleteDoc} docTypeLabels={DOC_TYPE_LABELS} />)}
        </div>
      )}

      {/* Employees */}
      <SectionHeader title="المسؤولون والمشغّلون" onAdd={onAddEmp} />
      {employees.length === 0 ? (
        <EmptyState icon={<User className="w-5 h-5" />} text="لا يوجد موظفون مرتبطون" />
      ) : (
        <div className="space-y-2">
          {employees.map(e => (
            <div key={e.id} className="flex items-start justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
              <div className="flex gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{e.employee_name ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-violet-300 bg-violet-500/20 px-1.5 py-0.5 rounded">
                      {EMP_ROLE_LABELS[e.role] ?? e.role}
                    </span>
                    {e.department && (
                      <span className="text-xs text-slate-400">{e.department}</span>
                    )}
                    {e.created_at && (
                      <span className="text-xs text-slate-500">{fmtDate(e.created_at)}</span>
                    )}
                  </div>
                  {e.linked_by && <p className="text-[11px] text-slate-500 mt-1 truncate">{e.linked_by}</p>}
                </div>
              </div>
              <button
                onClick={() => onUnlinkEmp(e.id)}
                className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinancialTab({
  financials,
  docs,
  summary,
  onDelete,
  onDeleteDoc,
  onAdd,
  onAddDoc,
}: {
  financials: FinancialRecord[];
  docs: DocumentRecord[];
  summary: AssetCenterData['financial_summary'];
  onDelete: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onAdd?: () => void;
  onAddDoc?: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <SectionHeader title="الوثائق المالية" onAdd={onAddDoc} />
      {docs.length === 0 ? (
        <EmptyState icon={<FileText className="w-5 h-5" />} text="لا توجد وثائق مالية" />
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <DocCard key={d.id} doc={d} onDelete={onDeleteDoc} docTypeLabels={DOC_TYPE_LABELS} />
          ))}
        </div>
      )}

      {/* Summary */}
      {summary.grand_total > 0 && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-xs text-emerald-400 mb-1 font-medium">إجمالي التكاليف</p>
          <p className="text-lg font-bold text-emerald-300">
            {fmt(summary.grand_total, 3)} {summary.currency}
          </p>
          <div className="mt-2 space-y-1">
            {Object.entries(summary.totals_by_type).map(([type, total]) => (
              <div key={type} className="flex justify-between text-[11px]">
                <span className="text-slate-400">{FIN_TYPE_LABELS[type] ?? type}</span>
                <span className="text-slate-300 font-mono">{fmt(total, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionHeader title="القيود المالية" onAdd={onAdd} />
      {financials.length === 0 ? (
        <EmptyState icon={<DollarSign className="w-5 h-5" />} text="لا توجد قيود مالية" />
      ) : (
        <div className="space-y-2">
          {financials.map(f => (
            <div key={f.id} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      {FIN_TYPE_LABELS[f.financial_type] ?? f.financial_type}
                    </span>
                    {f.reference_number && (
                      <span className="text-xs text-slate-500 font-mono">{f.reference_number}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-emerald-300 mt-1">
                    {fmt(f.amount, 3)} {f.currency}
                  </p>
                  {f.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
                  )}
                  {f.financial_date && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {fmtDate(f.financial_date)}
                    </p>
                  )}
                  {f.created_at && (
                    <p className="text-[11px] text-slate-500 mt-1">أضيف في: {fmtDate(f.created_at)}</p>
                  )}
                  {f.created_by && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{f.created_by}</p>
                  )}
                </div>
                <button
                  onClick={() => onDelete(f.id)}
                  className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type BriefSource = {
  ref: string;
  type: 'record' | 'document';
  title: string;
  url: string;
  note?: string;
  created_at?: string;
};

type BriefSentence = {
  id: string;
  text: string;
  source_refs: string[];
  priority: 'core' | 'support' | 'audit';
};

type AskReference = {
  ref: string;
  source_id: string;
  title: string;
  file_url: string;
  doc_type: string;
  extraction_status: string;
};

type KnowledgeSourceListItem = {
  id: string;
  title: string;
  file_url: string;
  doc_type: string;
  extraction_status: 'pending' | 'ingested' | 'needs_ocr' | 'failed';
  content_excerpt?: string | null;
  updated_at?: string;
};

function AuditTab({ assetId, events }: { assetId: string; events: AuditEvent[] }) {
  const ICONS: Record<AuditEvent['kind'], React.ElementType> = {
    asset: Building2,
    document: FileText,
    employee: User,
    financial: DollarSign,
    component: Cpu,
    child: Boxes,
  };

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<BriefSource[]>([]);
  const [sentences, setSentences] = useState<BriefSentence[]>([]);
  const [askReferences, setAskReferences] = useState<AskReference[]>([]);
  const [sourceList, setSourceList] = useState<KnowledgeSourceListItem[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceErr, setSourceErr] = useState('');
  const [retryingFileUrl, setRetryingFileUrl] = useState<string | null>(null);
  const [packetCount, setPacketCount] = useState<number | null>(null);
  const [ingestStats, setIngestStats] = useState<{ linked: number; ingested: number; needsOcr: number } | null>(null);
  const [err, setErr] = useState('');

  const loadKnowledgeSources = useCallback(async (silent = false) => {
    if (!silent) {
      setSourceLoading(true);
      setSourceErr('');
    }
    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/sources`, {
        headers: getTenantHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setSourceList(items.map((s: any) => ({
        id: String(s.id || ''),
        title: String(s.title || s.id || 'وثيقة'),
        file_url: String(s.file_url || ''),
        doc_type: String(s.doc_type || 'other'),
        extraction_status: String(s.extraction_status || 'pending') as KnowledgeSourceListItem['extraction_status'],
        content_excerpt: s.content_excerpt ? String(s.content_excerpt) : null,
        updated_at: s.updated_at ? String(s.updated_at) : undefined,
      })));
    } catch (e: any) {
      setSourceErr(String(e?.message || 'failed_to_load_sources'));
    } finally {
      if (!silent) {
        setSourceLoading(false);
      }
    }
  }, [assetId]);

  useEffect(() => {
    void loadKnowledgeSources();
  }, [loadKnowledgeSources]);

  const submitKnowledgeQuestion = async () => {
    const normalized = question.trim();
    if (!normalized || loading) return;
    if (question !== normalized) {
      setQuestion(normalized);
    }
    await askKnowledge(normalized);
  };

  const askKnowledge = async (questionOverride?: string) => {
    const effectiveQuestion = String(questionOverride ?? question).trim();
    if (!effectiveQuestion) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/ask`, {
        method: 'POST',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: effectiveQuestion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const refs: AskReference[] = Array.isArray(data.references) ? data.references : [];
      setAnswer(String(data.answer || ''));
      setAskReferences(refs);
      setSentences([]);
      setSources(refs.map((r) => ({
        ref: r.ref,
        type: 'document',
        title: r.title,
        url: r.file_url,
        note: `${r.doc_type} | ${r.extraction_status}`,
      })));
    } catch (e: any) {
      setErr(String(e?.message || 'failed_to_ask_knowledge'));
    } finally {
      setLoading(false);
    }
  };

  const askBrief = async (demo = false) => {
    setLoading(true);
    setErr('');
    try {
      const url = `/api/knowledge/assets/${encodeURIComponent(assetId)}/brief${demo ? '?demo=1' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setAnswer(String(data.answer || ''));
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setSentences(Array.isArray(data.sentences) ? data.sentences : []);
    } catch (e: any) {
      setErr(String(e?.message || 'failed_to_generate_brief'));
    } finally {
      setLoading(false);
    }
  };

  const preparePacket = async (demo = false) => {
    setLoading(true);
    setErr('');
    try {
      const url = `/api/knowledge/assets/${encodeURIComponent(assetId)}/packet${demo ? '?demo=1' : ''}`;
      const res = await fetch(url, { headers: getTenantHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setPacketCount(Array.isArray(data.attachments) ? data.attachments.length : 0);
    } catch (e: any) {
      setErr(String(e?.message || 'failed_to_prepare_packet'));
    } finally {
      setLoading(false);
    }
  };

  const runIngest = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/ingest`, {
        method: 'POST',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setIngestStats({
        linked: Number(data?.stats?.linked_sources || 0),
        ingested: Number(data?.stats?.ingested_sources || 0),
        needsOcr: Number(data?.stats?.needs_ocr_sources || 0),
      });
      await loadKnowledgeSources(true);
    } catch (e: any) {
      setErr(String(e?.message || 'failed_to_ingest_asset_docs'));
    } finally {
      setLoading(false);
    }
  };

  const runIngestDemo = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/ingest?demo=1`, {
        method: 'POST',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ demo: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setIngestStats({
        linked: Number(data?.stats?.linked_sources || 0),
        ingested: Number(data?.stats?.ingested_sources || 0),
        needsOcr: Number(data?.stats?.needs_ocr_sources || 0),
      });
      await loadKnowledgeSources(true);
    } catch (e: any) {
      setErr(String(e?.message || 'failed_to_ingest_demo'));
    } finally {
      setLoading(false);
    }
  };

  const retrySingleSource = async (fileUrl: string) => {
    if (!fileUrl || loading || retryingFileUrl) return;
    setRetryingFileUrl(fileUrl);
    setErr('');
    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/ingest`, {
        method: 'POST',
        headers: getTenantHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ onlyFileUrls: [fileUrl] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setIngestStats({
        linked: Number(data?.stats?.linked_sources || 0),
        ingested: Number(data?.stats?.ingested_sources || 0),
        needsOcr: Number(data?.stats?.needs_ocr_sources || 0),
      });
      await loadKnowledgeSources(true);
    } catch (e: any) {
      setErr(String(e?.message || 'failed_to_retry_source'));
    } finally {
      setRetryingFileUrl(null);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <SectionHeader title="سجل التتبع الموحد" />
      {events.length === 0 ? (
        <EmptyState icon={<Activity className="w-6 h-6" />} text="لا توجد أحداث مسجلة بعد" />
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const Icon = ICONS[ev.kind] || Activity;
            return (
              <div key={ev.id} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{ev.title}</p>
                    <p className="text-xs text-slate-300 mt-0.5 truncate">{ev.subtitle}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                      {ev.at && <span>{fmtDate(ev.at)}</span>}
                      {ev.by && <span className="truncate">{ev.by}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 rounded-xl bg-slate-900/70 border border-slate-700/50">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-cyan-300">مُلخّص ذكي مؤسّس على مصادر</h4>
          {loading && <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />}
        </div>
        <p className="text-xs text-slate-400 mb-2">
          اكتب سؤالك عن الأصل، وسيتم توليد إجابة مرتبطة بمصادر أصلية قابلة للفتح والتحقق.
        </p>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submitKnowledgeQuestion();
            }
          }}
          rows={2}
          className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-2.5 py-2 text-xs text-slate-100"
          placeholder="مثال: ما الوضع الحالي للأصل وما أحدث الوثائق الداعمة؟"
        />

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">Enter للإرسال مباشرة و Shift+Enter لسطر جديد</p>
          <button
            onClick={() => void submitKnowledgeQuestion()}
            disabled={loading || !question.trim()}
            className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            إرسال السؤال الآن
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={runIngest}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
          >
            فهرسة وثائق الأصل
          </button>
          <button
            onClick={runIngestDemo}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-white text-xs font-semibold disabled:opacity-50"
          >
            فهرسة تجريبية سريعة
          </button>
          <button
            onClick={() => void submitKnowledgeQuestion()}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            اسأل المعرفة المخزنة
          </button>
          <button
            onClick={() => askBrief(false)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            توليد ملخص مؤسّس
          </button>
          <button
            onClick={() => askBrief(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold disabled:opacity-50"
          >
            تجربة سريعة (Demo)
          </button>
          <button
            onClick={() => preparePacket(false)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
          >
            تجهيز قائمة مرفقات
          </button>
          <button
            onClick={() => {
              const u = `/api/knowledge/assets/${encodeURIComponent(assetId)}/packet?download=1`;
              window.open(u, '_blank', 'noopener,noreferrer');
            }}
            className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold"
          >
            تنزيل قائمة الإرفاق
          </button>
        </div>

        {packetCount != null && (
          <p className="mt-2 text-xs text-emerald-300">تم تجهيز الحزمة: {packetCount} وثيقة.</p>
        )}

        {ingestStats && (
          <p className="mt-2 text-xs text-amber-300">
            الفهرسة: ربط {ingestStats.linked} وثيقة | معالجة نصية {ingestStats.ingested} | تحتاج OCR {ingestStats.needsOcr}
          </p>
        )}

        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200">حالة فهرسة الملفات</p>
            <div className="flex items-center gap-2">
              {sourceLoading && <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
              <button
                onClick={() => void loadKnowledgeSources()}
                disabled={sourceLoading || loading}
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200 disabled:opacity-50"
              >
                تحديث
              </button>
            </div>
          </div>

          {sourceErr && <p className="mt-1 text-[11px] text-red-300">{sourceErr}</p>}

          {sourceList.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">لا توجد مصادر مفهرسة لهذا الأصل بعد.</p>
          ) : (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {sourceList.map((s) => {
                const statusClass =
                  s.extraction_status === 'ingested'
                    ? 'text-emerald-300'
                    : s.extraction_status === 'needs_ocr'
                      ? 'text-amber-300'
                      : s.extraction_status === 'failed'
                        ? 'text-red-300'
                        : 'text-slate-400';
                const statusText =
                  s.extraction_status === 'ingested'
                    ? 'مفهرس'
                    : s.extraction_status === 'needs_ocr'
                      ? 'يحتاج OCR'
                      : s.extraction_status === 'failed'
                        ? 'فشل'
                        : 'قيد الانتظار';
                const allowRetry = s.extraction_status === 'needs_ocr' || s.extraction_status === 'failed' || s.extraction_status === 'pending';

                return (
                  <div key={s.id} className="rounded border border-slate-700/70 bg-slate-900/60 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-100 truncate">{s.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{s.doc_type} | {s.file_url}</p>
                      </div>
                      <span className={`text-[10px] ${statusClass}`}>{statusText}</span>
                    </div>

                    {s.content_excerpt && (
                      <p className="mt-1 text-[10px] text-slate-400 line-clamp-2">{s.content_excerpt}</p>
                    )}

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500">{s.updated_at ? `آخر تحديث: ${fmtDate(s.updated_at)}` : 'بدون تاريخ تحديث'}</p>
                      {allowRetry && s.file_url && (
                        <button
                          onClick={() => void retrySingleSource(s.file_url)}
                          disabled={loading || Boolean(retryingFileUrl)}
                          className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-[10px] text-white disabled:opacity-50"
                        >
                          {retryingFileUrl === s.file_url ? 'جارٍ الإعادة...' : 'إعادة المعالجة'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {err && (
          <p className="mt-2 text-xs text-red-300">{err}</p>
        )}

        {answer && (
          <div className="mt-3 rounded-lg bg-slate-800/70 border border-slate-700 p-2.5">
            <p className="text-xs whitespace-pre-line text-slate-100">{answer}</p>
          </div>
        )}

        {sentences.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-200">الجُمل الموثقة بالمراجع</p>
            {sentences.map((sentence) => {
              const priClass =
                sentence.priority === 'core'
                  ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
                  : sentence.priority === 'audit'
                    ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                    : 'text-slate-200 border-slate-700 bg-slate-800/60';
              return (
                <div key={sentence.id} className={`rounded-lg border p-2 ${priClass}`}>
                  <p className="text-xs leading-relaxed">{sentence.text}</p>
                  {sentence.source_refs.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sentence.source_refs.map((ref) => {
                        const src = sources.find((s) => s.ref === ref);
                        if (!src) {
                          return (
                            <span key={`${sentence.id}:${ref}`} className="px-2 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                              {ref}
                            </span>
                          );
                        }
                        return (
                          <a
                            key={`${sentence.id}:${ref}`}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-slate-900/70 border border-slate-600 text-[10px] text-cyan-300 hover:border-cyan-400"
                            title={src.title}
                          >
                            {ref}
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-500">لا توجد مراجع مباشرة لهذه الجملة.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sources.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-semibold text-slate-200">المصادر الأصلية</p>
            {sources.map((s) => (
              <a
                key={`${s.ref}:${s.url}`}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1.5 hover:border-cyan-500/40"
              >
                <p className="text-[11px] text-cyan-300 font-semibold">[{s.ref}] {s.title}</p>
                <p className="text-[11px] text-slate-400 truncate">{s.url}</p>
                {s.note && <p className="text-[10px] text-slate-500">{s.note}</p>}
              </a>
            ))}
          </div>
        )}

        {askReferences.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            تم عرض {askReferences.length} مرجع/مراجع من المعرفة المخزنة لهذا الرد.
          </p>
        )}
      </div>
    </div>
  );
}

