'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { getHomeRoute } from '@/lib/rbac';
import { applyServerSession, syncClientAuthState } from '@/lib/client-auth-session';
import type { DepartmentCode, UserRole } from '@/lib/user-store';

interface Props {
  onDemoEnter: () => void;
}

type LoginStep = 'login' | 'change-password';

const PANEL_STYLE = {
  background: 'rgba(4, 12, 32, 0.78)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: '0 32px 64px -16px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
};

function persistTenantContext(tenantId?: string | null, tenantCode?: string | null) {
  const previousTenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id');

  localStorage.removeItem('tenant_id');
  localStorage.removeItem('active_tenant_id');
  localStorage.removeItem('tenant_code');
  localStorage.removeItem('active_tenant_code');

  if (previousTenantId && tenantId && previousTenantId !== tenantId) {
    localStorage.removeItem('erp-context');
    localStorage.removeItem('operational-context');
    localStorage.removeItem('workspace-user');
  }

  if (tenantId) {
    localStorage.setItem('tenant_id', tenantId);
    localStorage.setItem('active_tenant_id', tenantId);
  }

  if (tenantCode) {
    localStorage.setItem('tenant_code', tenantCode);
    localStorage.setItem('active_tenant_code', tenantCode);
  }
}

export default function LoginPanel({ onDemoEnter }: Props) {
  const [allowDevHelpers, setAllowDevHelpers] = useState(false);
  const [step, setStep]         = useState<LoginStep>('login');

  const [orgCode, setOrgCode]   = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const [authToken, setAuthToken]         = useState('');
  const [pendingLoginData, setPendingLoginData] = useState<any>(null);
  const [newPass, setNewPass]             = useState('');
  const [newPass2, setNewPass2]           = useState('');

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (
      host === 'dev.d-me.ly' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      process.env.NODE_ENV !== 'production'
    ) {
      setAllowDevHelpers(true);
    }
  }, []);

  const finalizeLogin = async (data: any, fallbackEmail?: string) => {
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user_email', data.email || fallbackEmail || '');
    if (data.full_name)         localStorage.setItem('user_name', data.full_name);
    if (data.organization_name) localStorage.setItem('org_name', data.organization_name);
    if (data.role)              localStorage.setItem('user_role', data.role);
    if (data.department_code)   localStorage.setItem('dept_code', data.department_code);

    persistTenantContext(data.tenant_id ?? null, data.tenant_code ?? null);
    const appScope = localStorage.getItem('launch_app') || process.env.NEXT_PUBLIC_APP_SCOPE || null;
    const sessionApplied = await applyServerSession(data.token, appScope);
    if (!sessionApplied) {
      setError('تعذر تثبيت جلسة الدخول الآمنة. حاول مرة أخرى.');
      return;
    }

    // Only set needs_bootstrap if the API explicitly says so.
    // is_founder alone does NOT trigger bootstrap — a founder can already have
    // completed onboarding (tenant_id present means setup is done).
    if (data.needs_bootstrap && !data.tenant_id) {
      localStorage.setItem('needs_bootstrap', '1');
    } else {
      // Clear any stale bootstrap flag so the founder goes to dashboard directly
      localStorage.removeItem('needs_bootstrap');
    }

    const homeRoute = getHomeRoute(
      (data.role ?? 'member') as UserRole,
      (data.department_code ?? null) as DepartmentCode | null
    );
    window.location.href = homeRoute;
  };

  const loginManager = async () => {
    if (!orgCode.trim())  { setError('أدخل رمز المؤسسة'); return; }
    if (!email.trim())    { setError('أدخل البريد الإلكتروني أو اسم المستخدم'); return; }
    if (!password.trim()) { setError('أدخل كلمة المرور'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_code: orgCode.trim().toLowerCase(),
          username: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'بيانات الدخول غير صحيحة'); return; }
      if (data.must_change_password) {
        setPendingLoginData(data);
        setAuthToken(data.token);
        setStep('change-password');
        return;
      }
      await finalizeLogin(data);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const saveManagerPassword = async () => {
    if (newPass.length < 8)   { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (newPass !== newPass2) { setError('كلمتا المرور غير متطابقتين'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ current_password: password, new_password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر حفظ كلمة المرور'); return; }

      // If we have the original login data, finalize properly (sets needs_bootstrap etc)
      if (pendingLoginData) {
        await finalizeLogin({ ...pendingLoginData, must_change_password: false });
      } else {
        const appScope = localStorage.getItem('launch_app') || process.env.NEXT_PUBLIC_APP_SCOPE || null;
        const sessionApplied = await applyServerSession(authToken, appScope);
        if (!sessionApplied) {
          setError('تعذر تثبيت جلسة الدخول الآمنة. حاول مرة أخرى.');
          return;
        }
        const role       = localStorage.getItem('user_role') ?? 'employee';
        const dept       = localStorage.getItem('dept_code') ?? null;
        const home = getHomeRoute(role as UserRole, (dept as DepartmentCode | null) ?? null);
        window.location.href = home;
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const quickDevLogin = async () => {
    try {
      const res = await fetch('/api/auth/dev-quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.token) {
        // Use syncClientAuthState to set ALL cookies (role, dept, tenant, etc.)
        // so middleware RBAC works correctly on the next navigation.
        await syncClientAuthState(data);
        // Clear any stale bootstrap flag — dev account always has a tenant
        localStorage.removeItem('needs_bootstrap');
        window.location.href = data.home_route || '/dashboard/gm-office';
        return;
      }
    } catch { /* fallback */ }
    onDemoEnter();
  };

  return (
    <div className="flex flex-col w-full max-w-sm" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-5"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-xs text-slate-400 leading-none">منصة الخدمات السيادية</div>
          <div className="text-sm font-bold text-white leading-tight">Digital Sovereignty Force</div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 space-y-3.5"
        style={PANEL_STYLE}
      >
        {step === 'login' ? (
          <>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">دخول المنصة</h3>

            <div className="relative">
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="رمز المؤسسة"
                value={orgCode}
                onChange={e => { setOrgCode(e.target.value); setError(''); }}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="البريد الإلكتروني"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                dir="ltr"
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="كلمة المرور"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && loginManager()}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && <div className="text-xs text-red-400">{error}</div>}

            <button
              onClick={loginManager}
              disabled={loading}
              className="w-full bg-gradient-to-l from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{loading ? 'جارٍ الدخول...' : 'دخول المنصة'}</span>
            </button>

            <div className="pt-1 text-center">
              <a href="/entry/request-institution" className="text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                ليس لديك مؤسسة؟ سجّل مؤسستك
              </a>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-amber-200 mb-1">تغيير كلمة المرور</h3>
            <p className="text-xs text-slate-400">
              كلمة المرور المؤقتة مفعّلة — يرجى تعيين كلمة مرور جديدة قبل المتابعة.
            </p>

            <input
              type="password"
              placeholder="كلمة المرور الجديدة"
              value={newPass}
              onChange={e => { setNewPass(e.target.value); setError(''); }}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              dir="ltr"
            />
            <input
              type="password"
              placeholder="تأكيد كلمة المرور الجديدة"
              value={newPass2}
              onChange={e => { setNewPass2(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && saveManagerPassword()}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              dir="ltr"
            />

            {error && <div className="text-xs text-red-400">{error}</div>}

            <button
              onClick={saveManagerPassword}
              disabled={loading}
              className="w-full bg-gradient-to-l from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور والدخول'}</span>
            </button>
          </>
        )}
      </motion.div>

      <div className="mt-4 flex items-center justify-between text-xs">
        {allowDevHelpers ? (
          <button onClick={quickDevLogin} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors">
            <Globe className="w-3 h-3" />
            <span>دخول تطويري سريع</span>
          </button>
        ) : (
          <a href="/" className="text-slate-600 hover:text-slate-400 transition-colors">الصفحة الرئيسية</a>
        )}
        <a href="/forgot-password" className="text-slate-400 hover:text-slate-300 transition-colors">
          نسيت كلمة المرور؟
        </a>
      </div>
    </div>
  );
}
