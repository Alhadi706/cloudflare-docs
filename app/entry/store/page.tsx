'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, QrCode, Smartphone, Store, ShieldCheck } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __assetInstallPrompt?: InstallPromptEvent;
  }
}

const APP_NAME = 'إدارة الأصول';
const MOBILE_URL = '/m';
const APK_URL = '/downloads/Asset-Management.apk';
const STORE_URL = '/entry/store';
const DOWNLOAD_URL = '/entry/download';
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(STORE_URL)}`;

export default function InternalStorePage() {
  const [installReady, setInstallReady] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onBefore = (event: Event) => {
      event.preventDefault();
      window.__assetInstallPrompt = event as InstallPromptEvent;
      setInstallReady(true);
    };

    window.addEventListener('beforeinstallprompt', onBefore);
    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, []);

  const installPwa = async () => {
    const deferred = window.__assetInstallPrompt;
    if (!deferred) {
      setMessage('افتح القائمة في المتصفح ثم اختر: Add to Home Screen.');
      return;
    }

    await deferred.prompt();
    const choice = await deferred.userChoice;
    setMessage(choice.outcome === 'accepted' ? 'تم بدء تثبيت التطبيق.' : 'تم إلغاء التثبيت.');
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 px-5 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Store className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-black">متجر النظام الداخلي</h1>
              <p className="text-slate-400 text-sm">توزيع التطبيقات من سيرفراتكم مباشرة</p>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-600/30 bg-cyan-950/20 p-4 mt-6">
            <div className="flex items-center gap-2 text-cyan-200 font-bold">
              <Smartphone className="h-5 w-5" />
              {APP_NAME}
            </div>
            <p className="text-sm text-slate-300 mt-2">تطبيق موبايل مرتبط بالنظام الإداري والمالي والفني داخل نفس بيئة المؤسسة.</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <a
                href={MOBILE_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 font-bold text-white"
              >
                فتح التطبيق
              </a>
              <button
                type="button"
                onClick={installPwa}
                className="rounded-xl border border-cyan-500/40 bg-cyan-900/20 px-4 py-2.5 font-bold text-cyan-200"
              >
                {installReady ? 'تثبيت كتطبيق' : 'إرشادات التثبيت'}
              </button>
              <a
                href={APK_URL}
                className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-2.5 font-bold text-amber-200"
              >
                <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> تنزيل APK الداخلي</span>
              </a>
              <Link
                href={DOWNLOAD_URL}
                className="rounded-xl border border-slate-600/60 bg-slate-900/40 px-4 py-2.5 font-bold text-slate-200"
              >
                صفحة التنزيل الاحترافية
              </Link>
            </div>
            {message && <p className="text-xs text-cyan-200 mt-3">{message}</p>}
            <p className="text-xs text-slate-500 mt-2">ملاحظة: إذا لم يكن ملف APK مرفوعاً بعد، استخدم خيار التثبيت من المتصفح مؤقتاً.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2"><QrCode className="h-5 w-5 text-cyan-300" /> QR المتجر</h2>
              <div className="bg-white w-fit rounded-xl p-2">
                <img src={QR_URL} alt="Internal Store QR" width={300} height={300} />
              </div>
              <p className="mt-3 text-xs text-slate-400 break-all">{STORE_URL}</p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /> سياسة الاستخدام</h2>
              <div className="text-sm text-slate-300 space-y-2">
                <p>1. هذا متجر خاص بالنظام ومربوط بسيرفراتكم فقط.</p>
                <p>2. الدخول على البيانات يعتمد على حساب المستخدم وصلاحياته داخل المؤسسة.</p>
                <p>3. أي موظف لا يملك صلاحية لن يرى بيانات الإدارة المالية أو الفنية الخاصة بغيره.</p>
                <p>4. يمكن توزيع النسخة داخلياً عبر QR أو رابط مباشر بدون Google Play.</p>
              </div>
              <div className="mt-4">
                <Link href="/entry/install" className="text-cyan-300 underline">العودة إلى صفحة التثبيت</Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
