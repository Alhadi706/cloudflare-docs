'use client';

import React, { useEffect, useMemo, useState } from 'react';

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}

type PrincipalAsset = {
  id: string;
  name?: string;
  asset_name?: string;
  classification?: string | null;
  owner_department?: string | null;
  status?: string | null;
};

export default function Asset360LandingPage() {
  const [assets, setAssets] = useState<PrincipalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const errorMessageAr = useMemo(() => {
    if (!error) return '';

    if (errorStatus === 401) {
      return 'انتهت جلسة الدخول أو لم يتم تسجيل الدخول. يرجى تسجيل الدخول ثم إعادة فتح الصفحة.';
    }

    if (errorStatus === 403) {
      return 'ليس لديك صلاحية الوصول إلى بيانات الأصول حالياً. تأكد من اختيار المؤسسة الصحيحة وتفعيل صلاحيات GIS/الأصول.';
    }

    if (errorStatus === 404) {
      return 'تعذر العثور على خدمة الأصول. يرجى المحاولة لاحقاً أو التواصل مع الدعم.';
    }

    if (String(error).toLowerCase().includes('tenant')) {
      return 'تعذر تحديد سياق المؤسسة. سجل الدخول مرة أخرى ثم اختر المؤسسة الصحيحة.';
    }

    if (String(error).toLowerCase().includes('module access denied')) {
      return 'وحدة GIS غير مفعلة لهذه المؤسسة حالياً. يرجى مراجعة إعدادات التفعيل.';
    }

    return 'تعذر تحميل قائمة الأصول الآن. حاول تحديث الصفحة، وإذا استمرت المشكلة تواصل مع الدعم.';
  }, [error, errorStatus]);

  useEffect(() => {
    let mounted = true;

    async function loadAssets() {
      setLoading(true);
      setError('');
      setErrorStatus(null);
      try {
        const tenantId = getTenantId();
        const headers: Record<string, string> = {};
        if (tenantId) headers['X-Tenant-ID'] = tenantId;
        const res = await fetch('/api/engineering/workspace/principal-assets', {
          cache: 'no-store',
          headers,
        });
        const json = await res.json().catch(() => []);
        if (!res.ok) {
          const detail = typeof json?.detail === 'string'
            ? json.detail
            : typeof json?.error === 'string'
              ? json.error
              : '';
          const e: Error & { status?: number } = new Error(detail || `HTTP ${res.status}`);
          e.status = res.status;
          throw e;
        }
        if (mounted) setAssets(Array.isArray(json) ? json : []);
      } catch (err: any) {
        if (mounted) {
          setErrorStatus(typeof err?.status === 'number' ? err.status : null);
          setError(String(err?.message || 'Failed to load assets'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadAssets();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => {
      const text = [asset.id, asset.name, asset.asset_name, asset.classification, asset.owner_department, asset.status]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return text.includes(q);
    });
  }, [assets, query]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">المرحلة التنفيذية 4B</p>
          <h1 className="text-2xl font-semibold text-slate-900">مساحة عمل الأصل 360</h1>
          <p className="mt-1 text-sm text-slate-600">اختر أصلاً رئيسياً أو فرعياً لفتح العرض التشغيلي الموحد.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالمعرف أو الاسم أو الإدارة أو الحالة"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 sm:max-w-md"
            />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {loading ? 'جاري التحميل...' : `${filtered.length} أصل`}
            </span>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">تعذر تحميل الأصول</p>
              <p className="mt-1 text-sm text-red-700">{errorMessageAr}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="/login"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  تسجيل الدخول
                </a>
                <a
                  href="/dashboard/asset-360"
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  إعادة المحاولة
                </a>
                {errorStatus ? (
                  <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200">
                    رمز الخطأ: {errorStatus}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.slice(0, 100).map((asset) => (
                <a key={asset.id} href={`/dashboard/asset-360/${encodeURIComponent(asset.id)}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-slate-300 hover:bg-white">
                  <p className="truncate text-sm font-semibold text-slate-900">{asset.asset_name || asset.name || asset.id}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-600">{asset.id} • {asset.owner_department || '-'} • {asset.status || '-'}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
