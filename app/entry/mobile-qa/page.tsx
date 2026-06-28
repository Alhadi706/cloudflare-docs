'use client';

import { useEffect, useState } from 'react';

const APP_URL = 'https://dev.d-me.ly/m';
const INSTALL_URL = 'https://dev.d-me.ly/entry/install';
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(APP_URL)}`;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function MobileQaPage() {
  const [installReady, setInstallReady] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      (window as Window & { __mobileInstallPrompt?: InstallPromptEvent }).__mobileInstallPrompt = event as InstallPromptEvent;
      setInstallReady(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const installApp = async () => {
    const deferred = (window as Window & { __mobileInstallPrompt?: InstallPromptEvent }).__mobileInstallPrompt;
    if (!deferred) {
      setInstallMessage('إذا لم يظهر زر التثبيت تلقائياً، افتح قائمة المتصفح ثم اختر: Add to Home Screen.');
      return;
    }

    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallMessage('تم إرسال طلب التثبيت.');
      setInstallReady(false);
    } else {
      setInstallMessage('تم إلغاء التثبيت. يمكنك المحاولة مرة أخرى.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">بوابة تجربة تطبيق الموبايل</h1>
        <p className="text-slate-300 text-sm md:text-base">
          امسح رمز QR من هاتف أندرويد لفتح نسخة الموبايل مباشرة، ثم نفذ سيناريو التفعيل والموافقة.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold mb-3">QR نسخة الموبايل</h2>
            <div className="bg-white rounded-xl p-3 w-fit">
              <img src={QR_URL} alt="QR for mobile app" width={280} height={280} />
            </div>
            <p className="text-xs text-slate-400 mt-3 break-all">{APP_URL}</p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
            <h2 className="text-lg font-semibold">روابط التشغيل</h2>
            <a className="block text-cyan-300 hover:text-cyan-200 underline" href={APP_URL} target="_blank" rel="noreferrer">
              فتح تطبيق الموبايل
            </a>
            <a className="block text-cyan-300 hover:text-cyan-200 underline" href={INSTALL_URL} target="_blank" rel="noreferrer">
              صفحة التثبيت الرئيسية
            </a>

            <button
              onClick={installApp}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 font-bold transition-colors"
              type="button"
            >
              {installReady ? 'تثبيت التطبيق الآن' : 'إرشادات التثبيت'}
            </button>

            {installMessage && (
              <p className="text-xs text-amber-200 bg-amber-900/30 border border-amber-700/40 rounded-lg p-2">{installMessage}</p>
            )}

            <div className="mt-4 text-sm text-slate-300 space-y-2">
              <p>1. افتح التطبيق من الهاتف أو عبر QR.</p>
              <p>2. نفذ request-access بالرقم الوظيفي.</p>
              <p>3. وافق من حساب المسؤول داخل نفس المؤسسة.</p>
              <p>4. سجل دخول الموظف بعد الموافقة.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
