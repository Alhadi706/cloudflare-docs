'use client';

import { useState } from 'react';
import { Building2, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';

interface Props {
  appKey: string;
  initialOrganization?: string;
  onActivated: (payload: {
    tenant_id: string;
    tenant_code: string;
    organization_name: string;
    app: string;
    activated_at: number;
  }) => void;
}

export default function DeviceActivationPanel({ appKey, initialOrganization = '', onActivated }: Props) {
  const [organization, setOrganization] = useState(initialOrganization);
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const requestInstitutionUrl = `/entry/request-institution?app=${encodeURIComponent(appKey)}${organization.trim() ? `&org=${encodeURIComponent(organization.trim())}` : ''}`;

  const activate = async () => {
    if (!organization.trim() || !activationCode.trim()) {
      setError('ادخل اسم المؤسسة ورمز التفعيل');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/device-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: organization.trim(),
          activation_code: activationCode.trim(),
          app: appKey,
        }),
      });
      const data = await res.json();
      if (res.status === 202 && data?.pending_approval) {
        setInfo(data?.message || 'تم إرسال طلب انضمام الإدارة للموافقة الأمنية.');
        return;
      }
      if (!res.ok || !data?.activation) {
        setError(data?.error || 'فشل التفعيل');
        return;
      }

      const activation = data.activation;
      localStorage.setItem('tenant_id', activation.tenant_id);
      localStorage.setItem('active_tenant_id', activation.tenant_id);
      localStorage.setItem('tenant_code', activation.tenant_code);
      localStorage.setItem('active_tenant_code', activation.tenant_code);
      localStorage.setItem('org_name', activation.organization_name);
      localStorage.setItem('launch_app', appKey);
      localStorage.setItem(`device_activation:${appKey}`, JSON.stringify(activation));
      const exp = new Date(Date.now() + 7 * 86400 * 1000).toUTCString();
      document.cookie = `app_scope=${encodeURIComponent(appKey)}; path=/; expires=${exp}; SameSite=Lax`;

      onActivated(activation);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5 space-y-3.5" style={{
      background: 'rgba(4, 12, 32, 0.78)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 32px 64px -16px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      <h3 className="text-sm font-semibold text-slate-200">تفعيل المؤسسة</h3>
      <p className="text-xs text-slate-400 leading-6">
        أدخل <strong className="text-slate-300">رمز المؤسسة</strong> (مثال: <span className="font-mono text-cyan-400 text-xs">ORG-B1F342</span>) و<strong className="text-slate-300">كود التفعيل</strong> الذي يوفره مالك المنصة عند اعتماد المؤسسة.
      </p>

      <div className="relative">
        <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="رمز المؤسسة — مثال: ORG-B1F342"
          value={organization}
          onChange={(e) => { setOrganization(e.target.value); setError(''); }}
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          dir="ltr"
        />
      </div>

      <div className="relative">
        <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="كود التفعيل — مثال: ORG-B1F342-16171E"
          value={activationCode}
          onChange={(e) => { setActivationCode(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && activate()}
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          dir="ltr"
        />
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}
  {info && <div className="text-xs text-emerald-400">{info}</div>}

      <a
        href={requestInstitutionUrl}
        className="block text-center w-full border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold py-2.5 rounded-xl transition-colors"
      >
        تسجيل مؤسسة جديدة
      </a>

      <button
        onClick={activate}
        disabled={loading}
        className="w-full bg-gradient-to-l from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        <span>{loading ? 'جار التفعيل...' : 'تفعيل المؤسسة والمتابعة'}</span>
      </button>
    </div>
  );
}
