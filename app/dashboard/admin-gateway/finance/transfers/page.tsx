'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, CheckCircle, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';
import { getUserAuthHeaders } from '@/store/useUserStore';

interface BudgetTransfer {
  id: number;
  from_budget_id: number;
  from_budget_name?: string;
  to_budget_id: number;
  to_budget_name?: string;
  transfer_amount: number;
  transfer_date: string;
  reason: string;
  status: string;
  approved_by?: number;
  approved_at?: string;
  requested_by?: number;
  requested_at?: string;
}

export default function BudgetTransfersPage() {
  const [transfers, setTransfers] = useState<BudgetTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      // Note: This endpoint might need to be adjusted based on actual backend implementation
      const response = await fetch('/api/v1/finance/budget-transfers', { headers: getUserAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTransfers(data.transfers || []);
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalTransfers = transfers.reduce((sum, t) => sum + (t.transfer_amount || 0), 0);
  const pendingTransfers = transfers.filter(t => t.status === 'pending').length;
  const approvedTransfers = transfers.filter(t => t.status === 'approved').length;
  const rejectedTransfers = transfers.filter(t => t.status === 'rejected').length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-emerald-400 bg-emerald-500/10';
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'rejected': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'pending': return 'معلق';
      case 'rejected': return 'مرفوض';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
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
          <span className="text-slate-200">النقل بين الميزانيات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600/20 p-4 rounded-xl border border-purple-500/50">
              <ArrowLeftRight className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">النقل بين الميزانيات</h1>
              <p className="text-slate-400 mt-1">إدارة طلبات نقل المبالغ بين الميزانيات والموافقة عليها</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5" />
            <span>طلب نقل جديد</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي التحويلات</span>
              <ArrowLeftRight className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalTransfers)}</div>
            <div className="text-xs text-slate-500 mt-1">{transfers.length} تحويل</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">معتمدة</span>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{approvedTransfers}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">معلقة</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{pendingTransfers}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">مرفوضة</span>
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{rejectedTransfers}</div>
          </div>
        </div>

        {/* Transfers Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                جاري التحميل...
              </div>
            ) : transfers.length === 0 ? (
              <div className="p-12 text-center">
                <ArrowLeftRight className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد تحويلات بعد</p>
                <p className="text-slate-500 text-sm mt-2">ابدأ بإنشاء طلب نقل جديد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">من ميزانية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إلى ميزانية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المبلغ</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">السبب</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(transfer.transfer_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {transfer.from_budget_name || `ميزانية #${transfer.from_budget_id}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {transfer.to_budget_name || `ميزانية #${transfer.to_budget_id}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                        {formatCurrency(transfer.transfer_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate">
                        {transfer.reason || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(transfer.status)}`}>
                          {getStatusIcon(transfer.status)}
                          {getStatusLabel(transfer.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {transfer.status === 'pending' && (
                          <div className="flex gap-2">
                            <button className="text-emerald-400 hover:text-emerald-300 text-sm">
                              اعتماد
                            </button>
                            <button className="text-rose-400 hover:text-rose-300 text-sm">
                              رفض
                            </button>
                          </div>
                        )}
                        {transfer.status !== 'pending' && (
                          <button className="text-blue-400 hover:text-blue-300 text-sm">
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
