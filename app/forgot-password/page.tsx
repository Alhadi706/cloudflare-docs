'use client';

import { useState } from 'react';
import { KeyRound, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const requestCode = async () => {
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('أدخل بريدك الإلكتروني');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'تعذر إرسال الرمز');
        return;
      }
      setMessage(data.message || 'تم إرسال الرمز إذا كان البريد مسجلا.');
      setStep(2);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const verifyStepCode = () => {
    setError('');
    if (!otpCode.trim()) {
      setError('أدخل رمز التحقق');
      return;
    }
    setStep(3);
  };

  const resetPassword = async () => {
    setError('');
    setMessage('');

    if (!newPassword || newPassword.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'تعذر إعادة التعيين');
        return;
      }
      setMessage('تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.');
      setTimeout(() => {
        window.location.href = '/entry';
      }, 1200);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020b16] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/65 p-5 space-y-4">
        <div className="flex items-center gap-2 text-cyan-200">
          <ShieldCheck className="w-4 h-4" />
          <h1 className="font-bold">استرجاع كلمة المرور</h1>
        </div>

        <p className="text-xs text-slate-400">التحقق الثنائي عبر البريد: أدخل البريد، ثم رمز OTP، ثم كلمة المرور الجديدة.</p>

        {step >= 1 && (
          <div className="space-y-2">
            <label className="text-xs text-slate-300">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-slate-800/60 border border-slate-700 pr-10 pl-3 py-2.5 text-sm text-white"
                placeholder="you@example.com"
                dir="ltr"
                disabled={step > 1}
              />
            </div>
            {step === 1 && (
              <button
                onClick={requestCode}
                disabled={loading}
                className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-2.5 text-sm font-semibold text-white"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
              </button>
            )}
          </div>
        )}

        {step >= 2 && (
          <div className="space-y-2">
            <label className="text-xs text-slate-300">رمز OTP من البريد</label>
            <div className="relative">
              <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full rounded-xl bg-slate-800/60 border border-slate-700 pr-10 pl-3 py-2.5 text-sm text-white"
                placeholder="000000"
                dir="ltr"
                disabled={step > 2}
              />
            </div>
            {step === 2 && (
              <button
                onClick={verifyStepCode}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white"
              >
                متابعة
              </button>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <label className="text-xs text-slate-300">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2.5 text-sm text-white"
              placeholder="********"
              dir="ltr"
            />
            <label className="text-xs text-slate-300">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2.5 text-sm text-white"
              placeholder="********"
              dir="ltr"
            />
            <button
              onClick={resetPassword}
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              <span>{loading ? 'جاري الحفظ...' : 'تعيين كلمة المرور الجديدة'}</span>
            </button>
          </div>
        )}

        {error && <div className="text-xs text-rose-400">{error}</div>}
        {message && <div className="text-xs text-emerald-400">{message}</div>}

        <a href="/entry" className="block text-center text-xs text-slate-400 hover:text-slate-200">العودة لصفحة الدخول</a>
      </div>
    </div>
  );
}
