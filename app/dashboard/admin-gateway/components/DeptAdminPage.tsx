'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Archive, CheckCircle, ChevronDown, ChevronRight,
  Clock, FileText, Inbox, Paperclip, Plus, RefreshCw, Send,
  XCircle, AlertTriangle, ClipboardList, Users, BarChart3, ArrowRight,
} from 'lucide-react';
import DocFormFields, { DocType, DocFormData, getAutoTitle, getBodyText, getMetadata } from './DocFormFields';
import DeptTeamView from './DeptTeamView';

// ─── types ───────────────────────────────────────────────────────────────────

// DocType is exported from DocFormFields

type DocStatus =
  | 'draft' | 'submitted' | 'in_review' | 'pending_approval'
  | 'approved' | 'rejected' | 'archived' | 'closed';

interface Attachment {
  id: number;
  document_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Document {
  id: number;
  doc_number: string;
  doc_type: DocType;
  title: string;
  body_text: string | null;
  origin_dept: string;
  dest_dept: string | null;
  priority: 'normal' | 'urgent' | 'confidential';
  status: DocStatus;
  current_step: number;
  origin_employee_name: string | null;
  due_date: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  linked_doc_id: number | null;
}

interface WorkflowStep {
  id: number;
  step_order: number;
  step_label: string;
  actor_role: string;
  action_required: string;
  status: 'pending' | 'completed' | 'rejected' | 'skipped';
  actioned_by: string | null;
  actioned_at: string | null;
  notes: string | null;
}

interface Stats {
  dept: string;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  inbox_count: number;
  pending_action: number;
  total: number;
}

// ─── constants ───────────────────────────────────────────────────────────────

const API = '/api/v1/dept-admin';

function getJsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

function getTenantHeader(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  exit_permit:        'إذن خروج',
  leave_approval:     'موافقة إجازة',
  internal_memo:      'مذكرة داخلية',
  outgoing_letter:    'خطاب صادر',
  incoming_letter:    'خطاب وارد',
  report:             'تقرير',
  work_order_doc:     'أمر عمل',
  inspection_request: 'طلب كشف',
  inspection_report:  'تقرير كشف',
};

const DOC_TYPE_ICONS: Record<DocType, React.ReactNode> = {
  exit_permit:        <ChevronRight className="h-4 w-4" />,
  leave_approval:     <Clock className="h-4 w-4" />,
  internal_memo:      <FileText className="h-4 w-4" />,
  outgoing_letter:    <Send className="h-4 w-4" />,
  incoming_letter:    <Inbox className="h-4 w-4" />,
  report:             <ClipboardList className="h-4 w-4" />,
  work_order_doc:     <Users className="h-4 w-4" />,
  inspection_request: <ClipboardList className="h-4 w-4" />,
  inspection_report:  <BarChart3 className="h-4 w-4" />,
};

const STATUS_BADGE: Record<DocStatus, { label: string; cls: string }> = {
  draft:            { label: 'مسودة',         cls: 'bg-slate-700 text-slate-300' },
  submitted:        { label: 'مقدّم',          cls: 'bg-blue-900/60 text-blue-300' },
  in_review:        { label: 'قيد المراجعة',  cls: 'bg-yellow-900/60 text-yellow-300' },
  pending_approval: { label: 'ينتظر الاعتماد',cls: 'bg-orange-900/60 text-orange-300' },
  approved:         { label: 'معتمد',          cls: 'bg-green-900/60 text-green-300' },
  rejected:         { label: 'مرفوض',         cls: 'bg-red-900/60 text-red-400' },
  archived:         { label: 'مؤرشف',         cls: 'bg-purple-900/60 text-purple-300' },
  closed:           { label: 'مغلق',           cls: 'bg-slate-600 text-slate-400' },
};

const PRIORITY_BADGE: Record<string, string> = {
  normal:       'bg-slate-700 text-slate-400',
  urgent:       'bg-red-900/70 text-red-300',
  confidential: 'bg-yellow-900/70 text-yellow-300',
};
const PRIORITY_LABELS: Record<string, string> = {
  normal: 'عادي', urgent: 'عاجل', confidential: 'سري',
};

const DEPT_LABELS: Record<string, string> = {
  corrosion:   'قسم التآكل',
  maintenance: 'قسم الصيانة',
  admin:       'الإدارة العامة',
};

const DEPT_HUB_URL: Record<string, string> = {
  corrosion:   '/dashboard/admin-gateway/corrosion',
  maintenance: '/dashboard/admin-gateway/maintenance',
  admin:       '/dashboard/admin-gateway/admin-dept',
};

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  dept: 'corrosion' | 'maintenance' | 'admin';
}

