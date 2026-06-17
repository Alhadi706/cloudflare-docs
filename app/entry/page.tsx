'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  Building2,
  CheckCircle2,
  Fingerprint,
  Layers3,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Workflow,
} from 'lucide-react';
import LoginPanel from '@/components/auth/LoginPanel';
import { clearServerSession, syncClientAuthState } from '@/lib/client-auth-session';
import { canAccessPathForScope, normalizeAppScope } from '@/lib/appScope';

type IPE = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
declare global { interface Window { __dsfInstallPrompt?: IPE | null; } }

const CAPABILITY_CARDS = [
  {
    title: 'إدارة تشغيلية موحدة',
    text: 'تابع العمليات اليومية من مركز واحد: فرق العمل، المهام، الحالات، والتنبيهات الحرجة لحظيًا.',
    icon: Workflow,
  },
  {
    title: 'أمن وصلاحيات متعددة المستويات',
    text: 'تحكم كامل بهيكل الصلاحيات حسب المؤسسة والإدارة والدور مع مسارات تدقيق واضحة.',
    icon: ShieldCheck,
  },
  {
    title: 'رقمنة الأصول والاستخبارات',
    text: 'ربط بيانات الأصول بالخرائط والميدان والتحليلات لاستخراج قرارات أسرع ودقيقة.',
    icon: Layers3,
  },
  {
    title: 'هوية سيادية قابلة للتوسع',
    text: 'منصة مصممة لبيئات حساسة وتوسّع مؤسسي عالي مع مرونة تشغيل متعددة الكيانات.',
    icon: Fingerprint,
  },
];

const KPI_ITEMS = [
  { label: 'مؤسسة/كيان', value: '+120' },
  { label: 'وحدة تشغيل', value: '+36' },
  { label: 'مؤشر مراقبة', value: '+1.8M' },
];

