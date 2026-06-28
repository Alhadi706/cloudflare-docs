'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, UserCheck, ChevronLeft, Award,
  Wrench, X, RefreshCw, ExternalLink, Activity,
  Bot, ShieldCheck, MessageCircle, CheckCircle2, UserPlus, Trash2, Copy,
} from 'lucide-react';
import Link from 'next/link';

const getTenantId = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || '';
};

interface MaintenanceTeam {
  id: number;
  team_name: string;
  team_code?: string;
  specialty: string;
  team_leader?: string;
  members_count?: number;
  status: string;
  // enriched from CMMS
  wo_pending?: number;
  wo_in_progress?: number;
  wo_completed?: number;
}

interface BotTeamProfile {
  id: number;
  source_team_id?: number | null;
  source_team_code?: string | null;
  team_name: string;
  asset_profile: string;
  site_scope?: string | null;
  supervisor_name?: string | null;
  supervisor_phone?: string | null;
  is_active: boolean;
  members_count?: number;
  active_members?: number;
}

interface BotMember {
  id: number;
  team_profile_id: number;
  employee_no: string;
  employee_name: string;
  phone_number: string;
  role_title?: string | null;
  telegram_user_id?: string | null;
  telegram_username?: string | null;
  registration_status: 'pending' | 'active' | 'blocked' | string;
}

interface BotReading {
  id: number;
  member_id: number;
  team_profile_id: number;
  asset_profile: string;
  site_scope?: string | null;
  payload?: Record<string, unknown>;
  raw_message?: string | null;
  source_channel: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  submitted_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  employee_no: string;
  employee_name: string;
  team_name: string;
}

interface BotCorrosionRequest {
  id: number;
  member_id: number;
  team_profile_id: number;
  asset_profile: string;
  location: string;
  asset_name?: string | null;
  issue: string;
  severity: string;
  note?: string | null;
  source_channel: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  submitted_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_work_order_id?: string | null;
  employee_no: string;
  employee_name: string;
  team_name: string;
}

interface BotModule {
  module_key: 'operations' | 'corrosion' | 'hr' | string;
  is_enabled: boolean;
  settings?: Record<string, unknown>;
  updated_at?: string;
}

const SPECIALTY_AR: Record<string, string> = {
  electrical:       'كهرباء',
  mechanical:       'ميكانيكا',
  plumbing:         'سباكة',
  hvac:             'تكييف وتبريد',
  carpentry:        'نجارة',
  painting:         'دهانات',
  general:          'عام',
  corrosion:        'تآكل وتفتيش',
  corrosion_integrity: 'نزاهة التآكل',
  pipeline:         'خطوط أنابيب',
};
const STATUS_AR: Record<string, string> = {
  active:      'نشط',
  on_break:    'في استراحة',
  training:    'تدريب',
  unavailable: 'غير متاح',
  inactive:    'غير نشط',
};
const STATUS_COLOR: Record<string, string> = {
  active:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  on_break:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  training:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
  unavailable: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  inactive:    'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const BOT_ASSET_PROFILES: Array<{ value: string; label: string; hint: string }> = [
  { value: 'tank', label: 'خزان', hint: 'يرسل المنسوب والضغط وحالة الصمامات الخاصة بالخزانات.' },
  { value: 'pump_station', label: 'محطة ضخ', hint: 'يرسل ضغط السحب والطرد والتدفق وحالة المضخات.' },
  { value: 'pipeline_valve', label: 'خط/صمام', hint: 'يرسل حالة الصمام والضغط قبل/بعد وملاحظات التسريب.' },
  { value: 'quality_point', label: 'نقطة جودة', hint: 'يرسل قراءات الجودة اليومية لنقاط القياس.' },
];

const BOT_MODULE_META: Record<string, { label: string; desc: string; owner: string }> = {
  operations: {
    label: 'وحدة التشغيل',
    desc: 'تفعيل أوامر القراءات اليومية (/reading) ومتابعة التدفقات والضغوط.',
    owner: 'الإدارة الفنية',
  },
  corrosion: {
    label: 'وحدة التآكل',
    desc: 'تفعيل أوامر التآكل (/corr_new, /corr_list, /corr_status) للفرق المعنية.',
    owner: 'قسم التآكل والنزاهة',
  },
  quality: {
    label: 'وحدة الجودة',
    desc: 'تفعيل أوامر الجودة (/quality) بمدخل رقمي مختصر أو مفصل للتحاليل.',
    owner: 'قسم الجودة',
  },
  hr: {
    label: 'وحدة شؤون إدارية',
    desc: 'خدمات الموارد البشرية داخل البوت (مرحلة أولية).',
    owner: 'الشؤون الإدارية',
  },
};

