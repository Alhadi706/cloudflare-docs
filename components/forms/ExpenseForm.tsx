// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج إضافة مصروف - Expense Creation Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { buildAssetLinkPayload, requireAssetLink } from '@/lib/asset-linking';

interface ExpenseFormData {
  asset_id?: number;
  amount: number;
  expense_date: string;
  description: string;
  budget_id?: number;
  notes?: string;
}

interface ExpenseFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Budget {
  id: number;
  budget_name: string;
  budget_name_ar?: string;
}

interface AssetOption {
  id: number;
  asset_name: string;
  asset_code?: string;
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

export default function ExpenseForm({ onClose, onSuccess }: ExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>({
    asset_id: 0,
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    budget_id: undefined,
    notes: ''
  });

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assetQuery, setAssetQuery] = useState('');
  const [linkageMode, setLinkageMode] = useState<'asset' | 'general'>('asset');
  const [generalReason, setGeneralReason] = useState('');
  const [allowGeneralMode, setAllowGeneralMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBudgets();
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

  const fetchBudgets = async () => {
    try {
      const response = await fetch('/api/v1/finance/budgets?status=active', {
        headers: getTenantHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBudgets(data.budgets || []);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/v1/workspace/assets/all?limit=3000', {
        headers: getTenantHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.assets || []);
        setAssets(list.map((a: any) => ({
          id: Number(a.id),
          asset_name: a.asset_name || a.name || `Asset #${a.id}`,
          asset_code: a.asset_code || a.asset_id || a.code,
        })).filter((a: AssetOption) => Number.isFinite(a.id)));
      }
    } catch (fetchError) {
      console.error('Error fetching assets:', fetchError);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let assetPayload: Record<string, unknown> = {};
    let resolvedNotes = formData.notes || '';

    if (linkageMode === 'asset') {
      const linkCheck = requireAssetLink(formData.asset_id);
      if (!linkCheck.ok) {
        setError(linkCheck.message);
        setLoading(false);
        return;
      }
      assetPayload = {
        ...buildAssetLinkPayload({
          assetId: linkCheck.assetId,
          source: 'department-dashboard',
          moduleKey: 'finance.expenses',
        }),
      };
    } else {
      if (!allowGeneralMode) {
        setError('ليس لديك صلاحية إنشاء سجل عام غير مرتبط بأصل');
        setLoading(false);
        return;
      }
      if (generalReason.trim().length < 8) {
        setError('سبب الاستثناء مطلوب (8 أحرف على الأقل)');
        setLoading(false);
        return;
      }
      resolvedNotes = [formData.notes, `[NON_ASSET_RECORD] reason=${generalReason.trim()}`].filter(Boolean).join(' | ');
    }

    try {
      const response = await fetch('/api/v1/finance/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
        },
        body: JSON.stringify({
          ...formData,
          asset_id: linkageMode === 'asset' ? formData.asset_id : undefined,
          notes: resolvedNotes,
          ...assetPayload,
        })
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.detail || 'حدث خطأ أثناء حفظ المصروف');
      }
    } catch (err) {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'budget_id' ? Number(value) : value
    }));
  };

  const filteredAssets = assets
    .filter((a) => {
      if (!assetQuery.trim()) return true;
      const q = assetQuery.toLowerCase().trim();
      return (
        a.asset_name.toLowerCase().includes(q)
        || String(a.id).includes(q)
        || String(a.asset_code || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  const selectedAsset = assets.find((a) => a.id === formData.asset_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">
            إضافةمصروف جديد
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 rounded-lg p-4 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Amount */}
          <div className="rounded-lg border border-cyan-600/30 bg-cyan-500/10 p-3">
            <p className="text-xs text-cyan-300">
              قاعدة الربط المؤسسية: الأصل إلزامي افتراضيا. يسمح بالسجل العام فقط للمخولين مع سبب استثناء.
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

          {/* Asset link (required) */}
          <div className={linkageMode === 'general' ? 'opacity-50 pointer-events-none' : ''}>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              الأصل المرتبط (Asset ID) *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="number"
                name="asset_id"
                value={formData.asset_id || ''}
                onChange={handleChange}
                required={linkageMode === 'asset'}
                min="1"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="اكتب رقم الأصل"
              />
              <input
                type="text"
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="أو ابحث باسم الأصل"
              />
            </div>

            {assetQuery.trim() && (
              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
                {filteredAssets.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">لا توجد نتائج مطابقة</div>
                ) : (
                  filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, asset_id: asset.id }));
                        setAssetQuery(asset.asset_name);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-slate-800/60 border-b border-slate-800 last:border-0"
                    >
                      <p className="text-sm text-slate-200">{asset.asset_name}</p>
                      <p className="text-xs text-slate-500">ID: {asset.id} {asset.asset_code ? `• ${asset.asset_code}` : ''}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedAsset && (
              <p className="text-xs text-emerald-300 mt-2">
                الأصل المحدد: {selectedAsset.asset_name} (ID: {selectedAsset.id})
              </p>
            )}
          </div>

          {linkageMode === 'general' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                سبب الاستثناء (إلزامي) *
              </label>
              <textarea
                value={generalReason}
                onChange={(e) => setGeneralReason(e.target.value)}
                rows={2}
                required
                className="w-full bg-slate-800 border border-amber-500/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                placeholder="اذكر لماذا هذه النفقة عامة وغير مرتبطة بأصل محدد"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              المبلغ (ريال) *
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="0.00"
            />
          </div>

          {/* Expense Date */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              تاريخ المصروف *
            </label>
            <input
              type="date"
              name="expense_date"
              value={formData.expense_date}
              onChange={handleChange}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              الوصف *
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              dir="rtl"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="وصف المصروف"
            />
          </div>

          {/* Budget Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              الموازنة (اختياري)
            </label>
            <select
              name="budget_id"
              value={formData.budget_id || ''}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- اختر موازنة --</option>
              {budgets.map(budget => (
                <option key={budget.id} value={budget.id}>
                  {budget.budget_name_ar || budget.budget_name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ملاحظات
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              dir="rtl"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              placeholder="ملاحظات إضافية..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  حفظ
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
