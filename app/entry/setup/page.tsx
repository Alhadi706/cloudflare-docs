'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ZapOff, Wrench, Building2, Wallet, Warehouse, Brain, Laptop2,
  ChevronRight, ChevronLeft, CheckCircle2, Key, Plus, Link2,
  Copy, Check, Send, Clock, XCircle,
} from 'lucide-react';

const DEPTS = [
  { key: 'corrosion',    name: 'إدارة التآكل',      icon: ZapOff,    color: 'text-orange-400', border: 'border-orange-500/40',  bg: 'bg-orange-950/30' },
  { key: 'maintenance',  name: 'الصيانة والمشاريع', icon: Wrench,    color: 'text-rose-400',   border: 'border-rose-500/40',    bg: 'bg-rose-950/30'   },
  { key: 'adminaffairs', name: 'الشؤون الإدارية',   icon: Building2, color: 'text-blue-400',   border: 'border-blue-500/40',    bg: 'bg-blue-950/30'   },
  { key: 'finance',      name: 'المالية',            icon: Wallet,    color: 'text-amber-400',  border: 'border-amber-500/40',   bg: 'bg-amber-950/30'  },
  { key: 'materials',    name: 'إدارة المواد',       icon: Warehouse, color: 'text-teal-400',   border: 'border-teal-500/40',    bg: 'bg-teal-950/30'   },
  { key: 'services',     name: 'الذكاء والخدمات',   icon: Brain,     color: 'text-fuchsia-400',border: 'border-fuchsia-500/40', bg: 'bg-fuchsia-950/30'},
] as const;

type DeptKey = (typeof DEPTS)[number]['key'];
type Mode = 'new' | 'join';
type PendingState = { poll_token: string; tenant_name: string };

function getDeptByKey(k: string) { return DEPTS.find(d => d.key === k) ?? null; }

function deptToScope(dept: DeptKey | '' | null | undefined): string {
  if (!dept) return 'all';
  if (dept === 'adminaffairs') return 'admin-affairs';
  return dept;
}

function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
      <input
        {...props}
        className={`w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white [color-scheme:dark] placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 ${props.className ?? ''}`}
      />
    </div>
  );
}

