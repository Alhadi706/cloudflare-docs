'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare, Clock, XCircle, RotateCcw, FileText, Shield,
  Map, AlertTriangle, ChevronLeft, ChevronRight, BarChart2,
  DollarSign, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

const ENTITY_LABELS: Record<string, string> = {
  purchase_request: 'طلب شراء',
  purchase_order:   'أمر شراء',
  journal_entry:    'قيد محاسبي',
  stock_issue:      'صرف مخزن',
  contract:         'عقد',
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'قيد الانتظار', color: 'text-amber-400 bg-amber-900/30' },
  approved:  { label: 'معتمد',        color: 'text-green-400 bg-green-900/30' },
  rejected:  { label: 'مرفوض',       color: 'text-red-400 bg-red-900/30' },
  returned:  { label: 'معاد',         color: 'text-blue-400 bg-blue-900/30' },
  cancelled: { label: 'ملغي',         color: 'text-gray-400 bg-gray-800/30' },
};

const ROLE_LABELS_MAP: Record<string, string> = {
  supervisor:         'المشرف المباشر',
  finance_controller: 'المراقب المالي',
  management:         'الإدارة',
  director:           'المدير العام',
};

const ROLES = [
  { value: 'supervisor',         label: 'المشرف المباشر' },
  { value: 'finance_controller', label: 'المراقب المالي' },
  { value: 'management',         label: 'الإدارة' },
  { value: 'director',           label: 'المدير العام' },
];

const TABS = [
  { id: 'overview',  label: 'الملخص',            icon: BarChart2 },
  { id: 'pending',   label: 'المعاملات المعلقة',  icon: Clock },
  { id: 'requests',  label: 'جميع الطلبات',       icon: FileText },
  { id: 'reviews',   label: 'مراجعة الأصول',      icon: Map },
  { id: 'templates', label: 'القوالب',             icon: Shield },
];

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

