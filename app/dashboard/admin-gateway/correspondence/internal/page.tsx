'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, Filter, Building2, ChevronLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const HEADERS = { 'X-Tenant-ID': getTenantId() || '', 'Content-Type': 'application/json' };

interface InternalMemo {
  id: number;
  reference_number: string;
  subject: string;
  priority: string;
  sender_department_id?: number;
  sender_dept_name?: string;
  recipient_department_id?: number;
  recipient_dept_name?: string;
  status: string;
  sent_date?: string;
  created_at: string;
}

export default function InternalMemosPage() {
  const [memos, setMemos] = useState<InternalMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    subject_ar: '',
    from_dept: '',
    to_dept: '',
    urgency: 'normal',
    content: ''
  });

  useEffect(() => {
    fetchInternalMemos();
  }, []);

  const fetchInternalMemos = async () => {
    try {
      const response = await fetch('/api/v1/correspondence/internal-memos', { headers: HEADERS });
      if (response.ok) {
        const data = await response.json();
        setMemos(Array.isArray(data) ? data : data.memos || []);
      }
    } catch (error) {
      console.error('Error fetching internal memos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/v1/correspondence/internal-memos', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        fetchInternalMemos();
        setShowForm(false);
        setFormData({
          subject: '',
          subject_ar: '',
          from_dept: '',
          to_dept: '',
          urgency: 'normal',
          content: ''
        });
      }
    } catch (error) {
      console.error('Error creating memo:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'sent': return 'text-emerald-400 bg-emerald-500/10';
      case 'read': return 'text-blue-400 bg-blue-500/10';
      case 'acknowledged': return 'text-violet-400 bg-violet-500/10';
      case 'draft': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'critical': return 'text-rose-400 bg-rose-500/10';
      case 'urgent': return 'text-orange-400 bg-orange-500/10';
      case 'normal': return 'text-blue-400 bg-blue-500/10';
      case 'low': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const filteredMemos = memos.filter(memo =>
    memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memo.sender_dept_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memo.recipient_dept_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memo.reference_number?.includes(searchTerm)
  );

  const sentCount = memos.filter(m => m.status === 'sent').length;
  const pendingCount = memos.filter(m => m.status === 'draft' || m.status === 'pending').length;
  const urgentCount = memos.filter(m => m.priority === 'urgent' || m.priority === 'high').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/correspondence">المراسلات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">المذكرات الداخلية</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
              <MessageSquare className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">المذكرات الداخلية</h1>
              <p className="text-slate-400 mt-1">مذكرات التواصل بين الإدارات</p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>مذكرة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي المذكرات</span>
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{memos.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">مرسلة</span>
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{sentCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قيد الانتظار</span>
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{pendingCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">عاجل</span>
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{urgentCount}</div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالموضوع، الرقم، أو الإدارة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button className="px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800/50 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span>تصفية</span>
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredMemos.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد مذكرات داخلية بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">رقم المذكرة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموضوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">من إدارة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إلى إدارة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الإصدار</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأهمية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredMemos.map((memo) => (
                    <tr key={memo.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {memo.reference_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200 max-w-xs truncate">
                        {memo.subject}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {memo.sender_dept_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {memo.recipient_dept_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {memo.sent_date
                          ? new Date(memo.sent_date).toLocaleDateString('ar-LY')
                          : new Date(memo.created_at).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getUrgencyColor(memo.priority)}`}>
                          {memo.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(memo.status)}`}>
                          {memo.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-600/30 transition-colors">
                          عرض
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">مذكرة داخلية جديدة</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الموضوع (EN) *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الموضوع (AR)</label>
                  <input
                    type="text"
                    value={formData.subject_ar}
                    onChange={(e) => setFormData({...formData, subject_ar: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">من إدارة *</label>
                  <input
                    type="text"
                    required
                    value={formData.from_dept}
                    onChange={(e) => setFormData({...formData, from_dept: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="IT Department"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">إلى إدارة *</label>
                  <input
                    type="text"
                    required
                    value={formData.to_dept}
                    onChange={(e) => setFormData({...formData, to_dept: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="HR Department"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">مستوى الأهمية</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                >
                  <option value="low">منخفض</option>
                  <option value="normal">عادي</option>
                  <option value="urgent">عاجل</option>
                  <option value="critical">حرج</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">المحتوى *</label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  rows={6}
                  placeholder="محتوى المذكرة..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                >
                  إرسال المذكرة
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