type TabId = 'pending' | 'outbox' | 'inbox' | 'archive' | 'team';

export default function DeptAdminPage({ dept }: Props) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [stats, setStats] = useState<Stats | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{
    document: Document;
    workflow_steps: WorkflowStep[];
    action_log: { action: string; performed_by: string; notes: string | null; created_at: string }[];
  } | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<DocType | null>(null);

  // new-doc form
  const [newDocType, setNewDocType] = useState<DocType>('exit_permit');
  const [formData, setFormData] = useState<DocFormData>({});
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [newDocDest, setNewDocDest] = useState('');
  const [newDocPriority, setNewDocPriority] = useState<'normal' | 'urgent' | 'confidential'>('normal');
  const [creating, setCreating] = useState(false);

  // doc attachments
  const [docAttachments, setDocAttachments] = useState<Attachment[]>([]);

  // action panel
  const [actionNotes, setActionNotes] = useState('');
  const [actioning, setActioning] = useState(false);
  const [forwarding, setForwarding] = useState(false);

  // inspection report reply modal
  const [showInspReply, setShowInspReply] = useState(false);
  const [inspReplyData, setInspReplyData] = useState<DocFormData>({});
  const [submittingInspReport, setSubmittingInspReport] = useState(false);

  // new-doc: optional cross-dept destination
  const [newDocDestDept, setNewDocDestDept] = useState<string>('');

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/${dept}/stats`, { headers: getJsonHeaders() });
      if (r.ok) setStats(await r.json());
    } catch { /* silent */ }
  }, [dept]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      let direction = 'all';
      let statusFilter = '';
      if (activeTab === 'inbox')   direction = 'inbox';
      if (activeTab === 'outbox')  direction = 'outbox';
      if (activeTab === 'archive') statusFilter = '&status=archived';
      if (activeTab === 'pending') statusFilter = '&status=submitted&status=in_review&status=pending_approval';

      const typeParam = activeTypeFilter ? `&doc_type=${activeTypeFilter}` : '';
      const url = `${API}/${dept}/documents?direction=${direction}${statusFilter}${typeParam}&limit=50`;
      const r = await fetch(url, { headers: getJsonHeaders() });
      if (r.ok) {
        const data = await r.json();
        setDocs(Array.isArray(data.documents) ? data.documents : []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [dept, activeTab, activeTypeFilter]);

  useEffect(() => { fetchStats(); fetchDocs(); }, [fetchStats, fetchDocs]);

  const openDoc = async (id: number) => {
    const r = await fetch(`${API}/${dept}/documents/${id}`, { headers: getJsonHeaders() });
    if (r.ok) {
      setSelectedDoc(await r.json());
      const ar = await fetch(`${API}/${dept}/documents/${id}/attachments`, { headers: getJsonHeaders() });
      setDocAttachments(ar.ok ? await ar.json() : []);
    }
  };

  const closeModal = () => {
    setShowNewDoc(false);
    setFormData({});
    setNewDocType('exit_permit');
    setNewDocDest('');
    setNewDocDestDept('');
    setNewDocPriority('normal');
    setAttachedFiles([]);
  };

  const createDoc = async () => {
    const title = getAutoTitle(newDocType, formData);
    if (!title.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/${dept}/documents`, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          doc_type: newDocType,
          title,
          body_text: getBodyText(newDocType, formData) || null,
          dest_dept: newDocDestDept || newDocDest || null,
          priority: newDocPriority,
          metadata: getMetadata(newDocType, formData),
          created_by: 'dept_manager',
        }),
      });
      if (r.ok) {
        const data = await r.json();
        if (attachedFiles.length > 0) {
          const uploadHeaders = getTenantHeader();
          for (const file of attachedFiles) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('uploaded_by', 'dept_manager');
            await fetch(`${API}/${dept}/documents/${data.id}/attachments`, {
              method: 'POST',
              headers: uploadHeaders,
              body: fd,
            }).catch(() => {});
          }
        }
        closeModal();
        fetchStats();
        fetchDocs();
      }
    } finally { setCreating(false); }
  };

  const doAction = async (docId: number, action: string) => {
    setActioning(true);
    try {
      const r = await fetch(`${API}/${dept}/documents/${docId}/action`, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({ action, performed_by: 'dept_manager', notes: actionNotes || null }),
      });
      if (r.ok) {
        setActionNotes('');
        await openDoc(docId);
        fetchStats(); fetchDocs();
      }
    } finally { setActioning(false); }
  };

  // Forward doc internally (إحالة للفني) or as cross-dept reply (رد على المُرسِل)
  const doForward = async (
    docId: number,
    docType: string,
    targetDept: string,
    destDept: string | null,
    notes?: string,
  ) => {
    setForwarding(true);
    try {
      const r = await fetch(`${API}/${dept}/documents/${docId}/forward`, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          doc_type: docType,
          target_dept: targetDept,
          dest_dept: destDept,
          body_text: notes || null,
          forwarded_by: 'dept_manager',
        }),
      });
      if (r.ok) {
        setActionNotes('');
        await openDoc(docId);
        fetchStats(); fetchDocs();
      }
    } finally { setForwarding(false); }
  };

  // Submit structured inspection report back to requesting dept
  const submitInspectionReport = async (docId: number) => {
    if (!selectedDoc) return;
    setSubmittingInspReport(true);
    try {
      const meta: Record<string, string> = {};
      (['inspector_name', 'inspection_date', 'corrosion_rate', 'overall_assessment',
        'cp_readings', 'recommendations', 'follow_up_required'] as const).forEach((k) => {
        if (inspReplyData[k]) meta[k] = inspReplyData[k];
      });
      const r = await fetch(`${API}/${dept}/documents/${docId}/forward`, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({
          doc_type: 'inspection_report',
          target_dept: dept,
          dest_dept: selectedDoc.document.origin_dept,
          title: `تقرير كشف — ${selectedDoc.document.title}`,
          body_text: inspReplyData.findings || null,
          forwarded_by: 'dept_manager',
          metadata: meta,
        }),
      });
      if (r.ok) {
        setShowInspReply(false);
        setInspReplyData({});
        await openDoc(docId);
        fetchStats(); fetchDocs();
      }
    } finally { setSubmittingInspReport(false); }
  };

  // ─── tabs ─────────────────────────────────────────────────────────────────

  const TABS: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'pending', label: 'قيد الإجراء', icon: <Clock className="h-4 w-4" />, count: stats?.pending_action },
    { id: 'outbox',  label: 'الصادر',      icon: <Send className="h-4 w-4" /> },
    { id: 'inbox',   label: 'الوارد',      icon: <Inbox className="h-4 w-4" />, count: stats?.inbox_count },
    { id: 'archive', label: 'الأرشيف',     icon: <Archive className="h-4 w-4" /> },
    { id: 'team',    label: 'فريق العمل',  icon: <Users className="h-4 w-4" /> },
  ];

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) return;
    const allowed: TabId[] = ['pending', 'outbox', 'inbox', 'archive', 'team'];
    if (allowed.includes(tabParam as TabId) && activeTab !== (tabParam as TabId)) {
      setActiveTab(tabParam as TabId);
    }
  }, [activeTab, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      {/* ── Header ── */}
      <div className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            {DEPT_HUB_URL[dept] && (
              <Link
                href={DEPT_HUB_URL[dept]}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs mb-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {DEPT_LABELS[dept] || dept}
              </Link>
            )}
            <h1 className="text-xl font-bold text-slate-100">الإدارة التشغيلية</h1>
            <p className="text-sm text-slate-400">{DEPT_LABELS[dept] || dept}</p>
          </div>
          <button
            onClick={() => {
              if (activeTypeFilter) { setNewDocType(activeTypeFilter); setFormData({}); }
              setShowNewDoc(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            {activeTypeFilter ? `+ ${DOC_TYPE_LABELS[activeTypeFilter]}` : 'وثيقة جديدة'}
          </button>
        </div>

        {/* ── Stats bar ── */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'إجمالي الوثائق', value: stats.total,          icon: <FileText className="h-5 w-5 text-indigo-400" /> },
              { label: 'الوارد',          value: stats.inbox_count,    icon: <Inbox className="h-5 w-5 text-blue-400" /> },
              { label: 'ينتظر إجراء',    value: stats.pending_action, icon: <AlertTriangle className="h-5 w-5 text-amber-400" /> },
              { label: 'معتمدة',          value: stats.by_status['approved'] ?? 0, icon: <CheckCircle className="h-5 w-5 text-green-400" /> },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                {s.icon}
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'team' ? (
        <DeptTeamView dept={dept} />
      ) : (
      <div className="flex h-[calc(100vh-190px)]">
        {/* ── Left: doc list ── */}
        <div className="flex w-full flex-col md:w-[420px]">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/50">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === t.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.count != null && t.count > 0 && (
                  <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs text-white">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Type filter row ── */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-900/40 px-3 py-2 scrollbar-hide">
            <button
              onClick={() => setActiveTypeFilter(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !activeTypeFilter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              الكل{stats?.total ? ` (${stats.total})` : ''}
            </button>
            {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => {
              const count = stats?.by_type[t] ?? 0;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTypeFilter(activeTypeFilter === t ? null : t)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeTypeFilter === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {DOC_TYPE_ICONS[t]}
                  {DOC_TYPE_LABELS[t]}
                  {count > 0 && (
                    <span className={`text-[10px] ${activeTypeFilter === t ? 'text-indigo-200' : 'text-slate-600'}`}>
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
            <span className="flex-1 text-xs text-slate-500">
              {activeTypeFilter
                ? `${total} وثيقة · ${DOC_TYPE_LABELS[activeTypeFilter]}`
                : `${total} وثيقة`}
            </span>
            <button onClick={() => { fetchStats(); fetchDocs(); }} className="rounded p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex h-32 items-center justify-center text-slate-500 text-sm">جار التحميل…</div>
            )}
            {!loading && docs.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm">لا توجد وثائق</p>
              </div>
            )}
            {docs.map((doc) => {
              const sb = STATUS_BADGE[doc.status] ?? STATUS_BADGE.draft;
              return (
                <button
                  key={doc.id}
                  onClick={() => openDoc(doc.id)}
                  className={`w-full border-b border-slate-800/70 px-4 py-3 text-right transition-colors hover:bg-slate-800/60 ${
                    selectedDoc?.document.id === doc.id ? 'bg-slate-800' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-indigo-400">{doc.doc_number}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sb.cls}`}>{sb.label}</span>
                        {doc.priority !== 'normal' && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${PRIORITY_BADGE[doc.priority]}`}>
                            {PRIORITY_LABELS[doc.priority]}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-200">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {DOC_TYPE_LABELS[doc.doc_type]} · {doc.origin_employee_name ?? 'غير محدد'}
                      </p>
                      {doc.origin_dept !== dept && (
                        <span className="mt-1 inline-block rounded-full border border-cyan-700/60 bg-cyan-900/30 px-1.5 py-0.5 text-[10px] text-cyan-400">
                          وارد من: {DEPT_LABELS[doc.origin_dept] ?? doc.origin_dept}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-slate-600">{new Date(doc.created_at).toLocaleDateString('ar')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: doc detail ── */}
        <div className="hidden flex-1 flex-col border-r border-slate-800 md:flex overflow-y-auto">
          {!selectedDoc ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-600">
              <BarChart3 className="h-16 w-16 opacity-20" />
              <p>اختر وثيقة للعرض</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Doc header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-indigo-400">{selectedDoc.document.doc_number}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[selectedDoc.document.status]?.cls}`}>
                      {STATUS_BADGE[selectedDoc.document.status]?.label}
                    </span>
                    {selectedDoc.document.priority !== 'normal' && (
                      <span className={`rounded px-2 py-0.5 text-xs ${PRIORITY_BADGE[selectedDoc.document.priority]}`}>
                        {PRIORITY_LABELS[selectedDoc.document.priority]}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-slate-100">{selectedDoc.document.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>النوع: {DOC_TYPE_LABELS[selectedDoc.document.doc_type]}</span>
                    <span>المُنشئ: {selectedDoc.document.origin_employee_name ?? '—'}</span>
                    {selectedDoc.document.dest_dept && <span>الوجهة: {DEPT_LABELS[selectedDoc.document.dest_dept] ?? selectedDoc.document.dest_dept}</span>}
                    {selectedDoc.document.due_date && <span>الموعد النهائي: {new Date(selectedDoc.document.due_date).toLocaleDateString('ar')}</span>}
                  </div>
                  {/* Cross-dept source indicator */}
                  {selectedDoc.document.origin_dept !== dept && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full border border-cyan-700/60 bg-cyan-900/30 px-2.5 py-1 text-xs text-cyan-300">
                        ↓ وارد من: {DEPT_LABELS[selectedDoc.document.origin_dept] ?? selectedDoc.document.origin_dept}
                      </span>
                      {selectedDoc.document.linked_doc_id && (
                        <span className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                          مرتبط بوثيقة #{selectedDoc.document.linked_doc_id}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedDoc(null)} className="rounded p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {selectedDoc.document.body_text && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{selectedDoc.document.body_text}</p>
                </div>
              )}

              {/* ── inspection_request: structured details ── */}
              {selectedDoc.document.doc_type === 'inspection_request' &&
                selectedDoc.document.metadata &&
                Object.keys(selectedDoc.document.metadata).length > 0 && (
                <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-amber-300">تفاصيل طلب الكشف</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(selectedDoc.document.metadata as Record<string,string>).pipeline_name && (
                      <div><span className="text-slate-500">الخط:</span> <span className="text-slate-200">{(selectedDoc.document.metadata as Record<string,string>).pipeline_name}</span></div>
                    )}
                    {(selectedDoc.document.metadata as Record<string,string>).inspection_type && (
                      <div><span className="text-slate-500">نوع الكشف:</span> <span className="text-slate-200 uppercase">{(selectedDoc.document.metadata as Record<string,string>).inspection_type}</span></div>
                    )}
                    {(selectedDoc.document.metadata as Record<string,string>).segment_from && (
                      <div><span className="text-slate-500">المقطع:</span> <span className="text-slate-200">كم {(selectedDoc.document.metadata as Record<string,string>).segment_from} — {(selectedDoc.document.metadata as Record<string,string>).segment_to ?? '?'}</span></div>
                    )}
                    {(selectedDoc.document.metadata as Record<string,string>).requested_by && (
                      <div><span className="text-slate-500">طالب الكشف:</span> <span className="text-slate-200">{(selectedDoc.document.metadata as Record<string,string>).requested_by}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* ── inspection_report: structured results card ── */}
              {selectedDoc.document.doc_type === 'inspection_report' &&
                selectedDoc.document.metadata &&
                Object.keys(selectedDoc.document.metadata).length > 0 && (() => {
                  const meta = selectedDoc.document.metadata as Record<string,string>;
                  const assmtCls =
                    meta.overall_assessment === 'critical'   ? 'border-red-600/60 bg-red-900/30 text-red-300' :
                    meta.overall_assessment === 'moderate'   ? 'border-yellow-600/60 bg-yellow-900/30 text-yellow-300' :
                    meta.overall_assessment === 'acceptable' ? 'border-green-600/60 bg-green-900/30 text-green-300' :
                    'border-slate-600 bg-slate-800 text-slate-400';
                  const assmtLabel =
                    meta.overall_assessment === 'critical'   ? '🔴 حرج' :
                    meta.overall_assessment === 'moderate'   ? '⚠️ متوسط' :
                    meta.overall_assessment === 'acceptable' ? '✅ مقبول' : meta.overall_assessment;
                  return (
                    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-300">نتائج الكشف الفني</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {meta.inspector_name && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">المفتش</p>
                            <p className="text-sm text-slate-200 mt-0.5">{meta.inspector_name}</p>
                          </div>
                        )}
                        {meta.inspection_date && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">تاريخ الكشف</p>
                            <p className="text-sm text-slate-200 mt-0.5">{new Date(meta.inspection_date).toLocaleDateString('ar')}</p>
                          </div>
                        )}
                        {meta.corrosion_rate && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">معدل التآكل</p>
                            <p className="text-sm font-bold text-amber-300 mt-0.5">{meta.corrosion_rate} ملم/سنة</p>
                          </div>
                        )}
                        {meta.overall_assessment && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">التقييم العام</p>
                            <span className={`inline-block mt-0.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${assmtCls}`}>
                              {assmtLabel}
                            </span>
                          </div>
                        )}
                      </div>
                      {meta.cp_readings && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">قراءات CP</p>
                          <p className="text-xs text-slate-300 font-mono bg-slate-900/60 rounded px-3 py-2">{meta.cp_readings}</p>
                        </div>
                      )}
                      {meta.recommendations && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">التوصيات</p>
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{meta.recommendations}</p>
                        </div>
                      )}
                      {meta.follow_up_required === 'yes' && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                          <p className="text-xs text-amber-300">هذا الكشف يستوجب متابعة دورية</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* Attachments */}
              {docAttachments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">
                    المرفقات ({docAttachments.length})
                  </h3>
                  <div className="space-y-1.5">
                    {docAttachments.map((att) => (
                      <a
                        key={att.id}
                        href={`${API}/files/${att.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="flex-1 truncate">{att.original_name}</span>
                        <span className="text-xs text-slate-500">{formatFileSize(att.file_size)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflow steps */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-300">مسار الاعتماد</h3>
                <div className="space-y-2">
                  {selectedDoc.workflow_steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        step.status === 'completed' ? 'border-green-800/60 bg-green-900/20' :
                        step.status === 'rejected'  ? 'border-red-800/60 bg-red-900/20' :
                        step.step_order === selectedDoc.document.current_step + 1
                          ? 'border-amber-700/60 bg-amber-900/20' : 'border-slate-700 bg-slate-800/30'
                      }`}
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        step.status === 'completed' ? 'bg-green-700 text-white' :
                        step.status === 'rejected'  ? 'bg-red-700 text-white' :
                        step.step_order === selectedDoc.document.current_step + 1
                          ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {step.status === 'completed' ? '✓' : step.status === 'rejected' ? '✗' : step.step_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200">{step.step_label}</p>
                        <p className="text-xs text-slate-500">{step.actor_role} · {step.action_required}</p>
                        {step.actioned_by && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            بواسطة {step.actioned_by} · {step.actioned_at ? new Date(step.actioned_at).toLocaleDateString('ar') : ''}
                          </p>
                        )}
                        {step.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{step.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action panel */}
              {!['archived', 'closed', 'rejected'].includes(selectedDoc.document.status) && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300">اتخاذ إجراء</h3>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="ملاحظات (اختياري)…"
                    rows={2}
                    className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc.document.status === 'draft' && (
                      <button onClick={() => doAction(selectedDoc.document.id, 'submit')} disabled={actioning}
                        className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                        <Send className="h-4 w-4" /> تقديم
                      </button>
                    )}
                    {['submitted', 'in_review', 'pending_approval'].includes(selectedDoc.document.status) && (
                      <>
                        <button onClick={() => doAction(selectedDoc.document.id, 'approve')} disabled={actioning}
                          className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-50">
                          <CheckCircle className="h-4 w-4" /> اعتماد
                        </button>
                        <button onClick={() => doAction(selectedDoc.document.id, 'reject')} disabled={actioning}
                          className="flex items-center gap-1.5 rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50">
                          <XCircle className="h-4 w-4" /> رفض
                        </button>
                        <button onClick={() => doAction(selectedDoc.document.id, 'route')} disabled={actioning}
                          className="flex items-center gap-1.5 rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50">
                          <ChevronDown className="h-4 w-4" /> إحالة
                        </button>
                      </>
                    )}
                    {selectedDoc.document.status === 'approved' && (
                      <button onClick={() => doAction(selectedDoc.document.id, 'archive')} disabled={actioning}
                        className="flex items-center gap-1.5 rounded bg-purple-700 px-3 py-1.5 text-sm text-white hover:bg-purple-600 disabled:opacity-50">
                        <Archive className="h-4 w-4" /> أرشفة
                      </button>
                    )}
                  </div>

                  {/* ─ Cross-dept routing buttons ─ */}
                  {selectedDoc.document.origin_dept !== dept && (
                    <div className="mt-3 border-t border-slate-700 pt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-400">التوجيه والتحويل</p>
                      <div className="flex flex-wrap gap-2">
                        {/* إحالة للفني: only on work_order_doc from another dept */}
                        {selectedDoc.document.doc_type === 'work_order_doc' && (
                          <button
                            onClick={() => doForward(
                              selectedDoc.document.id,
                              'work_order_doc',
                              dept,
                              null,
                              actionNotes || undefined,
                            )}
                            disabled={forwarding}
                            className="flex items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-900/30 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-900/60 disabled:opacity-50"
                          >
                            <Users className="h-4 w-4" />
                            إحالة للفني
                          </button>
                        )}
                        {/* رد بتقرير كشف: only on inspection_request */}
                        {selectedDoc.document.doc_type === 'inspection_request' && (
                          <button
                            onClick={() => setShowInspReply(true)}
                            disabled={forwarding}
                            className="flex items-center gap-1.5 rounded-lg border border-orange-700/60 bg-orange-900/30 px-3 py-1.5 text-sm text-orange-200 hover:bg-orange-900/60 disabled:opacity-50"
                          >
                            <BarChart3 className="h-4 w-4" />
                            رد بتقرير كشف
                          </button>
                        )}
                        {/* رد صادر إلى القسم المُرسِل */}
                        <button
                          onClick={() => doForward(
                            selectedDoc.document.id,
                            'outgoing_letter',
                            dept,
                            selectedDoc.document.origin_dept,
                            actionNotes || undefined,
                          )}
                          disabled={forwarding}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-900/30 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          رد إلى {DEPT_LABELS[selectedDoc.document.origin_dept] ?? selectedDoc.document.origin_dept}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Audit log */}
              {selectedDoc.action_log.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">سجل الإجراءات</h3>
                  <div className="space-y-1.5">
                    {selectedDoc.action_log.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                        <span>{entry.action}</span>
                        <span className="text-slate-600">·</span>
                        <span>{entry.performed_by}</span>
                        {entry.notes && <><span className="text-slate-600">·</span><span className="italic">{entry.notes}</span></>}
                        <span className="mr-auto">{new Date(entry.created_at).toLocaleString('ar')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── New Document Modal ── */}
      {showNewDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <h2 className="text-base font-bold text-slate-100">إنشاء وثيقة جديدة</h2>
              <button onClick={closeModal} className="rounded p-1 text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Type selector */}
            <div className="border-b border-slate-700 px-5 py-4">
              <label className="mb-2 block text-xs font-medium text-slate-400">نوع الوثيقة</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setNewDocType(t); setFormData({}); }}
                    className={`flex items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors ${
                      newDocType === t
                        ? 'border-indigo-500 bg-indigo-900/40 text-indigo-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {DOC_TYPE_ICONS[t]}
                    <span className="leading-tight">{DOC_TYPE_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            <div className="space-y-4 px-5 py-4">
              <DocFormFields
                docType={newDocType}
                data={formData}
                onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))}
              />

              {/* Common: dest + priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">إلى قسم</label>
                  <select
                    value={newDocDest}
                    onChange={(e) => setNewDocDest(e.target.value)}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    <option value="corrosion">قسم التآكل</option>
                    <option value="maintenance">قسم الصيانة</option>
                    <option value="admin">الإدارة العامة</option>
                    <option value="gm">مكتب المدير العام</option>
                    <option value="hr">الموارد البشرية</option>
                    <option value="documentation">قسم التوثيق</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">الأولوية</label>
                  <select
                    value={newDocPriority}
                    onChange={(e) => setNewDocPriority(e.target.value as 'normal' | 'urgent' | 'confidential')}
                    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="normal">عادي</option>
                    <option value="urgent">عاجل</option>
                    <option value="confidential">سري</option>
                  </select>
                </div>
              </div>

              {/* Auto-title preview */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">العنوان التلقائي</label>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 font-mono min-h-[36px]">
                  {getAutoTitle(newDocType, formData) || <span className="text-slate-600 italic">سيُحدَّد من الحقول أعلاه</span>}
                </div>
              </div>

              {/* File attachments */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">المرفقات</label>
                <div className="space-y-2">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="flex-1 truncate text-slate-300">{f.name}</span>
                      <span className="text-xs text-slate-500">{formatFileSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                    <Plus className="h-4 w-4" />
                    إرفاق ملف
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                      onChange={(e) => {
                        if (e.target.files) {
                          setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-700 px-5 py-4">
              <button onClick={closeModal} className="rounded px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
                إلغاء
              </button>
              <button
                onClick={createDoc}
                disabled={!getAutoTitle(newDocType, formData).trim() || creating}
                className="flex items-center gap-2 rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                إنشاء الوثيقة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inspection Report Reply Modal ── */}
      {showInspReply && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-100">رد بتقرير كشف</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  استناداً لـ: <span className="font-mono text-indigo-400">{selectedDoc.document.doc_number}</span>
                  {' — '}{selectedDoc.document.title}
                </p>
              </div>
              <button
                onClick={() => { setShowInspReply(false); setInspReplyData({}); }}
                className="rounded p-1 text-slate-400 hover:text-slate-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <DocFormFields
                docType="inspection_report"
                data={inspReplyData}
                onChange={(k, v) => setInspReplyData((prev) => ({ ...prev, [k]: v }))}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-700 px-5 py-4">
              <button
                onClick={() => { setShowInspReply(false); setInspReplyData({}); }}
                className="rounded px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                إلغاء
              </button>
              <button
                onClick={() => submitInspectionReport(selectedDoc.document.id)}
                disabled={submittingInspReport || !inspReplyData.inspector_name || !inspReplyData.overall_assessment}
                className="flex items-center gap-2 rounded bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {submittingInspReport
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                إرسال تقرير الكشف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
