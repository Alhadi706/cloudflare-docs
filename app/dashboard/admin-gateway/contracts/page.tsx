'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSignature, Users, FileText, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Summary {
  active_contractors: number;
  totals: {
    total: number; draft: number; active: number;
    on_hold: number; completed: number; cancelled: number;
    active_value: number; total_value: number;
  };
  expiring_soon: Array<{ contract_number: string; contract_title: string; end_date: string }>;
}

export default function ContractsOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/contracts/summary', { headers: { 'X-Tenant-ID': getTenantId() || '' } })
      .then(r => r.json()).then(setSummary).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const t = summary?.totals;

  return (
    <div className="min-h-full bg-transparent p-3 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl">
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/15 p-4">
          <FileSignature className="w-10 h-10 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">إدارة العقود والمقاولين</h1>
          <p className="mt-1 text-white/75">تسجيل المقاولين — إبرام العقود — ربط المشاريع والمواقع</p>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="text-slate-400 text-center py-8">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'مقاولون نشطون', value: summary?.active_contractors ?? 0, icon: <Users className="w-6 h-6" />, color: 'text-blue-400' },
            { label: 'عقود نشطة', value: t?.active ?? 0, icon: <FileText className="w-6 h-6" />, color: 'text-green-400' },
            { label: 'إجمالي العقود', value: t?.total ?? 0, icon: <TrendingUp className="w-6 h-6" />, color: 'text-indigo-400' },
            { label: 'إجمالي القيمة (LYD)', value: (t?.total_value ?? 0).toLocaleString('ar-LY', { maximumFractionDigits: 0 }), icon: <TrendingUp className="w-6 h-6" />, color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-xl">
              <div className={`${s.color} mb-2`}>{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="mt-1 text-sm text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status breakdown */}
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'مسودة', val: t.draft, chip: 'bg-slate-500/20 border-slate-400/40' },
            { label: 'نشط', val: t.active, chip: 'bg-emerald-500/20 border-emerald-400/40' },
            { label: 'موقوف', val: t.on_hold, chip: 'bg-amber-500/20 border-amber-400/40' },
            { label: 'مكتمل', val: t.completed, chip: 'bg-blue-500/20 border-blue-400/40' },
            { label: 'ملغي', val: t.cancelled, chip: 'bg-rose-500/20 border-rose-400/40' },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border p-3 text-center backdrop-blur-xl ${s.chip}`}>
              <div className="text-xl font-bold text-white">{s.val}</div>
              <div className="text-sm text-white/75">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/admin-gateway/contracts/contractors"
          className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/10 transition-all group">
          <div className="flex items-center gap-4">
            <div className="bg-blue-700/20 p-3 rounded-lg">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-blue-200 transition-colors">سجل المقاولين</h3>
              <p className="mt-1 text-sm text-white/75">إضافة وإدارة المقاولين المعتمدين</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/admin-gateway/contracts/list"
          className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/10 transition-all group">
          <div className="flex items-center gap-4">
            <div className="bg-green-700/20 p-3 rounded-lg">
              <FileSignature className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-green-200 transition-colors">سجل العقود</h3>
              <p className="mt-1 text-sm text-white/75">إبرام وإدارة العقود المرتبطة بالمشاريع</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Expiring soon */}
      {summary?.expiring_soon && summary.expiring_soon.length > 0 && (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/15 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-amber-300 font-semibold">عقود تقترب من نهايتها (خلال 60 يوم)</h3>
          </div>
          <div className="space-y-2">
            {summary.expiring_soon.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                <div>
                  <span className="font-medium text-white">{c.contract_number}</span>
                  <span className="mr-2 text-sm text-white/70">{c.contract_title}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 text-sm">
                  <Clock className="w-4 h-4" />
                  {c.end_date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
