'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, RefreshCw, Link2, ShieldCheck, Users, Layers, AlertCircle } from 'lucide-react';

type BotModule = {
  module_key: string;
  is_enabled: boolean;
  settings?: Record<string, unknown>;
  updated_at?: string;
};

type BotIntegration = {
  bot_type: string;
  bot_name?: string | null;
  is_active: boolean;
  status?: string | null;
  error_message?: string | null;
  last_ping?: string | null;
};

type BotProfile = {
  id: number;
  team_name: string;
  asset_profile: string;
  site_scope?: string | null;
  members_count?: number;
  active_members?: number;
};

type BotMember = {
  id: number;
  employee_name: string;
  employee_no: string;
  role_title?: string | null;
  registration_status: string;
};

type BotStateResponse = {
  success: boolean;
  error?: string;
  message?: string;
  modules?: BotModule[];
  integrations?: BotIntegration[];
  profiles?: BotProfile[];
  members?: BotMember[];
  pendingReadings?: number;
  pendingCorrosionRequests?: number;
  deactivatedTenantIds?: string[];
};

const MODULE_LABELS: Record<string, { title: string; description: string }> = {
  operations: {
    title: 'وحدة التشغيل',
    description: 'قراءات التشغيل اليومية (/reading) ومتابعة مؤشرات الأصول.',
  },
  corrosion: {
    title: 'وحدة التآكل',
    description: 'طلبات التآكل وأوامر المتابعة (/corr_new, /corr_list, /corr_status).',
  },
  quality: {
    title: 'وحدة الجودة',
    description: 'قراءات الجودة التشغيلية عبر /quality بصيغ رقمية مختصرة أو مفصلة.',
  },
  hr: {
    title: 'وحدة الشؤون الإدارية',
    description: 'خدمات الموارد البشرية داخل البوت (مقيدة بدور إداري).',
  },
};

function tenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function MaintenanceBotControlPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [token, setToken] = useState('');
  const [allowSharedToken, setAllowSharedToken] = useState(false);
  const [modules, setModules] = useState<BotModule[]>([]);
  const [integrations, setIntegrations] = useState<BotIntegration[]>([]);
  const [profiles, setProfiles] = useState<BotProfile[]>([]);
  const [members, setMembers] = useState<BotMember[]>([]);
  const [pendingReadings, setPendingReadings] = useState(0);
  const [pendingCorrosion, setPendingCorrosion] = useState(0);

  const telegram = useMemo(
    () => integrations.find((i) => i.bot_type === 'telegram') || null,
    [integrations]
  );
  const telegramConnected = Boolean(telegram?.is_active);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/workspace/observer-bot', { headers: tenantHeaders() });
      const data = (await res.json().catch(() => ({}))) as BotStateResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تحميل حالة البوت');
      }
      setModules(Array.isArray(data.modules) ? data.modules : []);
      setIntegrations(Array.isArray(data.integrations) ? data.integrations : []);
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setPendingReadings(Number(data.pendingReadings || 0));
      setPendingCorrosion(Number(data.pendingCorrosionRequests || 0));
    } catch (e: any) {
      setError(String(e?.message || 'فشل التحميل'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const runAction = async (payload: Record<string, unknown>) => {
    setError('');
    setInfo('');
    const res = await fetch('/api/v1/workspace/observer-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as BotStateResponse;
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'فشل تنفيذ العملية');
    }

    setInfo(data.message || 'تم التنفيذ بنجاح');
    if (Array.isArray(data.deactivatedTenantIds) && data.deactivatedTenantIds.length > 0) {
      setInfo((prev) => `${prev}\nالمؤسسات التي تم إيقاف الربط فيها: ${data.deactivatedTenantIds?.join(', ')}`);
    }

    setModules(Array.isArray(data.modules) ? data.modules : modules);
    setIntegrations(Array.isArray(data.integrations) ? data.integrations : integrations);
    setProfiles(Array.isArray(data.profiles) ? data.profiles : profiles);
    setMembers(Array.isArray(data.members) ? data.members : members);
    setPendingReadings(Number(data.pendingReadings ?? pendingReadings));
    setPendingCorrosion(Number(data.pendingCorrosionRequests ?? pendingCorrosion));
  };

  const toggleModule = async (m: BotModule, enabled: boolean) => {
    try {
      await runAction({
        action: 'set_module_state',
        moduleKey: m.module_key,
        isEnabled: enabled,
        settings: m.settings || {},
      });
    } catch (e: any) {
      setError(String(e?.message || 'تعذر تحديث الوحدة'));
    }
  };

  const connectTelegram = async () => {
    if (telegramConnected) {
      setInfo('تيليجرام مربوط بالفعل على مستوى المؤسسة. لا حاجة لإدخال توكن جديد.');
      return;
    }
    if (!token.trim()) {
      setError('الرجاء إدخال Bot Token');
      return;
    }
    try {
      await runAction({ action: 'connect_telegram', botToken: token.trim(), allowSharedToken });
      setToken('');
    } catch (e: any) {
      setError(String(e?.message || 'تعذر ربط Telegram'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/dashboard/admin-gateway/maintenance" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
              <ArrowRight className="w-4 h-4" />
              الرجوع إلى الصيانة
            </Link>
            <h1 className="text-2xl font-bold text-white mt-1">إدارة البوت الموحد</h1>
            <p className="text-sm text-slate-400 mt-1">شاشة موحدة للتحكم بالوحدات والربط وملخص فرق الإدارات.</p>
          </div>
          <button
            onClick={() => void loadState()}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>

        {!!error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-900/20 text-rose-200 p-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {!!info && <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 text-emerald-200 p-3 text-sm whitespace-pre-wrap">{info}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-slate-400 text-xs">فرق الرصد</div>
            <div className="text-xl font-bold text-cyan-300 mt-1">{profiles.length}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-slate-400 text-xs">الأعضاء</div>
            <div className="text-xl font-bold text-violet-300 mt-1">{members.length}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-slate-400 text-xs">قراءات معلقة</div>
            <div className="text-xl font-bold text-amber-300 mt-1">{pendingReadings}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-slate-400 text-xs">طلبات تآكل معلقة</div>
            <div className="text-xl font-bold text-rose-300 mt-1">{pendingCorrosion}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Link2 className="w-4 h-4 text-cyan-300" /> ربط Telegram
          </div>
          {telegramConnected ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-3 text-sm text-emerald-200">
              تم ربط Telegram مسبقًا على مستوى المؤسسة. بقية الإدارات تستخدم نفس الربط تلقائياً.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456:ABCDEF..."
                  className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={connectTelegram} className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-2 text-sm font-semibold">
                  ربط التوكن
                </button>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={allowSharedToken} onChange={(e) => setAllowSharedToken(e.target.checked)} className="mt-0.5" />
                <span>السماح بمشاركة التوكن بين أكثر من مؤسسة. عند الإيقاف: هذا التوكن يصبح مملوكًا لمؤسسة واحدة.</span>
              </label>
            </>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => runAction({ action: 'test_telegram' }).catch((e) => setError(String(e?.message || 'فشل الاختبار')))}
              className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-200"
            >
              اختبار الاتصال
            </button>
            <button
              onClick={() => runAction({ action: 'disconnect_telegram' }).catch((e) => setError(String(e?.message || 'فشل الفصل')))}
              className="rounded-lg border border-rose-500/30 bg-rose-600/20 px-3 py-1.5 text-xs text-rose-200"
            >
              فصل Telegram
            </button>
            <span className="text-xs text-slate-400">
              الحالة: {telegram?.status || (telegram?.is_active ? 'active' : 'inactive') || 'غير مربوط'}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-white font-semibold mb-3">
            <Layers className="w-4 h-4 text-violet-300" /> وحدات الإدارات
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {modules.map((m) => {
              const meta = MODULE_LABELS[m.module_key] || { title: m.module_key, description: 'وحدة مخصصة' };
              return (
                <div key={m.module_key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-100">{meta.title}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${m.is_enabled ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700 bg-slate-800/60'}`}>
                      {m.is_enabled ? 'مفعلة' : 'متوقفة'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 min-h-[34px]">{meta.description}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => void toggleModule(m, true)}
                      disabled={m.is_enabled}
                      className="px-2.5 py-1 text-xs rounded-md border border-emerald-500/30 bg-emerald-600/20 text-emerald-200 disabled:opacity-50"
                    >
                      تفعيل
                    </button>
                    <button
                      onClick={() => void toggleModule(m, false)}
                      disabled={!m.is_enabled}
                      className="px-2.5 py-1 text-xs rounded-md border border-rose-500/30 bg-rose-600/20 text-rose-200 disabled:opacity-50"
                    >
                      إيقاف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Users className="w-4 h-4 text-cyan-300" /> فرق الإدارات
            </div>
            <Link href="/dashboard/admin-gateway/maintenance/teams" className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1">
              إدارة تفصيلية للفرق <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {profiles.length === 0 ? (
              <div className="text-xs text-slate-500">لا توجد فرق رصد مضافة بعد.</div>
            ) : (
              profiles.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                  <div className="text-sm text-slate-100">{p.team_name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {p.asset_profile} • {p.site_scope || 'بدون نطاق'} • أعضاء: {p.members_count || 0} • مفعلون: {p.active_members || 0}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-100 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5" />
          <div>
            تنظيم الصلاحيات الحالي: الفني الميداني للإدخال، المشرف للمتابعة والاعتماد من اللوحة، والإداري لأوامر HR فقط عند تفعيل الوحدة.
          </div>
        </div>
      </div>
    </div>
  );
}
