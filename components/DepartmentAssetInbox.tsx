'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Search, MapPin, Package, ChevronLeft, AlertCircle } from 'lucide-react';

type DepartmentKey = 'administrative' | 'finance' | 'technical' | 'maintenance';

interface Props {
  department: DepartmentKey;
  title?: string;
  compact?: boolean;
}

interface AssetLike {
  id: number | string;
  asset_id?: string;
  asset_code?: string;
  code?: string;
  name?: string;
  asset_name?: string;
  asset_type?: string;
  category?: string;
  location?: string;
  status?: string;
  department?: string;
  department_owner?: string;
  owner_department?: string;
  managing_department?: string;
  responsible_department?: string;
}

const DEPT_LABEL: Record<DepartmentKey, string> = {
  administrative: 'الإدارة',
  finance: 'المالية',
  technical: 'الفنية',
  maintenance: 'الصيانة',
};

function normalize(v: unknown): string {
  return String(v ?? '').toLowerCase().trim();
}

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}

export default function DepartmentAssetInbox({ department, title, compact = false }: Props) {
  const [assets, setAssets] = useState<AssetLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const tenantId = getTenantId();
        const headers = tenantId ? { 'X-Tenant-ID': tenantId } : {};
        const [wRes, mRes] = await Promise.all([
          fetch('/api/v1/workspace/assets/all?limit=3000', { headers }),
          fetch('/api/v1/maintenance/assets', { headers }),
        ]);

        const merged: AssetLike[] = [];

        if (wRes.ok) {
          const d = await wRes.json();
          const list = Array.isArray(d) ? d : (d.assets || []);
          merged.push(...list);
        }

        if (mRes.ok) {
          const d = await mRes.json();
          const list = Array.isArray(d) ? d : (d.assets || []);
          merged.push(...list);
        }

        // Dedupe by id
        const uniq = new Map<string, AssetLike>();
        merged.forEach(a => uniq.set(String(a.id), a));

        if (alive) setAssets(Array.from(uniq.values()));
      } catch {
        if (alive) setAssets([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [department]);

  const scoped = useMemo(() => assets, [assets]);
  const filtered = useMemo(() => {
    if (!query.trim()) return scoped;
    const q = normalize(query);
    return scoped.filter(a => {
      const text = [a.name, a.asset_name, a.asset_code, a.asset_id, a.asset_type, a.category, a.location]
        .map(normalize)
        .join(' ');
      return text.includes(q);
    });
  }, [scoped, query]);

  const shown = filtered.slice(0, compact ? 6 : 10);
  const panelTitle = title || `الأصول المشتركة — ${DEPT_LABEL[department]}`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-cyan-300" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-200">{panelTitle}</h3>
          <p className="text-xs text-slate-500">{loading ? '...' : `${scoped.length} أصل`} مشترك بين الإدارات</p>
        </div>
        <Link href="/dashboard/admin-gateway/assets/registry" className="mr-auto text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1">
          عرض الكل <ChevronLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="relative mb-3">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث داخل الأصول المشتركة..."
          className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pr-8 pl-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60"
        />
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 py-3">جاري تحميل الأصول...</div>
      ) : shown.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
          <AlertCircle className="w-4 h-4" />
          لا توجد أصول مطابقة للبحث الحالي
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((a) => (
            <div key={String(a.id)} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-200 truncate">{a.asset_name || a.name || `Asset #${a.id}`}</p>
                <span className="mr-auto text-[10px] text-slate-500 font-mono">{a.asset_code || a.asset_id || a.code || a.id}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span>{a.asset_type || a.category || 'غير مصنف'}</span>
                {a.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[220px]">{a.location}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
