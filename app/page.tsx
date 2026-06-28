'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2, Building2, Users, Wallet, Wrench, Brain,
  MapPin, Shield, BarChart2, Download, CheckCircle2,
  ChevronLeft, ArrowLeft, Newspaper, Zap, LogIn, Smartphone,
} from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window { __dsfInstallPrompt?: InstallPromptEvent | null; }
}

function markInstalled() {
  localStorage.setItem('launcher_activated', '1');
  const exp = new Date(Date.now() + 30 * 86400 * 1000).toUTCString();
  document.cookie = `launcher_activated=1; path=/; expires=${exp}; SameSite=Lax`;
}

const INSTALL_STEPS = [
  { ms: 0,     pct: 5,   label: 'فحص مواصفات الجهاز...' },
  { ms: 1100,  pct: 13,  label: 'تحميل حزمة المنصة الرئيسية...' },
  { ms: 2400,  pct: 24,  label: 'تجهيز طبقات الأمان والتشفير...' },
  { ms: 3800,  pct: 36,  label: 'تثبيت مكوّنات الواجهة التفاعلية...' },
  { ms: 5200,  pct: 49,  label: 'مزامنة بروتوكولات الاتصال الآمن...' },
  { ms: 6600,  pct: 61,  label: 'إعداد نظام إدارة الصلاحيات...' },
  { ms: 8000,  pct: 73,  label: 'تجهيز وحدات الذكاء المكاني...' },
  { ms: 9400,  pct: 83,  label: 'ضبط معايير الأداء وضغط الموارد...' },
  { ms: 11000, pct: 93,  label: 'التحقق من سلامة التثبيت...' },
  { ms: 12800, pct: 100, label: 'اكتمل تثبيت المنصة بنجاح' },
];

const FEATURES = [
  { icon: Building2, color: 'from-blue-500 to-cyan-400',     title: 'إدارة مؤسسية متكاملة',   desc: 'موارد بشرية، مراسلات، عقود، وحوكمة متعددة المستويات — كل شيء في مكان واحد' },
  { icon: Wallet,    color: 'from-amber-500 to-yellow-400',  title: 'ذكاء مالي لحظي',         desc: 'ميزانيات، محاسبة، إيرادات، وتقارير تنفيذية في الوقت الفعلي' },
  { icon: MapPin,    color: 'from-teal-500 to-emerald-400',  title: 'الذكاء المكاني GIS',      desc: 'خرائط تفاعلية، تتبع الأصول ميدانيًا، وتحليل جغرافي لدعم القرارات' },
  { icon: Shield,    color: 'from-violet-500 to-purple-400', title: 'حوكمة وسير العمل',        desc: 'موافقات متعددة المستويات، تدقيق كامل، وصلاحيات دقيقة لكل دور' },
  { icon: Users,     color: 'from-rose-500 to-pink-400',     title: 'عزل كامل للمؤسسات',      desc: 'كل مؤسسة بيئة مستقلة ومعزولة — بياناتك لا تُشارك أبدًا مع غيرك' },
  { icon: Brain,     color: 'from-fuchsia-500 to-violet-400', title: 'ذكاء اصطناعي مدمج',    desc: 'تحليلات متقدمة، تنبؤ بالمخاطر، وقرارات مبنية على بيانات لحظية' },
];

const HOW_STEPS = [
  { n: '01', title: 'ثبّت المنصة', desc: 'اضغط الزر — ستُضاف أيقونة المنصة لجهازك كأي تطبيق رسمي. مجاني تمامًا.' },
  { n: '02', title: 'سجّل مؤسستك', desc: 'أرسل طلب تسجيل مؤسستك. يتم مراجعته والموافقة عليه خلال 24 ساعة.' },
  { n: '03', title: 'ابنِ هيكلك الإداري', desc: 'بعد الموافقة، أضف إداراتك وعيّن المدراء بإيميلاتهم وكلمات مرور مبدئية.' },
  { n: '04', title: 'شغّل من الأيقونة', desc: 'كل موظف يفتح أيقونة المنصة، يكتب اسم مؤسسته وبياناته، ويدخل للوحته مباشرة.' },
];

