'use client';
/**
 * صفحة تفصيل المشروع — Project 360
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Building2, Calendar, DollarSign, MapPin,
  CheckCircle2, Clock, AlertCircle, ArrowRight, Layers, Target,
  TrendingUp, FileText, Wrench, CheckSquare, Package, Plus, RefreshCw
} from 'lucide-react';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

interface ProjectDetail {
  id: number; name: string; code?: string; status: string;
  description?: string; budget?: number; budget_spent?: number;
  progress_pct?: number; priority?: string; project_type?: string;
  start_date?: string; end_date?: string; location_name?: string;
  layers?: any[]; sites?: any[]; asset_count?: number;
}

interface Milestone { id: number; name: string; status: string; due_date?: string; }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:      { label: 'نشط',       cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  completed:   { label: 'مكتمل',     cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  on_hold:     { label: 'موقوف',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  in_progress: { label: 'قيد التنفيذ', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>{s.label}</span>;
};

const fmt = (v?: number) => v != null
  ? new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 }).format(v)
  : '—';

const fmtDate = (d?: string) => d
  ? new Date(d).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—';

export default function ProjectDetailPage() {
  const params    = useParams<{ id: string }>();
  const router    = useRouter();
  const projectId = String(params?.id || '').trim();

  const [project,    setProject]    = useState<ProjectDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [commissioning, setCommissioning] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const headers = getClientTenantHeaders();
      const r = await fetch(`/api/v1/workspace/projects/${projectId}/gis-overview`, { headers });
      if (!r.ok) throw new Error(`خطأ ${r.status}`);
      const d = await r.json();
      const p = d.project ?? d;
      const mr = await fetch(`/api/v1/workspace/milestones?project_id=${projectId}`, { headers }).catch(() => null);
      const mData = mr?.ok ? await mr.json().catch(() => []) : [];
      setProject({ ...p, layers: d.layers ?? [], sites: d.sites ?? [], asset_count: d.asset_count ?? 0 });
      setMilestones(Array.isArray(mData) ? mData : (mData.milestones ?? []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCommission = async () => {
    if (!project) return;
    if (!confirm(`استلام وتشغيل مشروع "${project.name}"؟\nسيتحول لوضع "مكتمل" ولا يمكن التراجع.`)) return;
    setCommissioning(true);
    try {
      await fetch(`/api/v1/workspace/projects/${projectId}`, {
        method: 'PATCH',
        headers: { ...getClientTenantHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', project_type: 'commissioned' }),
      });
      alert(`✅ تم استلام "${project.name}" — أصوله في سجل الأصول التشغيلية`);
      router.push('/dashboard/admin-gateway/assets/registry');
    } catch (e: any) { alert(`فشل: ${e.message}`); }
    finally { setCommissioning(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
      <div className="flex items-center gap-3 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /><span>جاري التحميل...</span></div>
    </div>
  );

  if (error || !project) return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center" dir="rtl">
      <AlertCircle className="w-12 h-12 text-rose-400 mb-4" />
      <p className="text-rose-300 mb-4">{error ?? 'تعذر تحميل المشروع'}</p>
      <Link href="/dashboard/admin-gateway/projects/list" className="text-cyan-400 hover:underline text-sm">← قائمة المشاريع</Link>
    </div>
  );

  const progress  = Number(project.progress_pct ?? 0);
  const budgetPct = project.budget && project.budget_spent != null
    ? Math.min(100, (project.budget_spent / project.budget) * 100) : 0;
  const completedMs = milestones.filter(m => m.status === 'completed').length;
  const canCommission = ['active', 'in_progress'].includes(project.status);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" dir="rtl">

      {/* Breadcrumb */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة النظام</Link>
        <ChevronLeft className="w-3 h-3" />
        <Link href="/dashboard/admin-gateway/projects/list" className="hover:text-slate-300">المشاريع</Link>
        <ChevronLeft className="w-3 h-3" />
        <span className="text-slate-300 font-medium truncate max-w-sm">{project.name}</span>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="bg-violet-600/20 p-3 rounded-xl border border-violet-500/30 shrink-0">
                <Building2 className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                  <StatusBadge status={project.status} />
                  {project.priority && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${project.priority === 'high' ? 'bg-rose-400' : project.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                      {project.priority === 'high' ? 'أولوية عالية' : project.priority === 'medium' ? 'أولوية متوسطة' : 'أولوية منخفضة'}
                    </span>
                  )}
                </div>
                {project.description && <p className="text-slate-400 text-sm max-w-2xl">{project.description}</p>}
              </div>
            </div>
            {canCommission && (
              <button onClick={handleCommission} disabled={commissioning}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shrink-0">
                {commissioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                استلام المشروع وتشغيله
              </button>
            )}
            {project.status === 'completed' && (
              <span className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 border border-sky-500/30 text-sky-300 rounded-xl text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> تم الاستلام
              </span>
            )}
          </div>
          {/* Progress */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>نسبة الإنجاز</span>
              <span className="font-bold text-slate-200">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-cyan-500 transition-all"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: DollarSign, color: 'text-emerald-400', title: 'الميزانية', value: fmt(project.budget),
              sub: project.budget ? `${budgetPct.toFixed(0)}% مصروف` : undefined },
            { icon: Calendar, color: 'text-sky-400', title: 'البداية → النهاية',
              value: fmtDate(project.start_date), sub: fmtDate(project.end_date) },
            { icon: Target, color: 'text-violet-400', title: 'المراحل',
              value: `${completedMs} / ${milestones.length}`, sub: 'مكتملة' },
            { icon: Package, color: 'text-cyan-400', title: 'الأصول',
              value: String(project.asset_count ?? 0), sub: 'أصل مسجل' },
          ].map(({ icon: Icon, color, title, value, sub }) => (
            <div key={title} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                <Icon className={`w-4 h-4 ${color}`} />{title}
              </div>
              <p className="text-lg font-bold text-slate-100">{value}</p>
              {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Milestones */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Target className="w-5 h-5 text-violet-400" /> المراحل والمعالم
            </div>
            <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
              <Plus className="w-3.5 h-3.5" /> إضافة مرحلة
            </button>
          </div>
          {milestones.length === 0 ? (
            <div className="p-8 text-center">
              <Target className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">لا توجد مراحل بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {milestones.map(m => {
                const done = m.status === 'completed';
                const late = !done && m.due_date && new Date(m.due_date) < new Date();
                return (
                  <div key={m.id} className="px-5 py-3.5 flex items-center gap-3">
                    {done ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          : late ? <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          : <Clock className="w-5 h-5 text-amber-400 shrink-0" />}
                    <p className={`text-sm flex-1 ${done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{m.name}</p>
                    {m.due_date && <span className={`text-xs ${late ? 'text-rose-400' : 'text-slate-500'}`}>{fmtDate(m.due_date)}</span>}
                    <StatusBadge status={m.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Layers + Sites */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2 font-semibold text-slate-200">
              <Layers className="w-5 h-5 text-cyan-400" /> الطبقات على الخريطة
            </div>
            {!project.layers?.length ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm mb-3">لا توجد طبقات GIS</p>
                <Link href="/dashboard/admin-gateway/assets/registry"
                  className="text-xs text-cyan-400 hover:underline flex items-center justify-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> فتح سجل الأصول ←
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {project.layers.slice(0,6).map((l: any, i: number) => (
                  <div key={l.id ?? i} className="px-5 py-3 flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color ?? '#60a5fa' }} />
                    <span className="text-sm text-slate-300 flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-slate-500">{l.layer_type ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2 font-semibold text-slate-200">
              <MapPin className="w-5 h-5 text-rose-400" /> المواقع
            </div>
            {!project.sites?.length ? (
              <div className="p-6 text-center"><p className="text-slate-500 text-sm">لا توجد مواقع مضافة</p></div>
            ) : (
              <div className="divide-y divide-slate-800">
                {project.sites.slice(0,6).map((s: any, i: number) => (
                  <div key={s.id ?? i} className="px-5 py-3 flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-sm text-slate-300 flex-1 truncate">{s.name ?? s.site_name}</span>
                    <StatusBadge status={s.status ?? 'active'} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Commission callout */}
        {canCommission && (
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-5 flex items-start gap-4">
            <div className="bg-emerald-600/20 p-3 rounded-xl border border-emerald-500/30 shrink-0">
              <CheckSquare className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-300 mb-1">جاهز للاستلام؟</h3>
              <p className="text-sm text-emerald-200/70 mb-4">
                بعد استلام المشروع من المقاول، اضغط الزر أدناه — يتحول المشروع لـ "مكتمل"
                وأصوله تنتقل تلقائياً لسجل الأصول التشغيلية للصيانة والمتابعة.
              </p>
              <button onClick={handleCommission} disabled={commissioning}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition">
                {commissioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                استلام المشروع وتشغيله
              </button>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Layers, label: 'سجل الأصول والخريطة', href: '/dashboard/admin-gateway/assets/registry', color: 'text-cyan-400' },
            { icon: FileText, label: 'وثائق المشروع', href: `/dashboard/admin-gateway/projects/documents?project_id=${projectId}`, color: 'text-violet-400' },
            { icon: Wrench, label: 'أوامر العمل', href: `/dashboard/admin-gateway/maintenance`, color: 'text-amber-400' },
            { icon: TrendingUp, label: 'التقارير', href: `/dashboard/admin-gateway/projects/dashboard`, color: 'text-emerald-400' },
          ].map(({ icon: Icon, label, href, color }) => (
            <Link key={href} href={href}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-3 transition group">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <span className="text-sm text-slate-300 group-hover:text-slate-100 transition">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
