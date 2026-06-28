'use client';

import React, { useState, useEffect } from 'react';
import { Archive, Search, FileText, Download, Calendar, ChevronLeft, Filter } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface ArchivedDocument {
  id: number;
  document_type: string;
  document_number: string;
  subject: string;
  subject_ar?: string;
  archived_date: string;
  original_date: string;
  classification?: string;
  category?: string;
  retention_period?: string;
  archived_by?: string;
  file_location?: string;
}
const H = { 'X-Tenant-ID': getTenantId() || '' };

export default function ArchivePage() {
  const [documents, setDocuments] = useState<ArchivedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchArchivedDocuments();
  }, []);

  const fetchArchivedDocuments = async () => {
    try {
      const [outgoing, incoming, internal] = await Promise.all([
        fetch('/api/v1/correspondence/outgoing-letters', { headers: H }),
        fetch('/api/v1/correspondence/incoming-letters', { headers: H }),
        fetch('/api/v1/correspondence/internal-memos', { headers: H })
      ]);

      const results = await Promise.all([
        outgoing.ok ? outgoing.json() : [],
        incoming.ok ? incoming.json() : [],
        internal.ok ? internal.json() : []
      ]);

      const archived = [
        ...(Array.isArray(results[0]) ? results[0] : results[0].letters || []).map((d: any) => ({ ...d, document_type: 'outgoing' })),
        ...(Array.isArray(results[1]) ? results[1] : results[1].letters || []).map((d: any) => ({ ...d, document_type: 'incoming' })),
        ...(Array.isArray(results[2]) ? results[2] : results[2].memos || []).map((d: any) => ({ ...d, document_type: 'internal' }))
      ];

      setDocuments(archived);
    } catch (error) {
      console.error('Error fetching archived documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'outgoing': return 'text-blue-400 bg-blue-500/10';
      case 'incoming': return 'text-violet-400 bg-violet-500/10';
      case 'internal': return 'text-emerald-400 bg-emerald-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getTypeName = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'outgoing': return 'صادر';
      case 'incoming': return 'وارد';
      case 'internal': return 'داخلي';
      default: return type;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case 'confidential': return 'text-rose-400 bg-rose-500/10';
      case 'restricted': return 'text-orange-400 bg-orange-500/10';
      case 'internal': return 'text-amber-400 bg-amber-500/10';
      case 'public': return 'text-emerald-400 bg-emerald-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.subject_ar?.includes(searchTerm) ||
      doc.document_number?.includes(searchTerm);

    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter;

    const matchesDateRange = 
      (!dateFrom || new Date(doc.archived_date) >= new Date(dateFrom)) &&
      (!dateTo || new Date(doc.archived_date) <= new Date(dateTo));

    return matchesSearch && matchesType && matchesDateRange;
  });

  const totalArchived = documents.length;
  const outgoingCount = documents.filter(d => d.document_type === 'outgoing').length;
  const incomingCount = documents.filter(d => d.document_type === 'incoming').length;
  const internalCount = documents.filter(d => d.document_type === 'internal').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/correspondence">المراسلات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الأرشيف</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600/20 p-4 rounded-xl border border-amber-500/50">
              <Archive className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">أرشيف المراسلات</h1>
              <p className="text-slate-400 mt-1">إدارة الوثائق المؤرشفة والبحث المتقدم</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-2 transition-colors">
            <Download className="w-5 h-5" />
            <span>تصدير الأرشيف</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الأرشيف</span>
              <Archive className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{totalArchived}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">صادر</span>
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{outgoingCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">وارد</span>
              <FileText className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{incomingCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">داخلي</span>
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{internalCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-400" />
            البحث المتقدم
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالموضوع أو الرقم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">جميع الأنواع</option>
                <option value="outgoing">صادر</option>
                <option value="incoming">وارد</option>
                <option value="internal">داخلي</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-10 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="من"
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 pr-10 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="إلى"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <Archive className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm || typeFilter !== 'all' || dateFrom || dateTo 
                    ? 'لا توجد نتائج تطابق معايير البحث' 
                    : 'لا توجد وثائق مؤرشفة بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">رقم الوثيقة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموضوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التاريخ الأصلي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الأرشفة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التصنيف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDocuments.map((doc) => (
                    <tr key={`${doc.document_type}-${doc.id}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(doc.document_type)}`}>
                          {getTypeName(doc.document_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {doc.document_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200 max-w-xs truncate">
                        {doc.subject_ar || doc.subject}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(doc.original_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(doc.archived_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4">
                        {doc.classification ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getClassificationColor(doc.classification)}`}>
                            {doc.classification}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="px-3 py-1 bg-amber-600/20 text-amber-400 rounded-lg text-xs hover:bg-amber-600/30 transition-colors">
                            عرض
                          </button>
                          <button className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors">
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {filteredDocuments.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-400 px-2">
            <span>عرض {filteredDocuments.length} من {totalArchived} وثيقة</span>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
                السابق
              </button>
              <button className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