const NEWS = [
  { date: 'يونيو 2026',  tag: 'إطلاق',       title: 'الإصدار 2.1 — الحوكمة متعددة المستويات',   desc: 'تدفق الموافقات يدعم الآن 5 مستويات تنفيذية مع تتبع كامل لكل قرار.' },
  { date: 'مايو 2026',   tag: 'ميزة جديدة',   title: 'وحدة الذكاء المكاني المتقدمة',              desc: 'تكامل GIS مع بيانات الأصول والصيانة الميدانية في خريطة تفاعلية واحدة.' },
  { date: 'أبريل 2026',  tag: 'تحديث',        title: 'معيار جديد لعزل بيانات المؤسسات',           desc: 'كل مؤسسة الآن معزولة بالكامل — معرّف فريد وبنية بيانات مستقلة.' },
];

const AUDIENCE = [
  {
    title: 'للقيادات التنفيذية',
    desc: 'لوحة قرار موحدة تعرض الأداء، المخاطر، والالتزام عبر جميع الإدارات بدون تقارير مشتتة.',
    icon: BarChart2,
  },
  {
    title: 'لمدراء الإدارات',
    desc: 'متابعة يومية للمهام، الموافقات، الإنتاجية، والانحرافات مع إجراءات تصحيح سريعة.',
    icon: Building2,
  },
  {
    title: 'للفرق التشغيلية والميدانية',
    desc: 'تنفيذ المهام من الهاتف، تحديث الحالة مباشرة، ورفع الأدلة والصور لحظيًا.',
    icon: Wrench,
  },
];

const PLATFORM_JOURNEY = [
  {
    title: 'قبل التنفيذ',
    points: ['تجميع المتطلبات المؤسسية في مكان واحد', 'تعريف الأدوار والصلاحيات', 'تهيئة الهيكل الإداري والتشغيلي'],
  },
  {
    title: 'أثناء التشغيل',
    points: ['إدارة العمليات اليومية لحظيًا', 'تتبع الأداء والمخاطر والتنبيهات', 'تسريع الموافقات وسير الإجراءات'],
  },
  {
    title: 'بعد التنفيذ',
    points: ['تقارير تنفيذية دقيقة للقيادة', 'تحسين مستمر مبني على البيانات', 'قابلية توسع لإدارات ووحدات إضافية'],
  },
];

const FAQ_ITEMS = [
  {
    q: 'هل المنصة مناسبة فقط للمؤسسات الكبيرة؟',
    a: 'المنصة مرنة وتعمل للمؤسسات المتوسطة والكبيرة، ويمكن توسيعها تدريجيًا حسب النمو والاحتياج.',
  },
  {
    q: 'هل البيانات معزولة وآمنة لكل مؤسسة؟',
    a: 'نعم، كل مؤسسة تعمل في سياق بيانات وصلاحيات مستقل مع تتبع كامل للعمليات والمستخدمين.',
  },
  {
    q: 'كم يستغرق بدء التشغيل الفعلي؟',
    a: 'البداية سريعة: تسجيل المؤسسة، إعداد الهيكل، ثم تشغيل المستخدمين على مراحل ضمن خطة منظمة.',
  },
  {
    q: 'هل يمكن الاعتماد على الهاتف في التشغيل اليومي؟',
    a: 'نعم، التطبيق مصمم للعمليات الميدانية وتحديثات الحالة الفورية مع تكامل كامل مع لوحة المنصة.',
  },
];