export default function WorkflowPage() {
  const [tab, setTab] = useState('overview');
  const [summary,     setSummary]     = useState<any>(null);
  const [requests,    setRequests]    = useState<any[]>([]);
  const [syncStats,   setSyncStats]   = useState<any>(null);
  const [templates,   setTemplates]   = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

  // Pending approvals (inline)
  const [role,           setRole]           = useState('supervisor');
  const [pending,        setPending]        = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedReq,    setSelectedReq]    = useState<any>(null);
  const [detail,         setDetail]         = useState<any>(null);
  const [userName,       setUserName]       = useState('');
  const [comments,       setComments]       = useState('');
  const [submitting,     setSubmitting]     = useState(false);

  // Requests tab filters
  const [fStatus, setFStatus] = useState('');
  const [fType,   setFType]   = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    try {
      const H = { 'X-Tenant-ID': getTenantId() || '' };
      const [sumRes, reqRes, syncRes, tplRes] = await Promise.all([
        fetch('/api/v1/approval/summary',   { headers: H }),
        fetch('/api/v1/approval/requests',  { headers: H }),
        fetch(`/api/v1/review/sync-status?tenant_id=${getTenantId() || ''}`, { headers: H }),
        fetch('/api/v1/approval/templates', { headers: H }),
      ]);
      setSummary(await sumRes.json());
      const rd = await reqRes.json();
      setRequests(rd.requests || []);
      const ss = await syncRes.json();
      setSyncStats(ss.data || null);
      const td = await tplRes.json();
      setTemplates(td.templates || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await fetch(`/api/v1/approval/requests/pending?role=${role}`, {
        headers: { 'X-Tenant-ID': getTenantId() || '' },
      });
      const d = await res.json();
      setPending(d.pending || []);
    } finally {
      setPendingLoading(false);
    }
  }, [role]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (tab === 'pending') loadPending(); }, [tab, loadPending]);

  const openDetail = async (item: any) => {
    setSelectedReq(item);
    setComments('');
    const res = await fetch(`/api/v1/approval/requests/${item.id}`, {
      headers: { 'X-Tenant-ID': getTenantId() || '' },
    });
    setDetail(await res.json());
  };

  const doAction = async (action: 'approve' | 'reject' | 'return') => {
    if (!userName.trim()) { showToast('أدخل اسمك أولاً', false); return; }
    if ((action === 'reject' || action === 'return') && !comments.trim()) {
      showToast('يجب إدخال سبب واضح عند الرفض أو الإرجاع', false);
      return;
    }
    if (!selectedReq) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/approval/requests/${selectedReq.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({ action, performed_by: userName, role, comments }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.detail || 'خطأ', false); return; }
      showToast(d.message, true);
      setSelectedReq(null);
      setDetail(null);
      await Promise.all([loadPending(), loadAll()]);
    } finally {
      setSubmitting(false);
    }
  };

  const overdue = requests.filter(r =>
    r.status === 'pending' &&
    (Date.now() - new Date(r.updated_at).getTime()) > 48 * 3_600_000
  );
  const { totals = {}, by_entity_type = [], pending_by_role = [] } = summary || {};
  const pendingReviews = (syncStats?.pending_gis ?? 0) + (syncStats?.pending_admin ?? 0);
  const filteredRequests = requests.filter(r =>
    (!fStatus || r.status === fStatus) && (!fType || r.entity_type === fType)
  );
  const templatesByType: Record<string, any[]> = {};
  templates.forEach(t => {
    if (!templatesByType[t.entity_type]) templatesByType[t.entity_type] = [];
    templatesByType[t.entity_type].push(t);
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400">جاري التحميل...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${toast.ok ? 'bg-green-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-7 h-7 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">مركز الاعتماد والموافقات</h1>
              <p className="text-gray-500 text-sm mt-0.5">الموافقات · مراجعة البيانات · سير العمل · القوالب</p>
              <span className="inline-block mt-1 bg-green-500 text-black text-xs font-bold px-2 py-0.5 rounded">WORKFLOW HUB LIVE ✔</span>
            </div>
          </div>
          <Link href="/dashboard/admin-gateway" className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> البوابة
          </Link>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'طلبات اعتماد معلقة',    val: totals.pending ?? 0,  color: (totals.pending ?? 0) > 0 ? 'text-amber-400 bg-amber-900/20 border-amber-500/40' : 'text-gray-400 bg-gray-900/20 border-gray-700', Icon: Clock },
            { label: 'مراجعات أصول معلقة',    val: pendingReviews,       color: pendingReviews > 0        ? 'text-teal-400 bg-teal-900/20 border-teal-500/40'   : 'text-gray-400 bg-gray-900/20 border-gray-700', Icon: Map },
            { label: 'طلبات متأخرة +48 ساعة', val: overdue.length,       color: overdue.length > 0        ? 'text-red-400 bg-red-900/20 border-red-500/40'      : 'text-gray-400 bg-gray-900/20 border-gray-700', Icon: AlertTriangle },
            { label: 'معتمدة (الإجمالي)',       val: totals.approved ?? 0, color: 'text-green-400 bg-green-900/20 border-green-500/40', Icon: CheckSquare },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-4 flex items-center gap-3 ${k.color}`}>
              <k.Icon className="w-6 h-6 shrink-0 opacity-70" />
              <div>
                <div className="text-2xl font-bold leading-none">{k.val}</div>
                <div className="text-sm mt-1 opacity-70">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-medium whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === 'pending'  && (totals.pending  ?? 0) > 0 && <span className="bg-amber-500 text-black text-xs font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1.5 badge-alert">{totals.pending}</span>}
              {t.id === 'reviews'  && pendingReviews > 0          && <span className="bg-teal-500 text-black text-xs font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1.5">{pendingReviews}</span>}
              {t.id === 'requests' && overdue.length > 0           && <span className="bg-red-500 text-white text-xs font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1.5 badge-alert-red">{overdue.length}</span>}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3 text-base">الانتظار حسب الدور</h3>
                {pending_by_role.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">✅ لا توجد طلبات معلقة</p>
                ) : (
                  <div className="space-y-2">
                    {pending_by_role.map((r: any) => (
                      <button key={r.role_required} onClick={() => { setRole(r.role_required); setTab('pending'); }}
                        className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-3 transition-colors">
                        <span className="text-gray-300 text-base">{ROLE_LABELS_MAP[r.role_required] || r.role_required}</span>
                        <span className="bg-amber-500/20 text-amber-400 text-sm font-bold px-3 py-1 rounded-full">{r.pending_count} طلب →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3 text-base">بحسب نوع المعاملة</h3>
                <div className="space-y-2">
                  {by_entity_type.map((t: any) => (
                    <div key={t.entity_type} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                      <span className="text-gray-300 text-base">{ENTITY_LABELS[t.entity_type] || t.entity_type}</span>
                      <div className="flex gap-2 items-center">
                        <span className="text-gray-500 text-sm">{t.total} إجمالي</span>
                        {t.pending > 0 && <span className="bg-amber-500/20 text-amber-400 text-sm font-bold px-2.5 py-1 rounded">{t.pending} معلق</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {overdue.length > 0 && (
              <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4">
                <h3 className="text-red-400 font-semibold mb-3 text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> طلبات متأخرة — أكثر من 48 ساعة بدون إجراء
                </h3>
                <div className="space-y-2">
                  {overdue.map(r => {
                    const hrs = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 3_600_000);
                    return (
                      <div key={r.id} className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-white text-base">{r.title}</p>
                          <p className="text-gray-500 text-sm mt-0.5">{r.request_number} · {ENTITY_LABELS[r.entity_type] || r.entity_type}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-red-400 text-sm font-semibold">{hrs}h</span>
                          <Link href={`/dashboard/admin-gateway/workflow/requests/${r.id}`}
                            className="text-purple-400 hover:text-purple-300 text-sm border border-purple-500/30 px-3 py-1.5 rounded">عرض</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-base">آخر الطلبات</h3>
                <button onClick={() => setTab('requests')} className="text-purple-400 text-sm hover:text-purple-300">عرض الكل →</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700 text-right">
                      <th className="py-3 pr-2">رقم الطلب</th><th className="py-3">العنوان</th>
                      <th className="py-3">النوع</th><th className="py-3">الخطوة</th><th className="py-3">الحالة</th><th className="py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 8).map(r => {
                      const st = STATUS_CFG[r.status] || { label: r.status, color: 'text-gray-400 bg-gray-800' };
                      const isOvr = r.status === 'pending' && (Date.now() - new Date(r.updated_at).getTime()) > 48 * 3_600_000;
                      return (
                        <tr key={r.id} className={`border-b border-gray-800 hover:bg-gray-800/40 ${isOvr ? 'bg-red-950/10' : ''}`}>
                          <td className="py-3 pr-2 text-purple-400 font-mono text-sm">{r.request_number}{isOvr && <span className="text-red-400 mr-1">⚠</span>}</td>
                          <td className="py-3 text-white max-w-[200px] truncate">{r.title}</td>
                          <td className="py-3 text-gray-400 text-sm">{ENTITY_LABELS[r.entity_type] || r.entity_type}</td>
                          <td className="py-3 text-gray-400 text-sm">{r.current_step}/{r.total_steps}</td>
                          <td className="py-3"><span className={`text-sm px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span></td>
                          <td className="py-3"><Link href={`/dashboard/admin-gateway/workflow/requests/${r.id}`} className="text-purple-400 hover:text-purple-300 text-sm">عرض</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PENDING APPROVALS ─────────────────────────────────────────────── */}
        {tab === 'pending' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 bg-gray-900 rounded-xl border border-gray-700 p-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">دورك الحالي</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-base">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">اسمك (للتوقيع)</label>
                <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. محمد العمر"
                  className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm w-44" />
              </div>
              <div className="flex items-end">
                <button onClick={loadPending} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                  <RefreshCw className="w-4 h-4" /> تحديث
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold mb-3 text-base">
                  طلبات معلقة
                  {pending.length > 0 && <span className="mr-2 bg-amber-500/20 text-amber-400 text-sm px-2.5 py-0.5 rounded-full font-bold">{pending.length}</span>}
                </h3>
                {pendingLoading ? <p className="text-gray-500 text-sm text-center py-8">جاري التحميل...</p>
                : pending.length === 0 ? (
                  <div className="text-center py-10"><CheckSquare className="w-10 h-10 text-green-500/40 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">لا توجد طلبات لدور {ROLES.find(r => r.value === role)?.label}</p></div>
                ) : (
                  <div className="space-y-2">
                    {pending.map(item => (
                      <button key={item.id} onClick={() => openDetail(item)}
                        className={`w-full text-right rounded-lg border px-4 py-3 transition-all ${selectedReq?.id === item.id ? 'border-amber-500 bg-amber-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-base font-medium truncate">{item.title}</p>
                            <p className="text-gray-400 text-sm mt-0.5">{ENTITY_LABELS[item.entity_type] || item.entity_type}</p>
                          </div>
                          <div className="mr-3 flex-shrink-0">
                            <p className="text-amber-400 font-mono text-sm">{item.request_number}</p>
                            <p className="text-gray-500 text-sm">خطوة {item.current_step}/{item.total_steps}</p>
                          </div>
                        </div>
                        <p className="text-gray-500 text-sm mt-1"><Clock className="w-3 h-3 inline ml-1" />{item.step_name} · {item.submitted_by}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                {!selectedReq ? (
                  <div className="text-center py-16 text-gray-500"><ChevronLeft className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>اختر طلباً لاتخاذ إجراء</p></div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-semibold">{selectedReq.title}</h3>
                        <p className="text-purple-400 font-mono text-xs mt-0.5">{selectedReq.request_number}</p>
                      </div>
                      <Link href={`/dashboard/admin-gateway/workflow/requests/${selectedReq.id}`}
                        className="text-gray-400 hover:text-white text-xs border border-gray-700 px-2 py-1 rounded">عرض كامل ↗</Link>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-800 rounded-lg p-3"><p className="text-gray-500 text-sm mb-1">النوع</p><p className="text-white text-base">{ENTITY_LABELS[selectedReq.entity_type] || selectedReq.entity_type}</p></div>
                      <div className="bg-gray-800 rounded-lg p-3"><p className="text-gray-500 text-sm mb-1">الخطوة</p><p className="text-amber-400 text-base">{selectedReq.step_name}</p></div>
                    </div>
                    {detail?.steps && (
                      <div>
                        <p className="text-gray-500 text-sm mb-2 font-medium">مسار الاعتماد</p>
                        <div className="space-y-1">
                          {detail.steps.map((s: any) => (
                            <div key={s.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${s.step_order === selectedReq.current_step ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-gray-800'}`}>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.status === 'approved' ? 'bg-green-600 text-white' : s.status === 'rejected' ? 'bg-red-600 text-white' : s.status === 'returned' ? 'bg-blue-600 text-white' : s.step_order === selectedReq.current_step ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'}`}>{s.step_order}</span>
                              <span className="text-white flex-1 text-sm">{s.step_name}</span>
                              {s.acted_by && <span className="text-gray-500 text-sm">{s.acted_by}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedReq.notes && (
                      <div className="bg-gray-800 rounded-lg p-3"><p className="text-gray-400 text-sm mb-1">ملاحظات المقدِّم</p><p className="text-gray-300 text-base">{selectedReq.notes}</p></div>
                    )}
                    <div>
                      <label className="text-sm block mb-1">
                        <span className="text-gray-400">التعليق</span>
                        <span className="text-red-400 mr-2 text-xs">* مطلوب عند الرفض أو الإرجاع</span>
                      </label>
                      <textarea value={comments} onChange={e => setComments(e.target.value)}
                        placeholder="سبب القرار أو ملاحظاتك..."
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm resize-none h-16" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => doAction('approve')} disabled={submitting || !userName.trim()} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-1"><CheckSquare className="w-4 h-4" /> موافقة</button>
                      <button onClick={() => doAction('return')}  disabled={submitting || !userName.trim()} className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-1"><RotateCcw className="w-4 h-4" /> إرجاع</button>
                      <button onClick={() => doAction('reject')}  disabled={submitting || !userName.trim()} className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-1"><XCircle className="w-4 h-4" /> رفض</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ALL REQUESTS ──────────────────────────────────────────────────── */}
        {tab === 'requests' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 bg-gray-900 rounded-xl border border-gray-700 p-4">
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-base">
                <option value="">كل الحالات</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={fType} onChange={e => setFType(e.target.value)} className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-base">
                <option value="">كل الأنواع</option>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="text-gray-500 text-base flex items-center">{filteredRequests.length} طلب</span>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700 text-right bg-gray-800/60">
                      <th className="py-4 px-4">رقم الطلب</th><th className="py-4 px-4">العنوان</th>
                      <th className="py-4 px-4">النوع</th><th className="py-4 px-4">الخطوة</th>
                      <th className="py-4 px-4">الحالة</th><th className="py-4 px-4">مقدَّم بواسطة</th><th className="py-4 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(r => {
                      const st = STATUS_CFG[r.status] || { label: r.status, color: 'text-gray-400 bg-gray-800' };
                      const isOvr = r.status === 'pending' && (Date.now() - new Date(r.updated_at).getTime()) > 48 * 3_600_000;
                      return (
                        <tr key={r.id} className={`border-b border-gray-800 hover:bg-gray-800/40 ${isOvr ? 'bg-red-950/10' : ''}`}>
                          <td className="py-4 px-4 text-purple-400 font-mono text-sm">{r.request_number}{isOvr && <span className="text-red-400 mr-1">⚠</span>}</td>
                          <td className="py-4 px-4 text-white max-w-[200px] truncate">{r.title}</td>
                          <td className="py-4 px-4 text-gray-400 text-sm">{ENTITY_LABELS[r.entity_type] || r.entity_type}</td>
                          <td className="py-4 px-4 text-gray-400 text-sm">{r.current_step}/{r.total_steps}</td>
                          <td className="py-4 px-4"><span className={`text-sm px-2.5 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span></td>
                          <td className="py-4 px-4 text-gray-400 text-sm">{r.submitted_by}</td>
                          <td className="py-4 px-4"><Link href={`/dashboard/admin-gateway/workflow/requests/${r.id}`} className="text-purple-400 hover:text-purple-300 text-sm border border-purple-700/40 px-3 py-1.5 rounded">تفاصيل</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ASSET REVIEWS ─────────────────────────────────────────────────── */}
        {tab === 'reviews' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { labelAr: 'مراجعة جغرافية (GIS)', count: syncStats?.pending_gis ?? 0, done: syncStats?.gis_done ?? 0, color: 'text-teal-400 bg-teal-900/20 border-teal-500/40', Icon: Map },
                { labelAr: 'مراجعة إدارية',         count: syncStats?.pending_admin ?? 0, done: syncStats?.admin_done ?? 0, color: 'text-blue-400 bg-blue-900/20 border-blue-500/40', Icon: Shield },
                { labelAr: 'مراجعة مالية',           count: syncStats?.pending_finance ?? 0, done: syncStats?.finance_done ?? 0, color: 'text-amber-400 bg-amber-900/20 border-amber-500/40', Icon: DollarSign },
              ].map(d => (
                <div key={d.labelAr} className={`rounded-xl border p-5 ${d.color}`}>
                  <div className="flex items-center gap-3 mb-3"><d.Icon className="w-6 h-6 opacity-80" /><span className="font-semibold text-base">{d.labelAr}</span></div>
                  <div className="text-4xl font-bold mb-1">{d.count}</div>
                  <div className="text-sm opacity-70 mb-1">بانتظار المراجعة</div>
                  <div className="text-sm opacity-60">مكتملة: {d.done}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'إجمالي الأصول', val: syncStats?.total ?? 0 },
                  { label: 'مكتملة المراجعة', val: syncStats?.approved ?? 0 },
                  { label: 'مطلوب تعديلات', val: syncStats?.changes_requested ?? 0 },
                  { label: 'قيد المراجعة', val: syncStats?.pending_review ?? 0 },
                ].map(s => (
                  <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{s.val}</div>
                    <div className="text-sm text-gray-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <Link href="/dashboard/admin-gateway/assets/reviews"
                  className="inline-flex items-center gap-2 bg-teal-700/30 hover:bg-teal-700/50 border border-teal-500/40 text-teal-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
                  <Map className="w-4 h-4" /> فتح صفحة مراجعة الأصول الكاملة <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── TEMPLATES ─────────────────────────────────────────────────────── */}
        {tab === 'templates' && (
          <div className="space-y-4">
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-300">هذا القسم مخصص للمسؤولين — يتحكم في مسارات الاعتماد لكل نوع كيان</span>
            </div>
            <div className="space-y-3">
              {Object.entries(templatesByType).map(([etype, steps]) => (
                <div key={etype} className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-800/60 border-b border-gray-700">
                    <span className="font-semibold text-base text-white">{ENTITY_LABELS[etype] || etype}</span>
                    <span className="text-gray-500 text-sm">{steps.length} خطوات</span>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {steps.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="w-6 h-6 bg-purple-900/40 rounded-full flex items-center justify-center text-purple-400 text-xs font-bold">{s.step_order}</span>
                        <span className="text-white flex-1 text-base">{s.step_name}</span>
                        <span className="text-gray-500 text-sm">{ROLE_LABELS_MAP[s.role_required] || s.role_required}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="/dashboard/admin-gateway/workflow/templates"
                className="inline-flex items-center gap-2 bg-purple-700/20 hover:bg-purple-700/30 border border-purple-500/30 text-purple-300 px-5 py-2.5 rounded-xl text-sm transition-colors">
                إدارة القوالب (تعديل وإضافة) →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

