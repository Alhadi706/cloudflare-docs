'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, ChevronLeft, Download, Upload, Eye } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface ProjectDocument {
  id: number;
  document_name: string;
  description?: string;
  project_id?: number;
  project_name?: string;
  category: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  version?: string;
  uploaded_by?: string;
  visibility: string;
  tags?: string[];
  uploaded_at?: string;
  last_modified?: string;
}

export default function ProjectDocumentsPage() {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDocument, setEditDocument] = useState<ProjectDocument | null>(null);
  const [formData, setFormData] = useState({
    document_name: '',
    description: '',
    project_id: '',
    category: 'general',
    file_type: '',
    version: '1.0',
    visibility: 'internal',
    uploaded_by: ''
  });

  useEffect(() => {
    fetchDocuments();
  }, []);
  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/project-documents', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Documents are derived from projects — just refresh
    fetchDocuments();
    setShowForm(false);
    setEditDocument(null);
    setFormData({
      document_name: '',
      description: '',
      project_id: '',
      category: 'general',
      file_type: '',
      version: '1.0',
      visibility: 'internal',
      uploaded_by: ''
    });
  };

  const handleEdit = (document: ProjectDocument) => {
    setEditDocument(document);
    setFormData({
      document_name: document.document_name,
      description: document.description || '',
      project_id: document.project_id?.toString() || '',
      category: document.category,
      file_type: document.file_type || '',
      version: document.version || '1.0',
      visibility: document.visibility,
      uploaded_by: document.uploaded_by || ''
    });
    setShowForm(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'requirements': return 'text-blue-400 bg-blue-500/10';
      case 'designs': return 'text-violet-400 bg-violet-500/10';
      case 'reports': return 'text-emerald-400 bg-emerald-500/10';
      case 'contracts': return 'text-amber-400 bg-amber-500/10';
      case 'technical': return 'text-cyan-400 bg-cyan-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getVisibilityColor = (visibility: string) => {
    switch (visibility?.toLowerCase()) {
      case 'public': return 'text-emerald-400 bg-emerald-500/10';
      case 'internal': return 'text-blue-400 bg-blue-500/10';
      case 'restricted': return 'text-amber-400 bg-amber-500/10';
      case 'confidential': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredDocuments = documents.filter(doc =>
    doc.document_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const requirementsCount = documents.filter(d => d.category === 'requirements').length;
  const designsCount = documents.filter(d => d.category === 'designs').length;
  const reportsCount = documents.filter(d => d.category === 'reports').length;
  const contractsCount = documents.filter(d => d.category === 'contracts').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/projects">المشاريع</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">المستندات</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <FileText className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">مستندات المشاريع</h1>
              <p className="text-slate-400 mt-1">إدارة وثائق المشاريع والملفات</p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>مستند جديد</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">المتطلبات</span>
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{requirementsCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">التصاميم</span>
              <FileText className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{designsCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">التقارير</span>
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{reportsCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">العقود</span>
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{contractsCount}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الوصف، المشروع، أو الفئة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد مستندات مسجلة'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم المستند</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المشروع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الفئة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحجم</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الإصدار</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الرؤية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الرفع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDocuments.map((doc) => {
                    return (
                      <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-violet-400" />
                              <span className="text-sm text-slate-200 font-medium">
                                {doc.document_name}
                              </span>
                            </div>
                            {doc.description && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                                {doc.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {doc.project_name || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                            {doc.category === 'requirements' ? 'متطلبات' :
                             doc.category === 'designs' ? 'تصاميم' :
                             doc.category === 'reports' ? 'تقارير' :
                             doc.category === 'contracts' ? 'عقود' :
                             doc.category === 'technical' ? 'تقني' : 'عام'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 uppercase">
                          {doc.file_type || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                          {doc.version || '1.0'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getVisibilityColor(doc.visibility)}`}>
                            {doc.visibility === 'public' ? 'عام' :
                             doc.visibility === 'internal' ? 'داخلي' :
                             doc.visibility === 'restricted' ? 'محظور' : 'سري'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('ar-LY') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEdit(doc)}
                              className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors"
                            >
                              تعديل
                            </button>
                            {doc.file_url && (
                              <button className="p-1 text-blue-400 hover:text-blue-300 transition-colors">
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              <h2 className="text-2xl font-bold text-slate-100">
                {editDocument ? 'تعديل المستند' : 'مستند جديد'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">اسم المستند *</label>
                <input
                  type="text"
                  required
                  value={formData.document_name}
                  onChange={(e) => setFormData({...formData, document_name: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الفئة *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="general">عام</option>
                    <option value="requirements">متطلبات</option>
                    <option value="designs">تصاميم</option>
                    <option value="reports">تقارير</option>
                    <option value="contracts">عقود</option>
                    <option value="technical">تقني</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">نوع الملف</label>
                  <input
                    type="text"
                    value={formData.file_type}
                    onChange={(e) => setFormData({...formData, file_type: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="PDF, DOCX, XLSX..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الإصدار</label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({...formData, version: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="1.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الرؤية *</label>
                  <select
                    required
                    value={formData.visibility}
                    onChange={(e) => setFormData({...formData, visibility: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="public">عام</option>
                    <option value="internal">داخلي</option>
                    <option value="restricted">مقيد</option>
                    <option value="confidential">سري</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">رفع بواسطة</label>
                <input
                  type="text"
                  value={formData.uploaded_by}
                  onChange={(e) => setFormData({...formData, uploaded_by: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400 text-sm mb-2">اسحب الملف هنا أو انقر للتحميل</p>
                <p className="text-slate-600 text-xs">(ستتم إضافة وظيفة رفع الملفات لاحقاً)</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  {editDocument ? 'تحديث' : 'إنشاء'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditDocument(null);
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
