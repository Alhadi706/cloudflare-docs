'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, ChevronLeft, RefreshCw, CheckCheck, AlertTriangle, AlertCircle, Info, Filter, Send, X, Users, Smartphone, Radio } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
const getToken = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
};
const BASE   = '/api/v1/integration';
const MOBILE = '/api/auth/mobile';

interface Notification {
  id: number;
  notification_type: string;
  severity: 'critical' | 'warning' | 'info';
  module: string;
  entity_type: string | null;
  entity_id: number | null;
  ref_code: string | null;
  title: string;
  message: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  workflow: 'الاعتمادات', revenue: 'الإيرادات', contracts: 'العقود',
  inventory: 'المخزون', procurement: 'المشتريات', hr: 'الموارد البشرية',
  system: 'النظام', projects: 'المشاريع',
};

const MODULE_LINKS: Record<string, string> = {
  workflow: '/dashboard/admin-gateway/workflow',
  revenue:  '/dashboard/admin-gateway/revenue',
  contracts:'/dashboard/admin-gateway/contracts',
  inventory:'/dashboard/admin-gateway/materials/inventory',
  procurement:'/dashboard/admin-gateway/materials/procurement',
  hr:       '/dashboard/admin-gateway/hr',
};

const SEV_CONFIG = {
  critical: { bg: 'bg-red-500/10 border-red-500/30',    icon: <AlertCircle className="w-5 h-5 text-red-400"/>,    badge: 'bg-red-500/20 text-red-300',    label: 'حرج' },
  warning:  { bg: 'bg-amber-500/10 border-amber-500/30', icon: <AlertTriangle className="w-5 h-5 text-amber-400"/>, badge: 'bg-amber-500/20 text-amber-300', label: 'تحذير' },
  info:     { bg: 'bg-slate-800/50 border-slate-700',    icon: <Info className="w-5 h-5 text-blue-400"/>,           badge: 'bg-blue-500/20 text-blue-300',   label: 'معلومة' },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Subscriber {
  employee_no: string;
  full_name:   string;
  role:        string;
  push_count:  number;
  last_seen:   string;
}

// ── Send Notification Dialog ──────────────────────────────────────────────────
function SendNotifDialog({ onClose, onSent }: { onClose: () => void; onSent: (result: any) => void }) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [hasPush, setHasPush]         = useState(false);
  const [form, setForm] = useState({
    recipient:   'broadcast',  // 'broadcast' or employee_no
    title:       '',
    body:        '',
    urgency:     'normal',
    type:        'info',
    url:         '/m',
  });
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; push_sent?: number; error?: string } | null>(null);

  useEffect(() => {
    fetch(`${MOBILE}/subscribers`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(d => {
        setSubscribers(d.subscribers || []);
        setHasPush(d.has_push_enabled ?? false);
      })
      .catch(() => {})
      .finally(() => setLoadingSubs(false));
  }, []);

  const send = async () => {
    if (!form.title.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const payload: Record<string, any> = {
        title:   form.title.trim(),
        body:    form.body.trim(),
        urgency: form.urgency,
        type:    form.type,
        url:     form.url,
      };
      if (form.recipient === 'broadcast') {
        payload.broadcast = true;
      } else {
        payload.employee_no = form.recipient;
      }

      const res = await fetch(`${MOBILE}/notifications`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult({ ok: true, push_sent: data.push_sent });
        onSent(data);
      } else {
        setResult({ ok: false, error: data.detail || 'فشل الإرسال' });
      }
    } catch {
      setResult({ ok: false, error: 'خطأ في الاتصال' });
    } finally {
      setSending(false);
    }
  };

  const URGENCY_OPTS = [
    { value: 'normal',   label: 'عادي',  color: 'text-slate-300' },
    { value: 'high',     label: 'عالي',  color: 'text-amber-400' },
    { value: 'critical', label: 'عاجل',  color: 'text-red-400'   },
  ];
  const TYPE_OPTS = [
    { value: 'info',    label: 'معلومة' },
    { value: 'warning', label: 'تحذير'  },
    { value: 'alert',   label: 'تنبيه'  },
    { value: 'task',    label: 'مهمة'   },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600/20 p-2 rounded-lg border border-violet-500/40">
              <Smartphone className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">إرسال تنبيه للموظفين الميدانيين</h2>
              <p className="text-xs text-slate-500">Web Push → تطبيق الجوال مباشرة</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Push status */}
          {!hasPush && !loadingSubs && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>مفاتيح VAPID غير مهيأة — التنبيهات ستُحفظ لكن لن تُرسل فورياً للجوال</span>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">المستلم</label>
            {loadingSubs ? (
              <div className="h-10 bg-slate-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={form.recipient}
                onChange={e => setForm(p => ({ ...p, recipient: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
              >
                <option value="broadcast">
                  📡 جميع الموظفين الميدانيين ({subscribers.length} مشترك)
                </option>
                {subscribers.map(s => (
                  <option key={s.employee_no} value={s.employee_no}>
                    👤 {s.full_name} — {s.role} ({s.push_count} جهاز)
                  </option>
                ))}
              </select>
            )}
            {!loadingSubs && subscribers.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">لا يوجد موظفون مسجلون في التطبيق بعد</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">عنوان التنبيه <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="مثال: مهمة صيانة عاجلة في محطة الضخ 3"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              maxLength={80}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">تفاصيل الرسالة</label>
            <textarea
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              placeholder="تفاصيل إضافية تظهر في الإشعار..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
              maxLength={200}
            />
          </div>

          {/* Urgency + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-2">الأولوية</label>
              <select
                value={form.urgency}
                onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
              >
                {URGENCY_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">النوع</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
              >
                {TYPE_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
              {result.ok ? (
                <>✅ تم الإرسال بنجاح — <strong>{result.push_sent ?? 0}</strong> إشعار مباشر للجوال</>
              ) : (
                <>❌ {result.error}</>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm">
            إغلاق
          </button>
          <button
            onClick={send}
            disabled={sending || !form.title.trim()}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm flex items-center gap-2 font-medium"
          >
            <Send className="w-4 h-4" />
            {sending ? 'جاري الإرسال...' : 'إرسال التنبيه'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState<Notification[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [counts, setCounts]       = useState({ unread: 0, critical: 0, warning: 0 });
  const [filter, setFilter]       = useState<'all'|'critical'|'warning'|'info'>('all');
  const [modFilter, setModFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [nr, cr] = await Promise.all([
      fetch(`${BASE}/notifications?is_resolved=${showResolved}&limit=100`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
      fetch(`${BASE}/notifications/unread-count`, { headers: {'X-Tenant-ID': getTenantId() || ''} }),
    ]);
    if (nr.ok) setNotifs(await nr.json());
    if (cr.ok) setCounts(await cr.json());
    setLoading(false);
  }, [showResolved]);
  useEffect(() => { load(); }, [load]);

  const triggerSync = async () => {
    setSyncing(true);
    await fetch(`${BASE}/sync`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    await load();
    setSyncing(false);
  };

  const markRead = async (id: number) => {
    await fetch(`${BASE}/notifications/${id}/read`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    setNotifs(prev => prev.map(n => n.id === id ? {...n, is_read: true} : n));
  };

  const resolve = async (id: number) => {
    await fetch(`${BASE}/notifications/${id}/resolve`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    load();
  };

  const readAll = async () => {
    await fetch(`${BASE}/notifications/read-all`, { method: 'POST', headers: {'X-Tenant-ID': getTenantId() || ''} });
    setNotifs(prev => prev.map(n => ({...n, is_read: true})));
    setCounts(prev => ({...prev, unread: 0}));
  };

  const filtered = notifs.filter(n => {
    if (filter !== 'all' && n.severity !== filter) return false;
    if (modFilter && n.module !== modFilter) return false;
    return true;
  });

  const modules = [...new Set(notifs.map(n => n.module))];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Send Dialog */}
        {showSendDialog && (
          <SendNotifDialog
            onClose={() => setShowSendDialog(false)}
            onSent={() => { setShowSendDialog(false); }}
          />
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">مركز الإشعارات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <Bell className="w-8 h-8 text-violet-400" />
              {counts.unread > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[1.25rem] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
                  {counts.unread}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">مركز الإشعارات</h1>
              <p className="text-slate-400 mt-1">التنبيهات والمهام العاجلة عبر جميع وحدات المنصة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSendDialog(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm flex items-center gap-2 font-medium">
              <Smartphone className="w-4 h-4" /> إرسال للموظفين
            </button>
            <button onClick={readAll} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2">
              <CheckCheck className="w-4 h-4" /> قراءة الكل
            </button>
            <button onClick={triggerSync} disabled={syncing} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'جاري المزامنة...' : 'مزامنة'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label: 'غير مقروءة',  val: counts.unread,   color: 'text-violet-400'},
            {label: 'حرجة',        val: counts.critical,  color: 'text-red-400'},
            {label: 'تحذيرات',     val: counts.warning,   color: 'text-amber-400'},
            {label: 'إجمالي نشط',  val: notifs.filter(n=>!n.is_resolved).length, color: 'text-slate-300'},
          ].map(c => (
            <div key={c.label} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5 text-slate-400 text-sm"><Filter className="w-4 h-4" /> تصفية:</div>
          {(['all','critical','warning','info'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter===f ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {f==='all'?'الكل':f==='critical'?'حرج':f==='warning'?'تحذير':'معلومة'}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          {modules.map(m => (
            <button key={m} onClick={()=>setModFilter(modFilter===m?'':m)}
              className={`px-3 py-1.5 rounded-lg text-sm ${modFilter===m ? 'bg-slate-600 text-white' : 'bg-slate-800/50 text-slate-500 hover:bg-slate-700'}`}>
              {MODULE_LABELS[m] || m}
            </button>
          ))}
          <button onClick={()=>setShowResolved(!showResolved)}
            className={`px-3 py-1.5 rounded-lg text-sm mr-auto ${showResolved ? 'bg-slate-600 text-white' : 'bg-slate-800/50 text-slate-500'}`}>
            {showResolved ? 'إخفاء المحلولة' : 'عرض المحلولة'}
          </button>
        </div>

        {/* Notification List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">لا توجد إشعارات</p>
              <button onClick={triggerSync} className="mt-4 px-4 py-2 bg-violet-600/20 text-violet-400 rounded-lg text-sm hover:bg-violet-600/30">
                مزامنة للتحقق من البيانات
              </button>
            </div>
          ) : (
            filtered.map(n => {
              const cfg = SEV_CONFIG[n.severity] || SEV_CONFIG.info;
              return (
                <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${cfg.bg} ${n.is_read ? 'opacity-70' : 'ring-1 ring-inset ring-white/5'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-100 text-sm">{n.title}</span>
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />}
                          <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.badge}`}>{cfg.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                            {MODULE_LABELS[n.module] || n.module}
                          </span>
                          {n.ref_code && <span className="text-xs text-slate-500 font-mono">{n.ref_code}</span>}
                        </div>
                        {n.message && <p className="text-slate-400 text-sm mt-1">{n.message}</p>}
                        <p className="text-slate-600 text-xs mt-1">
                          {new Date(n.created_at).toLocaleString('ar-SA')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {MODULE_LINKS[n.module] && (
                        <Link href={MODULE_LINKS[n.module]}
                          className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg"
                          onClick={e => e.stopPropagation()}>
                          فتح
                        </Link>
                      )}
                      {!n.is_resolved && (
                        <button onClick={e => { e.stopPropagation(); resolve(n.id); }}
                          className="px-3 py-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg">
                          حل
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
