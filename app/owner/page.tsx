'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, RefreshCw, LogOut, Shield, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

interface TenantRequest {
  id: string;
  organization_name: string;
  organization_type?: string;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: number;
  tenant_id?: string;
  activation_code?: string;
  provisioning_package?: TenantProvisioningPackage;
}

interface ApproveResult {
  tenant?: { code?: string; name?: string; activation_code?: string };
  first_admin?: { email?: string; username?: string; temp_password?: string };
  provisioning_package?: TenantProvisioningPackage;
}

interface ProvisionedCredential {
  full_name: string;
  role: 'dept_manager' | 'section_manager' | 'supervisor' | 'employee' | 'admin' | 'founder' | 'member';
  department_code: string;
  section_id?: string;
  section_name?: string;
  email: string;
  username: string;
  temp_password: string;
}

interface ProvisionedDepartmentBundle {
  scope: string;
  department_code: string;
  department_name: string;
  app_download_key: string;
  manager: ProvisionedCredential;
  sections: ProvisionedCredential[];
}

interface TenantProvisioningPackage {
  generated_at: number;
  generated_by: string;
  tenant_code: string;
  organization_name: string;
  bundles: ProvisionedDepartmentBundle[];
}

interface PlatformAssistant {
  id: string;
  name: string;
  email: string;
  role: 'assistant' | 'delegate';
  notes?: string;
  active: boolean;
  created_at: number;
  updated_at: number;
}

interface OwnerIdentity {
  email: string;
  role: string;
}

const TOKEN_KEY = 'platform_owner_token';
const OWNER_EMAIL_KEY = 'platform_owner_email';

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} className="ml-2 text-slate-400 hover:text-cyan-300 transition-colors" title="نسخ">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-2.5">
      <span className="text-xs text-slate-400 w-32 flex-shrink-0">{label}</span>
      <span className="font-mono text-sm text-white flex-1 text-left" dir="ltr">{value}</span>
      <CopyBtn value={value} />
    </div>
  );
}

function ProvisionCredentialCard({
  title,
  cred,
  tenantCode,
}: {
  title: string;
  cred: ProvisionedCredential;
  tenantCode?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 space-y-2">
      <div className="text-xs text-cyan-300 font-semibold">{title}</div>
      {tenantCode ? <CredRow label="رمز المؤسسة (Tenant)" value={tenantCode} /> : null}
      <CredRow label="الاسم" value={cred.full_name} />
      <CredRow label="اسم المستخدم" value={cred.username} />
      <CredRow label="كلمة المرور" value={cred.temp_password} />
      <CredRow label="البريد" value={cred.email} />
      {cred.section_id && <CredRow label="رمز القسم (Section)" value={cred.section_id} />}
    </div>
  );
}

function ProvisionBundleCard({ bundle, tenantCode }: { bundle: ProvisionedDepartmentBundle; tenantCode?: string }) {
  return (
    <details className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-cyan-200">
        {bundle.department_name} • {bundle.department_code}
      </summary>
      <div className="mt-3 space-y-3">
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          تطبيق الإدارة: <span className="font-mono text-cyan-300" dir="ltr">{bundle.app_download_key}</span>
        </div>
        <ProvisionCredentialCard title="حساب مدير الإدارة" cred={bundle.manager} tenantCode={tenantCode} />
        {bundle.sections.map((sectionCred) => (
          <ProvisionCredentialCard
            key={`${bundle.scope}-${sectionCred.section_id || sectionCred.username}`}
            title={`حساب رئيس القسم: ${sectionCred.section_name || sectionCred.section_id || sectionCred.full_name}`}
            cred={sectionCred}
            tenantCode={tenantCode}
          />
        ))}
      </div>
    </details>
  );
}

