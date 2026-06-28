'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Search, TrendingDown, TrendingUp, ChevronLeft, Calendar, Plus, X } from 'lucide-react';
import Link from 'next/link';

interface AssetValuation {
  id: number;
  asset_id: number;
  asset_name: string;
  valuation_date: string;
  valuation_amount: number;
  valuation_type: string;
  appraiser?: string;
  depreciation_amount?: number;
  accumulated_depreciation?: number;
  net_book_value?: number;
  fair_market_value?: number;
  notes?: string;
}

interface DecommissionRecord {
  id: number;
  asset_id: number;
  asset_name: string;
  decommission_date: string;
  original_value: number;
  salvage_value?: number;
  reason: string;
  disposal_method?: string;
}

interface Asset {
  id: number;
  asset_name: string;
  asset_type: string;
}

export default function AssetValuationsPage() {
  const [valuations, setValuations] = useState<AssetValuation[]>([]);
  const [decommissions, setDecommissions] = useState<DecommissionRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'valuations' | 'decommissions'>('valuations');
  const [showValuationForm, setShowValuationForm] = useState(false);
  const [editValuation, setEditValuation] = useState<AssetValuation | null>(null);
  const [formData, setFormData] = useState({
    asset_id: '',
    valuation_date: new Date().toISOString().split('T')[0],
    valuation_amount: '',
    method: '',
    notes: ''
  });

  useEffect(() => {
    fetchValuations();
    fetchDecommissions();
    fetchAssets();
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
          id: a.id,
          asset_name: a.asset_name_ar || a.asset_name,
          asset_type: a.asset_type || a.category,
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
          valuation_type: 'book_value',
          net_book_value: v.current_value,
          fair_market_value: v.current_value,
          depreciation_amount: v.acquisition_cost - v.current_value,
          accumulated_depreciation: v.acquisition_cost - v.current_value,
          notes: `معدل الاستهلاك: ${v.depreciation_rate || 0}%`,
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
    // Not yet available
    setDecommissions([]);
  };

  const handleSubmitValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editValuation
        ? `/api/v1/finance/asset-valuations/${editValuation.id}`
        : '/api/v1/finance/asset-valuations';
      const method = editValuation ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: parseInt(formData.asset_id),
          valuation_date: formData.valuation_date,
          valuation_amount: parseFloat(formData.valuation_amount),
          valuation_method: formData.method,
          notes: formData.notes
        })
      });

      if (response.ok) {
        fetchValuations();
        setShowValuationForm(false);
        setEditValuation(null);
        resetForm();
      } else {
        const errorData = await response.json();
        alert(`فشل حفظ التقييم: ${errorData.detail || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error saving valuation:', error);
      alert('فشل الاتصال بالخادم');
    }
  };

  const resetForm = () => {
    setFormData({
      asset_id: '',
      valuation_date: new Date().toISOString().split('T')[0],
      valuation_amount: '',
      method: '',
      notes: ''
    });
  };

  const handleEdit = (valuation: AssetValuation) => {
    setEditValuation(valuation);
    setFormData({
      asset_id: valuation.asset_id.toString(),
      valuation_date: valuation.valuation_date.split('T')[0],
      valuation_amount: valuation.valuation_amount.toString(),
      method: valuation.valuation_type,
      notes: valuation.notes || ''
    });
    setShowValuationForm(true);
  };

  const getValuationTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'initial': return 'text-blue-400 bg-blue-500/10';
      case 'revaluation': return 'text-violet-400 bg-violet-500/10';
      case 'depreciation': return 'text-amber-400 bg-amber-500/10';
      case 'impairment': return 'text-orange-400 bg-orange-500/10';
      case 'disposal': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const filteredValuations = valuations.filter(val =>
    val.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    val.appraiser?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDecommissions = decommissions.filter(dec =>
    dec.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dec.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValuations = valuations.reduce((sum, v) => sum + (v.valuation_amount || 0), 0);
  const totalDepreciation = valuations.reduce((sum, v) => sum + (v.accumulated_depreciation || 0), 0);
  const totalNBV = valuations.reduce((sum, v) => sum + (v.net_book_value || 0), 0);
  const totalDecommissionValue = decommissions.reduce((sum, d) => sum + (d.original_value || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/assets">الأصول</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">التقييمات والاستبعاد</span>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
                <DollarSign className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-100">تقييم الأصول</h1>
                <p className="text-slate-400 mt-1">سجل التقييمات والاستهلاك والاستبعاد</p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditValuation(null);
                setShowValuationForm(true);
              }}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>تقييم جديد</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي التقييمات</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalValuations)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">الاستهلاك المتراكم</span>
              <TrendingDown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalDepreciation)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">القيمة الدفترية</span>
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalNBV)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">أصول مستبعدة</span>
              <TrendingDown className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{decommissions.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('valuations')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'valuations'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            التقييمات ({valuations.length})
          </button>
          <button
            onClick={() => setActiveTab('decommissions')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'decommissions'
                ? 'bg-rose-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الاستبعادات ({decommissions.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
          <input
            type="text"
            placeholder={activeTab === 'valuations' ? "بحث في التقييمات..." : "بحث في الاستبعادات..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Valuations Tab */}
        {activeTab === 'valuations' && (
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
              ) : filteredValuations.length === 0 ? (
                <div className="p-12 text-center">
                  <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">
                    {searchTerm ? 'لا توجد نتائج' : 'لا توجد تقييمات مسجلة'}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الأصل</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ التقييم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نوع التقييم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">قيمة التقييم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الاستهلاك</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">القيمة الدفترية</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">القيمة السوقية</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المقيّم</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredValuations.map((valuation) => (
                      <tr key={valuation.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                          {valuation.asset_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(valuation.valuation_date).toLocaleDateString('ar-LY')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getValuationTypeColor(valuation.valuation_type)}`}>
                            {valuation.valuation_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                          {formatCurrency(valuation.valuation_amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-amber-400">
                          {valuation.accumulated_depreciation 
                            ? `-${formatCurrency(valuation.accumulated_depreciation)}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-blue-400 font-medium">
                          {valuation.net_book_value 
                            ? formatCurrency(valuation.net_book_value)
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-emerald-400">
                          {valuation.fair_market_value 
                            ? formatCurrency(valuation.fair_market_value)
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {valuation.appraiser || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleEdit(valuation)}
                            className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-600/30 transition-colors"
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
          </div>
        )}

        {/* Decommissions Tab */}
        {activeTab === 'decommissions' && (
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
              ) : filteredDecommissions.length === 0 ? (
                <div className="p-12 text-center">
                  <TrendingDown className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">
                    {searchTerm ? 'لا توجد نتائج' : 'لا توجد سجلات استبعاد'}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الأصل</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الاستبعاد</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">القيمة الأصلية</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">قيمة الإنقاذ</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الخسارة/المكسب</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">السبب</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">طريقة التخلص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredDecommissions.map((record) => {
                      const difference = (record.salvage_value || 0) - record.original_value;
                      const isProfit = difference > 0;
                      
                      return (
                        <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                            {record.asset_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(record.decommission_date).toLocaleDateString('ar-LY')}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {formatCurrency(record.original_value)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {record.salvage_value 
                              ? formatCurrency(record.salvage_value)
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {record.salvage_value ? (
                              <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                                {isProfit ? '+' : ''}{formatCurrency(difference)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {record.reason}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {record.disposal_method || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Asset Selection */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    الأصل <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.asset_id}
                    onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">-- اختر الأصل --</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.asset_name} ({asset.asset_type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valuation Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    تاريخ التقييم <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.valuation_date}
                    onChange={(e) => setFormData({ ...formData, valuation_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">-- اختر طريقة التقييم --</option>
                    <option value="initial">تقييم أولي</option>
                    <option value="revaluation">إعادة تقييم</option>
                    <option value="depreciation">استهلاك</option>
                    <option value="impairment">تدني قيمة</option>
                    <option value="disposal">استبعاد</option>
                    <option value="market_value">القيمة السوقية</option>
                    <option value="book_value">القيمة الدفترية</option>
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
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={4}
                    placeholder="ملاحظات إضافية..."
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center gap-4 pt-6 border-t border-slate-800">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
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
  );
}