export default function EntryPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appFromQuery = params.get('app');  // App ID from download link
    const scopeFromQuery = params.get('scope');  // Explicit scope override (for sections)
    
    // Determine the final scope to activate
    const finalScope = scopeFromQuery || appFromQuery || '';
    const scope = normalizeAppScope(finalScope);
    
    if (scope !== 'all') {
      localStorage.setItem('launch_app', scope);
      localStorage.setItem('app_id', appFromQuery || '');  // Store app ID for app identification
      const exp = new Date(Date.now() + 7 * 86400 * 1000).toUTCString();
      document.cookie = `app_scope=${encodeURIComponent(scope)}; path=/; expires=${exp}; SameSite=Lax`;
      document.cookie = `app_id=${encodeURIComponent(appFromQuery || '')}; path=/; expires=${exp}; SameSite=Lax`;
    }

    const redirectPath = params.get('redirect');
    if (!redirectPath) return;
    const normalizedPath = redirectPath.split('?')[0] || '';
    const effectiveScope = scope !== 'all'
      ? scope
      : normalizeAppScope(localStorage.getItem('launch_app') || process.env.NEXT_PUBLIC_APP_SCOPE || '');

    if (normalizedPath.startsWith('/dashboard') && canAccessPathForScope(normalizedPath, effectiveScope)) {
      localStorage.setItem('post_login_redirect', redirectPath);
    }
  }, []);

  /* Capture PWA install prompt */
  useEffect(() => {
    const onBefore = (e: Event) => { e.preventDefault(); window.__dsfInstallPrompt = e as IPE; };
    window.addEventListener('beforeinstallprompt', onBefore);
    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, []);

  /* Auth guard → redirect if already logged in, else show panel */
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setTimeout(() => setShow(true), 220); return; }

    fetch('/api/auth/me/refresh-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (refreshRes) => {
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => null);
          if (refreshData?.token) {
            await syncClientAuthState(refreshData);
          }
        }

        const nextToken = localStorage.getItem('auth_token') || token;
        return fetch('/api/auth/me', { headers: { Authorization: `Bearer ${nextToken}` } });
      })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error('invalid_session');
        }
        return r.json();
      })
      .then(data => {
        if (data?.needs_bootstrap) {
          localStorage.setItem('needs_bootstrap', '1');
          router.replace('/entry/install');
        } else {
          localStorage.removeItem('needs_bootstrap');
          router.replace(data.home_route || '/dashboard');
        }
      })
      .catch(async () => {
        localStorage.removeItem('auth_token');
        await clearServerSession();
        setShow(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      dir="rtl"
      className="relative min-h-screen overflow-hidden"
      style={{ background: '#020b16' }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute -top-36 -right-24 w-[680px] h-[680px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.11) 0%, transparent 68%)' }}
        />
        <div
          className="absolute -bottom-32 -left-24 w-[540px] h-[540px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 72%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 72%)' }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          opacity: 0.04,
          backgroundImage: 'radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-4 md:px-8 xl:px-12 pt-4 md:pt-6">
          <div className="rounded-2xl border border-sky-500/15 bg-[#031225]/85 backdrop-blur-xl px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.35)]">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm md:text-base text-white font-bold leading-tight">Digital Sovereignty Force</div>
                <div className="text-[11px] md:text-xs text-slate-400">Sovereign Operations Platform</div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
              <a
                href="/entry/download"
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-300 to-cyan-300 hover:from-emerald-200 hover:to-cyan-200 transition-all"
              >
                <ArrowDownToLine className="w-4 h-4" />
                تحميل تطبيق الهاتف
              </a>
              <a
                href="#platform-login"
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white border border-sky-400/35 bg-sky-500/10 hover:bg-sky-500/20 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                دخول المنصة
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 xl:px-12 pb-6 md:pb-8 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_420px] gap-4 md:gap-6 h-full">
            <section className="rounded-[28px] border border-sky-400/15 bg-gradient-to-b from-[#04162c]/90 via-[#021125]/92 to-[#020d1b]/96 p-5 md:p-8 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 text-[11px] md:text-xs text-cyan-200 rounded-full border border-cyan-300/30 bg-cyan-400/10 w-fit px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                الإصدار 2.1 متاح الآن
              </div>

              <div className="space-y-4 max-w-3xl">
                <h1 className="text-3xl md:text-5xl leading-tight font-black text-white tracking-tight">
                  منصة واحدة تدير
                  <span className="block bg-gradient-to-l from-cyan-300 via-sky-300 to-indigo-300 text-transparent bg-clip-text">
                    السيادة التشغيلية لمؤسستك
                  </span>
                </h1>
                <p className="text-base md:text-lg text-slate-300 leading-8">
                  حوّل إداراتك المتفرقة إلى غرفة قيادة موحدة: أصول، عمليات، حوكمة، وميدان.
                  كل قرار يصبح أسرع، أوضح، وأكثر موثوقية ضمن إطار أمني مؤسسي.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {KPI_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-sky-300/15 bg-slate-900/45 p-4"
                  >
                    <div className="text-2xl md:text-3xl font-black text-cyan-200">{item.value}</div>
                    <div className="text-sm text-slate-400 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CAPABILITY_CARDS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4 md:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/30 to-cyan-400/20 border border-sky-300/25 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-cyan-200" />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-bold text-white">{item.title}</h3>
                          <p className="text-sm text-slate-300 mt-2 leading-7">{item.text}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-base md:text-lg font-bold text-emerald-200">تطبيق ميداني جاهز للفِرق</div>
                  <p className="text-sm text-slate-300 mt-1">
                    إدارة البلاغات، تنفيذ المهام، ومتابعة الأصول مباشرة من الهاتف حتى بدون تعقيد.
                  </p>
                </div>
                <a
                  href="/entry/download"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 text-sm font-bold hover:from-emerald-300 hover:to-cyan-300 transition-all"
                >
                  <Smartphone className="w-4 h-4" />
                  تنزيل التطبيق الآن
                </a>
              </div>
            </section>

            <section id="platform-login" className="rounded-[28px] border border-cyan-300/20 bg-[#031023]/88 backdrop-blur-2xl p-4 md:p-5 flex flex-col">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-3 md:p-4 mb-4">
                <div className="flex items-center gap-2 text-cyan-200 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  دخول آمن ومباشر للمنصة
                </div>
                <p className="text-xs md:text-sm text-slate-300 mt-1.5 leading-6">
                  استخدم رمز المؤسسة + بياناتك للدخول الفوري إلى مساحة العمل الخاصة بك.
                </p>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <AnimatePresence>
                  {show && (
                    <motion.div
                      key="panel"
                      initial={{ opacity: 0, y: 18, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full"
                    >
                      <LoginPanel onDemoEnter={() => router.push('/dashboard')} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                مخصص للمؤسسات متعددة الإدارات والكيانات ضمن بيئة تشغيل سيادية.
              </div>
            </section>
          </div>
        </main>

        <footer className="px-4 md:px-8 xl:px-12 pb-4">
          <div className="text-center text-[10px] md:text-[11px] tracking-[0.18em] text-slate-500">
            DSF · v2.1 · ENCRYPTED SESSION · OPERATION READY
          </div>
        </footer>
      </div>
    </div>
  );
}
