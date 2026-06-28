'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Search, CheckCircle, Clock, XCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee?: { full_name: string; full_name_ar?: string };
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count?: number;
  reason?: string;
  status: string;
  approved_by?: number;
  approver?: { full_name: string; full_name_ar?: string };
  created_at?: string;
}

export default function LeaveManagementPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch('/api/v1/hr/leave-requests');
      if (response.ok) {
        const data = await response.json();
        setLeaves(data.leave_requests || []);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/v1/hr/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchLeaveRequests();
        setShowForm(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating leave request:', error);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/hr/leave-requests/${id}/approve`, {
        method: 'POST'
      });
      if (response.ok) fetchLeaveRequests();
    } catch (error) {
      console.error('Error approving leave:', error);
    }
  };

  const handleReject = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/hr/leave-requests/${id}/reject`, {
        method: 'POST'
      });
      if (response.ok) fetchLeaveRequests();
    } catch (error) {
      console.error('Error rejecting leave:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      leave_type: 'annual',
      start_date: '',
      end_date: '',
      reason: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'text-emerald-400 bg-emerald-500/10';
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'rejected': return 'text-rose-400 bg-rose-500/10';
      case 'cancelled': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'annual': return 'text-blue-400 bg-blue-500/10';
      case 'sick': return 'text-rose-400 bg-rose-500/10';
      case 'emergency': return 'text-orange-400 bg-orange-500/10';
      case 'unpaid': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-violet-400 bg-violet-500/10';
    }
  };

  const filteredLeaves = leaves.filter(leave => {
    const matchesSearch = leave.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.employee?.full_name_ar?.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || leave.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">
            بوابة النظام
          </Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200 transition-colors">
            الموارد البشرية
          </Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">إدارة الإجازات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600/20 p-4 rounded-xl border border-purple-500/50">
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">إدارة الإجازات</h1>
              <p className="text-slate-400 mt-1">طلبات الإجازات والموافقات</p>
            </div>
          </div>
          <button 
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>طلب إجازة</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الطلبات</span>
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{leaves.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قيد الانتظار</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{pendingCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">موافق عليها</span>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{approvedCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">مرفوضة</span>
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {leaves.filter(l => l.status === 'rejected').length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالموظف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="approved">موافق عليها</option>
            <option value="rejected">مرفوضة</option>
          </select>
        </div>

        {/* Leave Requests Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredLeaves.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm || filterStatus !== 'all' ? 'لا توجد نتائج' : 'لا توجد طلبات بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموظف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نوع الإجازة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">من تاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إلى تاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">عدد الأيام</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">السبب</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLeaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {leave.employee?.full_name_ar || leave.employee?.full_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(leave.leave_type)}`}>
                          {leave.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(leave.start_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(leave.end_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                        {leave.days_count || '-'} يوم
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate">
                        {leave.reason || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(leave.status)}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {leave.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(leave.id)}
                              className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-600/30 transition-colors"
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => handleReject(leave.id)}
                              className="px-3 py-1 bg-rose-600/20 text-rose-400 rounded-lg text-xs hover:bg-rose-600/30 transition-colors"
                            >
                              رفض
                            </button>
                          </div>
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">طلب إجازة جديد</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">رقم الموظف *</label>
                <input
                  type="number"
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">نوع الإجازة *</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({...formData, leave_type: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                >
                  <option value="annual">سنوية</option>
                  <option value="sick">مرضية</option>
                  <option value="emergency">طارئة</option>
                  <option value="unpaid">بدون راتب</option>
                  <option value="maternity">أمومة</option>
                  <option value="paternity">أبوة</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">من تاريخ *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">إلى تاريخ *</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">السبب</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
                >
                  تقديم الطلب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
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
