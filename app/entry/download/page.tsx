'use client';

import Link from 'next/link';
import { ArrowDownToLine, BadgeCheck, Clock3, Download, QrCode, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';

const APP_NAME = 'DSF Asset Mobile';
const APP_VERSION = 'v1.0.0';
const APK_URL = '/downloads/Asset-Management.apk';
const STORE_URL = '/entry/store';
const MOBILE_URL = '/m';
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(APK_URL)}`;

export default function DownloadPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#020617_100%)] text-slate-100 px-5 py-10 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[2rem] border border-cyan-500/20 bg-slate-950/80 backdrop-blur-xl shadow-2xl shadow-cyan-950/20 overflow-hidden">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <section className="p-6 md:p-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold text-cyan-200">
                <Sparkles className="h-4 w-4" /> إصدار داخلي جاهز للتثبيت
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                    <Smartphone className="h-7 w-7" />
                  </span>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black leading-tight">{APP_NAME}</h1>
                    <p className="text-slate-400 text-sm md:text-base">تطبيق أندرويد داخلي لتسليم أوامر العمل والتقارير من الموقع مباشرة.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">{APP_VERSION}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">APK مباشر</span>
                  <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">بدون Google Play</span>
                  <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">التحديث من نفس الموقع</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <a href={APK_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 font-black text-slate-950 hover:bg-cyan-400 transition-colors">
                  <ArrowDownToLine className="h-5 w-5" /> تنزيل APK
                </a>
                <Link href={MOBILE_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 font-bold text-slate-200 hover:border-slate-500 transition-colors">
                  فتح التطبيق
                </Link>
                <Link href={STORE_URL} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 font-bold text-slate-200 hover:border-slate-500 transition-colors">
                  متجر التطبيقات
                </Link>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                    <BadgeCheck className="h-5 w-5" /> ما الذي ستحصل عليه
                  </div>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• تطبيق Android حقيقي قابل للتثبيت.</li>
                    <li>• يفتح على صفحة الموبايل من نفس الموقع.</li>
                    <li>• التحديثات تأتي من نفس رابط الموقع الداخلي.</li>
                    <li>• مناسب للتوزيع داخل المؤسسة فقط.</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center gap-2 text-amber-300 font-bold mb-2">
                    <ShieldCheck className="h-5 w-5" /> ملاحظات التثبيت
                  </div>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>• فعّل التثبيت من مصادر غير معروفة عند الحاجة.</li>
                    <li>• إذا كان التطبيق مثبتًا سابقًا فاحذف النسخة القديمة أولًا.</li>
                    <li>• امسح الكاش إذا لم تظهر آخر التعديلات.</li>
                    <li>• استخدم QR للوصول السريع للرابط من الهاتف.</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-cyan-100">
                <div className="flex items-center gap-2 font-bold mb-1"><Clock3 className="h-4 w-4" /> آخر تحديث</div>
                هذه الصفحة مرتبطة بالنسخة الداخلية الموجودة في {APK_URL} ويمكن استبدال الملف لاحقًا بنفس الاسم دون تغيير الرابط.
              </div>
            </section>

            <aside className="border-t lg:border-t-0 lg:border-r border-slate-800 p-6 md:p-10 bg-slate-950/80">
              <div className="rounded-3xl border border-slate-800 bg-white p-4 w-fit mx-auto">
                <img src={QR_URL} alt="APK QR" width={320} height={320} className="rounded-2xl" />
              </div>
              <div className="mt-5 space-y-2 text-center">
                <h2 className="text-xl font-black">امسح QR ونزّل التطبيق</h2>
                <p className="text-sm text-slate-400">الرابط المباشر يفتح ملف الـ APK من نفس موقعكم.</p>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                <p className="font-bold text-slate-100 mb-2">عنوان التحميل</p>
                <p className="break-all text-xs text-cyan-200">{APK_URL}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}