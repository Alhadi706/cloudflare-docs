'use client';

import React, { useState, useEffect } from 'react';
import { Inbox, Plus, Search, Filter, FileText, ChevronLeft, Calendar, MailOpen, Paperclip } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('dashboard_token') || localStorage.getItem('auth_token') || '';
};

const getCookieValue = (name: string): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const inferUserDepartment = (): string => {
  const cookieDept = getCookieValue('user_dept').trim();
  if (cookieDept) return cookieDept;

  const storageDept = (typeof window !== 'undefined' ? localStorage.getItem('user_dept') : '') || '';
  if (storageDept.trim()) return storageDept.trim();

  const claims = decodeJwtPayload(getAuthToken());
  return String(
    claims?.department_name ?? claims?.department ?? claims?.dept_name ?? claims?.dept ?? claims?.department_code ?? ''
  ).trim();
};

const getCircularHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
};

const HEADERS = { 'X-Tenant-ID': getTenantId() || '', 'Content-Type': 'application/json' };

interface CircularInboxItem {
  id: string;
  title: string;
  body: string;
  source_dept?: string;
  created_at: string;
  priority?: string;
  target_departments?: string[];
  target_count?: number;
  read_by?: string[];
  attachments?: Array<{ name?: string; data_url?: string }>;
}

type CircularFilter = 'all' | 'unread' | 'read' | 'urgent';

interface IncomingLetter {
  id: number;
  reference_number: string;
  subject: string;
  subject_ar?: string;
  sender_name: string;
  sender_organization?: string;
  received_date: string;
  status: string;
  priority: string;
  department_name?: string;
  assigned_to?: string;
  response_status?: string;
  due_date?: string;
}