function SetupContent() {
  const params  = useSearchParams();
  const urlDept = params.get('dept') ?? '';

  const [step,          setStep]         = useState<1 | 2 | 3>(1);
  const [dept,          setDept]         = useState<DeptKey | ''>(getDeptByKey(urlDept) ? (urlDept as DeptKey) : '');
  const [serverUrl,     setServerUrl]    = useState('https://dev.d-me.ly');
  const [mode,          setMode]         = useState<Mode>('new');

  // new org fields
  const [orgName,       setOrgName]      = useState('');
  const [adminEmail,    setAdminEmail]   = useState('');
  const [adminName,     setAdminName]    = useState('');
  const [tgToken,       setTgToken]      = useState('');
  const [tgChatId,      setTgChatId]     = useState('');
  const [showTg,        setShowTg]       = useState(false);

  // join fields
  const [tenantCode,    setTenantCode]   = useState('');
  const [joinName,      setJoinName]     = useState('');
  const [joinEmail,     setJoinEmail]    = useState('');

  // state
  const [loading,       setLoading]      = useState(false);
  const [error,         setError]        = useState('');
  const [copied,        setCopied]       = useState(false);
  const [result,        setResult]       = useState<{ tenantCode: string; tenantId: string; username: string; tempPassword: string } | null>(null);
  const [pending,       setPending]      = useState<PendingState | null>(null);
  const [pollStatus,    setPollStatus]   = useState<'polling' | 'approved' | 'rejected'>('polling');
  const [approvedCreds, setApprovedCreds] = useState<{ email: string; temp_password: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;

  // ── Polling for approval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!pending) return;
    const url = serverUrl.trim().replace(/\/$/, '');

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${url}/api/auth/setup/approval-status?token=${pending.poll_token}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'approved') {
          clearInterval(pollRef.current!);
          setPollStatus('approved');
          setApprovedCreds({ email: d.email, temp_password: d.temp_password });
        } else if (d.status === 'rejected') {
          clearInterval(pollRef.current!);
          setPollStatus('rejected');
        }
      } catch { /* retry on next tick */ }
    }, 15000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pending, serverUrl]);

  function finishSetup(code: string, tenantId?: string, name?: string) {
    const resolvedName = name || orgName || code;
    if (isElectron) {
      const activation = {
        tenant_id: tenantId || code, tenant_code: code,
        organization_name: resolvedName, app: 'electron', activated_at: Date.now(),
      };
      localStorage.setItem('device_activation:electron', JSON.stringify(activation));
      localStorage.setItem('tenant_code', code);
      localStorage.setItem('active_tenant_code', code);
      if (tenantId) { localStorage.setItem('tenant_id', tenantId); localStorage.setItem('active_tenant_id', tenantId); }
      if (resolvedName) localStorage.setItem('org_name', resolvedName);
      (window as any).electronAPI.completeSetup({ dept, tenantCode: code, serverUrl });
    } else {
      const app = encodeURIComponent(deptToScope(dept));
      window.location.href = `/entry?app=${app}`;
    }
  }

  async function createOrg() {
    setError(''); setLoading(true);
    const url = serverUrl.trim().replace(/\/$/, '');
    try {
      const res = await fetch(`${url}/api/auth/setup/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: orgName, admin_name: adminName, admin_email: adminEmail, dept,
          ...(tgToken.trim()  ? { telegram_bot_token: tgToken.trim() } : {}),
          ...(tgChatId.trim() ? { telegram_admin_chat_id: tgChatId.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'خطأ في الإنشاء');
      setResult({ tenantCode: data.code, tenantId: data.tenant?.id || '', username: data.admin.username, tempPassword: data.admin.temp_password });
      setStep(3);
    } catch (e: any) {
      setError(e.message === 'Failed to fetch' ? `تعذّر الوصول للخادم (${url})` : e.message);
    } finally { setLoading(false); }
  }

  async function joinOrg() {
    setError(''); setLoading(true);
    const url = serverUrl.trim().replace(/\/$/, '');
    try {
      const res = await fetch(`${url}/api/auth/setup/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_code: tenantCode.trim().toUpperCase(), full_name: joinName.trim(), email: joinEmail.trim(), dept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'كود الربط غير صحيح');
      setPending({ poll_token: data.poll_token, tenant_name: data.tenant?.name || '' });
      setStep(3);
      // أبلغ Electron بالـ poll_token ليبقى يستطلع حتى لو أُعيد تشغيل التطبيق
      if (isElectron) {
        (window as any).electronAPI.completeSetup({
          dept, tenantCode: tenantCode.trim().toUpperCase(), serverUrl,
          pollToken: data.poll_token,
        });
      }
    } catch (e: any) {
      setError(e.message === 'Failed to fetch' ? `تعذّر الوصول للخادم (${url})` : e.message);
    } finally { setLoading(false); }
  }

  function copyCode(txt: string) {
    navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const selectedDept = getDeptByKey(dept);

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a0f] text-white flex flex-col select-none">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-black/20">
        <div className="flex items-center gap-2">
          <Laptop2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white/80">
            DSF Gateway{selectedDept ? ` — ${selectedDept.name}` : ''}
          </span>
        </div>
        {isElectron && (
          <div className="flex items-center gap-1">
            <button onClick={() => (window as any).electronAPI?.minimize?.()} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400" />
            <button onClick={() => (window as any).electronAPI?.close?.()} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400" />
          </div>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 py-4 px-5">
        {([1, 2, 3] as const).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all
              ${step === s ? 'bg-indigo-600 border-indigo-400 text-white' :
                step > s   ? 'bg-indigo-900/60 border-indigo-600/40 text-indigo-300' :
                             'bg-white/5 border-white/15 text-slate-500'}`}>
              {step > s ? <Check className="w-3 h-3" /> : s}
            </div>
            {s < 3 && <div className={`w-10 h-px transition-colors ${step > s ? 'bg-indigo-600/50' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">

        {/* ── Step 1: Choose dept + server ─────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">الإعداد الأول</h2>
              <p className="text-xs text-slate-400 mt-0.5">اختر الإدارة المشتراة ثم أدخل عنوان الخادم</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEPTS.map(d => {
                const Icon = d.icon;
                return (
                  <button key={d.key} onClick={() => setDept(d.key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all
                      ${dept === d.key ? `${d.border} ${d.bg} ${d.color}` : 'border-white/10 bg-white/4 text-slate-400 hover:border-white/20 hover:text-white'}`}>
                    <Icon className="w-4 h-4" /> {d.name}
                  </button>
                );
              })}
            </div>
            <Input label="عنوان خادم DSF" dir="ltr" type="url" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://dev.d-me.ly" />
            <p className="text-[11px] text-slate-500">يُزوّدك به مزوّد الخدمة</p>
            <button disabled={!dept || !serverUrl.trim()} onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
              التالي <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: New org or join ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-bold text-white">ربط المؤسسة</h2>
                <p className="text-xs text-slate-400">مؤسسة جديدة أم ربط بمؤسسة موجودة؟</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { m: 'new' as Mode, icon: Plus, label: 'مؤسسة جديدة', sub: 'اشتريت النظام لأول مرة', color: 'indigo' },
                { m: 'join' as Mode, icon: Link2, label: 'مؤسسة موجودة', sub: 'لديك كود الربط', color: 'emerald' },
              ].map(({ m, icon: Icon, label, sub, color }) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all text-center
                    ${mode === m
                      ? color === 'indigo' ? 'border-indigo-500/50 bg-indigo-950/40 text-indigo-300'
                                           : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                      : 'border-white/10 bg-white/4 text-slate-400 hover:border-white/20'}`}>
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-[10px] opacity-70">{sub}</span>
                </button>
              ))}
            </div>

            {mode === 'new' && (
              <div className="space-y-3">
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="اسم المؤسسة *" />
                <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="اسم مدير النظام *" />
                <Input type="email" dir="ltr" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="البريد الإلكتروني *" />

                {/* Telegram optional */}
                <button onClick={() => setShowTg(!showTg)} className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  <Send className="w-3 h-3" />
                  {showTg ? 'إخفاء إعدادات تيليغرام' : 'إضافة بوت تيليغرام (اختياري)'}
                </button>
                {showTg && (
                  <div className="space-y-2 bg-slate-900/40 rounded-xl p-3 border border-slate-700/50">
                    <p className="text-[11px] text-slate-400">ستصلك إشعارات عند طلب انضمام مدير جديد</p>
                    <Input dir="ltr" value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="Bot Token (من @BotFather)" />
                    <Input dir="ltr" value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="Chat ID (من @userinfobot)" />
                  </div>
                )}
              </div>
            )}

            {mode === 'join' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Key className="w-3 h-3" /> كود الربط *
                  </label>
                  <input
                    dir="ltr"
                    value={tenantCode}
                    onChange={e => setTenantCode(e.target.value.toUpperCase())}
                    placeholder="XK-48219"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white [color-scheme:dark] font-mono placeholder-slate-500 tracking-widest focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <Input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="اسمك الكامل *" />
                <Input type="email" dir="ltr" value={joinEmail} onChange={e => setJoinEmail(e.target.value)} placeholder="بريدك الإلكتروني *" />
                <div className="flex items-start gap-2 bg-amber-950/20 border border-amber-500/20 rounded-xl p-3">
                  <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-300/80">بعد الإرسال ستنتظر موافقة مالك المؤسسة. يبقى التطبيق مفتوحاً تلقائياً حتى تصل الموافقة.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-500/30 rounded-xl px-3 py-2">{error}</div>
            )}

            <button
              disabled={loading || (mode === 'new' ? !orgName || !adminEmail || !adminName : !tenantCode || !joinName || !joinEmail)}
              onClick={mode === 'new' ? createOrg : joinOrg}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
              {loading ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ...</>
              ) : mode === 'new' ? 'إنشاء المؤسسة' : 'إرسال طلب الانضمام'}
            </button>
          </div>
        )}

        {/* ── Step 3A: New org success ──────────────────────────────────────── */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-base font-bold text-white">تمّ إنشاء المؤسسة</h2>
              <p className="text-xs text-slate-400 mt-1">احفظ الكود وبيانات الدخول قبل المتابعة</p>
            </div>
            {/* Tenant code */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-indigo-300 font-medium">كود الربط — شاركه لإضافة إدارات أخرى لاحقاً</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-2xl font-black text-white tracking-widest text-center py-1">{result.tenantCode}</code>
                <button onClick={() => copyCode(result.tenantCode)} className="p-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-300" />}
                </button>
              </div>
            </div>
            {/* Credentials */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-2.5 text-sm">
              <p className="text-xs text-slate-400 font-medium">بيانات الدخول الأولية</p>
              {[['اسم المستخدم', result.username, 'text-white'], ['كلمة السر المؤقتة', result.tempPassword, 'text-amber-300']].map(([lbl, val, cls]) => (
                <div key={lbl} className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">{lbl}</span>
                  <code className={`font-mono text-xs ${cls}`}>{val}</code>
                </div>
              ))}
            </div>
            <button onClick={() => finishSetup(result.tenantCode, result.tenantId)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
              <CheckCircle2 className="w-4 h-4" /> الانتقال لشاشة الدخول
            </button>
          </div>
        )}

        {/* ── Step 3B: Pending approval ─────────────────────────────────────── */}
        {step === 3 && pending && pollStatus === 'polling' && (
          <div className="space-y-5 text-center">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Clock className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">في انتظار الموافقة</h2>
              <p className="text-xs text-slate-400 mt-1">
                تم إرسال طلبك إلى مالك <span className="text-white font-medium">{pending.tenant_name}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">سيتم تحديث الحالة تلقائياً كل 15 ثانية</p>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-400 text-right space-y-1.5">
              <p>📋 ابقِ التطبيق مفتوحاً — ستظهر الموافقة هنا فور وصولها</p>
              <p>📬 إذا كان مالك المؤسسة مُعدّ البوت ستصله إشعار تيليغرام</p>
            </div>
          </div>
        )}

        {/* ── Step 3B: Approved ─────────────────────────────────────────────── */}
        {step === 3 && pending && pollStatus === 'approved' && approvedCreds && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-base font-bold text-white">تمت الموافقة!</h2>
              <p className="text-xs text-slate-400 mt-1">يمكنك الآن الدخول وبدء العمل</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-2.5 text-sm">
              <p className="text-xs text-slate-400 font-medium">بيانات الدخول</p>
              {[['البريد الإلكتروني', approvedCreds.email, 'text-white'], ['كلمة السر المؤقتة', approvedCreds.temp_password, 'text-amber-300']].map(([lbl, val, cls]) => (
                <div key={lbl} className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">{lbl}</span>
                  <code className={`font-mono text-xs ${cls}`}>{val}</code>
                </div>
              ))}
            </div>
            <button onClick={() => finishSetup(tenantCode, undefined, pending.tenant_name)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
              <CheckCircle2 className="w-4 h-4" /> الانتقال لشاشة الدخول
            </button>
          </div>
        )}

        {/* ── Step 3B: Rejected ─────────────────────────────────────────────── */}
        {step === 3 && pending && pollStatus === 'rejected' && (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">تم رفض الطلب</h2>
              <p className="text-xs text-slate-400 mt-1">تواصل مع مالك المؤسسة للمزيد من المعلومات</p>
            </div>
            <button onClick={() => { setPending(null); setPollStatus('polling'); setStep(2); setError(''); }}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-bold transition-colors">
              المحاولة مجدداً
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}