export default function MarketingPage() {
  const router = useRouter();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling]       = useState(false);
  const [installDone, setInstallDone]     = useState(false);
  const [progress, setProgress]           = useState(0);
  const [label, setLabel]                 = useState('');
  const [doneLabels, setDoneLabels]       = useState<string[]>([]);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    const launcherCookie   = document.cookie.includes('launcher_activated=1');
    const launcherStorage  = localStorage.getItem('launcher_activated') === '1';
    setAlreadyInstalled(launcherCookie || launcherStorage);

    const onInstallPrompt = (e: Event) => {
      const ev = e as InstallPromptEvent;
      ev.preventDefault();
      setInstallPrompt(ev);
      window.__dsfInstallPrompt = ev;
    };
    if (window.__dsfInstallPrompt) setInstallPrompt(window.__dsfInstallPrompt);
    window.addEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
    window.addEventListener('appinstalled', () => {
      markInstalled();
      setAlreadyInstalled(true);
    });
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
  }, []);

  const startInstall = () => {
    if (alreadyInstalled) { router.push('/entry'); return; }

    setInstalling(true);
    setProgress(0);
    setLabel(INSTALL_STEPS[0].label);
    setDoneLabels([]);

    if (installPrompt) installPrompt.prompt().catch(() => {});

    INSTALL_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setProgress(step.pct);
        setLabel(step.label);
        if (i > 0) setDoneLabels(prev => [...prev.slice(-4), INSTALL_STEPS[i - 1].label]);
        if (step.pct === 100) {
          markInstalled();
          setAlreadyInstalled(true);
          setTimeout(() => { setInstalling(false); setInstallDone(true); }, 700);
        }
      }, step.ms);
    });
  };

  const CIRC = 2 * Math.PI * 30; // r=30 circle circumference ≈ 188.5

  return (
    <div className="min-h-screen bg-[#010918] text-white overflow-x-hidden" dir="rtl">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#010918]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Globe2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-wide">Digital Sovereignty Force</div>
              <div className="text-[9px] text-slate-500 tracking-widest uppercase">Sovereign Operations Platform</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">المزايا</a>
            <a href="#how"      className="hover:text-white transition-colors">كيف تعمل</a>
            <a href="#news"     className="hover:text-white transition-colors">الأخبار</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/entry/download"
              className="hidden sm:flex items-center gap-2 bg-gradient-to-l from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Smartphone className="w-4 h-4" />
              تحميل تطبيق الهاتف
            </a>
            <a
              href="/entry"
              className="flex items-center gap-2 bg-gradient-to-l from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all"
            >
              <LogIn className="w-4 h-4" />
              دخول المنصة
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(14,165,233,0.14) 0%, transparent 70%)' }} className="absolute inset-0" />
          <div style={{ background: 'radial-gradient(ellipse 40% 40% at 80% 60%, rgba(99,102,241,0.09) 0%, transparent 70%)' }} className="absolute inset-0" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-cyan-500/8 border border-cyan-500/15 rounded-full px-4 py-1.5 text-xs text-cyan-400 mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            الإصدار 2.1 — متاح الآن
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-6xl font-black leading-tight mb-6 tracking-tight"
          >
            قيادة مؤسستك<br />
            <span className="bg-gradient-to-l from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              من منصة سيادية واحدة
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            منصة تشغيل وإدارة مؤسسية متكاملة تجمع الإدارات، المالية، الأصول، والذكاء المكاني
            في بيئة سيادية آمنة ومعزولة لكل مؤسسة على حدة.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <a
              href="/entry/download"
              className="group flex items-center justify-center gap-2.5 bg-gradient-to-l from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black px-8 py-4 rounded-2xl text-base shadow-xl shadow-emerald-500/25 transition-all"
            >
              <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
              تحميل تطبيق الهاتف الآن
            </a>
            <a
              href="/entry"
              className="flex items-center justify-center gap-2 border border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-100 hover:text-white font-bold px-8 py-4 rounded-2xl text-base transition-all"
            >
              <LogIn className="w-5 h-5" />
              دخول المنصة
            </a>
            <a
              href="#how"
              className="flex items-center justify-center gap-2 border border-slate-700/60 hover:border-slate-500 text-slate-300 hover:text-white font-medium px-8 py-4 rounded-2xl text-base transition-all"
            >
              كيف تعمل؟ <ChevronLeft className="w-4 h-4" />
            </a>
          </motion.div>

          <div className="mt-6 max-w-2xl mx-auto rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-right">
            <div className="text-sm text-cyan-200 font-semibold mb-1">نقطة البداية الواضحة</div>
            <p className="text-xs sm:text-sm text-slate-300 leading-6">
              جديد على المنصة؟ ابدأ من تحميل تطبيق الهاتف. لديك حساب بالفعل؟ ادخل مباشرة من زر دخول المنصة.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="border-y border-white/5 bg-white/2">
        <div className="mx-auto max-w-4xl px-6 py-6 grid grid-cols-3 gap-4 text-center">
          {[
            { val: '+50',  label: 'وحدة إدارية متكاملة' },
            { val: '100%', label: 'عزل البيانات بين المؤسسات' },
            { val: '24/7', label: 'استمرارية التشغيل' },
          ].map(s => (
            <div key={s.val}>
              <div className="text-2xl font-black text-white mb-1">{s.val}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">كل ما تحتاجه في منصة واحدة</h2>
          <p className="text-slate-500">من الإدارة اليومية إلى القرار الاستراتيجي</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="group rounded-2xl border border-white/5 bg-white/2 p-5 hover:bg-white/5 hover:border-white/10 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}>
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Audience clarity ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">المنصة مصممة لمن يتخذ القرار ومن ينفّذ</h2>
          <p className="text-slate-500">فهم سريع لمن يستفيد مباشرة قبل تسجيل الدخول</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AUDIENCE.map((item) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/25 border border-cyan-400/20 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-cyan-200" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-300 leading-7">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Capability journey ── */}
      <section className="border-y border-white/5 bg-slate-950/35 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">ماذا ستدير فعليًا من خلال المنصة؟</h2>
            <p className="text-slate-500">مسار واضح يشرح القيمة من أول يوم تشغيل حتى مرحلة التوسع</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLATFORM_JOURNEY.map((phase) => (
              <div key={phase.title} className="rounded-2xl border border-white/10 bg-white/3 p-5">
                <h3 className="text-lg font-bold text-cyan-200 mb-4">{phase.title}</h3>
                <div className="space-y-2.5">
                  {phase.points.map((point) => (
                    <div key={point} className="flex items-start gap-2 text-sm text-slate-300 leading-7">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4 md:p-5 text-sm text-slate-200 leading-7">
            النتيجة: رؤية تشغيلية موحدة، سرعة أعلى في اتخاذ القرار، وانضباط مؤسسي قابل للقياس والتطوير.
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="bg-slate-950/40 border-y border-white/5 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">من التثبيت إلى التشغيل</h2>
            <p className="text-slate-500">4 خطوات تحوّل مؤسستك إلى بيئة رقمية متكاملة</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {HOW_STEPS.map(step => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5 }}
                className="flex gap-4 p-5 rounded-2xl border border-white/5 bg-white/2"
              >
                <div className="text-4xl font-black text-slate-800 leading-none select-none shrink-0">{step.n}</div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-12">
            <button
              onClick={startInstall}
              className="inline-flex items-center gap-2.5 bg-gradient-to-l from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-blue-500/25 transition-all"
            >
              <Download className="w-5 h-5" />
              {alreadyInstalled ? 'فتح المنصة' : 'ابدأ الآن — مجاني'}
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ for pre-login understanding ── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">أسئلة شائعة قبل دخول المنصة</h2>
          <p className="text-slate-500">إجابات سريعة تساعدك على تقييم المنصة بشكل أوضح</p>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <motion.div
              key={item.q}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/8 bg-white/3 p-5"
            >
              <h3 className="text-base font-bold text-white mb-2">{item.q}</h3>
              <p className="text-sm text-slate-300 leading-7">{item.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── News ── */}
      <section id="news" className="max-w-6xl mx-auto px-6 py-24">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-bold mb-1">آخر التحديثات</h2>
            <p className="text-slate-500 text-sm">مستجدات المنصة والمزايا الجديدة</p>
          </div>
          <Newspaper className="w-6 h-6 text-slate-700" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {NEWS.map(n => (
            <motion.div
              key={n.title}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/5 bg-white/2 p-5 hover:bg-white/4 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">{n.tag}</span>
                <span className="text-[10px] text-slate-600">{n.date}</span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-2 leading-snug">{n.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{n.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-900 p-10 text-center">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(14,165,233,0.08) 0%, transparent 70%)' }} />
          <Zap className="w-8 h-8 text-cyan-500/40 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">جاهز لتحويل مؤسستك رقميًا؟</h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto text-sm leading-relaxed">ثبّت المنصة على جهازك وسجّل مؤسستك — فريقنا سيراجع طلبك خلال 24 ساعة</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={startInstall}
              className="flex items-center justify-center gap-2 bg-gradient-to-l from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              {alreadyInstalled ? 'فتح المنصة' : 'تثبيت المنصة'}
            </button>
            <a
              href="/entry/request-institution"
              className="flex items-center justify-center gap-2 border border-slate-700 hover:border-cyan-700/50 text-slate-300 hover:text-white font-medium px-7 py-3.5 rounded-xl transition-all"
            >
              طلب تسجيل مؤسسة جديدة <ArrowLeft className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-slate-600 text-sm">Digital Sovereignty Force © 2026 — منصة سيادية للمؤسسات</div>
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <a href="/entry/request-institution" className="hover:text-slate-400 transition-colors">تسجيل مؤسسة</a>
            <a href="/entry"                      className="hover:text-slate-400 transition-colors">دخول المنصة</a>
            <a href="/owner"                      className="hover:text-slate-400 transition-colors">بوابة الإدارة</a>
          </div>
        </div>
      </footer>

      {/* ── Install overlay ── */}
      <AnimatePresence>
        {(installing || installDone) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/96 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.90, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="w-full max-w-sm mx-4 rounded-3xl border border-white/8 bg-slate-900 p-8 text-center shadow-2xl"
            >
              {!installDone ? (
                <>
                  {/* Circular progress icon */}
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                      <Globe2 className="w-9 h-9 text-white" />
                    </div>
                    <svg className="absolute" style={{ width: 84, height: 84, top: -2, left: -2 }} viewBox="0 0 84 84">
                      <circle cx="42" cy="42" r="30" fill="none" stroke="rgba(14,165,233,0.12)" strokeWidth="2.5" />
                      <motion.circle
                        cx="42" cy="42" r="30"
                        fill="none" stroke="#0ea5e9"
                        strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={CIRC}
                        animate={{ strokeDashoffset: CIRC - (CIRC * progress) / 100 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ transformOrigin: '42px 42px', transform: 'rotate(-90deg)' }}
                      />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-white mb-0.5">جاري تثبيت المنصة</h2>
                  <p className="text-xs text-slate-500 mb-5">Digital Sovereignty Force v2.1</p>
                  <div className="mb-5">
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>{label}</span>
                      <span className="font-mono text-cyan-400 font-bold">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-blue-500"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    {doneLabels.map(l => (
                      <div key={l} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600/50 shrink-0" />{l}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25"
                  >
                    <CheckCircle2 className="w-9 h-9 text-white" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-white mb-2">تم تثبيت المنصة بنجاح</h2>
                  <p className="text-sm text-slate-400 mb-1.5 leading-relaxed">
                    يمكنك الآن فتح المنصة من أيقونتها على جهازك في أي وقت
                  </p>
                  <p className="text-xs text-slate-600 mb-6">لن تحتاج إلى إعادة التثبيت مرة أخرى</p>
                  <button
                    onClick={() => router.push('/entry')}
                    className="w-full bg-gradient-to-l from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all"
                  >
                    دخول المنصة الآن
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
