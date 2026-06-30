'use client';
import { buildClientTenantHeaders } from '@/lib/gis/clientTenantHeaders';

// ═══════════════════════════════════════════════════════════════════════════════
//  لوحة مدير إدارة التآكل
//  Route: /dashboard/admin-gateway/corrosion/manager
//  Tabs: لوحة التحكم | المراسلات الواردة | الصادرة | قيد الإجراء | موافقات الخطط
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  CheckCircle,
  ClipboardList,
  Crown,
  Database,
  FileText,
  Inbox,
  KeyRound,
  Layers,
  Mail,
  MessageCircle,
  Send,
  Shield,
  Sparkles,
  TrendingDown,
  UserPlus,
  Users,
  ZapOff,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const API_BASE = '/api/v1/dept-admin';
const WF_BASE = '/api/v1/workflow';

function getHeaders(): Record<string, string> {
  const headers = buildClientTenantHeaders();
  if (typeof window === 'undefined') return headers;

  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

type ManagerTab = 'dashboard' | 'correspondence' | 'approvals' | 'access' | 'telegram';

type InviteRole = 'section_manager' | 'supervisor' | 'employee';

interface InviteForm {
  full_name: string;
  email: string;
  role: InviteRole;
  section_id: string;
  job_title: string;
}

interface InviteResponse {
  username: string;
  temp_password: string;
  email: string;
  role: string;
  department_code: string;
}

interface AdminStats {
  total: number;
  pending_action: number;
  inbox_count: number;
}

interface WorkOrderSummary {
  status: string;
  count: number;
}

const TABS: { id: ManagerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',      label: 'لوحة التحكم',         icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'correspondence', label: 'المراسلات الداخلية',  icon: <Mail className="w-4 h-4" /> },
  { id: 'approvals',      label: 'موافقات الخطط',        icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'access',         label: 'رؤساء الأقسام',        icon: <UserPlus className="w-4 h-4" /> },
  { id: 'telegram',       label: 'تيليجرام',             icon: <MessageCircle className="w-4 h-4" /> },
];

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token') || '';
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ── Embedded simple inbox/outbox/pending panels ────────────────────────────
function CorrespondencePanel({ type }: { type: 'inbox' | 'outbox' | 'pending' }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tabMap = { inbox: 'inbox', outbox: 'outbox', pending: 'pending' };
    fetch(`${API_BASE}/corrosion/documents?tab=${tabMap[type]}&limit=30`, { headers: getHeaders() })
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(d => setItems(d.documents ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [type]);

  const typeLabels: Record<string, string> = { inbox: 'وارد', outbox: 'صادر', pending: 'قيد الإجراء' };
  const typeColors: Record<string, string> = { inbox: 'text-cyan-400', outbox: 'text-emerald-400', pending: 'text-amber-400' };

  if (loading) return <div className="text-center py-16 text-slate-500">جاري التحميل...</div>;
  if (!items.length) return (
    <div className="text-center py-16 text-slate-500">
      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>لا توجد {typeLabels[type]} حالياً</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {items.map((doc: any, i: number) => (
        <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
          <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${typeColors[type]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{doc.subject ?? doc.title ?? 'وثيقة'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{doc.sender ?? doc.recipient ?? doc.department ?? ''} — {doc.created_at ? new Date(doc.created_at).toLocaleDateString('ar-SA') : ''}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-800 ${typeColors[type]}`}>{typeLabels[type]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Approvals Panel ─────────────────────────────────────────────────────────
// Shows: (1) Annual plan documents pending manager approval
//        (2) WOs with technical_analysis status pending manager routing
function ApprovalsPanel() {
  const [plans, setPlans]   = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      // Annual plans pending manager approval
      fetch(`${API_BASE}/corrosion/documents?doc_type=annual_plan&limit=50`, { headers: getHeaders() })
        .then(r => r.ok ? r.json() : { documents: [] })
        .then(d => (d.documents ?? []).filter((p: any) =>
          p.metadata?.workflow_stage === 'pending_manager_approval'
        )),
      // WOs from technical analysis awaiting routing
      fetch(`${WF_BASE}/work-orders?dept=corrosion&status=technical_analysis&limit=30`, { headers: getHeaders() })
        .then(r => r.ok ? r.json() : { work_orders: [] })
        .then(d => d.work_orders ?? d.items ?? []),
    ]).then(([p, o]) => { setPlans(p); setOrders(o); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprovePlan = async (doc: any) => {
    setSaving(doc.id);
    try {
      // 1. Mark document as approved
      await fetch(`${API_BASE}/corrosion/documents/${doc.id}/action`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', performed_by: 'corrosion_manager' }),
      });
      // 2. Forward to monitoring section
      await fetch(`${API_BASE}/corrosion/documents/${doc.id}/forward`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: 'annual_plan',
          target_dept: 'corrosion',
          title: doc.title,
          body_text: `الخطة السنوية معتمدة من مدير الإدارة — أُحيلت لقسم المراقبة لإعداد المراحل الشهرية.\n\n${doc.body_text ?? ''}`,
          forwarded_by: 'corrosion_manager',
          metadata: { ...(doc.metadata ?? {}), section: 'monitoring', workflow_stage: 'approved' },
        }),
      });
      setPlans(prev => prev.filter(p => p.id !== doc.id));
    } catch (_) {}
    setSaving(null);
  };

  const handleRouteWO = async (wo: any) => {
    setSaving(wo.id);
    await fetch(`${WF_BASE}/work-orders/${wo.id}/status`, {
      method: 'PATCH',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'maintenance_escalated', notes: 'أحاله مدير إدارة التآكل' }),
    }).catch(() => {});
    setSaving(null);
    setOrders(prev => prev.filter(o => o.id !== wo.id));
  };

  if (loading) return <div className="text-center py-16 text-slate-500">جاري التحميل...</div>;

  const totalPending = plans.length + orders.length;
  if (!totalPending) return (
    <div className="text-center py-16 text-slate-500">
      <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>لا توجد خطط أو أوامر تنتظر الموافقة حالياً</p>
    </div>
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* Annual plans section */}
      {plans.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> خطط سنوية تنتظر الاعتماد ({plans.length})
          </h3>
          <div className="space-y-2">
            {plans.map((doc: any) => (
              <div key={doc.id} className="bg-slate-900/60 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100">{doc.title ?? 'خطة سنوية'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.metadata?.year ? `سنة ${doc.metadata.year} — ` : ''}
                      {doc.metadata?.pipeline_name ?? ''}
                      {doc.created_at ? ` — ${new Date(doc.created_at).toLocaleDateString('ar-SA')}` : ''}
                    </p>
                    {doc.body_text && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{doc.body_text}</p>}
                  </div>
                  <button
                    onClick={() => handleApprovePlan(doc)}
                    disabled={saving === doc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {saving === doc.id ? 'جاري...' : 'اعتماد وإحالة للمراقبة'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work orders section */}
      {orders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" /> أوامر عمل تنتظر الإحالة ({orders.length})
          </h3>
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o.id} className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-100">
                    {o.notes?.includes('[DUAL_WO]') ? '🔗 أمر مزدوج — ' : ''}
                    {o.title_ar ?? o.title ?? `أمر عمل #${o.work_order_number ?? o.id?.slice?.(0, 8)}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{o.asset_name ?? o.pipeline_name ?? ''}</p>
                </div>
                <button
                  onClick={() => handleRouteWO(o)}
                  disabled={saving === o.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {saving === o.id ? 'جاري...' : 'اعتماد وإحالة'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionAccessPanel() {
  const [deptCode, setDeptCode] = useState('CORR');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState<InviteResponse | null>(null);
  const [form, setForm] = useState<InviteForm>({
    full_name: '',
    email: '',
    role: 'section_manager',
    section_id: '',
    job_title: '',
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/auth/me', { headers: getAuthHeader() });
      const me = await meRes.json().catch(() => ({}));
      if (me?.department_code) setDeptCode(me.department_code);

      const res = await fetch('/api/auth/invite', { headers: getAuthHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'تعذر تحميل قائمة الحسابات');
      const all = Array.isArray(data.users) ? data.users : [];
      const scoped = all.filter((u: any) => u.department_code === (me?.department_code || deptCode));
      setUsers(scoped);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الحسابات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const createSectionManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    setResult(null);
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          department_code: deptCode,
          section_id: form.section_id.trim() || undefined,
          job_title: form.job_title.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'فشل إنشاء الحساب');
      setResult(data as InviteResponse);
      setSuccess('تم إنشاء الحساب بنجاح. أرسل اسم المستخدم والرقم السري المؤقت لرئيس القسم.');
      setForm({ full_name: '', email: '', role: 'section_manager', section_id: '', job_title: '' });
      await loadUsers();
    } catch (e: any) {
      setError(e?.message || 'فشل إنشاء الحساب');
    } finally {
      setSaving(false);
    }
  };

  const sectionLeads = users.filter((u) => u.role === 'section_manager' || u.role === 'supervisor');

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-violet-500/30 bg-violet-900/10 p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-violet-300 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> تعيين رؤساء الأقسام
          </h3>
          <p className="text-xs text-slate-400 mt-1">يمكنك تعيين رؤساء الأقسام من قائمة الموظفين الموجودة في الهيكل التنظيمي المركزي.</p>
        </div>
        <a href="/dashboard/admin-gateway/org-structure" className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white transition-colors">
          <UserPlus className="w-4 h-4" /> فتح الهيكل التنظيمي
        </a>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-900/15 px-3 py-2 text-sm text-rose-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/15 px-3 py-2 text-sm text-emerald-300">{success}</div>}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-4">
          <p className="text-xs text-emerald-300 mb-2">بيانات الدخول المؤقتة</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">اسم المستخدم: <span className="font-mono text-white">{result.username}</span></div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">الرقم السري المؤقت: <span className="font-mono text-white">{result.temp_password}</span></div>
          </div>
        </div>
      )}

      <form onSubmit={createSectionManager} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={form.full_name}
          onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
          placeholder="الاسم الكامل"
          required
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          placeholder="email@company.ly"
          required
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <select
          value={form.role}
          onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as InviteRole }))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
        >
          <option value="section_manager">رئيس قسم</option>
          <option value="supervisor">مشرف</option>
          <option value="employee">موظف</option>
        </select>
        <input
          value={form.section_id}
          onChange={(e) => setForm((s) => ({ ...s, section_id: e.target.value }))}
          placeholder="معرف القسم: monitoring / support / coating"
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <input
          value={form.job_title}
          onChange={(e) => setForm((s) => ({ ...s, job_title: e.target.value }))}
          placeholder="المسمى الوظيفي"
          className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <div className="md:col-span-2 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-900/25 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-900/40 disabled:opacity-60"
          >
            <KeyRound className="w-4 h-4" />
            {saving ? 'جاري الإنشاء...' : 'إنشاء حساب رئيس قسم'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h4 className="text-sm font-semibold text-slate-100 mb-3">رؤساء الأقسام الحاليون</h4>
        {loading ? (
          <p className="text-sm text-slate-500">جاري التحميل...</p>
        ) : !sectionLeads.length ? (
          <p className="text-sm text-slate-500">لا يوجد رؤساء أقسام بعد.</p>
        ) : (
          <div className="space-y-2">
            {sectionLeads.map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{u.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email} {u.section_id ? `- ${u.section_id}` : ''}</p>
                </div>
                <span className="text-xs rounded-full px-2 py-0.5 border border-slate-600 text-slate-300">{u.role === 'section_manager' ? 'رئيس قسم' : 'مشرف'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TelegramBotPanel() {
  const [token, setToken] = useState('');
  const [allowSharedToken, setAllowSharedToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [integration, setIntegration] = useState<any | null>(null);
  const telegramConnected = Boolean(integration?.is_active);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/v1/workspace/observer-bot', { headers: getHeaders() });
      const data = await res.json().catch(() => ({}));
      const integrations = Array.isArray(data.integrations) ? data.integrations : [];
      const telegram = integrations.find((i: any) => i.bot_type === 'telegram') || null;
      setIntegration(telegram);
    } catch {
      setIntegration(null);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const runAction = async (action: 'connect_telegram' | 'disconnect_telegram' | 'test_telegram') => {
    setLoading(true);
    setError('');
    setStatusMsg('');
    try {
      if (action === 'connect_telegram' && telegramConnected) {
        setStatusMsg('تيليجرام مربوط بالفعل على مستوى المؤسسة، ولا حاجة لإدخال توكن جديد.');
        return;
      }
      const payload: Record<string, unknown> = { action };
      if (action === 'connect_telegram') payload.botToken = token.trim();
      if (action === 'connect_telegram') payload.allowSharedToken = allowSharedToken;
      const res = await fetch('/api/v1/workspace/observer-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || 'فشل تنفيذ العملية');
      const switched = Array.isArray(data.deactivatedTenantIds) ? data.deactivatedTenantIds : [];
      const details = switched.length > 0 ? `\nالمؤسسات التي تم إيقاف الربط فيها: ${switched.join(', ')}` : '';
      setStatusMsg((data.message || 'تم التنفيذ بنجاح') + details);
      if (action === 'connect_telegram') setToken('');
      await loadStatus();
    } catch (e: any) {
      setError(e?.message || 'فشل الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-cyan-300" /> ربط تيليجرام لإدارة التآكل
        </h3>
        <p className="text-xs text-slate-400 mt-1">الربط يتم على مستوى المؤسسة/التنت الحالي، ويمكن لمدير الإدارة اختباره مباشرة من هنا.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-900/15 px-3 py-2 text-sm text-rose-300">{error}</div>}
      {statusMsg && <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/15 px-3 py-2 text-sm text-emerald-300">{statusMsg}</div>}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        {telegramConnected ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-3 text-sm text-emerald-200">
            تم ربط Telegram مسبقاً على مستوى المؤسسة. هذا القسم يستخدم نفس الربط تلقائياً.
          </div>
        ) : (
          <>
            <label className="text-xs text-slate-400">Telegram Bot Token</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABCDEF..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
              dir="ltr"
            />
            <label className="flex items-start gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={allowSharedToken}
                onChange={(e) => setAllowSharedToken(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                السماح بمشاركة نفس التوكن بين أكثر من مؤسسة. عند إلغاء هذا الخيار (الموصى به)، ربط نفس التوكن هنا سيوقفه تلقائياً في أي مؤسسة أخرى.
              </span>
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runAction('connect_telegram')}
            disabled={loading || telegramConnected || !token.trim()}
            className="rounded-lg border border-cyan-500/40 bg-cyan-900/25 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-60"
          >
            {loading ? 'جاري...' : 'ربط التوكن'}
          </button>
          <button
            onClick={() => runAction('test_telegram')}
            disabled={loading}
            className="rounded-lg border border-emerald-500/40 bg-emerald-900/25 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
          >
            اختبار الاتصال
          </button>
          <button
            onClick={() => runAction('disconnect_telegram')}
            disabled={loading}
            className="rounded-lg border border-rose-500/40 bg-rose-900/25 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-900/40 disabled:opacity-60"
          >
            فصل تيليجرام
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h4 className="text-sm font-semibold text-slate-100 mb-2">حالة الربط الحالية</h4>
        {integration ? (
          <div className="text-sm text-slate-300 space-y-1">
            <p>النوع: <span className="text-white">{integration.bot_type}</span></p>
            <p>الحالة: <span className="text-cyan-300">{integration.status || (integration.is_active ? 'active' : 'inactive')}</span></p>
            <p>نشط: <span className="text-white">{integration.is_active ? 'نعم' : 'لا'}</span></p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">لا يوجد ربط تيليجرام حالياً.</p>
        )}
      </div>
    </div>
  );
}

// ── Manager Dashboard ──────────────────────────────────────────────────────
function ManagerDashboard({ stats }: { stats: AdminStats | null }) {
  const sections = [
    {
      title: 'قسم المراقبة الدورية والصيانة',
      subtitle: 'Periodic Monitoring & Maintenance',
      color: 'border-cyan-500/30 hover:border-cyan-500/60',
      iconColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      icon: <Activity className="w-5 h-5" />,
      href: '/dashboard/admin-gateway/corrosion/monitoring',
      items: ['جلسات المسح', 'خريطة المسار', 'أدوات CIPS/DCVG'],
    },
    {
      title: 'قسم الدعم الفني',
      subtitle: 'Technical Support Section',
      color: 'border-emerald-500/30 hover:border-emerald-500/60',
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      icon: <Sparkles className="w-5 h-5" />,
      href: '/dashboard/admin-gateway/corrosion/support',
      items: ['تحليل المسح', 'مقارنة المسوحات', 'التنبؤ المتقدم', 'التقرير الهندسي'],
    },
    {
      title: 'قسم المكونات الهندسية والطلاء',
      subtitle: 'Components & Coating Section',
      color: 'border-amber-500/30 hover:border-amber-500/60',
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      icon: <Layers className="w-5 h-5" />,
      href: '/dashboard/admin-gateway/corrosion/coating',
      items: ['أوامر العمل', 'التقارير الإدارية'],
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الوثائق',    value: stats?.total ?? '—',          icon: <FileText className="w-4 h-4 text-slate-400" />,   border: 'border-slate-700' },
          { label: 'بانتظار الإجراء',   value: stats?.pending_action ?? '—', icon: <ClipboardList className="w-4 h-4 text-amber-400" />, border: 'border-amber-500/30' },
          { label: 'واردة للمراجعة',    value: stats?.inbox_count ?? '—',    icon: <Inbox className="w-4 h-4 text-cyan-400" />,        border: 'border-cyan-500/30' },
          { label: 'الأقسام النشطة',    value: 3,                             icon: <Users className="w-4 h-4 text-emerald-400" />,     border: 'border-emerald-500/30' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-slate-900/50 rounded-xl border ${kpi.border} p-4`}>
            <div className="flex items-center gap-2 mb-1">{kpi.icon}<p className="text-xs text-slate-400">{kpi.label}</p></div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Section Status Grid ── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> حالة الأقسام التابعة
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="group block">
              <div className={`bg-slate-900 border ${s.color} rounded-2xl p-5 transition-all duration-200 hover:bg-slate-800/70 h-full`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${s.bgColor} flex items-center justify-center shrink-0`}>
                    <span className={s.iconColor}>{s.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{s.title}</h3>
                    <p className={`text-xs mt-0.5 ${s.iconColor} opacity-70`}>{s.subtitle}</p>
                  </div>
                </div>
                <ul className="space-y-1 mb-3">
                  {s.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.bgColor} border ${s.color.split(' ')[0]}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className={`flex items-center gap-1 text-xs font-semibold ${s.iconColor} group-hover:gap-2 transition-all`}>
                  فتح القسم <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Quick Navigation ── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <ZapOff className="w-4 h-4" /> روابط سريعة للمدير
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'المراسلات الواردة',  href: '/dashboard/admin-gateway/corrosion/admin?tab=inbox',   color: 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20' },
            { label: 'المراسلات الصادرة',  href: '/dashboard/admin-gateway/corrosion/admin?tab=outbox',  color: 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/20' },
            { label: 'قيد الإجراء',        href: '/dashboard/admin-gateway/corrosion/admin?tab=pending', color: 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20' },
            { label: 'الفريق والأعضاء',    href: '/dashboard/admin-gateway/corrosion/admin?tab=team',   color: 'border-slate-600 text-slate-300 hover:bg-slate-800/40' },
            { label: 'أوامر عمل المكونات', href: '/dashboard/admin-gateway/corrosion/coating?tab=work-orders', color: 'border-orange-500/40 text-orange-300 hover:bg-orange-900/20' },
            { label: 'تقارير الدعم الفني', href: '/dashboard/admin-gateway/corrosion/support?tab=report', color: 'border-purple-500/40 text-purple-300 hover:bg-purple-900/20' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${link.color}`}
            >
              {link.label} <ArrowUpRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CorrosionManagerPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ManagerTab>('dashboard');
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/corrosion/stats`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setAdminStats({ total: d.total ?? 0, pending_action: d.pending_action ?? 0, inbox_count: d.inbox_count ?? 0 }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tabParam = searchParams?.get('tab') as ManagerTab | null;
    const allowed: ManagerTab[] = ['dashboard', 'correspondence', 'approvals', 'access', 'telegram'];
    if (tabParam && allowed.includes(tabParam)) setActiveTab(tabParam);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── شريط التنقل ── */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard/admin-gateway/corrosion" className="flex items-center gap-1.5 hover:text-rose-400 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
            إدارة التآكل
          </Link>
          <span>/</span>
          <span className="text-rose-400 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            مدير إدارة التآكل
          </span>
        </div>

        {/* ── Header ── */}
        <div className="bg-slate-900/60 border border-rose-500/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Crown className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">مدير إدارة التآكل</h1>
            <p className="text-sm text-rose-400/70 mt-0.5">Executive Corrosion Management — لوحة الإدارة والإشراف الكاملة</p>
          </div>
        </div>

        {/* روابط سريعة */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/dashboard/admin-gateway/corrosion/coating?tab=work-orders" className="rounded-full border border-emerald-500/35 bg-emerald-900/20 px-3 py-1.5 text-emerald-300 hover:bg-emerald-900/35 inline-flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> أوامر العمل الفنية
          </Link>
          <Link href="/dashboard/admin-gateway/corrosion/monitoring?tab=sessions" className="rounded-full border border-violet-500/35 bg-violet-900/20 px-3 py-1.5 text-violet-300 hover:bg-violet-900/35 inline-flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> جلسات المسح
          </Link>
          <Link href="/dashboard/admin-gateway/corrosion/support?tab=analysis" className="rounded-full border border-rose-500/35 bg-rose-900/20 px-3 py-1.5 text-rose-300 hover:bg-rose-900/35 inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> التحليل الفني
          </Link>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 bg-slate-900/50 rounded-xl border border-slate-800 p-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'dashboard'      && <ManagerDashboard stats={adminStats} />}
        {activeTab === 'correspondence' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المراسلات الداخلية الموحدة</h2>
            <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3">
              <p className="text-sm text-rose-200 font-semibold">تم توحيد مسارات المراسلات في قناة واحدة</p>
              <p className="text-xs text-slate-300 mt-1">الوارد والصادر والتعميمات والإجراءات الإدارية تُدار من نفس اللوحة لتقليل التشتت وتسريع المتابعة.</p>
            </div>
            <InternalMailTab department="corrosion" title="نظام المراسلات الموحد - إدارة التآكل" />
          </div>
        )}
        {activeTab === 'approvals'      && <ApprovalsPanel />}
        {activeTab === 'access'         && <SectionAccessPanel />}
        {activeTab === 'telegram'       && <TelegramBotPanel />}

      </div>
    </div>
  );
}