const inputCls = 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500';

export default function MaintenanceTeamsPage() {
  const [teams, setTeams] = useState<MaintenanceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState<MaintenanceTeam | null>(null);
  const [formData, setFormData] = useState({
    team_name: '', team_code: '', specialty: '',
    team_leader: '', members_count: '', status: 'active',
  });
  const [botProfiles, setBotProfiles] = useState<BotTeamProfile[]>([]);
  const [botMembers, setBotMembers] = useState<BotMember[]>([]);
  const [botName, setBotName] = useState('observer_ops_bot');
  const [pendingReadings, setPendingReadings] = useState(0);
  const [pendingCorrosionRequests, setPendingCorrosionRequests] = useState(0);
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState({
    sourceTeamId: '',
    sourceTeamCode: '',
    teamName: '',
    assetProfile: 'tank',
    siteScope: '',
    supervisorName: '',
    supervisorPhone: '',
  });
  const [memberForm, setMemberForm] = useState({
    profileId: '',
    employeeNo: '',
    employeeName: '',
    phoneNumber: '',
    roleTitle: '',
  });
  const [botReadings, setBotReadings] = useState<BotReading[]>([]);
  const [botCorrosionRequests, setBotCorrosionRequests] = useState<BotCorrosionRequest[]>([]);
  const [botModules, setBotModules] = useState<BotModule[]>([]);
  const [savingModuleKey, setSavingModuleKey] = useState<string | null>(null);

  // ── Fetch teams + enrich with CMMS WO counts ──────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, woRes] = await Promise.allSettled([
        fetch('/api/v1/hr-structure/maintenance-teams', {
          headers: { 'X-Tenant-ID': getTenantId() },
        }),
        fetch('/api/v1/workspace/work-orders?limit=500'),
      ]);

      let rawTeams: MaintenanceTeam[] = [];
      if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
        const d = await teamsRes.value.json();
        rawTeams = (d.teams || []).map((t: Record<string, unknown>) => ({
          id: t.id as number,
          team_name: (t.team_name_ar || t.team_name) as string,
          team_code: t.team_code as string | undefined,
          specialty: (t.specialization || '') as string,
          team_leader: t.team_leader_name as string | undefined,
          status: t.is_active ? 'active' : 'inactive',
          members_count: t.members_count as number | undefined,
        }));
      }

      // Enrich with WO counts
      if (woRes.status === 'fulfilled' && woRes.value.ok) {
        const wd = await woRes.value.json();
        const wos: Array<{ assigned_team?: string; status: string }> =
          Array.isArray(wd?.data) ? wd.data : [];
        rawTeams = rawTeams.map(t => {
          const teamWOs = wos.filter(
            w => w.assigned_team?.toLowerCase() === t.team_name?.toLowerCase() ||
                 w.assigned_team?.toLowerCase() === t.team_code?.toLowerCase(),
          );
          return {
            ...t,
            wo_pending:     teamWOs.filter(w => w.status === 'pending' || w.status === 'open').length,
            wo_in_progress: teamWOs.filter(w => w.status === 'in_progress').length,
            wo_completed:   teamWOs.filter(w => w.status === 'completed' || w.status === 'closed').length,
          };
        });
      }

      setTeams(rawTeams);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchBotSetup = useCallback(async () => {
    setBotLoading(true);
    setBotError('');
    try {
      const res = await fetch('/api/v1/workspace/observer-bot');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setBotError(data?.error || 'تعذر تحميل إعدادات بوت الرصد');
        return;
      }
      const profiles: BotTeamProfile[] = Array.isArray(data?.profiles) ? data.profiles : [];
      const members: BotMember[] = Array.isArray(data?.members) ? data.members : [];
      const readings: BotReading[] = Array.isArray(data?.readings) ? data.readings : [];
      const corrosionRequests: BotCorrosionRequest[] = Array.isArray(data?.corrosionRequests) ? data.corrosionRequests : [];
      const modules: BotModule[] = Array.isArray(data?.modules) ? data.modules : [];
      setBotProfiles(profiles);
      setBotMembers(members);
      setBotReadings(readings);
      setBotCorrosionRequests(corrosionRequests);
      setBotModules(modules);
      setPendingReadings(Number(data?.pendingReadings || 0));
      setPendingCorrosionRequests(Number(data?.pendingCorrosionRequests || 0));
      setBotName(data?.botName || 'observer_ops_bot');
      if (!selectedProfileId && profiles.length > 0) {
        setSelectedProfileId(Number(profiles[0].id));
      }
    } catch {
      setBotError('فشل الاتصال بخدمة بوت الرصد');
    } finally {
      setBotLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => { fetchBotSetup(); }, [fetchBotSetup]);

  const botAction = async (payload: Record<string, unknown>) => {
    setBotError('');
    const res = await fetch('/api/v1/workspace/observer-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'فشل تحديث بيانات بوت الرصد');
    }
    const profiles: BotTeamProfile[] = Array.isArray(data?.profiles) ? data.profiles : [];
    const members: BotMember[] = Array.isArray(data?.members) ? data.members : [];
    const readings: BotReading[] = Array.isArray(data?.readings) ? data.readings : [];
    const corrosionRequests: BotCorrosionRequest[] = Array.isArray(data?.corrosionRequests) ? data.corrosionRequests : [];
    const modules: BotModule[] = Array.isArray(data?.modules) ? data.modules : [];
    setBotProfiles(profiles);
    setBotMembers(members);
    setBotReadings(readings);
    setBotCorrosionRequests(corrosionRequests);
    setBotModules(modules);
    setPendingReadings(Number(data?.pendingReadings || 0));
    setPendingCorrosionRequests(Number(data?.pendingCorrosionRequests || 0));
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(Number(profiles[0].id));
    }
  };

  const createBotProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await botAction({
        action: 'create_profile',
        sourceTeamId: profileForm.sourceTeamId ? Number(profileForm.sourceTeamId) : null,
        sourceTeamCode: profileForm.sourceTeamCode || null,
        teamName: profileForm.teamName,
        assetProfile: profileForm.assetProfile,
        siteScope: profileForm.siteScope,
        supervisorName: profileForm.supervisorName,
        supervisorPhone: profileForm.supervisorPhone,
      });
      setProfileForm({
        sourceTeamId: '',
        sourceTeamCode: '',
        teamName: '',
        assetProfile: 'tank',
        siteScope: '',
        supervisorName: '',
        supervisorPhone: '',
      });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر إنشاء ملف الفريق')); 
    }
  };

  const addBotMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const profileId = memberForm.profileId || String(selectedProfileId || '');
      await botAction({
        action: 'add_member',
        profileId: Number(profileId),
        employeeNo: memberForm.employeeNo,
        employeeName: memberForm.employeeName,
        phoneNumber: memberForm.phoneNumber,
        roleTitle: memberForm.roleTitle,
      });
      setMemberForm({
        profileId: '',
        employeeNo: '',
        employeeName: '',
        phoneNumber: '',
        roleTitle: '',
      });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر إضافة العضو')); 
    }
  };

  const setMemberStatus = async (memberId: number, status: 'pending' | 'active' | 'blocked') => {
    try {
      await botAction({ action: 'set_member_status', memberId, status });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر تحديث حالة العضو'));
    }
  };

  const removeMember = async (memberId: number) => {
    try {
      await botAction({ action: 'remove_member', memberId });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر حذف العضو'));
    }
  };

  const approveReading = async (readingId: number) => {
    try {
      await botAction({ action: 'approve_reading', readingId, approvedBy: 'system-supervisor' });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر اعتماد القراءة'));
    }
  };

  const rejectReading = async (readingId: number) => {
    try {
      await botAction({ action: 'reject_reading', readingId, approvedBy: 'system-supervisor', reason: 'بيانات غير مكتملة' });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر رفض القراءة'));
    }
  };

  const approveCorrosionRequest = async (requestId: number) => {
    try {
      await botAction({ action: 'approve_corrosion_request', requestId, approvedBy: 'system-supervisor' });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر اعتماد طلب التآكل'));
    }
  };

  const rejectCorrosionRequest = async (requestId: number) => {
    try {
      await botAction({ action: 'reject_corrosion_request', requestId, approvedBy: 'system-supervisor', reason: 'تحتاج مراجعة ميدانية إضافية' });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر رفض طلب التآكل'));
    }
  };

  const copyOnboardingText = async (member: BotMember) => {
    const profile = botProfiles.find(p => p.id === member.team_profile_id);
    const text = [
      `تعليمات التفعيل للموظف: ${member.employee_name}`,
      `1) افتح تيليغرام وابحث عن @${botName}`,
      '2) اكتب /start',
      `3) أدخل رقمك الوظيفي: ${member.employee_no}`,
      profile ? `4) سيظهر لك نموذج ${profile.asset_profile} ضمن نطاق ${profile.site_scope || 'الفريق المحدد'}` : '4) سيظهر لك النموذج المعتمد لفريقك',
      '5) بعد أول إرسال، راجع المشرف لاعتماد الحساب إذا كان معلقاً',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setBotError('');
    } catch {
      setBotError('تعذر نسخ التعليمات. انسخها يدويا من الشاشة.');
    }
  };

  const setModuleState = async (moduleKey: string, enabled: boolean) => {
    setSavingModuleKey(moduleKey);
    try {
      const current = botModules.find((m) => m.module_key === moduleKey);
      await botAction({
        action: 'set_module_state',
        moduleKey,
        isEnabled: enabled,
        settings: current?.settings || {},
      });
    } catch (err: any) {
      setBotError(String(err?.message || 'تعذر تحديث حالة الوحدة'));
    } finally {
      setSavingModuleKey(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editTeam
      ? `/api/v1/hr-structure/maintenance-teams/${editTeam.id}`
      : '/api/v1/hr-structure/maintenance-teams';
    const method = editTeam ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() },
        body: JSON.stringify({
          team_name: formData.team_name,
          team_name_ar: formData.team_name,
          team_code: formData.team_code || undefined,
          specialization: formData.specialty,
          team_leader_name: formData.team_leader || undefined,
          members_count: formData.members_count ? parseInt(formData.members_count) : undefined,
          is_active: formData.status === 'active',
        }),
      });
      if (res.ok || res.status === 204) {
        setShowForm(false);
        setEditTeam(null);
        setFormData({ team_name: '', team_code: '', specialty: '', team_leader: '', members_count: '', status: 'active' });
        await fetchAll();
      }
    } catch { /* silent */ }
  };

  const openEdit = (t: MaintenanceTeam) => {
    setEditTeam(t);
    setFormData({
      team_name: t.team_name, team_code: t.team_code || '',
      specialty: t.specialty, team_leader: t.team_leader || '',
      members_count: t.members_count?.toString() || '', status: t.status,
    });
    setShowForm(true);
  };

  const filtered = teams.filter(t =>
    t.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.team_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.team_leader?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const kpi = {
    active:  teams.filter(t => t.status === 'active').length,
    members: teams.reduce((s, t) => s + (t.members_count || 0), 0),
    woActive: teams.reduce((s, t) => s + (t.wo_in_progress || 0) + (t.wo_pending || 0), 0),
    woTotal:  teams.reduce((s, t) => s + (t.wo_completed || 0), 0),
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة النظام</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance" className="hover:text-slate-300">الصيانة</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance/technical" className="hover:text-slate-300">الواجهة الفنية</Link>
          <ChevronLeft className="w-3 h-3" />
          <span className="text-slate-200">الفرق التقنية</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-500/10 p-3 rounded-xl border border-violet-500/30">
              <Users className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">الفرق التقنية</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                مصدر تعيين الفرق في{' '}
                <Link href="/dashboard/admin-gateway/maintenance/work-orders"
                  className="text-violet-400 hover:underline inline-flex items-center gap-1">
                  أوامر العمل <ExternalLink className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
              <Plus className="w-4 h-4" /> فريق جديد
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'فرق نشطة', val: kpi.active, icon: Users, color: 'text-emerald-400' },
            { label: 'إجمالي الأعضاء', val: kpi.members, icon: UserCheck, color: 'text-blue-400' },
            { label: 'أوامر عمل نشطة', val: kpi.woActive, icon: Wrench, color: 'text-amber-400' },
            { label: 'أوامر مكتملة', val: kpi.woTotal, icon: Award, color: 'text-violet-400' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Observer Bot Operations Guide */}
        <div className="bg-slate-900/55 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/30">
                <Bot className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-white font-bold">تشغيل بوت الرصد الموحد</h2>
                <p className="text-xs text-slate-400 mt-0.5">بوت واحد لكل الإدارات: يوجه النموذج تلقائيا حسب الفريق ونوع الأصل.</p>
              </div>
            </div>
            <button onClick={fetchBotSetup}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> تحديث الربط
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold mb-1"><ShieldCheck className="w-4 h-4" /> 1) دور الشؤون الإدارية</div>
              <p className="text-slate-300 leading-6">تضيف الرقم الوظيفي ورقم الهاتف فقط. لا تكوّن الفرق.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-violet-300 font-semibold mb-1"><Users className="w-4 h-4" /> 2) دور الإدارة الفنية</div>
              <p className="text-slate-300 leading-6">تكوّن الفرق وتربط كل فريق بنوع أصل وموقع، ثم تضيف أعضاء الفريق.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold mb-1"><MessageCircle className="w-4 h-4" /> 3) تعليمات للموظف</div>
              <p className="text-slate-300 leading-6">يكتب الموظف /start للبوت @{botName} ثم يدخل رقمه الوظيفي. بعدها تصله شاشة قراءاته مباشرة.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm text-white font-semibold">وحدات الإدارات داخل البوت الواحد</div>
                <p className="text-[11px] text-slate-400 mt-1">فعّل أو عطّل كل إدارة بشكل مستقل. الأوامر في تيليغرام تتغير تلقائياً حسب هذه المفاتيح.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {botModules.map((mod) => {
                const meta = BOT_MODULE_META[mod.module_key] || {
                  label: mod.module_key,
                  desc: 'وحدة مخصصة.',
                  owner: 'إدارة مخصصة',
                };
                const isSaving = savingModuleKey === mod.module_key;
                return (
                  <div key={mod.module_key} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-slate-100 font-medium">{meta.label}</div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${mod.is_enabled ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700 bg-slate-800/50'}`}>
                        {mod.is_enabled ? 'مفعلة' : 'متوقفة'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-5">{meta.desc}</p>
                    <div className="text-[11px] text-slate-500">المالك التشغيلي: {meta.owner}</div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={isSaving || mod.is_enabled}
                        onClick={() => setModuleState(mod.module_key, true)}
                        className="px-2.5 py-1 text-xs rounded-md border border-emerald-500/30 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        تفعيل
                      </button>
                      <button
                        disabled={isSaving || !mod.is_enabled}
                        onClick={() => setModuleState(mod.module_key, false)}
                        className="px-2.5 py-1 text-xs rounded-md border border-rose-500/30 bg-rose-600/20 text-rose-200 hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        إيقاف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={createBotProfile} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div className="text-sm text-white font-semibold">إنشاء ملف فريق رصد</div>
              <p className="text-[11px] text-slate-400">بعد الإنشاء: اطلب من أعضاء هذا الفريق الدخول للبوت وكتابة /start.</p>
              <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 p-2 text-[11px] text-violet-200 leading-5">
                دور رئيس القسم/الإدارة الفنية: اختر نوع الأصل والموقع بدقة لأن البوت سيبني النموذج تلقائيا حسب هذا الاختيار.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم الفريق *</label>
                  <input required value={profileForm.teamName}
                    onChange={e => setProfileForm({ ...profileForm, teamName: e.target.value })}
                    className={inputCls} placeholder="فريق رصد الشويرف" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">رمز الفريق (اختياري)</label>
                  <input value={profileForm.sourceTeamCode}
                    onChange={e => setProfileForm({ ...profileForm, sourceTeamCode: e.target.value })}
                    className={inputCls} placeholder="OBS-SHW" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">نوع الأصل *</label>
                  <select required value={profileForm.assetProfile}
                    onChange={e => setProfileForm({ ...profileForm, assetProfile: e.target.value })}
                    className={inputCls}>
                    {BOT_ASSET_PROFILES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {BOT_ASSET_PROFILES.find(opt => opt.value === profileForm.assetProfile)?.hint}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الموقع/النطاق</label>
                  <input value={profileForm.siteScope}
                    onChange={e => setProfileForm({ ...profileForm, siteScope: e.target.value })}
                    className={inputCls} placeholder="الشويرف - محطة 2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم المشرف</label>
                  <input value={profileForm.supervisorName}
                    onChange={e => setProfileForm({ ...profileForm, supervisorName: e.target.value })}
                    className={inputCls} placeholder="المشرف المسؤول" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">هاتف المشرف</label>
                  <input value={profileForm.supervisorPhone}
                    onChange={e => setProfileForm({ ...profileForm, supervisorPhone: e.target.value })}
                    className={inputCls} placeholder="09xxxxxxxx" />
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                تعليمات فورية: بعد حفظ الفريق، أضف الأعضاء ثم اطلب منهم فتح تيليغرام وكتابة /start للبوت @{botName}.
              </div>
              <button type="submit"
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> حفظ ملف الفريق
              </button>
            </form>

            <form onSubmit={addBotMember} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <div className="text-sm text-white font-semibold">إضافة عضو إلى فريق رصد</div>
              <p className="text-[11px] text-slate-400">هذه الخطوة تنفذها الإدارة الفنية بعد اعتماد بيانات الموظف من الشؤون الإدارية.</p>
              <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2 text-[11px] text-cyan-200 leading-5">
                بعد الضغط على "إضافة العضو": استخدم زر "نسخ تعليمات" بجانب اسمه وأرسلها له مباشرة عبر واتساب/رسالة داخلية.
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">الفريق المستهدف *</label>
                <select required value={memberForm.profileId || (selectedProfileId ? String(selectedProfileId) : '')}
                  onChange={e => {
                    setMemberForm({ ...memberForm, profileId: e.target.value });
                    setSelectedProfileId(Number(e.target.value) || null);
                  }}
                  className={inputCls}>
                  <option value="">اختر فريق رصد</option>
                  {botProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.team_name} ({p.asset_profile})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الرقم الوظيفي *</label>
                  <input required value={memberForm.employeeNo}
                    onChange={e => setMemberForm({ ...memberForm, employeeNo: e.target.value })}
                    className={inputCls} placeholder="EMP-1042" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم الموظف *</label>
                  <input required value={memberForm.employeeName}
                    onChange={e => setMemberForm({ ...memberForm, employeeName: e.target.value })}
                    className={inputCls} placeholder="اسم الموظف" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">رقم الهاتف *</label>
                  <input required value={memberForm.phoneNumber}
                    onChange={e => setMemberForm({ ...memberForm, phoneNumber: e.target.value })}
                    className={inputCls} placeholder="09xxxxxxxx" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">المسمى داخل الفريق</label>
                  <input value={memberForm.roleTitle}
                    onChange={e => setMemberForm({ ...memberForm, roleTitle: e.target.value })}
                    className={inputCls} placeholder="راصد - وردية صباح" />
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                بعد الإضافة: أعط الموظف هذه الجملة حرفيا: "افتح البوت @{botName} واكتب /start ثم أدخل رقمك الوظيفي".
              </div>
              <button type="submit"
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" /> إضافة العضو
              </button>
            </form>
          </div>

          {!!botError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">{botError}</div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-white font-semibold">ملفات فرق الرصد</div>
                <div className="text-xs text-slate-500">{botLoading ? 'جاري التحميل...' : `${botProfiles.length} فريق`}</div>
              </div>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {botProfiles.length === 0 ? (
                  <div className="text-xs text-slate-500">لم يتم إنشاء أي فريق رصد بعد.</div>
                ) : botProfiles.map(p => (
                  <button key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`w-full text-right rounded-lg border p-2.5 transition-colors ${selectedProfileId === p.id ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/30 hover:bg-slate-900/50'}`}>
                    <div className="text-sm text-slate-100 font-medium">{p.team_name}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {p.asset_profile} • {p.site_scope || 'بدون نطاق محدد'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      أعضاء: {p.members_count || 0} • مفعلون: {p.active_members || 0}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-sm text-white font-semibold mb-3">أعضاء الفريق المختار</div>
              <p className="text-[11px] text-slate-400 mb-3">دور المشرف: غيّر الحالة إلى "مفعل" فقط بعد تأكدك أن الموظف دخل البوت وأرسل /start برقمه الوظيفي.</p>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {botMembers.filter(m => m.team_profile_id === selectedProfileId).length === 0 ? (
                  <div className="text-xs text-slate-500">لا يوجد أعضاء في هذا الفريق حالياً.</div>
                ) : botMembers
                  .filter(m => m.team_profile_id === selectedProfileId)
                  .map(m => (
                    <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm text-slate-100">{m.employee_name} <span className="text-slate-500">({m.employee_no})</span></div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{m.phone_number} {m.role_title ? `• ${m.role_title}` : ''}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {m.telegram_user_id ? `Telegram: ${m.telegram_username || m.telegram_user_id}` : 'لم يفعل البوت بعد'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => copyOnboardingText(m)}
                            className="p-1.5 rounded-md bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30"
                            title="نسخ تعليمات التفعيل">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <select
                            value={m.registration_status}
                            onChange={e => setMemberStatus(m.id, e.target.value as 'pending' | 'active' | 'blocked')}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1"
                          >
                            <option value="pending">معلق</option>
                            <option value="active">مفعل</option>
                            <option value="blocked">محظور</option>
                          </select>
                          <button onClick={() => removeMember(m.id)}
                            className="p-1.5 rounded-md bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600/30">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-white font-semibold">اعتماد قراءات الراصدين</div>
              <div className="text-xs text-amber-300">معلق الآن: {pendingReadings}</div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">هذه شاشة المشرف لاعتماد الدورة المستندية: أي قراءة من تيليغرام تبقى معلقة حتى اعتمادها هنا.</p>
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {botReadings.length === 0 ? (
                <div className="text-xs text-slate-500">لا توجد قراءات حتى الآن. جرّب إرسال قراءة من البوت: /reading flow=120 pressure=4.8 valve=open</div>
              ) : botReadings.slice(0, 40).map(r => (
                <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-100">#{r.id} • {r.employee_name} <span className="text-slate-500">({r.employee_no})</span></div>
                      <div className="text-[11px] text-slate-400 mt-1">{r.team_name} • {r.asset_profile} • {r.site_scope || 'بدون نطاق'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{new Date(r.submitted_at).toLocaleString('ar-LY')} • {r.source_channel}</div>
                      <div className="text-[11px] text-cyan-200 mt-1.5 break-words">{r.raw_message || JSON.stringify(r.payload || {})}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.status === 'pending' ? (
                        <>
                          <button onClick={() => approveReading(r.id)}
                            className="px-2 py-1 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-600/30">
                            اعتماد
                          </button>
                          <button onClick={() => rejectReading(r.id)}
                            className="px-2 py-1 rounded-md bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs hover:bg-rose-600/30">
                            رفض
                          </button>
                        </>
                      ) : (
                        <span className={`px-2 py-1 rounded-md text-xs border ${r.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                          {r.status === 'approved' ? 'معتمد' : 'مرفوض'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-white font-semibold">طلبات التآكل الواردة من تيليغرام</div>
              <div className="text-xs text-amber-300">معلق الآن: {pendingCorrosionRequests}</div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">أي أمر /corr_new يصل هنا كطلب معلّق حتى يعتمده المشرف أو يرفضه.</p>
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {botCorrosionRequests.length === 0 ? (
                <div className="text-xs text-slate-500">لا توجد طلبات تآكل حتى الآن. جرّب /corr_new location=... issue=...</div>
              ) : botCorrosionRequests.slice(0, 40).map(r => (
                <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-100">#{r.id} • {r.employee_name} <span className="text-slate-500">({r.employee_no})</span></div>
                      <div className="text-[11px] text-slate-400 mt-1">{r.team_name} • {r.asset_profile} • {r.location}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{new Date(r.submitted_at).toLocaleString('ar-LY')} • {r.source_channel}</div>
                      <div className="text-[11px] text-cyan-200 mt-1.5 break-words">{r.issue}{r.asset_name ? ` • الأصل: ${r.asset_name}` : ''}{r.note ? ` • ${r.note}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.status === 'pending' ? (
                        <>
                          <button onClick={() => approveCorrosionRequest(r.id)}
                            className="px-2 py-1 rounded-md bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-600/30">
                            اعتماد
                          </button>
                          <button onClick={() => rejectCorrosionRequest(r.id)}
                            className="px-2 py-1 rounded-md bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs hover:bg-rose-600/30">
                            رفض
                          </button>
                        </>
                      ) : (
                        <span className={`px-2 py-1 rounded-md text-xs border ${r.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                          {r.status === 'approved' ? 'معتمد' : 'مرفوض'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، الرمز، التخصص..."
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 pr-9 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="p-14 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>جاري التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center">
            <Users className="w-14 h-14 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">{searchTerm ? 'لا توجد نتائج' : 'لا توجد فرق مسجلة'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(team => {
              const totalWOs = (team.wo_pending || 0) + (team.wo_in_progress || 0) + (team.wo_completed || 0);
              return (
                <div key={team.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-violet-700/40 transition-colors">
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white text-base">{team.team_name}</div>
                      {team.team_code && (
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{team.team_code}</div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[team.status] || STATUS_COLOR.inactive}`}>
                      {STATUS_AR[team.status] || team.status}
                    </span>
                  </div>

                  {/* Specialty */}
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-300">
                      {SPECIALTY_AR[team.specialty] || team.specialty || '—'}
                    </span>
                  </div>

                  {/* Leader */}
                  {team.team_leader && (
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-300">{team.team_leader}</span>
                      {team.members_count && (
                        <span className="text-slate-500">• {team.members_count} عضو</span>
                      )}
                    </div>
                  )}

                  {/* CMMS WO bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">أوامر العمل (CMMS)</span>
                      <span className="text-slate-400 font-mono">{totalWOs} أمر</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-800 gap-px">
                      {(team.wo_in_progress || 0) > 0 && (
                        <div className="bg-blue-500 transition-all"
                          style={{ width: `${((team.wo_in_progress || 0) / Math.max(totalWOs, 1)) * 100}%` }} />
                      )}
                      {(team.wo_pending || 0) > 0 && (
                        <div className="bg-amber-500 transition-all"
                          style={{ width: `${((team.wo_pending || 0) / Math.max(totalWOs, 1)) * 100}%` }} />
                      )}
                      {(team.wo_completed || 0) > 0 && (
                        <div className="bg-emerald-500 transition-all"
                          style={{ width: `${((team.wo_completed || 0) / Math.max(totalWOs, 1)) * 100}%` }} />
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        قيد التنفيذ: {team.wo_in_progress || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        معلق: {team.wo_pending || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        مكتمل: {team.wo_completed || 0}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/dashboard/admin-gateway/maintenance/work-orders`}
                      className="flex-1 py-1.5 text-center text-xs bg-violet-600/10 text-violet-400 border border-violet-500/20 rounded-lg hover:bg-violet-600/20 transition-colors flex items-center justify-center gap-1"
                    >
                      <Wrench className="w-3 h-3" /> أوامر الفريق
                    </Link>
                    <button onClick={() => openEdit(team)}
                      className="flex-1 py-1.5 text-xs bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors">
                      تعديل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editTeam ? 'تعديل الفريق' : 'فريق تقني جديد'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditTeam(null); }}
                className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">اسم الفريق *</label>
                  <input required value={formData.team_name}
                    onChange={e => setFormData({ ...formData, team_name: e.target.value })}
                    className={inputCls} placeholder="فريق نزاهة التآكل" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">رمز الفريق</label>
                  <input value={formData.team_code}
                    onChange={e => setFormData({ ...formData, team_code: e.target.value })}
                    className={inputCls} placeholder="CORR-01" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">التخصص *</label>
                  <select required value={formData.specialty}
                    onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                    className={inputCls}>
                    <option value="">اختر...</option>
                    {Object.entries(SPECIALTY_AR).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">الحالة</label>
                  <select value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className={inputCls}>
                    {Object.entries(STATUS_AR).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">قائد الفريق</label>
                  <input value={formData.team_leader}
                    onChange={e => setFormData({ ...formData, team_leader: e.target.value })}
                    className={inputCls} placeholder="اسم القائد" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">عدد الأعضاء</label>
                  <input type="number" min="1" value={formData.members_count}
                    onChange={e => setFormData({ ...formData, members_count: e.target.value })}
                    className={inputCls} placeholder="5" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium text-sm transition-colors">
                  {editTeam ? 'تحديث' : 'إنشاء الفريق'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditTeam(null); }}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
