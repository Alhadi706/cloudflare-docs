'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// الفرق الفنية الميدانية — يُكوِّنها رئيس قسم المراقبة من قوائم الموظفين
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Link2, Loader2, MessageCircle, Plus, RefreshCw, Trash2, UserPlus, Users, X } from 'lucide-react';

const API_DEPT = '/api/v1/dept-admin';

function buildHeaders(): Record<string, string> {
  const tenantId = (typeof window !== 'undefined')
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

interface Employee {
  id: number;
  first_name_ar: string;
  last_name_ar: string;
  email: string;
  employee_number: string;
  phone?: string;
  phone_number?: string;
  mobile?: string;
  mobile_number?: string;
}

interface TeamMember {
  memberId: string;
  empId: number | null;
  name: string;
  email?: string;
  role: string;
  employeeNumber?: string;
  phone?: string;
  source: 'directory' | 'manual';
}

interface FieldTeam {
  id: string;
  name: string;
  specialization: string;
  members: TeamMember[];
  savedAt?: string;
}

interface IncomingWorkOrder {
  id: number;
  work_order_number?: string;
  title?: string;
  title_ar?: string;
  status?: string;
  source_dept?: string;
  target_department?: string;
  assigned_team?: string | null;
  created_at?: string;
  notes?: string;
}

const SPECS = [
  'مسح الحماية الكاثودية CP',
  'مسح CIPS/DCVG',
  'فحص الطلاء والمكونات',
  'كشف العوائق الميدانية',
  'مسح متكامل (CP + DCVG)',
];

const TEAM_ROLES = ['قائد الفريق', 'مهندس ميداني', 'فني مسح', 'سائق / دعم لوجستي'];

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function FieldTeamsTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teams, setTeams] = useState<FieldTeam[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamSpec, setTeamSpec] = useState(SPECS[0]);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [addEmpId, setAddEmpId] = useState('');
  const [addRole, setAddRole] = useState(TEAM_ROLES[0]);
  const [manualName, setManualName] = useState('');
  const [manualEmployeeNumber, setManualEmployeeNumber] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualRole, setManualRole] = useState(TEAM_ROLES[0]);
  const [formError, setFormError] = useState('');
  const [incomingLoading, setIncomingLoading] = useState(true);
  const [incomingOrders, setIncomingOrders] = useState<IncomingWorkOrder[]>([]);
  const [incomingAssigningId, setIncomingAssigningId] = useState<number | null>(null);
  const [incomingError, setIncomingError] = useState('');
  const [incomingSuccess, setIncomingSuccess] = useState('');
  const [teamByOrder, setTeamByOrder] = useState<Record<number, string>>({});
  const [syncingAllToBot, setSyncingAllToBot] = useState(false);
  const [syncAllError, setSyncAllError] = useState('');
  const [syncAllSuccess, setSyncAllSuccess] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [allowSharedToken, setAllowSharedToken] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [telegramInfo, setTelegramInfo] = useState('');
  const [telegramIntegration, setTelegramIntegration] = useState<any | null>(null);

  const telegramConnected = Boolean(telegramIntegration?.is_active);

  // Load employees from HR dept API
  useEffect(() => {
    setEmpLoading(true);
    setEmpError(false);
    fetch(`${API_DEPT}/corrosion/employees?limit=200`, { headers: buildHeaders() })
      .then(r => {
        if (!r.ok) { setEmpError(true); return []; }
        return r.json();
      })
      .then((d: any) => {
        const list = Array.isArray(d) ? d : (d?.employees ?? d?.data ?? []);
        setEmployees(list);
        if (!list.length) setEmpError(true);
      })
      .catch(() => { setEmpError(true); setEmployees([]); })
      .finally(() => setEmpLoading(false));
  }, []);

  const loadTeams = async () => {
    setTeamsLoading(true);
    try {
      const r = await fetch('/api/v1/corrosion/field-teams', { headers: buildHeaders() });
      const d = await r.json().catch(() => ({ teams: [] }));
      if (r.ok) {
        const rows = Array.isArray(d.teams) ? d.teams : [];
        setTeams(
          rows.map((t: any) => ({
            id: t.id,
            name: t.name,
            specialization: t.specialization,
            members: Array.isArray(t.members) ? t.members : [],
            savedAt: t.updatedAt ?? t.createdAt,
          }))
        );
      } else {
        setTeams([]);
      }
    } catch {
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTelegramStatus = async () => {
    try {
      const res = await fetch('/api/v1/workspace/observer-bot', { headers: buildHeaders() });
      const data = await res.json().catch(() => ({}));
      const integrations = Array.isArray(data?.integrations) ? data.integrations : [];
      const telegram = integrations.find((i: any) => i.bot_type === 'telegram') || null;
      setTelegramIntegration(telegram);
    } catch {
      setTelegramIntegration(null);
    }
  };

  useEffect(() => {
    loadTelegramStatus();
  }, []);

  const runTelegramAction = async (action: 'connect_telegram' | 'test_telegram' | 'disconnect_telegram') => {
    setTelegramLoading(true);
    setTelegramError('');
    setTelegramInfo('');
    try {
      if (action === 'connect_telegram' && telegramConnected) {
        setTelegramInfo('تيليجرام مربوط مسبقاً على مستوى المؤسسة. كل الفرق تستخدم نفس الربط تلقائياً.');
        return;
      }

      const payload: Record<string, unknown> = { action };
      if (action === 'connect_telegram') {
        if (!telegramToken.trim()) {
          setTelegramError('الرجاء إدخال Bot Token قبل الربط');
          return;
        }
        payload.botToken = telegramToken.trim();
        payload.allowSharedToken = allowSharedToken;
      }

      const res = await fetch('/api/v1/workspace/observer-bot', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setTelegramError(String(data?.error || 'تعذر تنفيذ عملية تيليجرام'));
        return;
      }

      const switched = Array.isArray(data?.deactivatedTenantIds) ? data.deactivatedTenantIds : [];
      const details = switched.length > 0 ? `\nالمؤسسات التي تم إيقاف الربط فيها: ${switched.join('، ')}` : '';
      setTelegramInfo(String(data?.message || 'تم تنفيذ العملية بنجاح') + details);
      if (action === 'connect_telegram') setTelegramToken('');
      await loadTelegramStatus();
    } catch {
      setTelegramError('تعذر تنفيذ عملية تيليجرام');
    } finally {
      setTelegramLoading(false);
    }
  };

  const loadIncomingOrders = async () => {
    setIncomingLoading(true);
    setIncomingError('');
    try {
      const r = await fetch('/api/v1/workflow/work-orders?tab=incoming&dept=corrosion&limit=200', { headers: buildHeaders() });
      const d = await r.json().catch(() => ({ data: [] }));
      if (!r.ok) {
        setIncomingOrders([]);
        setIncomingError(d?.error ?? d?.detail ?? 'تعذر جلب الأوامر الواردة');
        return;
      }

      const rows: IncomingWorkOrder[] = Array.isArray(d?.data)
        ? d.data
        : Array.isArray(d?.work_orders)
          ? d.work_orders
          : Array.isArray(d?.items)
            ? d.items
            : [];

      // Orders that still need section-head routing to a concrete field team.
      const pendingForTeam = rows.filter((o) => {
        const assigned = String(o.assigned_team ?? '').trim();
        if (!assigned) return true;
        const lower = assigned.toLowerCase();
        return (
          lower.includes('رئيس قسم') ||
          (lower.includes('قسم') && !lower.includes('فريق'))
        );
      });

      setIncomingOrders(pendingForTeam);
      setTeamByOrder((prev) => {
        const next = { ...prev };
        for (const wo of pendingForTeam) {
          if (!next[wo.id] && teams.length > 0) next[wo.id] = teams[0].name;
        }
        return next;
      });
    } catch {
      setIncomingOrders([]);
      setIncomingError('تعذر جلب الأوامر الواردة');
    } finally {
      setIncomingLoading(false);
    }
  };

  useEffect(() => {
    loadIncomingOrders();
  }, [teams.length]);

  const assignOrderToTeam = async (order: IncomingWorkOrder) => {
    const selectedTeam = teamByOrder[order.id];
    if (!selectedTeam) {
      setIncomingError('اختر الفريق أولاً قبل الإحالة');
      return;
    }

    setIncomingAssigningId(order.id);
    setIncomingError('');
    setIncomingSuccess('');
    try {
      const r = await fetch(`/api/v1/workflow/work-orders/${order.id}/assign`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          assigned_team: selectedTeam,
          assigned_by: 'رئيس قسم المراقبة الدورية والصيانة',
          notes: 'إحالة مباشرة من رئيس القسم إلى فريق التنفيذ',
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setIncomingError(d?.error ?? d?.detail ?? 'تعذر إحالة الأمر للفريق');
        return;
      }
      setIncomingSuccess('تمت إحالة الأمر للفريق بنجاح');
      await loadIncomingOrders();
    } catch {
      setIncomingError('تعذر إحالة الأمر للفريق');
    } finally {
      setIncomingAssigningId(null);
    }
  };

  const addMember = () => {
    const empId = parseInt(addEmpId);
    if (!empId) { setFormError('اختر موظفاً'); return; }
    if (selectedMembers.find(m => m.empId === empId && m.source === 'directory')) { setFormError('الموظف مضاف مسبقاً'); return; }
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    setSelectedMembers(prev => [
      ...prev,
      {
        memberId: `dir-${empId}`,
        empId,
        name: `${emp.first_name_ar} ${emp.last_name_ar}`,
        email: emp.email,
        employeeNumber: emp.employee_number,
        phone: String(emp.phone || emp.phone_number || emp.mobile || emp.mobile_number || '').trim() || undefined,
        role: addRole,
        source: 'directory',
      },
    ]);
    setAddEmpId('');
    setFormError('');
  };

  const addManualMember = () => {
    if (!manualName.trim()) { setFormError('أدخل اسم العضو'); return; }
    if (!manualEmployeeNumber.trim()) { setFormError('أدخل الرقم الوظيفي'); return; }
    if (!manualPhone.trim()) { setFormError('أدخل رقم الهاتف'); return; }
    if (selectedMembers.find(m => m.source === 'manual' && m.employeeNumber === manualEmployeeNumber.trim())) {
      setFormError('هذا الرقم الوظيفي مضاف مسبقاً');
      return;
    }
    setSelectedMembers(prev => [
      ...prev,
      {
        memberId: `man-${uid()}`,
        empId: null,
        name: manualName.trim(),
        employeeNumber: manualEmployeeNumber.trim(),
        phone: manualPhone.trim(),
        role: manualRole,
        source: 'manual',
      },
    ]);
    setManualName('');
    setManualEmployeeNumber('');
    setManualPhone('');
    setManualRole(TEAM_ROLES[0]);
    setFormError('');
  };

  const removeMember = (memberId: string) => setSelectedMembers(prev => prev.filter(m => m.memberId !== memberId));

  const saveTeam = () => {
    saveTeamAsync();
  };

  const saveTeamAsync = async () => {
    if (!teamName.trim()) { setFormError('يرجى تسمية الفريق'); return; }
    if (selectedMembers.length === 0) { setFormError('أضف عضواً واحداً على الأقل'); return; }
    const team: FieldTeam = {
      id: uid(),
      name: teamName.trim(),
      specialization: teamSpec,
      members: selectedMembers,
      savedAt: new Date().toISOString(),
    };
    try {
      const r = await fetch('/api/v1/corrosion/field-teams', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          id: team.id,
          name: team.name,
          specialization: team.specialization,
          members: team.members,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: 'تعذر حفظ الفريق' }));
        setFormError(e.error ?? 'تعذر حفظ الفريق');
        return;
      }
      setTeamName('');
      setTeamSpec(SPECS[0]);
      setSelectedMembers([]);
      setShowForm(false);
      setFormError('');
      await loadTeams();
    } catch {
      setFormError('تعذر حفظ الفريق');
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await fetch(`/api/v1/corrosion/field-teams/${id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });
      await loadTeams();
    } catch {
      // no-op
    }
  };

  const syncAllTeamsToBot = async () => {
    setSyncingAllToBot(true);
    setSyncAllError('');
    setSyncAllSuccess('');
    try {
      const teamsRes = await fetch('/api/v1/corrosion/field-teams', { headers: buildHeaders() });
      const teamsData = await teamsRes.json().catch(() => ({ teams: [] }));
      if (!teamsRes.ok) {
        setSyncAllError(teamsData?.error ?? 'تعذر تحميل الفرق للمزامنة');
        return;
      }

      const rows: Array<{ id: string; name?: string; specialization?: string }> = Array.isArray(teamsData?.teams)
        ? teamsData.teams
        : [];

      if (!rows.length) {
        setSyncAllError('لا توجد فرق تآكل للمزامنة حالياً');
        return;
      }

      let okCount = 0;
      const failed: string[] = [];

      for (const row of rows) {
        const res = await fetch('/api/v1/workspace/observer-bot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildHeaders(),
          },
          body: JSON.stringify({
            action: 'sync_corrosion_team',
            sourceTeamId: row.id,
            assetProfile: 'pipeline_valve',
            siteScope: row.specialization || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          okCount += 1;
        } else {
          failed.push(String(row.name || row.id));
        }
      }

      if (failed.length) {
        setSyncAllError(`تمت مزامنة ${okCount} فريق، وتعذر مزامنة: ${failed.join('، ')}`);
      } else {
        setSyncAllSuccess(`تمت مزامنة جميع الفرق بنجاح (${okCount})`);
      }
    } catch {
      setSyncAllError('حدث خطأ أثناء مزامنة الفرق مع البوت');
    } finally {
      setSyncingAllToBot(false);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">الفرق الفنية الميدانية</h2>
          <p className="text-sm text-slate-400 mt-0.5">يُكوِّنها رئيس قسم المراقبة من قوائم موظفي الإدارة لتنفيذ مراحل الخطة السنوية</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncAllTeamsToBot}
            disabled={syncingAllToBot}
            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-sm font-semibold transition-colors disabled:opacity-50"
            title="مزامنة كل الفرق القديمة مع البوت"
          >
            {syncingAllToBot ? 'جاري المزامنة...' : 'مزامنة كل الفرق مع البوت'}
          </button>
          <button
            onClick={loadTeams}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${teamsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> فريق جديد
          </button>
        </div>
      </div>

      {syncAllError && (
        <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{syncAllError}</div>
      )}
      {syncAllSuccess && (
        <div className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> {syncAllSuccess}
        </div>
      )}

      {/* ── Telegram Control (for same corrosion section) ── */}
      <div className="bg-slate-900/70 border border-cyan-500/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> تحكم تيليجرام للفرق الفنية
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">نفس شاشة الفرق فيها ربط البوت واختباره، لأن كل تكوين فريق لازم يكون معه تحكم تيليجرام.</p>
          </div>
          <button
            onClick={loadTelegramStatus}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="تحديث حالة تيليجرام"
          >
            <RefreshCw className={`w-4 h-4 ${telegramLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!!telegramError && (
          <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{telegramError}</div>
        )}
        {!!telegramInfo && (
          <div className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/20 rounded-lg px-3 py-2 whitespace-pre-wrap">{telegramInfo}</div>
        )}

        {telegramConnected ? (
          <div className="text-xs text-emerald-200 bg-emerald-900/20 border border-emerald-500/20 rounded-lg px-3 py-2">
            تيليجرام مربوط مسبقاً للمؤسسة، والفرق الحالية تستخدم هذا الربط تلقائياً.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="123456:ABCDEF..."
                className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                dir="ltr"
              />
              <button
                onClick={() => runTelegramAction('connect_telegram')}
                disabled={telegramLoading || !telegramToken.trim()}
                className="rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1.5"><Link2 className="w-4 h-4" /> ربط التوكن</span>
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={allowSharedToken}
                onChange={(e) => setAllowSharedToken(e.target.checked)}
                className="mt-0.5"
              />
              <span>السماح بمشاركة نفس التوكن بين أكثر من مؤسسة (اختياري).</span>
            </label>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runTelegramAction('test_telegram')}
            disabled={telegramLoading}
            className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-50"
          >
            اختبار الاتصال
          </button>
          <button
            onClick={() => runTelegramAction('disconnect_telegram')}
            disabled={telegramLoading}
            className="px-3 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold disabled:opacity-50"
          >
            فصل تيليجرام
          </button>
          <span className="text-xs text-slate-400 self-center">
            الحالة: {telegramIntegration?.status || (telegramConnected ? 'active' : 'inactive') || 'غير مربوط'}
          </span>
        </div>
      </div>

      {/* ── Incoming Orders For Section Head ── */}
      <div className="bg-slate-900/70 border border-amber-500/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-amber-300">الأوامر المحالة لرئيس القسم</h3>
            <p className="text-xs text-slate-400 mt-0.5">هنا يظهر الأمر الوارد للقسم ليتم توزيعُه على الفريق المناسب</p>
          </div>
          <button
            onClick={loadIncomingOrders}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="تحديث الأوامر الواردة"
          >
            <RefreshCw className={`w-4 h-4 ${incomingLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {incomingError && (
          <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{incomingError}</div>
        )}
        {incomingSuccess && (
          <div className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {incomingSuccess}
          </div>
        )}

        {incomingLoading ? (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري تحميل الأوامر الواردة...
          </div>
        ) : incomingOrders.length === 0 ? (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> لا توجد حالياً أوامر قيد التوزيع على فريق
          </div>
        ) : (
          <div className="space-y-2">
            {incomingOrders.map((order) => (
              <div key={order.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm text-white font-semibold">
                      {order.title_ar || order.title || `أمر عمل #${order.id}`}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {order.work_order_number ?? `#${order.id}`} • الحالة: {order.status ?? '—'}
                      {order.source_dept ? ` • وارد من: ${order.source_dept}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={teamByOrder[order.id] ?? ''}
                      onChange={(e) => setTeamByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))}
                      className="min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">— اختر الفريق المناسب —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignOrderToTeam(order)}
                      disabled={incomingAssigningId === order.id}
                      className="px-3 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 transition-colors text-xs font-semibold disabled:opacity-50"
                    >
                      {incomingAssigningId === order.id ? 'جاري الإحالة...' : 'إحالة للفريق'}
                    </button>
                  </div>
                </div>
                {order.assigned_team && (
                  <p className="text-[11px] text-slate-500">المحال حالياً إلى: {order.assigned_team}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <div className="bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> تكوين فريق ميداني جديد
          </h3>

          {formError && (
            <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{formError}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">اسم الفريق *</label>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="مثال: فريق مسح خط الشويرف – أ"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">التخصص</label>
              <select
                value={teamSpec}
                onChange={e => setTeamSpec(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Add Member */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300">إضافة أعضاء الفريق</p>
                {/* HR Employee Selector — always visible with loading/error states */}
                {empLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري تحميل قوائم الموارد البشرية...
                  </div>
                ) : empError || employees.length === 0 ? (
                  <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2">
                    قائمة الشؤون الإدارية غير متاحة حالياً، استخدم الإدخال المباشر أدناه لبناء الفريق يدوياً.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> مرتبط مع الشؤون الإدارية — {employees.length} موظف متاح
                    </div>
                    <input
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      placeholder="ابحث باسم الموظف أو رقمه الوظيفي..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={addEmpId}
                        onChange={e => setAddEmpId(e.target.value)}
                        className="min-w-[240px] flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">— اختر موظفاً —</option>
                        {employees
                          .filter(e => {
                            if (!empSearch.trim()) return true;
                            const s = empSearch.toLowerCase();
                            return (
                              (e.first_name_ar || '').toLowerCase().includes(s) ||
                              (e.last_name_ar || '').toLowerCase().includes(s) ||
                              (e.employee_number || '').toLowerCase().includes(s) ||
                              (e.email || '').toLowerCase().includes(s)
                            );
                          })
                          .map(e => {
                            const name = [e.first_name_ar, e.last_name_ar].filter(Boolean).join(' ') || e.email?.split('@')[0] || '—';
                            return (
                              <option key={e.id} value={e.id}>
                                {name} ({e.employee_number})
                              </option>
                            );
                          })}
                      </select>
                      <select
                        value={addRole}
                        onChange={e => setAddRole(e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                      >
                        {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        onClick={addMember}
                        className="px-3 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 transition-colors text-sm font-semibold"
                      >
                        إضافة من القائمة
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-300">إضافة مباشرة من رئيس القسم</p>
                    <span className="text-[11px] text-slate-500">للأعضاء غير الموجودين في قائمة الإدارة</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      placeholder="اسم العضو"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      value={manualEmployeeNumber}
                      onChange={e => setManualEmployeeNumber(e.target.value)}
                      placeholder="الرقم الوظيفي"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      value={manualPhone}
                      onChange={e => setManualPhone(e.target.value)}
                      placeholder="رقم الهاتف للربط بالتيليجرام"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex gap-2">
                      <select
                        value={manualRole}
                        onChange={e => setManualRole(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                      >
                        {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        onClick={addManualMember}
                        className="px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-sm font-semibold"
                      >
                        إضافة مباشرة
                      </button>
                    </div>
                  </div>
                </div>

            {/* Members list */}
            {selectedMembers.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {selectedMembers.map(m => (
                      <div key={m.memberId} className="flex items-center gap-2 bg-slate-700/60 rounded-lg px-3 py-2">
                    <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-white">{m.name}</span>
                            {m.source === 'manual' && (
                              <span className="text-[10px] text-amber-300 bg-amber-900/20 border border-amber-500/20 rounded-full px-2 py-0.5">يدوي</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {m.employeeNumber ? `رقم وظيفي: ${m.employeeNumber}` : 'بدون رقم وظيفي'}
                            {m.phone ? ` • هاتف: ${m.phone}` : ''}
                            {m.email ? ` • ${m.email}` : ''}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{m.role}</span>
                        <button onClick={() => removeMember(m.memberId)} className="text-slate-500 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={saveTeam}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-sm font-semibold transition-colors"
            >
              <UserPlus className="w-4 h-4" /> حفظ الفريق
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(''); setTeamName(''); setSelectedMembers([]); }}
              className="text-slate-500 hover:text-slate-300 text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── Teams List ── */}
      {teamsLoading ? (
        <div className="text-center py-16 text-slate-500 border border-slate-800 rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="font-medium">جاري تحميل الفرق...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-slate-800 rounded-2xl">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد فرق ميدانية بعد</p>
          <p className="text-xs mt-1">أنشئ فريقاً جديداً لتخصيصه لمراحل الخطة السنوية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{team.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {team.specialization} — {team.members.length} عضو
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); deleteTeam(team.id); }}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedId === team.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {expandedId === team.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-4">
                  <div className="space-y-2">
                    {team.members.map(m => (
                      <div key={m.empId} className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-3 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                          <span className="text-xs text-cyan-400 font-bold">{m.name[0]}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{m.name}</p>
                          <p className="text-xs text-slate-500">{m.email}</p>
                        </div>
                        <span className="text-xs text-slate-400 bg-slate-700/60 rounded-full px-2.5 py-1">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