export default function IncomingLettersPage() {
  const [letters, setLetters] = useState<IncomingLetter[]>([]);
  const [circularInbox, setCircularInbox] = useState<CircularInboxItem[]>([]);
  const [loadingCirculars, setLoadingCirculars] = useState(true);
  const [currentDept, setCurrentDept] = useState('');
  const [currentEmployeeNo, setCurrentEmployeeNo] = useState('');
  const [circularFilter, setCircularFilter] = useState<CircularFilter>('all');
  const [selectedCircular, setSelectedCircular] = useState<CircularInboxItem | null>(null);
  const [circularActionMsg, setCircularActionMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    reference_number: '',
    subject: '',
    subject_ar: '',
    sender: '',
    sender_org: '',
    received_date: new Date().toISOString().split('T')[0],
    priority: 'normal',
    assigned_to: '',
    due_date: ''
  });

  useEffect(() => {
    fetchIncomingLetters();
    void fetchCircularInbox();
    setCurrentDept(inferUserDepartment());
    const claims = decodeJwtPayload(getAuthToken());
    const employeeNo = String(
      claims?.employee_no ?? claims?.employeeNo ?? claims?.emp_no ?? getCookieValue('employee_no') ?? ''
    ).trim();
    setCurrentEmployeeNo(employeeNo);
  }, []);

  const isCircularRead = (item: CircularInboxItem): boolean => {
    if (currentEmployeeNo) {
      return Array.isArray(item.read_by) ? item.read_by.includes(currentEmployeeNo) : false;
    }
    return (item.read_by?.length || 0) > 0;
  };

  const markCircularAsRead = async (itemId: string) => {
    if (!currentEmployeeNo) {
      setCircularActionMsg('تعذر تحديد هوية الموظف لتسجيل حالة القراءة');
      return;
    }
    try {
      const response = await fetch('/api/auth/mobile/circulars', {
        method: 'POST',
        headers: getCircularHeaders(),
        body: JSON.stringify({ action: 'mark_read', id: itemId }),
      });

      if (!response.ok) {
        setCircularActionMsg('تعذر تحديث حالة القراءة');
        return;
      }

      setCircularInbox((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const readBy = Array.isArray(item.read_by) ? item.read_by : [];
          if (readBy.includes(currentEmployeeNo)) return item;
          return { ...item, read_by: [...readBy, currentEmployeeNo] };
        })
      );
      setCircularActionMsg('تم تسجيل الرسالة كمقروءة');
    } catch {
      setCircularActionMsg('تعذر تحديث حالة القراءة');
    }
  };

  const openCircularDetails = async (item: CircularInboxItem) => {
    setSelectedCircular(item);
    setCircularActionMsg('');
    if (!isCircularRead(item)) {
      await markCircularAsRead(item.id);
    }
  };

  const fetchCircularInbox = async () => {
    setLoadingCirculars(true);
    try {
      const response = await fetch('/api/auth/mobile/circulars?action=all', { headers: getCircularHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      const allCirculars: CircularInboxItem[] = Array.isArray(data) ? data : [];
      const normalizedDept = inferUserDepartment().toLowerCase();

      const filtered = allCirculars.filter((item) => {
        const targets = Array.isArray(item.target_departments)
          ? item.target_departments.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
          : [];
        if (targets.length === 0) return true;
        if (!normalizedDept) return false;
        return targets.includes(normalizedDept);
      });

      setCircularInbox(filtered);
    } catch {
      // keep incoming letters page functional even if circular inbox fails
    } finally {
      setLoadingCirculars(false);
    }
  };

  const fetchIncomingLetters = async () => {
    try {
      const response = await fetch('/api/v1/correspondence/incoming-letters', { headers: HEADERS });
      if (response.ok) {
        const data = await response.json();
        setLetters(Array.isArray(data) ? data : data.letters || []);
      }
    } catch (error) {
      console.error('Error fetching incoming letters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/v1/correspondence/incoming-letters', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        fetchIncomingLetters();
        setShowForm(false);
        setFormData({
          reference_number: '',
          subject: '',
          subject_ar: '',
          sender: '',
          sender_org: '',
          received_date: new Date().toISOString().split('T')[0],
          priority: 'normal',
          assigned_to: '',
          due_date: ''
        });
      }
    } catch (error) {
      console.error('Error creating letter:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new': return 'text-blue-400 bg-blue-500/10';
      case 'assigned': return 'text-amber-400 bg-amber-500/10';
      case 'in_progress': return 'text-violet-400 bg-violet-500/10';
      case 'completed': return 'text-emerald-400 bg-emerald-500/10';
      case 'archived': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'text-rose-400 bg-rose-500/10';
      case 'high': return 'text-orange-400 bg-orange-500/10';
      case 'normal': return 'text-blue-400 bg-blue-500/10';
      case 'low': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getResponseStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'responded': return 'text-emerald-400 bg-emerald-500/10';
      case 'no_response': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const filteredLetters = letters.filter(letter =>
    letter.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    letter.subject_ar?.includes(searchTerm) ||
    letter.sender?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    letter.reference_number?.includes(searchTerm)
  );

  const newCount = letters.filter(l => l.status === 'received' || l.status === 'new').length;
  const assignedCount = letters.filter(l => l.status === 'forwarded' || l.status === 'assigned').length;
  const urgentCount = letters.filter(l => l.priority === 'urgent' || l.priority === 'high').length;
  const pendingResponseCount = letters.filter(l => l.status === 'pending' || l.response_status === 'pending').length;
  const unreadCirculars = circularInbox.filter((item) => !isCircularRead(item)).length;
  const filteredCircularInbox = circularInbox.filter((item) => {
    const matchesSearch =
      !searchTerm.trim() ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.source_dept || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (circularFilter === 'all') return true;
    if (circularFilter === 'unread') return !isCircularRead(item);
    if (circularFilter === 'read') return isCircularRead(item);
    return item.priority === 'urgent' || item.priority === 'high';
  });

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/correspondence">المراسلات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الوارد</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <Inbox className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الخطابات الواردة</h1>
              <p className="text-slate-400 mt-1">إدارة المراسلات الواردة وتوجيهها</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="incoming" onSuccess={fetchIncomingLetters} />
            <button 
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>خطاب جديد</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الوارد</span>
              <Inbox className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{letters.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">جديد</span>
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{newCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">محول</span>
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{assignedCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">يحتاج رد</span>
              <Calendar className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{pendingResponseCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100">وارد المراسلات الداخلية للإدارة</h2>
              <p className="text-xs text-slate-400 mt-1">
                {currentDept ? `الإدارة الحالية: ${currentDept}` : 'تعرض كل الرسائل العامة والموجهة لإدارتك'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-300">
                {circularInbox.length} إجمالي
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-300">
                {unreadCirculars} غير مقروء
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {([
              { key: 'all', label: 'الكل' },
              { key: 'unread', label: 'غير مقروء' },
              { key: 'read', label: 'مقروء' },
              { key: 'urgent', label: 'عاجل/عالي' },
            ] as Array<{ key: CircularFilter; label: string }>).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCircularFilter(tab.key)}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  circularFilter === tab.key
                    ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingCirculars ? (
            <div className="py-6 text-center text-sm text-slate-400">جاري تحميل وارد المراسلات...</div>
          ) : filteredCircularInbox.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">لا توجد مراسلات واردة لإدارتك حالياً.</div>
          ) : (
            <div className="space-y-3">
              {filteredCircularInbox.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-100">{item.title}</span>
                    {!isCircularRead(item) && (
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">غير مقروء</span>
                    )}
                    {item.priority === 'urgent' && (
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">عاجل</span>
                    )}
                    {item.priority === 'high' && (
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">عالي</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{item.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>{new Date(item.created_at).toLocaleDateString('ar-LY')}</span>
                    {item.source_dept ? <span>• من: {item.source_dept}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <MailOpen className="h-3 w-3" />
                      {item.target_count && item.target_count > 0
                        ? `${item.read_by?.length || 0}/${item.target_count} قراءة`
                        : `${item.read_by?.length || 0} قراءة`}
                    </span>
                    {item.attachments && item.attachments.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-indigo-300">
                        <Paperclip className="h-3 w-3" />
                        {item.attachments.length} مرفق
                      </span>
                    ) : null}
                    <button
                      onClick={() => void openCircularDetails(item)}
                      className="mr-auto rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-300 hover:bg-indigo-500/20"
                    >
                      عرض التفاصيل
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالموضوع، الرقم، أو المرسل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            ) : filteredLetters.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد خطابات واردة بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الرقم المرجعي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموضوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المرسل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الجهة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الاستلام</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأولوية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المحول إليه</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLetters.map((letter) => (
                    <tr key={letter.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {letter.reference_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200 max-w-xs truncate">
                        {letter.subject_ar || letter.subject}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {letter.sender_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {letter.sender_organization || letter.department_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(letter.received_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(letter.priority)}`}>
                          {letter.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(letter.status)}`}>
                          {letter.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {letter.assigned_to || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors">
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
              <h2 className="text-2xl font-bold text-slate-100">خطاب وارد جديد</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الرقم المرجعي *</label>
                  <input
                    type="text"
                    required
                    value={formData.reference_number}
                    onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ الاستلام *</label>
                  <input
                    type="date"
                    required
                    value={formData.received_date}
                    onChange={(e) => setFormData({...formData, received_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

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
                  <label className="block text-sm font-medium text-slate-300 mb-2">المرسل *</label>
                  <input
                    type="text"
                    required
                    value={formData.sender}
                    onChange={(e) => setFormData({...formData, sender: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الجهة</label>
                  <input
                    type="text"
                    value={formData.sender_org}
                    onChange={(e) => setFormData({...formData, sender_org: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الأولوية</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="low">عادي</option>
                    <option value="normal">متوسط</option>
                    <option value="high">عالي</option>
                    <option value="urgent">عاجل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">المحول إليه</label>
                  <input
                    type="text"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  حفظ
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

      {selectedCircular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{selectedCircular.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(selectedCircular.created_at).toLocaleString('ar-LY')}
                  {selectedCircular.source_dept ? ` • من: ${selectedCircular.source_dept}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedCircular(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                إغلاق
              </button>
            </div>

            <div className="p-5 space-y-4">
              {circularActionMsg && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {circularActionMsg}
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm leading-7 text-slate-200 whitespace-pre-wrap">{selectedCircular.body}</p>
              </div>

              {selectedCircular.attachments && selectedCircular.attachments.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3">المرفقات</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCircular.attachments.map((att, idx) => (
                      <a
                        key={`${selectedCircular.id}-detail-att-${idx}`}
                        href={att.data_url || '#'}
                        download={att.name || `attachment-${idx + 1}`}
                        target={att.data_url ? '_blank' : undefined}
                        rel={att.data_url ? 'noreferrer' : undefined}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-200"
                      >
                        <Paperclip className="h-3 w-3" />
                        {att.name || `مرفق ${idx + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
