'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Package, DollarSign, AlertCircle, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { buildAssetLinkPayload, requireAssetLink } from '@/lib/asset-linking';

interface AssetValuation {
  id: number;
  asset_id: number;
  asset_name?: string;
  valuation_date: string;
  valuation_amount: number;
  valuation_method: string;
  valuated_by?: number;
  notes?: string;
}

interface DecommissionRecord {
  id: number;
  asset_id: number;
  asset_name?: string;
  decommission_date: string;
  book_value: number;
  disposal_value: number;
  loss_or_gain: number;
  reason: string;
}

interface Asset {
  id: number;
  asset_name: string;
}

export default function AssetTrackingPage() {
  const [valuations, setValuations] = useState<AssetValuation[]>([]);
  const [decommissions, setDecommissions] = useState<DecommissionRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'valuations' | 'decommissions'>('valuations');
  const [showValuationForm, setShowValuationForm] = useState(false);
  const [editValuation, setEditValuation] = useState<AssetValuation | null>(null);
  const [formError, setFormError] = useState('');
  const [linkageMode, setLinkageMode] = useState<'asset' | 'general'>('asset');
  const [generalReason, setGeneralReason] = useState('');
  const [allowGeneralMode, setAllowGeneralMode] = useState(false);
  const [formData, setFormData] = useState({
    asset_id: '',
    valuation_date: new Date().toISOString().split('T')[0],
    valuation_amount: '',
    method: 'market_value',
    notes: ''
  });

  useEffect(() => {
    fetchValuations();
    fetchDecommissions();
    fetchAssets();
    try {
      const adminMode = localStorage.getItem('admin_mode') === '1';
      const role = (localStorage.getItem('user_role') || '').toLowerCase();
      const allowed = adminMode || ['admin', 'super_admin', 'director', 'manager'].includes(role);
      setAllowGeneralMode(allowed);
    } catch {
      setAllowGeneralMode(false);
    }
  }, []);

  const getTenantHeader = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
    return tenantId ? { 'X-Tenant-ID': tenantId } : {};
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/asset-health', {
        headers: getTenantHeader()
      });
      if (response.ok) {
        const data = await response.json();
        setAssets((data.assets || []).map((a: any) => ({
          id: a.id, asset_name: a.asset_name_ar || a.asset_name
        })));
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  const fetchValuations = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/asset-valuations', {
        headers: getTenantHeader()
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = (data.valuations || []).map((v: any) => ({
          id: v.id,
          asset_id: v.id,
          asset_name: v.asset_name_ar || v.asset_name,
          valuation_date: new Date().toISOString().split('T')[0],
          valuation_amount: v.current_value,
          valuation_method: 'book_value',
          notes: `معدل استهلاك ${v.depreciation_rate || 0}% | تكلفة اقتناء: ${v.acquisition_cost?.toLocaleString()} د`,
        }));
        setValuations(mapped);
      }
    } catch (error) {
      console.error('Error fetching valuations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDecommissions = async () => {
    // No decommissions yet
    setDecommissions([]);
  };

  const handleSubmitValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    let resolvedAssetId: number | undefined;
    let notesWithException = formData.notes;

    if (linkageMode === 'asset') {
      const linkCheck = requireAssetLink(formData.asset_id);
      if (!linkCheck.ok) {
        setFormError(linkCheck.message);
        return;
      }
      resolvedAssetId = linkCheck.assetId;
    } else {
      if (!allowGeneralMode) {
        setFormError('ليس لديك صلاحية إنشاء تقييم عام غير مرتبط بأصل');
        return;
      }
      if (generalReason.trim().length < 8) {
        setFormError('سبب الاستثناء مطلوب (8 أحرف على الأقل)');
        return;
      }
      notesWithException = [formData.notes, `[NON_ASSET_RECORD] reason=${generalReason.trim()}`].filter(Boolean).join(' | ');
    }

    try {
      const url = editValuation
        ? `/api/v1/finance/asset-valuations/${editValuation.id}`
        : '/api/v1/finance/asset-valuations';
      const method = editValuation ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: linkageMode === 'asset' ? resolvedAssetId : undefined,
          valuation_date: formData.valuation_date,
          valuation_amount: parseFloat(formData.valuation_amount),
          valuation_method: formData.method,
          notes: notesWithException,
          ...(linkageMode === 'asset' && resolvedAssetId
            ? buildAssetLinkPayload({
                assetId: resolvedAssetId,
                source: 'department-dashboard',
                moduleKey: 'finance.asset-valuations',
              })
            : {}),
        })
      });

      if (response.ok) {
        fetchValuations();
        setShowValuationForm(false);
        setEditValuation(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving valuation:', error);
    }
  };

  const resetForm = () => {
    setFormError('');
    setLinkageMode('asset');
    setGeneralReason('');
    setFormData({
      asset_id: '',
      valuation_date: new Date().toISOString().split('T')[0],
      valuation_amount: '',
      method: 'market_value',
      notes: ''
    });
  };

  const handleEdit = (valuation: AssetValuation) => {
    setEditValuation(valuation);
    setFormData({
      asset_id: valuation.asset_id.toString(),
      valuation_date: valuation.valuation_date.split('T')[0],
      valuation_amount: valuation.valuation_amount.toString(),
      method: valuation.valuation_method,
      notes: valuation.notes || ''
    });
    setShowValuationForm(true);
  };

  const totalValuation = valuations.reduce((sum, v) => sum + (v.valuation_amount || 0), 0);
  const totalBookValue = decommissions.reduce((sum, d) => sum + (d.book_value || 0), 0);
  const totalDisposalValue = decommissions.reduce((sum, d) => sum + (d.disposal_value || 0), 0);
  const totalLossOrGain = decommissions.reduce((sum, d) => sum + (d.loss_or_gain || 0), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/admin-gateway" className="text-slate-400 hover:text-slate-300 transition-colors">
            البوابة الرئيسية
          </Link>
          <span className="text-slate-600">/</span>
          <Link href="/dashboard/admin-gateway/finance" className="text-slate-400 hover:text-slate-300 transition-colors">
            الإدارة المالية
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200">التتبع المالي للأصول</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600/20 p-4 rounded-xl border border-amber-500/50">
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">التتبع المالي للأصول</h1>
              <p className="text-slate-400 mt-1">تقييمات الأصول وسجلات الاستبعاد المالي</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditValuation(null);
              setShowValuationForm(true);
            }}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>تقييم جديد</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي التقييمات</span>
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalValuation)}</div>
            <div className="text-xs text-slate-500 mt-1">{valuations.length} تقييم</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قيمة الاستبعادات الدفترية</span>
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalBookValue)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قيمة التصفية</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalDisposalValue)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">صافي الربح/الخسارة</span>
              <AlertCircle className={`w-5 h-5 ${totalLossOrGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
            </div>
            <div className={`text-2xl font-bold ${totalLossOrGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(Math.abs(totalLossOrGain))}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {totalLossOrGain >= 0 ? 'ربح' : 'خسارة'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('valuations')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'valuations'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            التقييمات ({valuations.length})
          </button>
          <button
            onClick={() => setActiveTab('decommissions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'decommissions'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            سجلات الاستبعاد ({decommissions.length})
          </button>
        </div>

        {/* Content */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          
          {/* Valuations Table */}
          {activeTab === 'valuations' && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  جاري التحميل...
                </div>
              ) : valuations.length === 0 ? (
                <div className="p-12 text-center">
                  <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">لا توجد تقييمات للأصول</p>
                  <p className="text-slate-500 text-sm mt-2">سيتم عرض تقييمات الأصول هنا</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأصل</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ التقييم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">قيمة التقييم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">طريقة التقييم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">ملاحظات</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {valuations.map((valuation) => (
                      <tr key={valuation.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-200">
                          {valuation.asset_name || `أصل #${valuation.asset_id}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {new Date(valuation.valuation_date).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                          {formatCurrency(valuation.valuation_amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {valuation.valuation_method || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate">
                          {valuation.notes || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleEdit(valuation)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            تعديل
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Decommissions Table */}
          {activeTab === 'decommissions' && (
            <div className="overflow-x-auto">
              {decommissions.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">لا توجد سجلات استبعاد</p>
                  <p className="text-slate-500 text-sm mt-2">سيتم عرض سجلات الاستبعاد المالي هنا</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأصل</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الاستبعاد</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">القيمة الدفترية</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">قيمة التصفية</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الربح/الخسارة</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">السبب</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {decommissions.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-200">
                          {record.asset_name || `أصل #${record.asset_id}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {new Date(record.decommission_date).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                          {formatCurrency(record.book_value)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                          {formatCurrency(record.disposal_value)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <span className={record.loss_or_gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {formatCurrency(Math.abs(record.loss_or_gain))}
                            {record.loss_or_gain >= 0 ? ' ربح' : ' خسارة'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate">
                          {record.reason || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-400 hover:text-blue-300 text-sm">
                            عرض
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Valuation Form Modal */}
        {showValuationForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                <h2 className="text-2xl font-bold text-slate-100">
                  {editValuation ? 'تعديل التقييم' : 'تقييم جديد'}
                </h2>
                <button
                  onClick={() => {
                    setShowValuationForm(false);
                    setEditValuation(null);
                    resetForm();
                  }}
                  className="text-slate-400 hover:text-slate-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitValuation} className="p-6 space-y-6">
                {formError && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
                    {formError}
                  </div>
                )}

                <div className="rounded-lg border border-cyan-600/30 bg-cyan-500/10 p-3">
                  <p className="text-xs text-cyan-300">
                    الأصل إلزامي افتراضيا. يسمح بالتقييم العام فقط للمخولين مع سبب استثناء.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">نوع الربط</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLinkageMode('asset')}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        linkageMode === 'asset'
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      مرتبط بأصل
                    </button>
                    {allowGeneralMode && (
                      <button
                        type="button"
                        onClick={() => setLinkageMode('general')}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          linkageMode === 'general'
                            ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        سجل عام (استثناء)
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Asset Selection */}
                  <div className={`md:col-span-2 ${linkageMode === 'general' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      الأصل <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.asset_id}
                      onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required={linkageMode === 'asset'}
                    >
                      <option value="">-- اختر الأصل --</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.asset_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {linkageMode === 'general' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        سبب الاستثناء (إلزامي) *
                      </label>
                      <textarea
                        value={generalReason}
                        onChange={(e) => setGeneralReason(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800 border border-amber-500/50 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        rows={2}
                        required
                        placeholder="اذكر سبب إنشاء تقييم مالي عام غير مربوط بأصل"
                      />
                    </div>
                  )}

                  {/* Valuation Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      تاريخ التقييم <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.valuation_date}
                      onChange={(e) => setFormData({ ...formData, valuation_date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  {/* Valuation Amount */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      قيمة التقييم (ريال) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valuation_amount}
                      onChange={(e) => setFormData({ ...formData, valuation_amount: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Valuation Method */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      طريقة التقييم <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.method}
                      onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    >
                      <option value="market_value">القيمة السوقية</option>
                      <option value="book_value">القيمة الدفترية</option>
                      <option value="replacement_cost">تكلفة الاستبدال</option>
                      <option value="depreciated_value">القيمة بعد الإهلاك</option>
                      <option value="liquidation_value">قيمة التصفية</option>
                      <option value="expert_appraisal">تقييم خبير</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      ملاحظات
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      rows={4}
                      placeholder="ملاحظات إضافية..."
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center gap-4 pt-6 border-t border-slate-800">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors"
                  >
                    {editValuation ? 'حفظ التعديلات' : 'إضافة التقييم'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowValuationForm(false);
                      setEditValuation(null);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
