'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, Inbox, MailOpen, Loader2, ImageIcon, X, Users } from 'lucide-react';
import { MAILBOX_OPTIONS, getMailboxLabel, normalizeMailboxKey } from '@/lib/internalMailDirectory';

type MailItem = {
  id: string;
  fromDepartment: string;
  toDepartment: string;
  subject: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'unread' | 'read';
  createdAt: string;
  recipients?: string[];
  ccRecipients?: string[];
  attachmentUrls?: string[];
  isBroadcast?: boolean;
  recipientMode?: 'direct' | 'cc' | 'broadcast';
};

type Stats = {
  inbox_total: number;
  inbox_unread: number;
  outbox_total: number;
};

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;

  const token = localStorage.getItem('auth_token') || '';
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const email = localStorage.getItem('user_email') || '';
  const role = localStorage.getItem('user_role') || localStorage.getItem('role') || 'user';
  
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (tenantId) headers['x-verified-tenant-id'] = tenantId;
  if (tenantCode) headers['x-verified-tenant-code'] = tenantCode;
  if (email) headers['x-verified-email'] = email;
  if (role) headers['x-verified-role'] = role;
  
  return headers;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('failed_to_read_file'));
    reader.readAsDataURL(file);
  });
}

export default function InternalMailTab({
  department,
  title,
  initialTab,
}: {
  department: string;
  title?: string;
  initialTab?: 'inbox' | 'outbox' | 'compose';
}) {
  const selfMailbox = normalizeMailboxKey(department);

  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox' | 'compose'>(initialTab || 'inbox');
  const [stats, setStats] = useState<Stats>({ inbox_total: 0, inbox_unread: 0, outbox_total: 0 });
  const [inbox, setInbox] = useState<MailItem[]>([]);
  const [outbox, setOutbox] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [toDepartments, setToDepartments] = useState<string[]>([]);
  const [ccDepartments, setCcDepartments] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [attachmentDataUrls, setAttachmentDataUrls] = useState<string[]>([]);

  const recipientOptions = useMemo(
    () => MAILBOX_OPTIONS.filter((d) => d.key !== selfMailbox),
    [selfMailbox],
  );

  const [recipientSearch, setRecipientSearch] = useState('');
  const filteredRecipientOptions = useMemo(
    () =>
      recipientSearch.trim()
        ? recipientOptions.filter((o) => o.label.includes(recipientSearch.trim()))
        : recipientOptions,
    [recipientOptions, recipientSearch],
  );

  useEffect(() => {
    if (!toDepartments.length) {
      const first = recipientOptions.find((o) => o.group === 'departments') || recipientOptions[0];
      if (first) setToDepartments([first.key]);
    }
  }, [recipientOptions, toDepartments.length]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = getAuthHeaders();
      const [s, i, o] = await Promise.all([
        fetch(`/api/v1/internal-mail/stats?department=${encodeURIComponent(selfMailbox)}`, { headers }),
        fetch(`/api/v1/internal-mail/inbox?department=${encodeURIComponent(selfMailbox)}&limit=40`, { headers }),
        fetch(`/api/v1/internal-mail/outbox?department=${encodeURIComponent(selfMailbox)}&limit=40`, { headers }),
      ]);

      if (!s.ok || !i.ok || !o.ok) {
        setError('تعذر تحميل نظام المراسلات الموحد');
        return;
      }

      const sJson = await s.json();
      const iJson = await i.json();
      const oJson = await o.json();
      setStats(sJson?.data || { inbox_total: 0, inbox_unread: 0, outbox_total: 0 });
      setInbox(Array.isArray(iJson?.data) ? iJson.data : []);
      setOutbox(Array.isArray(oJson?.data) ? oJson.data : []);
    } catch {
      setError('تعذر تحميل نظام المراسلات الموحد');
    } finally {
      setLoading(false);
    }
  }, [selfMailbox]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRecipient = (key: string) => {
    setToDepartments((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const toggleCc = (key: string) => {
    setCcDepartments((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    if (!files.length) return;

    try {
      const encoded = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith('image/')) {
            throw new Error('يرجى اختيار صور فقط');
          }
          if (file.size > 2_000_000) {
            throw new Error(`الصورة ${file.name} أكبر من 2MB`);
          }
          return fileToDataUrl(file);
        }),
      );
      setAttachmentDataUrls((prev) => [...prev, ...encoded].slice(0, 8));
      setError('');
    } catch (err: any) {
      setError(String(err?.message || 'تعذر قراءة الصور'));    
    } finally {
      e.target.value = '';
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTo = Array.from(new Set(toDepartments.map(normalizeMailboxKey))).filter(Boolean);
    const cleanCc = Array.from(new Set(ccDepartments.map(normalizeMailboxKey))).filter(Boolean);

    if (!broadcast && cleanTo.length === 0 && cleanCc.length === 0) {
      setError('اختر مستلمًا واحدًا على الأقل أو فعّل خيار التعميم');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError('يرجى إدخال عنوان ونص الرسالة');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const r = await fetch('/api/v1/internal-mail/send', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDepartment: selfMailbox,
          toDepartments: cleanTo,
          ccDepartments: cleanCc,
          broadcast,
          subject: subject.trim(),
          body: body.trim(),
          priority,
          attachmentDataUrls,
        }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(String(j?.error || 'فشل إرسال الرسالة'));
        return;
      }

      setSubject('');
      setBody('');
      setPriority('normal');
      setToDepartments([]);
      setCcDepartments([]);
      setBroadcast(false);
      setAttachmentDataUrls([]);
      setActiveTab('outbox');
      await load();
      setRecipientSearch('');
    } catch {
      setError('فشل إرسال الرسالة');
    } finally {
      setSaving(false);
    }
  };

  const resetComposeForm = () => {
    setSubject('');
    setBody('');
    setPriority('normal');
    setToDepartments([]);
    setCcDepartments([]);
    setBroadcast(false);
    setAttachmentDataUrls([]);
    setRecipientSearch('');
  };

  const markRead = async (id: string) => {
    try {
      const r = await fetch(`/api/v1/internal-mail/read/${id}?department=${encodeURIComponent(selfMailbox)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (!r.ok) return;
      setInbox((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'read' } : m)));
      setStats((prev) => ({ ...prev, inbox_unread: Math.max(0, prev.inbox_unread - 1) }));
    } catch {
      // no-op
    }
  };

  const visible = useMemo(() => (activeTab === 'inbox' ? inbox : outbox), [activeTab, inbox, outbox]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-sm md:text-base font-bold text-white">{title || 'المراسلات الداخلية'}</h3>
          <p className="text-xs text-slate-400 mt-1">نظام موحد بين الإدارات والأقسام مع نسخ، تعميم، وإرفاق صور</p>
        </div>
        <div className="text-xs text-slate-300 flex items-center gap-3">
          <span>الوارد: {stats.inbox_total}</span>
          <span className="text-amber-300">غير مقروء: {stats.inbox_unread}</span>
          <span>الصادر: {stats.outbox_total}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-3 py-1.5 rounded-lg text-xs border ${activeTab === 'inbox' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
        >
          <span className="inline-flex items-center gap-1.5"><Inbox className="w-3.5 h-3.5" /> الوارد</span>
        </button>
        <button
          onClick={() => setActiveTab('outbox')}
          className={`px-3 py-1.5 rounded-lg text-xs border ${activeTab === 'outbox' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
        >
          <span className="inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> الصادر</span>
        </button>
        <button
          onClick={() => setActiveTab('compose')}
          className={`px-3 py-1.5 rounded-lg text-xs border ${activeTab === 'compose' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
        >
          رسالة جديدة
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      {activeTab === 'compose' ? (
        <form onSubmit={sendMessage} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'high' | 'urgent')}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="normal">أولوية عادية</option>
              <option value="high">أولوية عالية</option>
              <option value="urgent">عاجل</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={broadcast}
                onChange={(e) => setBroadcast(e.target.checked)}
                className="accent-violet-500"
              />
              <Users className="w-3.5 h-3.5 text-violet-300" />
              تعميم على كل الإدارات
            </label>
            <button
              disabled={saving}
              type="submit"
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
            </button>
          </div>

          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="عنوان الرسالة"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="نص الرسالة"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-300">إلى (المستلمون الأساسيون)</p>
                <span className="text-[10px] text-cyan-400">{toDepartments.length} محدد</span>
              </div>
              <input
                type="text"
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                placeholder="ابحث عن إدارة..."
                className="w-full mb-2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500"
              />
              <div className="max-h-44 overflow-auto space-y-1 pr-1">
                {filteredRecipientOptions.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={toDepartments.includes(opt.key)}
                      onChange={() => toggleRecipient(opt.key)}
                      className="accent-cyan-500"
                    />
                    <span className={opt.group === 'sections' ? 'text-slate-400' : ''}>{opt.label}</span>
                  </label>
                ))}
                {filteredRecipientOptions.length === 0 && (
                  <p className="text-xs text-slate-500 py-2 text-center">لا توجد نتائج</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-300">نسخ (CC)</p>
                <span className="text-[10px] text-emerald-400">{ccDepartments.length} محدد</span>
              </div>
              <div className="max-h-44 overflow-auto space-y-1 pr-1">
                {filteredRecipientOptions.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={ccDepartments.includes(opt.key)}
                      onChange={() => toggleCc(opt.key)}
                      className="accent-emerald-500"
                    />
                    <span className={opt.group === 'sections' ? 'text-slate-400' : ''}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs text-slate-300">الصور المرفقة (حد أقصى 8 صور)</p>
              <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer hover:bg-slate-800">
                <ImageIcon className="w-3.5 h-3.5" />
                إضافة صور
                <input type="file" accept="image/*" multiple className="hidden" onChange={onFilesPicked} />
              </label>
            </div>

            {attachmentDataUrls.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {attachmentDataUrls.map((src, idx) => (
                  <div key={`${idx}-${src.slice(0, 20)}`} className="relative">
                    <img src={src} alt={`attachment-${idx + 1}`} className="w-full h-20 object-cover rounded-md border border-slate-700" />
                    <button
                      type="button"
                      onClick={() => setAttachmentDataUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -left-1.5 rounded-full bg-red-600 p-1 text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">لا توجد صور مرفقة</p>
            )}
          </div>
        </form>
      ) : loading ? (
        <div className="py-10 text-center text-slate-500 text-sm">جاري التحميل...</div>
      ) : visible.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm">لا توجد رسائل</div>
      ) : (
        <div className="space-y-2">
          {visible.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-semibold truncate">{m.subject}</p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{m.body}</p>

                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {activeTab === 'inbox'
                      ? `من: ${getMailboxLabel(m.fromDepartment)} · إلى: ${getMailboxLabel(m.toDepartment)}`
                      : `من: ${getMailboxLabel(m.fromDepartment)} · إلى: ${getMailboxLabel(m.toDepartment)}`}
                    {' · '}
                    {new Date(m.createdAt).toLocaleString('ar-SA')}
                  </p>

                  {Array.isArray(m.recipients) && m.recipients.length > 0 ? (
                    <p className="text-[11px] text-slate-500 mt-1">
                      المستلمون: {m.recipients.map((r) => getMailboxLabel(r)).join('، ')}
                    </p>
                  ) : null}

                  {Array.isArray(m.ccRecipients) && m.ccRecipients.length > 0 ? (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      نسخة إلى: {m.ccRecipients.map((r) => getMailboxLabel(r)).join('، ')}
                    </p>
                  ) : null}

                  {Array.isArray(m.attachmentUrls) && m.attachmentUrls.length > 0 ? (
                    <div className="mt-2 grid grid-cols-4 gap-1.5 max-w-md">
                      {m.attachmentUrls.slice(0, 8).map((src, idx) => (
                        <a key={`${m.id}-img-${idx}`} href={src} target="_blank" rel="noreferrer">
                          <img src={src} alt={`img-${idx + 1}`} className="h-14 w-full object-cover rounded border border-slate-700" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {activeTab === 'inbox' && m.status === 'unread' && (
                    <button
                      onClick={() => void markRead(m.id)}
                      className="text-[11px] px-2 py-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 inline-flex items-center gap-1"
                    >
                      <MailOpen className="w-3 h-3" /> تعليم كمقروء
                    </button>
                  )}

                  {m.isBroadcast ? (
                    <span className="text-[11px] px-2 py-1 rounded-md border border-violet-500/40 bg-violet-500/15 text-violet-300">
                      تعميم
                    </span>
                  ) : null}

                  <span className={`text-[11px] px-2 py-1 rounded-md border ${m.priority === 'urgent' ? 'border-red-500/40 bg-red-500/15 text-red-300' : m.priority === 'high' ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-slate-600 bg-slate-700/40 text-slate-300'}`}>
                    {m.priority === 'urgent' ? 'عاجل' : m.priority === 'high' ? 'عالي' : 'عادي'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
