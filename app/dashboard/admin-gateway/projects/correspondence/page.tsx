'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Send, Inbox, Mail, Archive, FileText, Plus,
  Search, ChevronLeft, Clock, CheckCircle, AlertCircle,
} from 'lucide-react';

function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

interface CorrespondenceItem {
  id: number;
  subject: string;
  direction: 'incoming' | 'outgoing' | 'internal';
  status: 'pending' | 'replied' | 'archived';
  from_dept?: string;
  to_dept?: string;
  created_at: string;
}

const TABS = [
  { key: 'incoming', label: 'الوارد', icon: Inbox, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/20' },
  { key: 'outgoing', label: 'الصادر', icon: Send, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/20' },
  { key: 'internal', label: 'الداخلي', icon: Mail, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/20' },
  { key: 'archive', label: 'الأرشيف', icon: Archive, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/20' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function ProjectsCorrespondencePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('incoming');
  const [items, setItems] = useState<CorrespondenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/dept-admin/projects/correspondence?direction=${activeTab}`, {
      headers: getHeaders(),
    })
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.data) ? d.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filtered = items.filter((i) =>
    i.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const activeTabInfo = TABS.find((t) => t.key === activeTab)!;
  const Icon = activeTabInfo.icon;

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col" dir="rtl">
      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full px-4 py-4 gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <Link
              href="/dashboard/admin-gateway/projects"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-1"
            >
              <ArrowRight className="w-4 h-4" />
              إدارة المشاريع
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">نظام المراسلات الموحد</h1>
            <p className="text-slate-400 text-xs mt-0.5">Unified Correspondence System — Projects</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-200 hover:bg-purple-500/20 transition-colors">
            <Plus className="w-4 h-4" />
            مراسلة جديدة
          </button>
        </div>

        {/* Tab bar */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          {TABS.map((tab) => {
            const T = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all
                  ${activeTab === tab.key
                    ? `${tab.border} ${tab.bg} ${tab.color}`
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:bg-slate-800/50'
                  }`}
              >
                <T className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المراسلات..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className={`w-14 h-14 rounded-2xl ${activeTabInfo.bg} border ${activeTabInfo.border} flex items-center justify-center`}>
                <Icon className={`w-7 h-7 ${activeTabInfo.color}`} />
              </div>
              <p className="text-slate-400 text-sm">لا توجد مراسلات في {activeTabInfo.label}</p>
              <p className="text-slate-600 text-xs">ستظهر المراسلات هنا عند توفرها</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 hover:bg-slate-800/60 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.subject}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {item.from_dept && <span>من: {item.from_dept}</span>}
                        {item.to_dept && <span>إلى: {item.to_dept}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleDateString('ar-LY')}
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium
                      ${item.status === 'replied' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30'
                        : item.status === 'pending' ? 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                      {item.status === 'replied' ? <><CheckCircle className="w-3 h-3" /> تم الرد</>
                        : item.status === 'pending' ? <><AlertCircle className="w-3 h-3" /> معلق</>
                        : <><Archive className="w-3 h-3" /> مؤرشف</>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-400 font-medium shrink-0">روابط سريعة:</span>
            <Link href="/dashboard/admin-gateway/correspondence/incoming" className="rounded-full border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-0.5 text-emerald-300 hover:bg-emerald-900/40 transition-colors">
              الوارد العام
            </Link>
            <Link href="/dashboard/admin-gateway/correspondence/outgoing" className="rounded-full border border-blue-700/50 bg-blue-900/20 px-2.5 py-0.5 text-blue-300 hover:bg-blue-900/40 transition-colors">
              الصادر العام
            </Link>
            <Link href="/dashboard/admin-gateway/correspondence/internal" className="rounded-full border border-purple-700/50 bg-purple-900/20 px-2.5 py-0.5 text-purple-300 hover:bg-purple-900/40 transition-colors">
              المذكرات الداخلية
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
