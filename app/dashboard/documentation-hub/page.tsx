'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FolderArchive, FileText, Send, Inbox, BarChart3, Loader2 } from 'lucide-react';

type ExternalMail = {
  id: string;
  direction: 'incoming' | 'outgoing';
  counterparty: string;
  subject: string;
  body: string;
  createdAt: string;
};

type ArchiveModule = {
  module: string;
  count: number;
  avg_completeness: number;
};

function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token') || '';
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

export default function DocumentationHubPage() {
  const [incoming, setIncoming] = useState<ExternalMail[]>([]);
  const [outgoing, setOutgoing] = useState<ExternalMail[]>([]);
  const [archive, setArchive] = useState<ArchiveModule[]>([]);
  const [crossStats, setCrossStats] = useState<{ documentationRecords: number; externalMail: number; hrInternalMail: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing');
  const [counterparty, setCounterparty] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [docModule, setDocModule] = useState('contracts');
  const [docTitle, setDocTitle] = useState('');
  const [docRef, setDocRef] = useState('');
  const [docCompleteness, setDocCompleteness] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [i, o, a, s] = await Promise.all([
        fetch('/api/v1/documentation/external-mail?direction=incoming&limit=6', { headers }),
        fetch('/api/v1/documentation/external-mail?direction=outgoing&limit=6', { headers }),
        fetch('/api/v1/documentation/archive-completeness', { headers }),
        fetch('/api/v1/documentation/cross-schema-stats', { headers }),
      ]);
      const iJson = await i.json().catch(() => ({}));
      const oJson = await o.json().catch(() => ({}));
      const aJson = await a.json().catch(() => ({}));
      const sJson = await s.json().catch(() => ({}));
      setIncoming(Array.isArray(iJson?.data) ? iJson.data : []);
      setOutgoing(Array.isArray(oJson?.data) ? oJson.data : []);
      setArchive(Array.isArray(aJson?.data) ? aJson.data : []);
      setCrossStats(sJson?.data || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitExternalMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterparty.trim() || !subject.trim() || !body.trim()) return;

    setSaving(true);
    try {
      await fetch('/api/v1/documentation/external-mail', {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, counterparty, subject, body }),
      });
      setCounterparty('');
      setSubject('');
      setBody('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const submitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docModule.trim() || !docTitle.trim()) return;

    setSaving(true);
    try {
      await fetch('/api/v1/documentation/records', {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: docModule,
          title: docTitle,
          refNo: docRef,
          completenessPct: docCompleteness,
          metadata: { source: 'documentation_hub' },
        }),
      });
      setDocTitle('');
      setDocRef('');
      setDocCompleteness(60);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const archiveScore = useMemo(() => {
    if (!archive.length) return 0;
    return Math.round(archive.reduce((s, x) => s + Number(x.avg_completeness || 0), 0) / archive.length);
  }, [archive]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" /> لوحة التحكم
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white">إدارة التوثيق والمعلومات</h1>
          <p className="text-slate-400 text-sm mt-1">المراسلات الخارجية + توثيق العقود وملفات الأصول والمشاريع + متابعة اكتمال الأرشفة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="text-xs text-slate-500">سجلات التوثيق</p><p className="text-xl font-bold text-cyan-300">{crossStats?.documentationRecords ?? 0}</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="text-xs text-slate-500">المراسلات الخارجية</p><p className="text-xl font-bold text-violet-300">{crossStats?.externalMail ?? 0}</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="text-xs text-slate-500">ربط HR داخلي</p><p className="text-xl font-bold text-emerald-300">{crossStats?.hrInternalMail ?? 0}</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="text-xs text-slate-500">مؤشر اكتمال الأرشيف</p><p className="text-xl font-bold text-amber-300">{archiveScore}%</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form onSubmit={submitExternalMail} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white inline-flex items-center gap-2"><Send className="w-4 h-4 text-cyan-300" /> تسجيل مراسلة خارجية (صادر/وارد)</h2>
            <div className="grid grid-cols-2 gap-2">
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="outgoing">صادر</option>
                <option value="incoming">وارد</option>
              </select>
              <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="الجهة الخارجية" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="الموضوع" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="نص المراسلة" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} حفظ مراسلة
            </button>
          </form>

          <form onSubmit={submitRecord} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h2 className="text-sm font-bold text-white inline-flex items-center gap-2"><FileText className="w-4 h-4 text-violet-300" /> توثيق العقود/الأصول/المشاريع</h2>
            <div className="grid grid-cols-2 gap-2">
              <select value={docModule} onChange={(e) => setDocModule(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="contracts">العقود</option>
                <option value="assets">الأصول</option>
                <option value="projects">المشاريع</option>
                <option value="archive">الأرشيف</option>
              </select>
              <input value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="رقم المرجع" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="عنوان الملف" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <div>
              <label className="text-xs text-slate-400">اكتمال البيانات: {docCompleteness}%</label>
              <input type="range" min={0} max={100} value={docCompleteness} onChange={(e) => setDocCompleteness(Number(e.target.value))} className="w-full" />
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />} حفظ سجل
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-bold text-cyan-300 mb-2 inline-flex items-center gap-2"><Inbox className="w-4 h-4" /> وارد خارجي</h3>
            <div className="space-y-2">
              {loading ? <p className="text-xs text-slate-500">جاري التحميل...</p> : incoming.slice(0, 5).map((m) => (
                <div key={m.id} className="border border-slate-800 rounded-lg p-2">
                  <p className="text-xs text-white font-semibold truncate">{m.subject}</p>
                  <p className="text-[11px] text-slate-400 truncate">{m.counterparty}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-bold text-emerald-300 mb-2 inline-flex items-center gap-2"><Send className="w-4 h-4" /> صادر خارجي</h3>
            <div className="space-y-2">
              {loading ? <p className="text-xs text-slate-500">جاري التحميل...</p> : outgoing.slice(0, 5).map((m) => (
                <div key={m.id} className="border border-slate-800 rounded-lg p-2">
                  <p className="text-xs text-white font-semibold truncate">{m.subject}</p>
                  <p className="text-[11px] text-slate-400 truncate">{m.counterparty}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-bold text-amber-300 mb-2 inline-flex items-center gap-2"><BarChart3 className="w-4 h-4" /> اكتمال الأرشيف</h3>
            <div className="space-y-2">
              {loading ? <p className="text-xs text-slate-500">جاري التحميل...</p> : archive.map((m) => (
                <div key={m.module} className="border border-slate-800 rounded-lg p-2">
                  <p className="text-xs text-white">{m.module}</p>
                  <p className="text-[11px] text-slate-400">عدد الملفات: {m.count} · اكتمال: {m.avg_completeness}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
