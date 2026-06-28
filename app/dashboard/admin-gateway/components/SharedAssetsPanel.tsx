'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Boxes, RefreshCw, ExternalLink, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

type PrincipalAsset = {
  id: string;
  name: string;
  owner_department?: string | null;
};

type ChildAsset = {
  id: string;
  parent_asset_id?: string | null;
  name: string;
  asset_type?: string | null;
};

function getTenantHeader(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

export default function SharedAssetsPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<PrincipalAsset[]>([]);
  const [children, setChildren] = useState<ChildAsset[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/v1/workspace/principal-assets', {
          headers: getTenantHeader(),
        }),
        fetch('/api/v1/workspace/principal-assets/all-children', {
          headers: getTenantHeader(),
        }),
      ]);

      const pData = pRes.ok ? await pRes.json() : [];
      const cData = cRes.ok ? await cRes.json() : [];
      setAssets(Array.isArray(pData) ? pData : []);
      setChildren(Array.isArray(cData) ? cData : []);
    } catch {
      setAssets([]);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ownerOptions = useMemo(() => {
    const uniq = new Set<string>();
    for (const a of assets) {
      const dep = String(a.owner_department || '').trim();
      if (dep) uniq.add(dep);
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return assets.filter((a) => {
      const byOwner = ownerFilter === 'all' || String(a.owner_department || '') === ownerFilter;
      const byName = !qq || (a.name || '').toLowerCase().includes(qq);
      return byOwner && byName;
    });
  }, [assets, ownerFilter, q]);

  const childrenByParent = useMemo(() => {
    const map: Record<string, ChildAsset[]> = {};
    for (const c of children) {
      const key = String(c.parent_asset_id || '');
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [children]);

  return (
    <section className="mx-2 mt-2 mb-1 rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl" dir="rtl">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen(v => !v)}
          className="flex items-center gap-1.5 min-w-0 text-right"
        >
          {panelOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          )}
          <Building2 className="w-3.5 h-3.5 text-cyan-300" />
          <span className="text-[12px] font-semibold text-white truncate">الأصول الأساسية والفرعية</span>
          <span className="text-[10px] text-cyan-300/80">{assets.length}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-40"
            title="تحديث"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {panelOpen && (
        <>
          <div className="px-3 pt-2 pb-1 space-y-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث داخل الأصول..."
              className="w-full h-8 rounded-lg bg-slate-900/70 border border-slate-700 px-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500"
            />
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2" />
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full h-8 rounded-lg bg-slate-900/70 border border-slate-700 pr-7 pl-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
              >
                <option value="all">كل الإدارات المالكة</option>
                {ownerOptions.map((dep) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto px-2 pb-2 space-y-1">
            {!loading && filteredAssets.length === 0 && (
              <div className="text-[11px] text-slate-400 px-2 py-2">لا توجد أصول مطابقة</div>
            )}

            {filteredAssets.map((a) => {
              const aid = String(a.id);
              const kids = childrenByParent[aid] || [];
              const isOpen = !!expanded[aid];
              return (
                <div key={aid} className="rounded-lg border border-white/10 bg-slate-900/40">
                  <div className="w-full px-2 py-1.5 flex items-center gap-1.5 hover:bg-white/5">
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [aid]: !p[aid] }))}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-right"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="text-[11px] text-slate-100 truncate flex-1">{a.name}</span>
                    </button>
                    <span className="text-[10px] text-rose-300/90">{kids.length} فرعي</span>
                    <button
                      onClick={() => router.push(`/dashboard/gis-sovereignty/engineering-workspace?asset=${encodeURIComponent(aid)}`)}
                      className="p-1 rounded text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
                      title="فتح الأصل مباشرة على الخريطة"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-white/10 px-2 py-1.5 space-y-1">
                      {kids.length === 0 ? (
                        <div className="text-[10px] text-slate-500">لا توجد أصول فرعية</div>
                      ) : (
                        kids.map((k) => (
                          <button
                            key={k.id}
                            onClick={() => router.push(`/dashboard/gis-sovereignty/engineering-workspace?asset=${encodeURIComponent(aid)}&child=${encodeURIComponent(String(k.id))}`)}
                            className="w-full flex items-center gap-1.5 text-[10px] text-slate-300 hover:text-white hover:bg-white/5 rounded px-1 py-1 text-right"
                            title="فتح الأصل الفرعي مباشرة"
                          >
                            <Boxes className="w-3 h-3 text-rose-300/80" />
                            <span className="truncate">{k.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard/gis-sovereignty/engineering-workspace')}
              className="w-full h-8 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 text-[11px] hover:bg-cyan-500/20"
              title="عرض وتحرير الأصول على الخريطة ورفع البيانات"
            >
              فتح لوحة الأصول على الخريطة
            </button>
          </div>
        </>
      )}
    </section>
  );
}
