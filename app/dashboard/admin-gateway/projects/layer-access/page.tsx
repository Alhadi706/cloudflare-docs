'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Map, Shield, CheckCircle, XCircle, Eye, EyeOff,
  Crown, AlertTriangle, Lock, Unlock, RefreshCw, Info,
  Building2,
} from 'lucide-react';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('auth_token') || '';
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || '';
  const role = localStorage.getItem('user_role') || '';
  const email = localStorage.getItem('user_email') || '';
  if (token)      headers['Authorization']        = `Bearer ${token}`;
  if (tenantId)   headers['x-tenant-id']          = tenantId;
  if (tenantId)   headers['x-verified-tenant-id'] = tenantId;
  if (tenantCode) headers['x-verified-tenant-code'] = tenantCode;
  if (role)       headers['x-verified-role']       = role;
  if (email)      headers['x-verified-email']      = email;
  return headers;
}

interface DeptGrant {
  code:       string;
  name:       string;
  nameEn:     string;
  has_access: boolean;
  is_owner:   boolean;
}

interface GrantsResponse {
  owner_dept:    string;
  grants:        DeptGrant[];
  total_granted: number;
}

// Dept descriptions for UI
const DEPT_DESCRIPTIONS: Record<string, string> = {
  ADMIN:  'يمكنها الاطلاع على مواقع المشاريع لأغراض الحوكمة الإدارية',
  FIN:    'تطلع على الميزانيات والمصروفات المكانية للمشاريع',
  HR:     'تطلع على توزيع الفرق الميدانية على المشاريع',
  MAINT:  'تطلع على المشاريع لتنسيق الصيانة والتنفيذ',
  GIS:    'إدارة فنية — تملك رؤية كاملة للطبقات المكانية',
  ASSET:  'تطلع على ارتباط الأصول بالمشاريع',
  CORR:   'تطلع على مواقع المشاريع لمتابعة التآكل',
  PROC:   'تطلع على مواقع المشاريع للمشتريات والتوريد',
  CTRL:   'لوحة التحكم التنفيذي — تتابع تقدم المشاريع على الخريطة',
  FLEET:  'تطلع على مواقع المشاريع لتسيير المركبات',
  ENG:    'إدارة هندسية — تطلع على نطاقات المشاريع التقنية',
};

export default function ProjectsLayerAccessPage() {
  const [data,    setData]    = useState<GrantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/projects-layer/grants', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
    } catch (e: any) {
      setError(e.message || 'خطأ في التحميل');
    } finally {
      setLoading(false);
    }
  }

  async function toggle(dept: DeptGrant) {
    setSaving(dept.code);
    try {
      const action = dept.has_access ? 'revoke' : 'grant';
      const res = await fetch('/api/v1/projects-layer/grants', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, dept_code: dept.code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || d.error || `HTTP ${res.status}`);
      setData((prev) => prev ? { ...prev, grants: d.grants, total_granted: d.grants.filter((g: DeptGrant) => g.has_access).length } : prev);
      showToast(
        action === 'grant'
          ? `✓ تم منح ${dept.name} صلاحية رؤية طبقة المشاريع`
          : `✓ تم سحب صلاحية ${dept.name}`,
        true
      );
    } catch (e: any) {
      showToast(e.message || 'فشل التحديث', false);
    } finally {
      setSaving(null);
    }
  }

  useEffect(() => { load(); }, []);

  const granted  = data?.grants.filter((g) => g.has_access)  ?? [];
  const revoked  = data?.grants.filter((g) => !g.has_access) ?? [];

  return (
    <div className="min-h-full w-full bg-slate-950 text-slate-100" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <Link
            href="/dashboard/admin-gateway/projects"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-3"
          >
            <ArrowRight className="w-4 h-4" />
            إدارة المشاريع
          </Link>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Map className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">التحكم في رؤية طبقة المشاريع</h1>
                <p className="text-slate-400 text-sm mt-0.5">Projects Layer Access Control — تحكم مدير إدارة المشاريع</p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-cyan-200">كيف يعمل هذا النظام؟</p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                طبقة المشاريع على الخريطة تحتوي على مواقع ونطاقات جميع المشاريع الجارية والمستقبلية مع نسب التقدم.
                <strong className="text-white"> إدارة المشاريع فقط</strong> تتحكم في من يستطيع رؤية هذه الطبقة.
                الإدارات غير المرخصة لن ترى أي بيانات مشاريع على الخريطة.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{granted.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">إدارة لديها صلاحية</p>
            </div>
            <div className="bg-slate-900 border border-red-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-400">{revoked.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">إدارة محجوبة</p>
            </div>
            <div className="bg-slate-900 border border-purple-500/20 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-purple-400">PROJ</p>
              <p className="text-xs text-slate-500 mt-0.5">المالك — وصول دائم</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Owner row */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">المالك — وصول دائم غير قابل للسحب</h2>
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white">إدارة المشاريع</p>
              <p className="text-xs text-slate-400 mt-0.5">PROJ — المالك والمتحكم في الطبقة</p>
            </div>
            <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">وصول كامل — مالك الطبقة</span>
            </div>
          </div>
        </div>

        {/* Departments list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            جاري التحميل...
          </div>
        ) : data ? (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">الإدارات الأخرى — انقر لمنح أو سحب الصلاحية</h2>
            <div className="space-y-2">
              {data.grants.map((dept) => {
                const isSaving = saving === dept.code;
                return (
                  <div
                    key={dept.code}
                    className={`relative rounded-2xl border transition-all duration-200
                      ${dept.has_access
                        ? 'bg-slate-900 border-emerald-500/25 hover:border-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
                        ${dept.has_access ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-slate-800 border border-slate-700'}`}>
                        <Building2 className={`w-5 h-5 ${dept.has_access ? 'text-emerald-400' : 'text-slate-500'}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold ${dept.has_access ? 'text-white' : 'text-slate-400'}`}>{dept.name}</p>
                          <span className="text-xs text-slate-600 font-mono">{dept.code}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {DEPT_DESCRIPTIONS[dept.code] || dept.nameEn}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className={`hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0
                        ${dept.has_access
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 border border-slate-700 text-slate-500'
                        }`}>
                        {dept.has_access ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {dept.has_access ? 'ترى الطبقة' : 'محجوبة'}
                      </div>

                      {/* Toggle button */}
                      <button
                        onClick={() => toggle(dept)}
                        disabled={isSaving}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all
                          ${dept.has_access
                            ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isSaving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : dept.has_access ? (
                          <>
                            <Lock className="w-4 h-4" />
                            <span className="hidden sm:inline">سحب الصلاحية</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4" />
                            <span className="hidden sm:inline">منح الصلاحية</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Warning note */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-amber-300">ملاحظة:</strong> الإدارات التي لا تملك صلاحية لن ترى طبقة المشاريع على الخريطة الموحدة.
              القرارات تُطبَّق فورياً على الخريطة الحية. مدير النظام (Admin) لديه وصول دائم لجميع الطبقات بغض النظر عن هذه الإعدادات.
            </p>
          </div>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold shadow-xl transition-all
          ${toast.ok
            ? 'border-emerald-500/40 bg-emerald-900/80 text-emerald-200'
            : 'border-red-500/40 bg-red-900/80 text-red-200'
          }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
