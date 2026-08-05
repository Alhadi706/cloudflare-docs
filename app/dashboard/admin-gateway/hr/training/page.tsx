'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, ListChecks, RefreshCw, Send, CheckCircle2, XCircle } from 'lucide-react';

type TrainingNeed = {
  id: string;
  department_code: string;
  section_code: string;
  target_department_codes?: string[];
  title: string;
  competency_gap: string;
  objective: string;
  target_audience: string;
  expected_impact: string;
  priority: 'low' | 'medium' | 'high';
  proposed_budget: number;
  status: 'draft' | 'submitted' | 'section_approved' | 'dept_approved' | 'training_approved' | 'rejected';
  created_at: string;
};

type TrainingNomination = {
  id: string;
  need_id: string;
  employee_no: string;
  employee_name: string;
  department_code: string;
  section_code: string;
  nomination_reason: string;
  status:
    | 'submitted'
    | 'section_approved'
    | 'dept_approved'
    | 'finance_approved'
    | 'hr_approved'
    | 'completed'
    | 'rejected';
  created_at: string;
  updated_at?: string;
};

type TrainingAudit = {
  id: string;
  entity: 'need' | 'nomination';
  entity_id: string;
  action: string;
  actor_role: string;
  created_at: string;
};

type Summary = {
  needs_total: number;
  needs_approved: number;
  nominations_total: number;
  nominations_hr_approved: number;
  nominations_completed: number;
};

type NeedForm = {
  department_code: string;
  section_code: string;
  target_department_codes: string[];
  title: string;
  competency_gap: string;
  objective: string;
  target_audience: string;
  expected_impact: string;
  priority: 'low' | 'medium' | 'high';
  proposed_budget: number;
};

type NomForm = {
  need_id: string;
  employee_no: string;
  employee_name: string;
  department_code: string;
  section_code: string;
  nomination_reason: string;
};

type OrgDepartment = {
  id: string;
  code: string;
  name_ar: string;
};

type OrgEmployee = {
  employee_no: string;
  name_ar: string;
};

type TrainingSurvey = {
  id: string;
  nomination_id: string;
  employee_no: string;
  department_code: string;
  section_code: string;
  score_relevance: number;
  score_trainer: number;
  score_content: number;
  score_overall: number;
  comments: string;
  submitted_at: string;
};

type TrainingFollowup = {
  id: string;
  nomination_id: string;
  employee_no: string;
  department_code: string;
  section_code: string;
  checkpoint_days: 30 | 60 | 90;
  behavior_change_score: number;
  application_score: number;
  performance_signal: string;
  notes: string;
  submitted_at: string;
};

type SurveyForm = {
  nomination_id: string;
  employee_no: string;
  score_relevance: number;
  score_trainer: number;
  score_content: number;
  score_overall: number;
  comments: string;
};

type FollowupForm = {
  nomination_id: string;
  employee_no: string;
  department_code: string;
  section_code: string;
  checkpoint_days: 30 | 60 | 90;
  behavior_change_score: number;
  application_score: number;
  performance_signal: string;
  notes: string;
};

type OverdueFollowup = {
  id: string;
  nomination_id: string;
  employee_no: string;
  employee_name: string;
  checkpoint_days: 30 | 60 | 90;
  late_days: number;
};

