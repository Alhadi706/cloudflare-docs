'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { getHomeRoute } from '@/lib/rbac';
import { applyServerSession, syncClientAuthState } from '@/lib/client-auth-session';
import { getPreferredAppScopeForDepartmentCode } from '@/lib/appScope';
import type { DepartmentCode, UserRole } from '@/lib/user-store';

interface Props {
  onDemoEnter: () => void;
}

/** Three-stage flow:
 *  'org'             → enter & verify org code
 *  'credentials'     → username + password (org banner shown)
 *  'change-password' → forced first-login password change
 */
type LoginStep = 'org' | 'credentials' | 'change-password';

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
  const [step, setStep] = useState<LoginStep>('org');

  // ── Stage 1 state (org lookup) ────────────────────────────────────────────
  const [orgCode, setOrgCode]       = useState('');
  const [orgName, setOrgName]       = useState('');           // confirmed org display name
  const [orgVerified, setOrgVerified] = useState(false);

  // ── Stage 2 state (credentials) ───────────────────────────────────────────
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);

  // ── Stage 3 state (force-change password) ─────────────────────────────────
  const [authToken, setAuthToken]         = useState('');
  const [pendingLoginData, setPendingLoginData] = useState<any>(null);
  const [newPass, setNewPass]             = useState('');
  const [newPass2, setNewPass2]           = useState('');

  // ── Shared state ──────────────────────────────────────────────────────────
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const credInputRef = useRef<HTMLInputElement>(null);

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

  // Focus username field when step changes to credentials
  useEffect(() => {
    if (step === 'credentials') {
      setTimeout(() => credInputRef.current?.focus(), 80);
    }
  }, [step]);

  // ── Stage 1: Verify org code ───────────────────────────────────────────────
  const verifyOrg = async () => {
    const code = orgCode.trim().toLowerCase();
    if (!code) { setError('أدخل رمز المؤسسة'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/lookup-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_code: code }),
      });
      if (!res.ok) {
        setError('رمز المؤسسة غير موجود أو غير مفعّل');
        return;
      }
      const data = await res.json();
      setOrgName(data.name);
      setOrgVerified(true);
      setStep('credentials');
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared: finalize session after successful auth ─────────────────────────
  const finalizeLogin = async (data: any, fallbackEmail?: string) => {
    persistTenantContext(data.tenant_id ?? null, data.tenant_code ?? null);

    const isWideAdmin = (data.role === 'admin' || data.role === 'founder') && !data.department_code;
    if (isWideAdmin) {
      localStorage.removeItem('launch_app');
      localStorage.removeItem('app_id');
      localStorage.removeItem('post_login_redirect');
      document.cookie = 'app_scope=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      document.cookie = 'app_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    } else {
      // P5: If no explicit launch_app was set (user came directly to /entry),
      // derive the scope from the user's department code.
      // This ensures department employees always operate in their scoped view.
      const existingScope = localStorage.getItem('launch_app');
      if (!existingScope && data.department_code) {
        const derivedScope = getPreferredAppScopeForDepartmentCode(data.department_code);
        if (derivedScope !== 'all') {
          localStorage.setItem('launch_app', derivedScope);
          const exp = new Date(Date.now() + 7 * 86400 * 1000).toUTCString();
          document.cookie = `app_scope=${encodeURIComponent(derivedScope)}; path=/; expires=${exp}; SameSite=Lax`;
        }
      }
    }

    const sessionApplied = await syncClientAuthState({
      ...data,
      email: data.email || fallbackEmail || '',
    });
    if (!sessionApplied) {
      setError('تعذر تثبيت جلسة الدخول الآمنة. حاول مرة أخرى.');
      return;
    }

    if (data.needs_bootstrap) {
      localStorage.setItem('needs_bootstrap', '1');
    } else {
      localStorage.removeItem('needs_bootstrap');
    }

    const requestedScope = isWideAdmin
      ? null
      : (localStorage.getItem('launch_app') || null);

    const homeRoute = data.needs_bootstrap
      ? '/entry/install'
      : (typeof data.home_route === 'string' && data.home_route.trim())
        ? data.home_route
        : getHomeRoute(
            (data.role ?? 'member') as UserRole,
            (data.department_code ?? null) as DepartmentCode | null,
            requestedScope,
            (data.section_id ?? null) as string | null,
          );
    window.location.href = homeRoute;
  };

  // ── Stage 2: Login with credentials ───────────────────────────────────────
  const loginWithCredentials = async () => {
    if (!username.trim()) { setError('أدخل اسم المستخدم أو البريد الإلكتروني'); return; }
    if (!password.trim()) { setError('أدخل كلمة المرور'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_code: orgCode.trim().toLowerCase(),
          username: username.trim(),
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

  // ── Stage 3: Save forced new password ─────────────────────────────────────
  const saveNewPassword = async () => {
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

      if (pendingLoginData) {
        await finalizeLogin({ ...pendingLoginData, must_change_password: false });
      } else {
        const appScope = localStorage.getItem('launch_app') || null;
        const sessionApplied = await applyServerSession(authToken, appScope);
        if (!sessionApplied) {
          setError('تعذر تثبيت جلسة الدخول الآمنة. حاول مرة أخرى.');
          return;
        }
        const role = localStorage.getItem('user_role') ?? 'employee';
        const dept = localStorage.getItem('dept_code') ?? null;
        const nextScope = localStorage.getItem('launch_app') || null;
        const home = getHomeRoute(role as UserRole, (dept as DepartmentCode | null) ?? null, nextScope);
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
      if (res.ok && data.token) { await finalizeLogin(data, data.email); return; }
    } catch { /* fallback */ }
    onDemoEnter();
  };

  // ── Step indicator dots ────────────────────────────────────────────────────
  const STEPS: LoginStep[] = ['org', 'credentials', 'change-password'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="flex flex-col w-full max-w-sm" dir="rtl">
      {/* Header */}
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

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-4 px-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i < stepIndex
                ? 'flex-1 bg-cyan-500'
                : i === stepIndex
                  ? 'flex-[2] bg-blue-400'
                  : 'flex-1 bg-slate-700'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl p-5 space-y-3.5"
          style={PANEL_STYLE}
        >
          {/* ── Stage 1: Org Code ───────────────────────────────────────── */}
          {step === 'org' && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">دخول المنصة</h3>
                <p className="text-xs text-slate-500 mt-0.5">أدخل رمز مؤسستك للمتابعة</p>
              </div>

              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="رمز المؤسسة"
                  value={orgCode}
                  autoFocus
                  onChange={e => { setOrgCode(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && verifyOrg()}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  dir="ltr"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                onClick={verifyOrg}
                disabled={loading}
                className="w-full bg-gradient-to-l from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {loading
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <ArrowRight className="w-4 h-4" />
                }
                <span>{loading ? 'جارٍ التحقق...' : 'التالي'}</span>
              </button>

              <div className="pt-1 text-center">
                <a href="/entry/request-institution" className="text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                  ليس لديك مؤسسة؟ سجّل مؤسستك
                </a>
              </div>
            </>
          )}

          {/* ── Stage 2: Credentials ────────────────────────────────────── */}
          {step === 'credentials' && (
            <>
              {/* Confirmed org banner */}
              <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 leading-none">المؤسسة</div>
                  <div className="text-sm font-semibold text-white truncate">{orgName}</div>
                </div>
                <button
                  onClick={() => { setStep('org'); setOrgVerified(false); setError(''); }}
                  className="mr-auto text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                  title="تغيير المؤسسة"
                >
                  تغيير
                </button>
              </div>

              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  ref={credInputRef}
                  type="text"
                  placeholder="اسم المستخدم أو البريد الإلكتروني"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
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
                  onKeyDown={e => e.key === 'Enter' && loginWithCredentials()}
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

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={loginWithCredentials}
                disabled={loading}
                className="w-full bg-gradient-to-l from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{loading ? 'جارٍ الدخول...' : 'دخول المنصة'}</span>
              </button>
            </>
          )}

          {/* ── Stage 3: Force-change password ──────────────────────────── */}
          {step === 'change-password' && (
            <>
              {/* Confirmed org banner */}
              <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="text-sm font-semibold text-white truncate">{orgName}</div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-amber-200">تغيير كلمة المرور</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  كلمة المرور المؤقتة مفعّلة — يرجى تعيين كلمة مرور جديدة قبل المتابعة.
                </p>
              </div>

              <input
                type="password"
                placeholder="كلمة المرور الجديدة"
                value={newPass}
                autoFocus
                onChange={e => { setNewPass(e.target.value); setError(''); }}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                dir="ltr"
              />
              <input
                type="password"
                placeholder="تأكيد كلمة المرور الجديدة"
                value={newPass2}
                onChange={e => { setNewPass2(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && saveNewPassword()}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                dir="ltr"
              />

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={saveNewPassword}
                disabled={loading}
                className="w-full bg-gradient-to-l from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور والدخول'}</span>
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

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
