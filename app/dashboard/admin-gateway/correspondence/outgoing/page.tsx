'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Send, Plus, Search, Filter, FileText, ChevronLeft } from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';
import Link from 'next/link';

const HEADERS = { 'Content-Type': 'application/json' };

interface OutgoingLetter {
  id: number;
  reference_number: string;
  subject: string;
  recipient_name: string;
  recipient_organization?: string;
  department_name?: string;
  sent_date?: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function OutgoingLettersPage() {
  const [letters, setLetters] = useState<OutgoingLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mailTab, setMailTab] = useState<'inbox' | 'outbox' | 'compose'>('outbox');
  const mailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOutgoingLetters();
  }, []);

  const fetchOutgoingLetters = async () => {
    try {
      const response = await fetch('/api/v1/correspondence/outgoing-letters', { headers: HEADERS });
      if (response.ok) {
        const data = await response.json();
        setLetters(Array.isArray(data) ? data : data.letters || []);
      }
    } catch (error) {
      console.error('Error fetching outgoing letters:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCompose = () => {
    setMailTab('compose');
    setTimeout(() => mailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent': return 'text-emerald-400 bg-emerald-500/10';
      case 'draft': return 'text-slate-400 bg-slate-500/10';
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'cancelled': return 'text-rose-400 bg-rose-500/10';
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

  const filteredLetters = letters.filter(letter =>
    letter.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    letter.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    letter.reference_number?.includes(searchTerm)
  );

  const sentCount = letters.filter(l => l.status === 'sent').length;
  const draftCount = letters.filter(l => l.status === 'draft').length;
  const urgentCount = letters.filter(l => l.priority === 'urgent').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/correspondence">المراسلات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الصادر</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50">
              <Send className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الخطابات الصادرة</h1>
              <p className="text-slate-400 mt-1">إرسال مراسلات داخلية بين الإدارات مع اختيار المستلمين بالاسم</p>
            </div>
          </div>
          <button
            onClick={openCompose}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>رسالة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الصادر</span>
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{letters.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">تم الإرسال</span>
              <Send className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{sentCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">مسودات</span>
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{draftCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">عاجل</span>
              <FileText className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{urgentCount}</div>
          </div>
        </div>

          <div ref={mailRef} className="scroll-mt-4">
          <InternalMailTab
            department="admin_manager"
            title="نظام المراسلات الموحد — اختر الإدارة المستلمة وأرسل مباشرة"
            initialTab={mailTab}
          />
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالموضوع، الرقم، أو المستلم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <Send className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد خطابات صادرة بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">رقم الخطاب</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموضوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المستلم</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الجهة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الإرسال</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأولوية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
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
                        {letter.subject}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {letter.recipient_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {letter.recipient_organization || letter.department_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {letter.sent_date 
                          ? new Date(letter.sent_date).toLocaleDateString('ar-LY')
                          : '-'
                        }
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
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors">
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
    </div>
  );
}