export default function OwnerApprovalsPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [ownerIdentity, setOwnerIdentity] = useState<OwnerIdentity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotStep, setForgotStep] = useState<0 | 1 | 2 | 3>(0); // 0=hidden 1=email 2=otp 3=newpass
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [assistants, setAssistants] = useState<PlatformAssistant[]>([]);
  const [assistantName, setAssistantName] = useState('');
  const [assistantEmail, setAssistantEmail] = useState('');
  const [assistantRole, setAssistantRole] = useState<'assistant' | 'delegate'>('assistant');
  const [assistantNotes, setAssistantNotes] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantActionId, setAssistantActionId] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [lastApprove, setLastApprove] = useState<ApproveResult | null>(null);
  const [approvedName, setApprovedName] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'assistants'>('pending');

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY) || '';
    const savedEmail = localStorage.getItem(OWNER_EMAIL_KEY) || '';
    if (savedToken) setToken(savedToken);
    if (savedEmail) setOwnerIdentity({ email: savedEmail, role: 'super_admin' });
  }, []);

  const pendingRequests = useMemo(
    () => requests.filter(item => item.status === 'pending'),
    [requests]
  );

  const visibleRequests = useMemo(
    () => (activeTab === 'all' ? requests : pendingRequests),
    [activeTab, pendingRequests, requests]
  );

  const loadRequests = async (accessToken: string) => {
    setListLoading(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/tenant-requests', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر تحميل الطلبات'); return; }
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setListLoading(false);
    }
  };

  const loadOwnerIdentity = async (accessToken: string) => {
    try {
      const res = await fetch('/api/owner/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data?.owner) {
        setOwnerIdentity(data.owner);
        localStorage.setItem(OWNER_EMAIL_KEY, data.owner.email || email.trim().toLowerCase());
      }
    } catch {
      setOwnerIdentity(null);
    }
  };

  const loadAssistants = async (accessToken: string) => {
    try {
      const res = await fetch('/api/owner/assistants', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) return;
      setAssistants(Array.isArray(data.assistants) ? data.assistants : []);
    } catch {
      setAssistants([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadOwnerIdentity(token);
    void loadRequests(token);
    void loadAssistants(token);
  }, [token]);

  const loginOwner = async () => {
    if (!email.trim()) return setError('أدخل إيميل المالك');
    if (!password.trim()) return setError('أدخل كلمة المرور');
    setLoading(true); setError('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'فشل دخول المالك'); return; }
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(OWNER_EMAIL_KEY, normalizedEmail);
      setToken(data.token);
      setOwnerIdentity({ email: normalizedEmail, role: 'super_admin' });
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const logoutOwner = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OWNER_EMAIL_KEY);
    setToken('');
    setOwnerIdentity(null);
    setRequests([]);
    setAssistants([]);
    setLastApprove(null);
    setApprovedName('');
  };

  const sendForgotCode = async () => {
    if (!forgotEmail.trim()) { setForgotError('أدخل بريدك الإلكتروني'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setForgotError(data?.detail || 'تعذر إرسال الرمز'); return; }
      setForgotStep(2);
      setForgotMessage('تم إرسال رمز التحقق إلى بريدك. أدخله هنا.');
    } catch {
      setForgotError('تعذر الاتصال بالخادم');
    } finally {
      setForgotLoading(false);
    }
  };

  const verifyForgotCode = () => {
    if (!forgotOtp.trim() || forgotOtp.length < 4) { setForgotError('أدخل الرمز الذي وصلك على بريدك'); return; }
    setForgotError('');
    setForgotStep(3);
    setForgotMessage('');
  };

  const submitForgotPassword = async () => {
    if (!forgotNewPass || forgotNewPass.length < 8) { setForgotError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (forgotNewPass !== forgotConfirmPass) { setForgotError('كلمتا المرور غير متطابقتين'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          code: forgotOtp.trim(),
          new_password: forgotNewPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data?.detail || 'تعذر إعادة التعيين');
        if (data?.code === 'expired' || data?.code === 'invalid_code') setForgotStep(2);
        return;
      }
      setForgotStep(0);
      setForgotMessage('');
      setPassword('');
      setError('تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.');
    } catch {
      setForgotError('تعذر الاتصال بالخادم');
    } finally {
      setForgotLoading(false);
    }
  };

  const approveRequest = async (req: TenantRequest) => {
    if (!token) return setError('سجل دخولك كمالك أولاً');
    setActionLoadingId(req.id); setError(''); setLastApprove(null);
    try {
      const res = await fetch(`/api/onboarding/tenant-requests/${req.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر اعتماد الطلب'); return; }
      setLastApprove({
        tenant: data.tenant,
        first_admin: data.first_admin,
        provisioning_package: data.provisioning_package,
      });
      setApprovedName(req.organization_name);
      await loadRequests(token);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setActionLoadingId('');
    }
  };

  const rejectRequest = async (requestId: string) => {
    if (!token) return setError('سجل دخولك كمالك أولاً');
    setActionLoadingId(requestId); setError('');
    try {
      const res = await fetch(`/api/onboarding/tenant-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ review_notes: 'تم الرفض من بوابة مالك المنصة' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر رفض الطلب'); return; }
      await loadRequests(token);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setActionLoadingId('');
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!token) return setError('سجل دخولك كمالك أولاً');
    if (!confirm('هل تريد حذف هذا الطلب نهائياً؟')) return;
    setActionLoadingId(requestId); setError('');
    try {
      const res = await fetch(`/api/onboarding/tenant-requests/${requestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر حذف الطلب'); return; }
      await loadRequests(token);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setActionLoadingId('');
    }
  };

  const addAssistant = async () => {
    if (!token) return setError('سجل دخولك كمالك أولاً');
    if (!assistantName.trim()) return setError('أدخل اسم المساعد');
    if (!assistantEmail.trim()) return setError('أدخل بريد المساعد');
    setAssistantLoading(true);
    setError('');
    try {
      const res = await fetch('/api/owner/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: assistantName,
          email: assistantEmail,
          role: assistantRole,
          notes: assistantNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر إضافة المساعد'); return; }
      setAssistants((current) => [data.assistant, ...current]);
      setAssistantName('');
      setAssistantEmail('');
      setAssistantRole('assistant');
      setAssistantNotes('');
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setAssistantLoading(false);
    }
  };

  const toggleAssistant = async (assistant: PlatformAssistant) => {
    if (!token) return setError('سجل دخولك كمالك أولاً');
    setAssistantActionId(assistant.id);
    setError('');
    try {
      const res = await fetch(`/api/owner/assistants/${assistant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !assistant.active }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر تحديث حالة المساعد'); return; }
      setAssistants((current) => current.map((item) => item.id === assistant.id ? data.assistant : item));
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setAssistantActionId('');
    }
  };

  const removeAssistant = async (assistantId: string) => {
    if (!token) return setError('سجل دخولك كمالك أولاً');
    if (!confirm('هل تريد حذف هذا المساعد نهائياً؟')) return;
    setAssistantActionId(assistantId);
    setError('');
    try {
      const res = await fetch(`/api/owner/assistants/${assistantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'تعذر حذف المساعد'); return; }
      setAssistants((current) => current.filter((item) => item.id !== assistantId));
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setAssistantActionId('');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white" dir="rtl" style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc' }}>
      <section className="mx-auto max-w-3xl px-5 py-10 space-y-6">

        {/* Header */}
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)]">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">بوابة مالك المنصة</h1>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">workspace مستقل</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">إدارة المساعدين والطلبات والصلاحيات من حساب المالك نفسه</p>
            </div>
            {token && (
              <button onClick={logoutOwner} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                <LogOut className="w-3.5 h-3.5" /> خروج
              </button>
            )}
          </div>
          {token && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="text-[11px] text-slate-500">الحساب النشط</div>
                <div className="mt-1 text-sm font-medium" dir="ltr">{ownerIdentity?.email || email}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="text-[11px] text-slate-500">الدور</div>
                <div className="mt-1 text-sm font-medium">{ownerIdentity?.role || 'super_admin'}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="text-[11px] text-slate-500">المساعدون</div>
                <div className="mt-1 text-sm font-medium">{assistants.length} نشط/مسجل</div>
              </div>
            </div>
          )}
        </div>

        {/* Login form */}
        {!token && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-200">دخول المالك</h2>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="الإيميل" dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loginOwner()}
              placeholder="كلمة المرور" dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition-colors" />

            {forgotStep === 0 && (
              <button
                type="button"
                onClick={() => { setForgotStep(1); setForgotEmail(email); setForgotError(''); setForgotMessage(''); }}
                className="text-xs text-violet-300 hover:text-violet-200 transition-colors underline underline-offset-2"
              >
                نسيت كلمة السر؟
              </button>
            )}

            {forgotStep >= 1 && (
              <div className="rounded-xl border border-violet-500/35 bg-violet-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-violet-200">استرجاع كلمة السر</p>
                  <button onClick={() => { setForgotStep(0); setForgotError(''); setForgotMessage(''); }} className="text-xs text-slate-500 hover:text-slate-300">إلغاء</button>
                </div>

                {/* خطوة 1: البريد */}
                {forgotStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">أدخل بريدك الشخصي المرتبط بحساب المالك وسنرسل لك رمز التحقق.</p>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                      onKeyDown={e => e.key === 'Enter' && sendForgotCode()}
                      placeholder="البريد الإلكتروني"
                      dir="ltr"
                      autoFocus
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <button onClick={sendForgotCode} disabled={forgotLoading}
                      className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 py-2.5 text-sm font-semibold transition-colors">
                      {forgotLoading ? 'جار الإرسال...' : 'إرسال رمز التحقق على البريد'}
                    </button>
                  </div>
                )}

                {/* خطوة 2: رمز OTP */}
                {forgotStep === 2 && (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
                      ✅ تم إرسال الرمز إلى <strong dir="ltr">{forgotEmail}</strong> — تحقق من بريدك الوارد.
                    </div>
                    <p className="text-xs text-slate-300 font-medium">أدخل الرمز الذي وصلك على بريدك هنا:</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={forgotOtp}
                      onChange={e => { setForgotOtp(e.target.value.replace(/\D/g, '')); setForgotError(''); }}
                      onKeyDown={e => e.key === 'Enter' && verifyForgotCode()}
                      placeholder="أدخل الرمز المرسل للبريد"
                      dir="ltr"
                      autoFocus
                      className="w-full rounded-xl border-2 border-violet-500/50 bg-slate-800/70 px-4 py-3 text-base text-white text-center tracking-[0.35em] font-mono focus:outline-none focus:border-violet-400 transition-colors"
                    />
                    <button onClick={verifyForgotCode}
                      className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-semibold transition-colors">
                      تأكيد الرمز والمتابعة
                    </button>
                    <button onClick={() => { setForgotStep(1); setForgotOtp(''); setForgotError(''); }} className="w-full text-xs text-slate-500 hover:text-slate-300">
                      إعادة إرسال الرمز
                    </button>
                  </div>
                )}

                {/* خطوة 3: كلمة المرور الجديدة */}
                {forgotStep === 3 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300 font-medium">أدخل كلمة المرور الجديدة:</p>
                    <input
                      type="password"
                      value={forgotNewPass}
                      onChange={e => { setForgotNewPass(e.target.value); setForgotError(''); }}
                      placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)"
                      dir="ltr"
                      autoFocus
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <input
                      type="password"
                      value={forgotConfirmPass}
                      onChange={e => { setForgotConfirmPass(e.target.value); setForgotError(''); }}
                      onKeyDown={e => e.key === 'Enter' && submitForgotPassword()}
                      placeholder="تأكيد كلمة المرور"
                      dir="ltr"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button onClick={submitForgotPassword} disabled={forgotLoading}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 py-2.5 text-sm font-semibold transition-colors">
                      {forgotLoading ? 'جار الحفظ...' : 'حفظ كلمة المرور الجديدة'}
                    </button>
                  </div>
                )}

                {forgotError && <p className="text-xs text-rose-400 mt-1">{forgotError}</p>}
                {forgotMessage && forgotStep === 2 && <p className="text-xs text-emerald-400 mt-1">{forgotMessage}</p>}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={loginOwner} disabled={loading}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 py-3 font-semibold transition-colors">
              {loading ? 'جارٍ الدخول...' : 'دخول'}
            </button>
          </div>
        )}

        {token && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${activeTab === 'pending' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/25' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>
                الطلبات المعلقة
              </button>
              <button onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${activeTab === 'all' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/25' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>
                كل الطلبات
              </button>
              <button onClick={() => setActiveTab('assistants')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${activeTab === 'assistants' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/25' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`}>
                المساعدون
              </button>
            </div>
          </div>
        )}

        {token && activeTab === 'assistants' && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">إدارة المساعدين</h2>
                <p className="text-xs text-slate-400">أضف مساعدين أو مفوضين بصلاحيات واضحة داخل مساحة المالك</p>
              </div>
              <button onClick={() => loadAssistants(token)} className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors">
                <RefreshCw className="w-3 h-3" /> تحديث
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder="اسم المساعد" className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors" />
              <input value={assistantEmail} onChange={e => setAssistantEmail(e.target.value)} placeholder="البريد الإلكتروني" dir="ltr" className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors" />
              <select value={assistantRole} onChange={e => setAssistantRole(e.target.value as 'assistant' | 'delegate')} className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors">
                <option value="assistant">مساعد</option>
                <option value="delegate">مفوّض</option>
              </select>
              <input value={assistantNotes} onChange={e => setAssistantNotes(e.target.value)} placeholder="ملاحظات اختيارية" className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>
            <button onClick={addAssistant} disabled={assistantLoading} className="rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold transition-colors">
              {assistantLoading ? 'جار الإضافة...' : 'إضافة المساعد'}
            </button>

            <div className="space-y-3">
              {assistants.length === 0 && <p className="text-sm text-slate-500 text-center py-6">لا يوجد مساعدون بعد</p>}
              {assistants.map((assistant) => (
                <div key={assistant.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{assistant.name}</div>
                      <div className="text-xs text-slate-400" dir="ltr">{assistant.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${assistant.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                      {assistant.active ? 'نشط' : 'موقوف'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">{assistant.role === 'delegate' ? 'مفوّض' : 'مساعد'}</span>
                    {assistant.notes && <span>{assistant.notes}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleAssistant(assistant)} disabled={assistantActionId === assistant.id} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-60 transition-colors">
                      {assistant.active ? 'إيقاف' : 'تفعيل'}
                    </button>
                    <button onClick={() => removeAssistant(assistant.id)} disabled={assistantActionId === assistant.id} className="rounded-lg border border-rose-700/50 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-60 transition-colors">
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success: credentials after approval */}
        {lastApprove?.first_admin && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-emerald-300 text-base">تم اعتماد: {approvedName}</h3>
            </div>
            <p className="text-xs text-slate-400">احفظ هذه البيانات وأرسلها لمدير المؤسسة — لن تظهر مرة أخرى.</p>
            <div className="space-y-2">
              <CredRow label="رمز المؤسسة" value={lastApprove.tenant?.code || ''} />
              {lastApprove.tenant?.activation_code && (
                <CredRow label="كود التفعيل" value={lastApprove.tenant.activation_code} />
              )}
              <CredRow label="اسم المستخدم" value={lastApprove.first_admin.username || ''} />
              <CredRow label="كلمة المرور المؤقتة" value={lastApprove.first_admin.temp_password || ''} />
              <CredRow label="البريد الإلكتروني" value={lastApprove.first_admin.email || ''} />
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <p>📋 <strong>تعليمات الدخول الأول:</strong></p>
              <p>١. افتح <span className="font-mono text-cyan-400">dev.d-me.ly/entry</span></p>
              <p>٢. أدخل رمز المؤسسة واسم المستخدم وكلمة المرور المؤقتة</p>
              <p>🔑 <strong>لتفعيل التطبيق المكتبي:</strong> أدخل "رمز المؤسسة" في خانة المؤسسة، و"كود التفعيل" في خانة الكود</p>
              <p>٣. سيُطلب منك تغيير كلمة المرور فوراً</p>
              <p>٤. بعد التغيير ستنتقل لمعالج إعداد المنظومة</p>
            </div>

            {lastApprove.provisioning_package?.bundles?.length ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-cyan-200">حسابات الإدارات والأقسام (توليد مركزي)</div>
                <p className="text-xs text-slate-400">
                  انسخ فقط الإدارة المتعاقد عليها وأرسلها للمؤسسة. يمكن العودة لهذه البيانات لاحقًا من بطاقة المؤسسة المعتمدة.
                </p>
                {lastApprove.provisioning_package.bundles.map((bundle) => (
                  <ProvisionBundleCard key={`approve-${bundle.scope}`} bundle={bundle} tenantCode={lastApprove.provisioning_package?.tenant_code} />
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Error */}
        {error && token && (
          <div className="rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 p-3 text-sm">{error}</div>
        )}

        {/* Requests list */}
        {token && activeTab !== 'assistants' && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-100">{activeTab === 'pending' ? 'الطلبات المعلقة' : 'كل الطلبات'}</h2>
                <p className="text-xs text-slate-400">من هنا تدير إدخال وإخراج طلبات المنصة واعتماد المؤسسات</p>
              </div>
              <button onClick={() => loadRequests(token)} disabled={listLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-60 transition-colors">
                <RefreshCw className={`w-3 h-3 ${listLoading ? 'animate-spin' : ''}`} />
                تحديث
              </button>
            </div>

            {!listLoading && visibleRequests.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6">لا توجد طلبات</p>
            )}

            <div className="space-y-3">
              {visibleRequests.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">اسم المؤسسة</div>
                      <div className="text-white font-medium">{item.organization_name}</div>
                    </div>
                    <div className="flex items-start justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                        item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-rose-500/20 text-rose-300'
                      }`}>
                        {item.status === 'pending' ? 'معلق' : item.status === 'approved' ? 'معتمد' : 'مرفوض'}
                      </span>
                    </div>
                    {item.organization_type && (
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">النوع</div>
                        <div className="text-slate-300">{item.organization_type}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">جهة التواصل</div>
                      <div className="text-slate-300">{item.contact_full_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">الهاتف</div>
                      <div className="text-slate-300 font-mono" dir="ltr">{item.contact_phone}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-slate-500 mb-0.5">البريد الإلكتروني</div>
                      <div className="text-slate-300 font-mono" dir="ltr">{item.contact_email}</div>
                    </div>
                    {item.notes && (
                      <div className="col-span-2">
                        <div className="text-xs text-slate-500 mb-0.5">ملاحظات</div>
                        <div className="text-slate-400 text-xs">{item.notes}</div>
                      </div>
                    )}
                  </div>

                  {item.status === 'approved' && item.activation_code && (
                    <div className="col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 space-y-2">
                      <div className="text-xs text-emerald-400 font-semibold">بيانات التفعيل — للاستخدام في التطبيق</div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">رمز المؤسسة</div>
                          <div className="font-mono text-sm text-white" dir="ltr">{item.activation_code?.split('-').slice(0,2).join('-')}</div>
                        </div>
                        <CopyBtn value={item.activation_code?.split('-').slice(0,2).join('-') ?? ''} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">كود التفعيل الكامل</div>
                          <div className="font-mono text-sm text-emerald-300 font-bold" dir="ltr">{item.activation_code}</div>
                        </div>
                        <CopyBtn value={item.activation_code ?? ''} />
                      </div>
                    </div>
                  )}

                  {item.status === 'approved' && !item.activation_code && (
                    <div className="col-span-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
                      كود التفعيل غير متوفر — أُنشئ قبل تحديث النظام. اطلب إعادة اعتماد الطلب لتوليد كود جديد.
                    </div>
                  )}

                  {item.status === 'approved' && item.provisioning_package?.bundles?.length ? (
                    <div className="col-span-2 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 space-y-3">
                      <div className="text-xs text-cyan-300 font-semibold">حسابات الإدارات والأقسام (تسليم مركزي)</div>
                      <p className="text-[11px] text-slate-400">
                        انسخ فقط الإدارات المتعاقد عليها لهذه المؤسسة. التوسعة لاحقًا تتم من نفس البطاقة بدون إنشاء Tenant جديد.
                      </p>
                      {item.provisioning_package.bundles.map((bundle) => (
                        <ProvisionBundleCard key={`${item.id}-${bundle.scope}`} bundle={bundle} tenantCode={item.provisioning_package?.tenant_code} />
                      ))}
                    </div>
                  ) : null}

                  {item.status === 'pending' ? (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => approveRequest(item)} disabled={actionLoadingId === item.id}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 py-2.5 text-sm font-semibold transition-colors">
                        <CheckCircle2 className="w-4 h-4" />
                        {actionLoadingId === item.id ? 'جارٍ...' : 'اعتماد المؤسسة'}
                      </button>
                      <button onClick={() => rejectRequest(item.id)} disabled={actionLoadingId === item.id}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-700 hover:bg-rose-700 disabled:opacity-60 py-2.5 text-sm font-semibold transition-colors">
                        <XCircle className="w-4 h-4" />
                        رفض
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end pt-1">
                      <button onClick={() => deleteRequest(item.id)} disabled={actionLoadingId === item.id}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-rose-600 hover:text-rose-400 text-slate-400 px-3 py-1.5 text-xs transition-colors disabled:opacity-60">
                        <Trash2 className="w-3.5 h-3.5" />
                        {actionLoadingId === item.id ? 'جارٍ...' : 'حذف الطلب'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