function readCookie(key: string): string {
  if (typeof document === 'undefined') return '';
  const hit = document.cookie
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${key}=`));
  if (!hit) return '';
  return decodeURIComponent(hit.slice(key.length + 1)).trim();
}

function statusTone(status: string): string {
  if (status === 'rejected') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  if (status === 'completed' || status === 'training_approved' || status === 'hr_approved') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

function labelNeedStatus(status: TrainingNeed['status']): string {
  const map: Record<TrainingNeed['status'], string> = {
    draft: 'مسودة',
    submitted: 'مقدم',
    section_approved: 'معتمد من رئيس القسم',
    dept_approved: 'معتمد من مدير الإدارة',
    training_approved: 'معتمد من إدارة التدريب',
    rejected: 'مرفوض',
  };
  return map[status] || status;
}

function labelNomStatus(status: TrainingNomination['status']): string {
  const map: Record<TrainingNomination['status'], string> = {
    submitted: 'مقدم',
    section_approved: 'اعتماد رئيس القسم',
    dept_approved: 'اعتماد مدير الإدارة',
    finance_approved: 'اعتماد المالية',
    hr_approved: 'اعتماد شؤون الموظفين',
    completed: 'مكتمل',
    rejected: 'مرفوض',
  };
  return map[status] || status;
}

export default function TrainingPage() {
  const [role, setRole] = useState('employee');
  const [actorEmployeeNo, setActorEmployeeNo] = useState('');
  const [actorDeptCode, setActorDeptCode] = useState('');
  const [actorSectionCode, setActorSectionCode] = useState('');
  const [needView, setNeedView] = useState<'role_pending' | 'all'>('role_pending');
  const [nomView, setNomView] = useState<'role_pending' | 'all'>('role_pending');
  const [needs, setNeeds] = useState<TrainingNeed[]>([]);
  const [nominations, setNominations] = useState<TrainingNomination[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [surveys, setSurveys] = useState<TrainingSurvey[]>([]);
  const [followups, setFollowups] = useState<TrainingFollowup[]>([]);
  const [audit, setAudit] = useState<TrainingAudit[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [needForm, setNeedForm] = useState<NeedForm>({
    department_code: '',
    section_code: '',
    target_department_codes: [],
    title: '',
    competency_gap: '',
    objective: '',
    target_audience: '',
    expected_impact: '',
    priority: 'medium',
    proposed_budget: 0,
  });

  const [nomForm, setNomForm] = useState<NomForm>({
    need_id: '',
    employee_no: '',
    employee_name: '',
    department_code: '',
    section_code: '',
    nomination_reason: '',
  });

  const [surveyForm, setSurveyForm] = useState<SurveyForm>({
    nomination_id: '',
    employee_no: '',
    score_relevance: 4,
    score_trainer: 4,
    score_content: 4,
    score_overall: 4,
    comments: '',
  });

  const [followupForm, setFollowupForm] = useState<FollowupForm>({
    nomination_id: '',
    employee_no: '',
    department_code: '',
    section_code: '',
    checkpoint_days: 30,
    behavior_change_score: 4,
    application_score: 4,
    performance_signal: '',
    notes: '',
  });

  const isSection = useMemo(() => ['section_manager', 'admin', 'founder', 'admin_officer'].includes(role), [role]);
  const isDept = useMemo(() => ['dept_manager', 'admin', 'founder', 'admin_officer'].includes(role), [role]);
  const isTraining = useMemo(() => ['hr_manager', 'admin_officer', 'admin', 'founder'].includes(role), [role]);
  const isFinance = useMemo(() => ['finance_manager', 'finance_controller', 'admin', 'founder'].includes(role), [role]);
  const canReviewNeeds = isSection || isDept || isTraining;
  const canReviewNominations = isSection || isDept || isFinance || isTraining;
  const canSubmitFollowup = isSection || isDept || isTraining;
  const canCreateProposal = isTraining;
  const canNominate = isDept || role === 'admin' || role === 'founder' || role === 'admin_officer';

  const averageSurveyScore = useMemo(() => {
    if (!surveys.length) return 0;
    const total = surveys.reduce((sum, row) => sum + Number(row.score_overall || 0), 0);
    return Math.round((total / surveys.length) * 10) / 10;
  }, [surveys]);

  const averageBehaviorScore = useMemo(() => {
    if (!followups.length) return 0;
    const total = followups.reduce((sum, row) => sum + Number(row.behavior_change_score || 0), 0);
    return Math.round((total / followups.length) * 10) / 10;
  }, [followups]);

  const completedNominationIds = useMemo(() => {
    return new Set(nominations.filter((n) => n.status === 'completed').map((n) => n.id));
  }, [nominations]);

  const checkpointCoverage = useMemo(() => {
    const base = completedNominationIds.size;
    const calc = (checkpoint: 30 | 60 | 90) => {
      if (!base) return 0;
      const ids = new Set(
        followups
          .filter((f) => f.checkpoint_days === checkpoint && completedNominationIds.has(f.nomination_id))
          .map((f) => f.nomination_id),
      );
      return Math.round((ids.size / base) * 100);
    };
    return {
      c30: calc(30),
      c60: calc(60),
      c90: calc(90),
    };
  }, [followups, completedNominationIds]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const labels: Array<{ key: string; label: string }> = [];

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ar-LY', { month: 'short', year: '2-digit' });
      labels.push({ key, label });
    }

    const buckets = new Map(
      labels.map((x) => [x.key, { label: x.label, surveys: 0, followups: 0, sumOverall: 0 }]),
    );

    for (const s of surveys) {
      const d = new Date(s.submitted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.surveys += 1;
      bucket.sumOverall += Number(s.score_overall || 0);
    }

    for (const f of followups) {
      const d = new Date(f.submitted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.followups += 1;
    }

    return labels.map((x) => {
      const b = buckets.get(x.key)!;
      return {
        key: x.key,
        label: b.label,
        surveys: b.surveys,
        followups: b.followups,
        avgOverall: b.surveys > 0 ? Math.round((b.sumOverall / b.surveys) * 10) / 10 : 0,
      };
    });
  }, [surveys, followups]);

  const maxTrendCount = useMemo(() => {
    return Math.max(1, ...monthlyTrend.map((x) => Math.max(x.surveys, x.followups)));
  }, [monthlyTrend]);

  const overdueFollowups = useMemo(() => {
    const canSeeAll = ['hr_manager', 'admin_officer', 'admin', 'founder'].includes(role);
    const scopeNominations = nominations.filter((n) => {
      if (canSeeAll) return true;
      if (role === 'section_manager') return actorSectionCode ? n.section_code === actorSectionCode : false;
      if (role === 'dept_manager') return actorDeptCode ? n.department_code === actorDeptCode : false;
      return false;
    });

    const rows: OverdueFollowup[] = [];
    const nowMs = Date.now();

    for (const n of scopeNominations) {
      if (n.status !== 'completed') continue;
      const completedAt = new Date(n.updated_at || n.created_at).getTime();
      if (!Number.isFinite(completedAt)) continue;
      const ageDays = Math.floor((nowMs - completedAt) / (1000 * 60 * 60 * 24));
      for (const checkpoint of [30, 60, 90] as const) {
        if (ageDays < checkpoint) continue;
        const hasFollowup = followups.some((f) => f.nomination_id === n.id && f.checkpoint_days === checkpoint);
        if (hasFollowup) continue;
        rows.push({
          id: `${n.id}-${checkpoint}`,
          nomination_id: n.id,
          employee_no: n.employee_no,
          employee_name: n.employee_name,
          checkpoint_days: checkpoint,
          late_days: Math.max(0, ageDays - checkpoint),
        });
      }
    }

    return rows.sort((a, b) => b.late_days - a.late_days);
  }, [nominations, followups, role, actorDeptCode, actorSectionCode]);

  const rolePendingNeeds = useMemo(() => {
    return needs.filter((n) => {
      if (n.status === 'submitted' && isSection) return true;
      if (n.status === 'section_approved' && isDept) return true;
      if (n.status === 'dept_approved' && isTraining) return true;
      return false;
    });
  }, [needs, isSection, isDept, isTraining]);

  const rolePendingNominations = useMemo(() => {
    return nominations.filter((n) => {
      if (n.status === 'submitted' && isSection) return true;
      if (n.status === 'section_approved' && isDept) return true;
      if (n.status === 'dept_approved' && isFinance) return true;
      if (n.status === 'finance_approved' && isTraining) return true;
      if (n.status === 'hr_approved' && isTraining) return true;
      return false;
    });
  }, [nominations, isSection, isDept, isFinance, isTraining]);

  const visibleNeeds = useMemo(() => {
    if (!canReviewNeeds) return needs;
    return needView === 'all' ? needs : rolePendingNeeds;
  }, [needs, rolePendingNeeds, canReviewNeeds, needView]);

  const visibleNominations = useMemo(() => {
    if (!canReviewNominations) return nominations;
    return nomView === 'all' ? nominations : rolePendingNominations;
  }, [nominations, rolePendingNominations, canReviewNominations, nomView]);

  const nominationNeeds = useMemo(() => {
    return needs.filter((n: TrainingNeed & { target_department_codes?: string[] }) => {
      if (n.status !== 'training_approved') return false;
      const targets = Array.isArray((n as any).target_department_codes) ? (n as any).target_department_codes : [];
      if (isDept && actorDeptCode) return targets.length === 0 || targets.includes(actorDeptCode);
      return true;
    });
  }, [needs, isDept, actorDeptCode]);

  async function loadAll() {
    setLoading(true);
    setMessage('');
    try {
      const [nRes, mRes, sRes, fRes, aRes, cRes] = await Promise.all([
        fetch('/api/hr/training/needs', { cache: 'no-store' }),
        fetch('/api/hr/training/nominations', { cache: 'no-store' }),
        fetch('/api/hr/training/surveys', { cache: 'no-store' }),
        fetch('/api/hr/training/followups', { cache: 'no-store' }),
        fetch('/api/hr/training/audit', { cache: 'no-store' }),
        fetch('/api/hr/training/catalog', { cache: 'no-store' }),
      ]);

      const nData = await nRes.json();
      const mData = await mRes.json();
      const sData = await sRes.json();
      const fData = await fRes.json();
      const aData = await aRes.json();
      const cData = await cRes.json();

      setNeeds(Array.isArray(nData?.needs) ? nData.needs : []);
      setNominations(Array.isArray(mData?.nominations) ? mData.nominations : []);
      setSurveys(Array.isArray(sData?.surveys) ? sData.surveys : []);
      setFollowups(Array.isArray(fData?.followups) ? fData.followups : []);
      setAudit(Array.isArray(aData?.audit) ? aData.audit : []);
      setDepartments(Array.isArray(cData?.departments) ? cData.departments : []);
      setEmployees(Array.isArray(cData?.employees) ? cData.employees : []);
      setSummary(aData?.summary || null);
    } catch {
      setMessage('تعذر تحميل بيانات التدريب.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const nextRole = (readCookie('user_role') || 'employee').toLowerCase();
    const nextEmployeeNo = (readCookie('employee_no') || '').trim();
    const nextDept = (readCookie('user_dept') || '').toUpperCase();
    const nextSection = (readCookie('section_code') || '').toUpperCase();
    setRole(nextRole);
    setActorEmployeeNo(nextEmployeeNo);
    setActorDeptCode(nextDept);
    setActorSectionCode(nextSection);
    setNeedForm((s) => ({ ...s, department_code: nextDept || s.department_code, section_code: nextSection || s.section_code }));
    setNomForm((s) => ({ ...s, department_code: nextDept || s.department_code, section_code: nextSection || s.section_code }));
    setSurveyForm((s) => ({ ...s, employee_no: nextEmployeeNo || s.employee_no }));
    setFollowupForm((s) => ({ ...s, department_code: nextDept || s.department_code, section_code: nextSection || s.section_code }));
    void loadAll();
  }, []);

  useEffect(() => {
    if (!followupForm.nomination_id) return;
    const nom = nominations.find((n) => n.id === followupForm.nomination_id);
    if (!nom) return;
    setFollowupForm((s) => ({
      ...s,
      employee_no: nom.employee_no,
      department_code: nom.department_code || s.department_code,
      section_code: nom.section_code || s.section_code,
    }));
  }, [followupForm.nomination_id, nominations]);

  async function submitNeed(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/hr/training/needs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر حفظ الاحتياج التدريبي.');
        return;
      }
      setNeedForm((s) => ({
        ...s,
        title: '',
        competency_gap: '',
        objective: '',
        target_audience: '',
        expected_impact: '',
        proposed_budget: 0,
      }));
      await loadAll();
    } catch {
      setMessage('تعذر حفظ الاحتياج التدريبي.');
    }
  }

  async function submitNomination(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/hr/training/nominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nomForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر حفظ الترشيح.');
        return;
      }
      setNomForm((s) => ({ ...s, employee_no: '', employee_name: '', nomination_reason: '' }));
      await loadAll();
    } catch {
      setMessage('تعذر حفظ الترشيح.');
    }
  }

  function onEmployeeSelect(value: string) {
    const [employeeNo] = value.split('|');
    const found = employees.find((x) => x.employee_no === employeeNo);
    setNomForm((s) => ({
      ...s,
      employee_no: employeeNo || '',
      employee_name: found?.name_ar || s.employee_name,
    }));
  }

  async function needAction(id: string, action: 'approve_section' | 'approve_dept' | 'approve_training' | 'reject') {
    setBusyId(id);
    setMessage('');
    try {
      const res = await fetch(`/api/hr/training/needs/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر تنفيذ الإجراء على الاحتياج.');
        return;
      }
      await loadAll();
    } catch {
      setMessage('تعذر تنفيذ الإجراء على الاحتياج.');
    } finally {
      setBusyId(null);
    }
  }

  async function nominationAction(
    id: string,
    action: 'approve_section' | 'approve_dept' | 'approve_finance' | 'approve_hr' | 'mark_completed' | 'reject',
  ) {
    setBusyId(id);
    setMessage('');
    try {
      const res = await fetch(`/api/hr/training/nominations/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر تنفيذ الإجراء على الترشيح.');
        return;
      }
      await loadAll();
    } catch {
      setMessage('تعذر تنفيذ الإجراء على الترشيح.');
    } finally {
      setBusyId(null);
    }
  }

  async function submitSurvey(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/hr/training/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(surveyForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر إرسال الاستبيان.');
        return;
      }
      setSurveyForm((s) => ({ ...s, comments: '' }));
      await loadAll();
    } catch {
      setMessage('تعذر إرسال الاستبيان.');
    }
  }

  async function submitFollowup(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/hr/training/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followupForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.detail || 'تعذر حفظ متابعة المدير.');
        return;
      }
      setFollowupForm((s) => ({ ...s, performance_signal: '', notes: '' }));
      await loadAll();
    } catch {
      setMessage('تعذر حفظ متابعة المدير.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> إدارة الموارد البشرية
        </Link>

        <section className="rounded-3xl border border-emerald-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">قسم التدريب والتطوير</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            تشغيل فعلي لنماذج الاحتياج والترشيحات وسير الاعتماد عبر الأقسام والإدارات والمالية وشؤون الموظفين.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">إجمالي الاحتياجات</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary?.needs_total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-emerald-300">احتياجات معتمدة</p>
            <p className="mt-2 text-2xl font-bold text-emerald-200">{summary?.needs_approved ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">إجمالي الترشيحات</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary?.nominations_total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-xs text-cyan-300">معتمدة من HR</p>
            <p className="mt-2 text-2xl font-bold text-cyan-200">{summary?.nominations_hr_approved ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-300">مكتملة</p>
            <p className="mt-2 text-2xl font-bold text-amber-200">{summary?.nominations_completed ?? 0}</p>
          </div>
        </section>

        {overdueFollowups.length > 0 ? (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
            <h2 className="text-lg font-bold text-rose-200">تنبيه تلقائي: متابعات 30/60/90 متأخرة</h2>
            <p className="mt-1 text-xs text-rose-100/90">عدد الحالات المتأخرة: {overdueFollowups.length}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {overdueFollowups.slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-xl border border-rose-500/30 bg-slate-900/60 p-3 text-xs text-rose-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{row.employee_name} ({row.employee_no})</span>
                    <span>{row.checkpoint_days} يوم</span>
                  </div>
                  <p className="mt-1">متأخر بمقدار {row.late_days} يوم</p>
                  <button
                    type="button"
                    onClick={() => {
                      const matched = nominations.find((n) => n.id === row.nomination_id);
                      setFollowupForm((s) => ({
                        ...s,
                        nomination_id: row.nomination_id,
                        employee_no: row.employee_no,
                        checkpoint_days: row.checkpoint_days,
                        department_code: matched?.department_code || s.department_code,
                        section_code: matched?.section_code || s.section_code,
                      }));
                    }}
                    className="mt-2 rounded-lg border border-rose-400/40 px-2 py-1 text-[11px] font-bold text-rose-100 hover:bg-rose-500/20"
                  >
                    تعبئة نموذج المتابعة تلقائياً
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h2 className="mb-3 text-lg font-bold text-white">تحليلات شهرية (آخر 6 أشهر)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {monthlyTrend.map((row) => {
              const surveyBar = Math.round((row.surveys / maxTrendCount) * 100);
              const followBar = Math.round((row.followups / maxTrendCount) * 100);
              return (
                <div key={row.key} className="rounded-xl border border-white/10 bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-400">{row.label}</p>
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-violet-200">
                        <span>استبيانات</span>
                        <span>{row.surveys}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-slate-700">
                        <div className="h-1.5 rounded bg-violet-400" style={{ width: `${surveyBar}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-indigo-200">
                        <span>متابعات</span>
                        <span>{row.followups}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-slate-700">
                        <div className="h-1.5 rounded bg-indigo-400" style={{ width: `${followBar}%` }} />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-300">متوسط الرضا: {row.avgOverall.toFixed(1)}/5</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <p className="text-xs text-violet-300">متوسط رضا المتدربين</p>
            <p className="mt-2 text-2xl font-bold text-violet-100">{averageSurveyScore.toFixed(1)}/5</p>
          </div>
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <p className="text-xs text-indigo-300">متوسط التحسن السلوكي</p>
            <p className="mt-2 text-2xl font-bold text-indigo-100">{averageBehaviorScore.toFixed(1)}/5</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">تغطية متابعة 30 يوم</p>
            <p className="mt-2 text-2xl font-bold text-white">{checkpointCoverage.c30}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">تغطية متابعة 60 يوم</p>
            <p className="mt-2 text-2xl font-bold text-white">{checkpointCoverage.c60}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">تغطية متابعة 90 يوم</p>
            <p className="mt-2 text-2xl font-bold text-white">{checkpointCoverage.c90}%</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <form onSubmit={submitNeed} className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold text-white"><ClipboardCheck className="h-5 w-5 text-emerald-300" /> نموذج احتياج تدريبي</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={needForm.department_code} onChange={(e) => setNeedForm((s) => ({ ...s, department_code: e.target.value }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                <option value="">اختر إدارة المقترح</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.code}>{d.name_ar} ({d.code})</option>
                ))}
              </select>
              <input value={needForm.section_code} onChange={(e) => setNeedForm((s) => ({ ...s, section_code: e.target.value }))} placeholder="رمز القسم" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <select
                multiple
                value={needForm.target_department_codes}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setNeedForm((s) => ({ ...s, target_department_codes: values }));
                }}
                className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2"
              >
                {departments.map((d) => (
                  <option key={`target-${d.id}`} value={d.code}>{d.name_ar} ({d.code})</option>
                ))}
              </select>
              <input value={needForm.title} onChange={(e) => setNeedForm((s) => ({ ...s, title: e.target.value }))} placeholder="عنوان الاحتياج" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
              <textarea value={needForm.competency_gap} onChange={(e) => setNeedForm((s) => ({ ...s, competency_gap: e.target.value }))} rows={2} placeholder="فجوة المهارة" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
              <textarea value={needForm.objective} onChange={(e) => setNeedForm((s) => ({ ...s, objective: e.target.value }))} rows={2} placeholder="الهدف التدريبي" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
              <input value={needForm.target_audience} onChange={(e) => setNeedForm((s) => ({ ...s, target_audience: e.target.value }))} placeholder="الفئة المستهدفة" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <input value={needForm.expected_impact} onChange={(e) => setNeedForm((s) => ({ ...s, expected_impact: e.target.value }))} placeholder="الأثر المتوقع" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <select value={needForm.priority} onChange={(e) => setNeedForm((s) => ({ ...s, priority: e.target.value as NeedForm['priority'] }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                <option value="low">أولوية منخفضة</option>
                <option value="medium">أولوية متوسطة</option>
                <option value="high">أولوية عالية</option>
              </select>
              <input type="number" min={0} value={needForm.proposed_budget} onChange={(e) => setNeedForm((s) => ({ ...s, proposed_budget: Math.max(0, Number(e.target.value || 0)) }))} placeholder="ميزانية مقترحة" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
            </div>
            <p className="text-[11px] text-slate-400 md:col-span-2">الإدارات المستهدفة: اضغط Ctrl/Command لاختيار أكثر من إدارة.</p>
            <button type="submit" disabled={!canCreateProposal} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Send className="h-4 w-4" /> إرسال مقترح التدريب</button>
          </form>

          <form onSubmit={submitNomination} className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold text-white"><ListChecks className="h-5 w-5 text-cyan-300" /> نموذج ترشيح موظف</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={nomForm.need_id} onChange={(e) => setNomForm((s) => ({ ...s, need_id: e.target.value }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2">
                <option value="">اختر الاحتياج المرتبط</option>
                {nominationNeeds.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.title} - {n.department_code}/{n.section_code}</option>
                ))}
              </select>
              <select value={nomForm.employee_no ? `${nomForm.employee_no}|${nomForm.employee_name}` : ''} onChange={(e) => onEmployeeSelect(e.target.value)} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2">
                <option value="">اختر الموظف من قائمة شؤون الموظفين</option>
                {employees.map((emp) => (
                  <option key={emp.employee_no} value={`${emp.employee_no}|${emp.name_ar}`}>{emp.employee_no} - {emp.name_ar}</option>
                ))}
              </select>
              <select value={nomForm.department_code} onChange={(e) => setNomForm((s) => ({ ...s, department_code: e.target.value }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                <option value="">اختر الإدارة</option>
                {departments.map((d) => (
                  <option key={`nom-dept-${d.id}`} value={d.code}>{d.name_ar} ({d.code})</option>
                ))}
              </select>
              <input value={nomForm.section_code} onChange={(e) => setNomForm((s) => ({ ...s, section_code: e.target.value }))} placeholder="رمز القسم" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <textarea value={nomForm.nomination_reason} onChange={(e) => setNomForm((s) => ({ ...s, nomination_reason: e.target.value }))} rows={3} placeholder="سبب الترشيح" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <button type="submit" disabled={!canNominate} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Send className="h-4 w-4" /> إرسال الترشيح</button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">طلبات الاحتياج</h2>
            <div className="flex items-center gap-2">
              {canReviewNeeds ? (
                <div className="inline-flex overflow-hidden rounded-xl border border-white/15 text-xs">
                  <button
                    type="button"
                    onClick={() => setNeedView('role_pending')}
                    className={`px-2.5 py-1.5 ${needView === 'role_pending' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                  >
                    بانتظار دوري ({rolePendingNeeds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedView('all')}
                    className={`px-2.5 py-1.5 ${needView === 'all' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                  >
                    عرض الكل ({needs.length})
                  </button>
                </div>
              ) : null}
              <button onClick={() => void loadAll()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-1.5 text-sm"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث</button>
            </div>
          </div>
          <div className="space-y-3">
            {visibleNeeds.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{n.title}</p>
                  <span className={`rounded-lg border px-2 py-1 text-xs ${statusTone(n.status)}`}>{labelNeedStatus(n.status)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{n.department_code}/{n.section_code} - {new Date(n.created_at).toLocaleString('ar-LY')}</p>
                {Array.isArray(n.target_department_codes) && n.target_department_codes.length > 0 ? (
                  <p className="mt-1 text-[11px] text-emerald-300">الإدارات المستهدفة: {n.target_department_codes.join(' , ')}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {n.status === 'submitted' && isSection ? <button onClick={() => void needAction(n.id, 'approve_section')} disabled={busyId === n.id} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950"><CheckCircle2 className="inline h-3.5 w-3.5 ml-1" />اعتماد رئيس القسم</button> : null}
                  {n.status === 'section_approved' && isDept ? <button onClick={() => void needAction(n.id, 'approve_dept')} disabled={busyId === n.id} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"><CheckCircle2 className="inline h-3.5 w-3.5 ml-1" />اعتماد مدير الإدارة</button> : null}
                  {n.status === 'dept_approved' && isTraining ? <button onClick={() => void needAction(n.id, 'approve_training')} disabled={busyId === n.id} className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white"><CheckCircle2 className="inline h-3.5 w-3.5 ml-1" />اعتماد إدارة التدريب</button> : null}
                  {['submitted', 'section_approved', 'dept_approved'].includes(n.status) && (isSection || isDept || isTraining) ? <button onClick={() => void needAction(n.id, 'reject')} disabled={busyId === n.id} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"><XCircle className="inline h-3.5 w-3.5 ml-1" />رفض</button> : null}
                </div>
              </div>
            ))}
            {!loading && visibleNeeds.length === 0 ? <p className="text-sm text-slate-400">لا توجد احتياجات حالياً وفق الفلتر الحالي.</p> : null}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <form onSubmit={submitSurvey} className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3">
            <h2 className="text-lg font-bold text-white">استبيان ما بعد التدريب</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={surveyForm.nomination_id} onChange={(e) => setSurveyForm((s) => ({ ...s, nomination_id: e.target.value }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2">
                <option value="">اختر رقم الترشيح</option>
                {nominations.filter((n) => (role === 'employee' ? n.employee_no === actorEmployeeNo : true)).map((n) => (
                  <option key={n.id} value={n.id}>{n.employee_name} - {n.id}</option>
                ))}
              </select>
              <input value={surveyForm.employee_no} onChange={(e) => setSurveyForm((s) => ({ ...s, employee_no: e.target.value }))} placeholder="رقم الموظف" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <select value={surveyForm.score_overall} onChange={(e) => setSurveyForm((s) => ({ ...s, score_overall: Number(e.target.value) }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>التقييم العام {v}/5</option>)}
              </select>
              <select value={surveyForm.score_relevance} onChange={(e) => setSurveyForm((s) => ({ ...s, score_relevance: Number(e.target.value) }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>ملاءمة المحتوى {v}/5</option>)}
              </select>
              <select value={surveyForm.score_trainer} onChange={(e) => setSurveyForm((s) => ({ ...s, score_trainer: Number(e.target.value) }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>أداء المدرب {v}/5</option>)}
              </select>
              <select value={surveyForm.score_content} onChange={(e) => setSurveyForm((s) => ({ ...s, score_content: Number(e.target.value) }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>جودة المادة العلمية {v}/5</option>)}
              </select>
              <textarea value={surveyForm.comments} onChange={(e) => setSurveyForm((s) => ({ ...s, comments: e.target.value }))} rows={3} placeholder="ملاحظات المتدرب" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white">إرسال الاستبيان</button>
          </form>

          <form onSubmit={submitFollowup} className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3">
            <h2 className="text-lg font-bold text-white">متابعة المدير 30/60/90</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={followupForm.nomination_id} onChange={(e) => setFollowupForm((s) => ({ ...s, nomination_id: e.target.value }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2">
                <option value="">اختر رقم الترشيح</option>
                {nominations.map((n) => (
                  <option key={n.id} value={n.id}>{n.employee_name} - {n.id}</option>
                ))}
              </select>
              <input value={followupForm.employee_no} onChange={(e) => setFollowupForm((s) => ({ ...s, employee_no: e.target.value }))} placeholder="رقم الموظف" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <select value={followupForm.checkpoint_days} onChange={(e) => setFollowupForm((s) => ({ ...s, checkpoint_days: Number(e.target.value) as 30 | 60 | 90 }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                <option value={30}>30 يوم</option>
                <option value={60}>60 يوم</option>
                <option value={90}>90 يوم</option>
              </select>
              <input value={followupForm.department_code} onChange={(e) => setFollowupForm((s) => ({ ...s, department_code: e.target.value }))} placeholder="رمز الإدارة" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <input value={followupForm.section_code} onChange={(e) => setFollowupForm((s) => ({ ...s, section_code: e.target.value }))} placeholder="رمز القسم" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm" />
              <select value={followupForm.behavior_change_score} onChange={(e) => setFollowupForm((s) => ({ ...s, behavior_change_score: Number(e.target.value) }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>تغير السلوك {v}/5</option>)}
              </select>
              <select value={followupForm.application_score} onChange={(e) => setFollowupForm((s) => ({ ...s, application_score: Number(e.target.value) }))} className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm">
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>تطبيق المهارة {v}/5</option>)}
              </select>
              <input value={followupForm.performance_signal} onChange={(e) => setFollowupForm((s) => ({ ...s, performance_signal: e.target.value }))} placeholder="إشارة الأداء (إيجابي/محايد/منخفض)" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
              <textarea value={followupForm.notes} onChange={(e) => setFollowupForm((s) => ({ ...s, notes: e.target.value }))} rows={3} placeholder="ملاحظات المدير" className="rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <button type="submit" disabled={!canSubmitFollowup} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">حفظ المتابعة</button>
          </form>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="mb-3 text-lg font-bold text-white">نتائج استبيانات المتدربين</h2>
            <div className="space-y-2">
              {surveys.slice(0, 20).map((s) => (
                <div key={s.id} className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-violet-300">{s.employee_no} - {s.nomination_id}</span>
                    <span>{s.score_overall}/5</span>
                  </div>
                  <p className="mt-1 text-slate-400">{s.department_code}/{s.section_code} - {new Date(s.submitted_at).toLocaleString('ar-LY')}</p>
                </div>
              ))}
              {!loading && surveys.length === 0 ? <p className="text-sm text-slate-400">لا توجد استبيانات حالياً.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="mb-3 text-lg font-bold text-white">متابعات المدير 30/60/90</h2>
            <div className="space-y-2">
              {followups.slice(0, 20).map((f) => (
                <div key={f.id} className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-indigo-300">{f.employee_no} - {f.checkpoint_days} يوم</span>
                    <span>{f.behavior_change_score}/5</span>
                  </div>
                  <p className="mt-1 text-slate-400">{f.department_code}/{f.section_code} - {new Date(f.submitted_at).toLocaleString('ar-LY')}</p>
                </div>
              ))}
              {!loading && followups.length === 0 ? <p className="text-sm text-slate-400">لا توجد متابعات حالياً.</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">ترشيحات الموظفين</h2>
            {canReviewNominations ? (
              <div className="inline-flex overflow-hidden rounded-xl border border-white/15 text-xs">
                <button
                  type="button"
                  onClick={() => setNomView('role_pending')}
                  className={`px-2.5 py-1.5 ${nomView === 'role_pending' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                >
                  بانتظار دوري ({rolePendingNominations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNomView('all')}
                  className={`px-2.5 py-1.5 ${nomView === 'all' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                >
                  عرض الكل ({nominations.length})
                </button>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            {visibleNominations.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{n.employee_name} ({n.employee_no})</p>
                  <span className={`rounded-lg border px-2 py-1 text-xs ${statusTone(n.status)}`}>{labelNomStatus(n.status)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">need: {n.need_id} - {n.department_code}/{n.section_code}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {n.status === 'submitted' && isSection ? <button onClick={() => void nominationAction(n.id, 'approve_section')} disabled={busyId === n.id} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950">اعتماد رئيس القسم</button> : null}
                  {n.status === 'section_approved' && isDept ? <button onClick={() => void nominationAction(n.id, 'approve_dept')} disabled={busyId === n.id} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950">اعتماد مدير الإدارة</button> : null}
                  {n.status === 'dept_approved' && isFinance ? <button onClick={() => void nominationAction(n.id, 'approve_finance')} disabled={busyId === n.id} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950">اعتماد المالية</button> : null}
                  {n.status === 'finance_approved' && isTraining ? <button onClick={() => void nominationAction(n.id, 'approve_hr')} disabled={busyId === n.id} className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white">اعتماد شؤون الموظفين</button> : null}
                  {n.status === 'hr_approved' && isTraining ? <button onClick={() => void nominationAction(n.id, 'mark_completed')} disabled={busyId === n.id} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200">إغلاق مكتمل</button> : null}
                  {['submitted', 'section_approved', 'dept_approved', 'finance_approved', 'hr_approved'].includes(n.status) && (isSection || isDept || isFinance || isTraining) ? <button onClick={() => void nominationAction(n.id, 'reject')} disabled={busyId === n.id} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">رفض</button> : null}
                </div>
              </div>
            ))}
            {!loading && visibleNominations.length === 0 ? <p className="text-sm text-slate-400">لا توجد ترشيحات حالياً وفق الفلتر الحالي.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h2 className="mb-3 text-lg font-bold text-white">سجل التدقيق</h2>
          <div className="space-y-2">
            {audit.slice(0, 20).map((row) => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-xs text-slate-300">
                <span className="text-cyan-300">{row.entity}</span> #{row.entity_id} - {row.action} - {row.actor_role} - {new Date(row.created_at).toLocaleString('ar-LY')}
              </div>
            ))}
            {!loading && audit.length === 0 ? <p className="text-sm text-slate-400">لا توجد أحداث تدقيق حالياً.</p> : null}
          </div>
        </section>

        {message ? <p className="text-sm text-rose-300">{message}</p> : null}
      </div>
    </div>
  );
}
