'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter }    from 'next/navigation';
import { CheckCircle, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { applyServerSession } from '@/lib/client-auth-session';
import { canAccessPathForScope } from '@/lib/appScope';

type PageStatus = 'loading' | 'success' | 'already_verified' | 'error';

function ActivateContent() {
  const params             = useSearchParams();
  const router             = useRouter();
  const [status, setStatus]   = useState<PageStatus>('loading');
  const [message, setMessage] = useState('');
  const [isFounder, setIsFounder] = useState(false);
  const [fullName,  setFullName]  = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setMessage('رابط التفعيل غير مكتمل أو مفقود.');
      setStatus('error');
      return;
    }

    fetch('/api/auth/activate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(async res => {
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('auth_token',  data.token);
          localStorage.setItem('user_email',  data.email);
          if (data.full_name)         localStorage.setItem('user_name',  data.full_name);
          if (data.organization_name) localStorage.setItem('org_name',   data.organization_name);
          if (data.is_founder)        localStorage.setItem('is_founder', '1');

          const appScope = localStorage.getItem('launch_app') || null;
          const sessionApplied = await applyServerSession(data.token, appScope);
          if (!sessionApplied) {
            setMessage('تعذر تثبيت جلسة الدخول الآمنة. أعد المحاولة.');
            setStatus('error');
            return;
          }

          setFullName(data.full_name || '');
          setIsFounder(!!data.is_founder);
          setStatus(data.status === 'already_verified' ? 'already_verified' : 'success');

          // Route after 2.5 s
          setTimeout(() => {
            const requestedRedirect = localStorage.getItem('post_login_redirect');
            if (requestedRedirect) {
              localStorage.removeItem('post_login_redirect');
              const requestedPath = requestedRedirect.split('?')[0] || '';
              if (requestedPath.startsWith('/dashboard') && canAccessPathForScope(requestedPath, appScope)) {
                router.push(requestedRedirect);
                return;
              }
            }
            if (data.is_founder || data.needs_bootstrap) {
              router.push('/entry?bootstrap=1');
            } else {
              router.push('/dashboard');
            }
          }, 2500);
        } else {
          const errMap: Record<string, string> = {
            invalid_token:  'رابط التفعيل غير صالح أو تالف.',
            expired:        'انتهت صلاحية رابط التفعيل. يرجى طلب إعادة الإرسال.',
            user_not_found: 'البريد الإلكتروني غير مسجل في النظام.',
            missing_token:  'رابط التفعيل غير مكتمل.',
          };
          setMessage(errMap[data.code] || data.detail || 'حدث خطأ غير متوقع.');
          setStatus('error');
        }
      })
      .catch(() => {
        setMessage('خطأ في الاتصال بالخادم. تحقق من اتصالك وأعد المحاولة.');
        setStatus('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: `
          radial-gradient(ellipse 58% 70% at 90% 15%, rgba(130,52,210,0.30) 0%, transparent 65%),
          radial-gradient(ellipse 120% 120% at 50% 50%, #010a18 0%, #000006 100%)
        `,
      }}
    >
      {/* Brand header */}
      <div className="absolute top-6 left-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 leading-none">منصة</div>
          <div className="text-sm font-bold text-white leading-tight">Digital Sovereignty Force</div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-10 max-w-md w-full text-center"
        dir="rtl"
        style={{
          background:        'rgba(4, 12, 32, 0.82)',
          backdropFilter:    'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border:            '1px solid rgba(255,255,255,0.07)',
          boxShadow:         '0 32px 64px -16px rgba(0,0,0,0.9)',
        }}
      >
        {/* ── Loading ── */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-5">
            <RefreshCw className="w-14 h-14 text-blue-400 animate-spin" />
            <div>
              <p className="text-white font-bold text-lg">جاري التحقق من رابط التفعيل…</p>
              <p className="text-slate-400 text-sm mt-1">لحظة من فضلك</p>
            </div>
          </div>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-bold text-2xl">
                {fullName ? `مرحباً ${fullName}!` : 'تم التفعيل بنجاح!'}
              </p>
              <p className="text-emerald-400 text-sm mt-1 font-medium">تم تفعيل حسابك</p>
              <p className="text-slate-400 text-sm mt-3">
                {isFounder
                  ? 'أنت مؤسس المنظمة — جاري الانتقال لإعداد المنصة…'
                  : 'جاري الانتقال إلى المنصة…'}
              </p>
            </div>
          </div>
        )}

        {/* ── Already verified ── */}
        {status === 'already_verified' && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-bold text-xl">حسابك مفعّل مسبقاً</p>
              <p className="text-slate-400 text-sm mt-2">يمكنك تسجيل الدخول مباشرة.</p>
            </div>
            <a
              href="/entry"
              className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors text-sm"
            >
              تسجيل الدخول ←
            </a>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <p className="text-white font-bold text-xl">تعذّر التفعيل</p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">{message}</p>
            </div>
            <a
              href="/entry"
              className="mt-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors text-sm"
            >
              العودة إلى صفحة التسجيل
            </a>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#010a18]">
          <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
        </div>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
