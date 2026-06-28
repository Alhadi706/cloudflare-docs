'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Search, AlertTriangle, TrendingDown,
  ChevronLeft, Box, RefreshCw, X, ShoppingCart,
} from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';

const getTenantId = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || '';
};

interface SparePart {
  id: number;
  part_number?: string;
  part_name: string;
  category: string;
  manufacturer?: string;
  quantity_in_stock: number;
  minimum_stock_level: number;
  unit_price?: number;
  location?: string;
  status: string;
}

const CATEGORY_AR: Record<string, string> = {
  electrical: 'كهربائي',
  mechanical: 'ميكانيكي',
  hydraulic:  'هيدروليكي',
  filters:    'فلاتر',
  bearings:   'محامل',
  seals:      'أختام',
  belts:      'أحزمة',
  other:      'أخرى',
};

function stockInfo(part: SparePart) {
  if (part.quantity_in_stock === 0)
    return { label: 'نفذ المخزون', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', pct: 0, urgent: true };
  if (part.quantity_in_stock <= part.minimum_stock_level)
    return { label: 'مخزون منخفض', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', pct: Math.round((part.quantity_in_stock / (part.minimum_stock_level * 2)) * 100), urgent: true };
  return { label: 'جيد', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', pct: Math.min(100, Math.round((part.quantity_in_stock / (part.minimum_stock_level * 3)) * 100)), urgent: false };
}

const inputCls = 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500';

export default function SparePartsPage() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAlert, setFilterAlert] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editPart, setEditPart] = useState<SparePart | null>(null);
  const [restockingId, setRestockingId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [formData, setFormData] = useState({
    part_name: '', part_number: '', category: '', manufacturer: '',
    quantity_in_stock: '', minimum_stock_level: '5', unit_price: '', location: '',
  });

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setBackendError(false);
    try {
      const res = await fetch('/api/v1/hr-structure/spare-parts', {
        headers: { 'X-Tenant-ID': getTenantId() },
      });
      if (res.ok) {
        const d = await res.json();
        const mapped: SparePart[] = (d.items || []).map((i: Record<string, unknown>) => ({
          id: i.id as number,
          part_number: i.item_code as string,
          part_name: i.item_name as string,
          category: i.item_category as string,
          quantity_in_stock: (i.quantity_received as number) || 0,
          minimum_stock_level: (i.min_stock_level as number) || 5,
          unit_price: i.default_cost as number | undefined,
          status: i.status as string,
          location: i.location as string | undefined,
        }));
        setParts(mapped);
      } else {
        setBackendError(true);
      }
    } catch {
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  // ── Request restock via CMMS work order ────────────────────────────────────
  const requestRestock = async (part: SparePart) => {
    setRestockingId(part.id);
    try {
      const res = await fetch('/api/v1/workspace/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_ar: `طلب تعبئة مخزون — ${part.part_name}`,
          title: `Restock Request — ${part.part_name}`,
          asset_name: part.part_name,
          description: `قطعة الغيار: ${part.part_name}\nرقم القطعة: ${part.part_number || '—'}\nالكمية الحالية: ${part.quantity_in_stock}\nالحد الأدنى: ${part.minimum_stock_level}\nالموقع: ${part.location || '—'}`,
          work_type: 'preventive',
          priority: part.quantity_in_stock === 0 ? 'urgent' : 'normal',
          scheduled_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          target_department: 'maintenance',
          target_team: 'procurement',
          created_by: 'spare_parts_system',
          notes: `طلب تعبئة مخزون تلقائي — ${part.quantity_in_stock === 0 ? 'نفذ المخزون عاجل!' : 'مخزون منخفض'}`,
        }),
      });
      toast(res.ok ? '✅ تم إنشاء طلب تعبئة المخزون في CMMS' : '⚠️ فشل إنشاء الطلب');
    } catch {
      toast('❌ خطأ في الاتصال');
    } finally {
      setRestockingId(null);
    }
  };

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editPart
      ? `/api/v1/hr-structure/spare-parts/${editPart.id}`
      : '/api/v1/hr-structure/spare-parts';
    try {
      await fetch(url, {
        method: editPart ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() },
        body: JSON.stringify({
          item_code: formData.part_number,
          item_name: formData.part_name,
          item_category: formData.category,
          default_cost: formData.unit_price ? parseFloat(formData.unit_price) : undefined,
          min_stock_level: parseInt(formData.minimum_stock_level),
          location: formData.location,
          unit: 'قطعة',
        }),
      });
    } catch { /* silent */ }
    setShowForm(false);
    setEditPart(null);
    setFormData({ part_name: '', part_number: '', category: '', manufacturer: '', quantity_in_stock: '', minimum_stock_level: '5', unit_price: '', location: '' });
    await fetchParts();
  };

  const openEdit = (p: SparePart) => {
    setEditPart(p);
    setFormData({
      part_name: p.part_name, part_number: p.part_number || '',
      category: p.category, manufacturer: p.manufacturer || '',
      quantity_in_stock: p.quantity_in_stock.toString(),
      minimum_stock_level: p.minimum_stock_level.toString(),
      unit_price: p.unit_price?.toString() || '', location: p.location || '',
    });
    setShowForm(true);
  };

  const filtered = parts.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchQ = !q ||
      p.part_name?.toLowerCase().includes(q) ||
      p.part_number?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);
    const matchAlert = !filterAlert || stockInfo(p).urgent;
    return matchQ && matchAlert;
  });

  const kpi = {
    total:   parts.length,
    low:     parts.filter(p => p.quantity_in_stock > 0 && p.quantity_in_stock <= p.minimum_stock_level).length,
    out:     parts.filter(p => p.quantity_in_stock === 0).length,
    value:   parts.reduce((s, p) => s + (p.quantity_in_stock * (p.unit_price || 0)), 0),
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة النظام</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance" className="hover:text-slate-300">الصيانة</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance/technical" className="hover:text-slate-300">الواجهة الفنية</Link>
          <ChevronLeft className="w-3 h-3" />
          <span className="text-slate-200">قطع الغيار</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-500/10 p-3 rounded-xl border border-violet-500/30">
              <Package className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">قطع الغيار والمواد</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                إدارة المخزون • عند نقص المخزون يُنشأ طلب تعبئة تلقائياً في{' '}
                <Link href="/dashboard/admin-gateway/maintenance/work-orders"
                  className="text-violet-400 hover:underline">CMMS</Link>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ImportButton moduleKey="spare_parts" onSuccess={fetchParts} />
            <button onClick={fetchParts} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
              <Plus className="w-4 h-4" /> قطعة جديدة
            </button>
          </div>
        </div>

        {/* Backend error banner */}
        {backendError && (
          <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>تعذّر الاتصال بخدمة قطع الغيار (خطأ من الخادم). تحقق من تشغيل الخادم الخلفي أو حاول مجدداً.</span>
            <button onClick={fetchParts} className="mr-auto text-xs underline hover:text-rose-200">إعادة المحاولة</button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الأصناف', val: kpi.total, icon: Box, color: 'text-slate-300' },
            { label: 'مخزون منخفض', val: kpi.low, icon: AlertTriangle, color: 'text-amber-400' },
            { label: 'نفذ المخزون', val: kpi.out, icon: TrendingDown, color: 'text-rose-400' },
            { label: 'قيمة المخزون (د.ل)', val: kpi.value.toLocaleString('ar-EG', { maximumFractionDigits: 0 }), icon: Package, color: 'text-emerald-400' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم، الرقم، أو الفئة..."
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 pr-9 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <button
            onClick={() => setFilterAlert(!filterAlert)}
            className={`px-4 py-2 rounded-xl text-sm flex items-center gap-2 border transition-colors ${
              filterAlert
                ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800/50'
            }`}>
            <AlertTriangle className="w-4 h-4" />
            تنبيهات فقط
          </button>
        </div>

        {/* Alert banner if urgent items */}
        {kpi.out + kpi.low > 0 && (
          <div className="bg-rose-900/10 border border-rose-700/20 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{kpi.out} صنف</strong> نفذ مخزونه، و<strong>{kpi.low} صنف</strong> مخزونه منخفض.
              اضغط <strong>"طلب تعبئة"</strong> لإنشاء أمر عمل تلقائي في CMMS.
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p>جاري التحميل...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-14 text-center">
              <Package className="w-14 h-14 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">{searchTerm ? 'لا توجد نتائج' : 'لا توجد قطع غيار مسجلة'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">رقم القطعة</th>
                    <th className="px-4 py-3 text-right font-medium">اسم القطعة</th>
                    <th className="px-4 py-3 text-right font-medium">الفئة</th>
                    <th className="px-4 py-3 text-right font-medium">المخزون</th>
                    <th className="px-4 py-3 text-right font-medium">الحد الأدنى</th>
                    <th className="px-4 py-3 text-right font-medium">المستوى</th>
                    <th className="px-4 py-3 text-right font-medium">السعر (د.ل)</th>
                    <th className="px-4 py-3 text-right font-medium">الموقع</th>
                    <th className="px-4 py-3 text-right font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(part => {
                    const si = stockInfo(part);
                    return (
                      <tr key={part.id} className={`hover:bg-slate-800/30 transition-colors ${si.urgent ? 'bg-rose-950/10' : ''}`}>
                        <td className="px-4 py-3 font-mono text-slate-400 text-xs">{part.part_number || '—'}</td>
                        <td className="px-4 py-3 text-slate-200 font-medium">{part.part_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700/50 text-slate-300">
                            {CATEGORY_AR[part.category] || part.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${part.quantity_in_stock === 0 ? 'text-rose-400' : part.quantity_in_stock <= part.minimum_stock_level ? 'text-amber-400' : 'text-slate-300'}`}>
                            {part.quantity_in_stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-center">{part.minimum_stock_level}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 min-w-[100px]">
                            <span className={`px-2 py-0.5 rounded-full text-xs border ${si.color}`}>
                              {si.label}
                            </span>
                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${
                                si.pct === 0 ? 'bg-rose-500' : si.pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} style={{ width: `${si.pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {part.unit_price != null ? part.unit_price.toLocaleString('ar-EG') : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{part.location || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {si.urgent && (
                              <button
                                onClick={() => requestRestock(part)}
                                disabled={restockingId === part.id}
                                className="px-2 py-1 bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs hover:bg-rose-600/30 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                              >
                                {restockingId === part.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                                طلب تعبئة
                              </button>
                            )}
                            <button onClick={() => openEdit(part)}
                              className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs hover:bg-slate-700 transition-colors">
                              تعديل
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm">
          {toastMsg}
        </div>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editPart ? 'تعديل قطعة الغيار' : 'قطعة غيار جديدة'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditPart(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">اسم القطعة *</label>
                  <input required value={formData.part_name}
                    onChange={e => setFormData({ ...formData, part_name: e.target.value })}
                    className={inputCls} placeholder="محمل، مضخة، فلتر..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">رقم القطعة</label>
                  <input value={formData.part_number}
                    onChange={e => setFormData({ ...formData, part_number: e.target.value })}
                    className={inputCls} placeholder="PART-001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">الفئة *</label>
                  <select required value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className={inputCls}>
                    <option value="">اختر...</option>
                    {Object.entries(CATEGORY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">الشركة المصنعة</label>
                  <input value={formData.manufacturer}
                    onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                    className={inputCls} placeholder="SKF, ABB..." />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">الكمية</label>
                  <input type="number" min="0" value={formData.quantity_in_stock}
                    onChange={e => setFormData({ ...formData, quantity_in_stock: e.target.value })}
                    className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">الحد الأدنى</label>
                  <input type="number" min="0" value={formData.minimum_stock_level}
                    onChange={e => setFormData({ ...formData, minimum_stock_level: e.target.value })}
                    className={inputCls} placeholder="5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">السعر (د.ل)</label>
                  <input type="number" min="0" step="0.01" value={formData.unit_price}
                    onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                    className={inputCls} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">موقع التخزين</label>
                <input value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className={inputCls} placeholder="رف A1، مخزن B..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium text-sm transition-colors">
                  {editPart ? 'تحديث' : 'إضافة القطعة'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditPart(null); }}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
