'use client';

import React, { useState, useEffect } from 'react';
import { Flag, Plus, Search, ChevronLeft, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface Milestone {
  id: number;
  milestone_name: string;
  description?: string;
  project_id?: number;
  project_name?: string;
  status: string;
  target_date?: string;
  actual_completion_date?: string;
  deliverables?: string[];
  dependencies?: number[];
  is_critical: boolean;
  completion_criteria?: string;
  created_at?: string;
}

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null);
  const [formData, setFormData] = useState({
    milestone_name: '',
    description: '',
    project_id: '',
    status: 'upcoming',
    target_date: '',
    actual_completion_date: '',
    is_critical: false,
    completion_criteria: ''
  });
  const BASE = '/api/v1/hr-structure';

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    try {
      const response = await fetch(`${BASE}/project-milestones`, {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setMilestones(data.milestones || []);
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editMilestone 
        ? `${BASE}/project-milestones/${editMilestone.id}`
        : `${BASE}/project-milestones`;
      const method = editMilestone ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchMilestones();
        setShowForm(false);
        setEditMilestone(null);
        setFormData({
          milestone_name: '',
          description: '',
          project_id: '',
          status: 'upcoming',
          target_date: '',
          actual_completion_date: '',
          is_critical: false,
          completion_criteria: ''
        });
      }
    } catch (error) {
      console.error('Error saving milestone:', error);
    }
  };

  const handleEdit = (milestone: Milestone) => {
    setEditMilestone(milestone);
    setFormData({
      milestone_name: milestone.milestone_name,
      description: milestone.description || '',
      project_id: milestone.project_id?.toString() || '',
      status: milestone.status,
      target_date: milestone.target_date || '',
      actual_completion_date: milestone.actual_completion_date || '',
      is_critical: milestone.is_critical,
      completion_criteria: milestone.completion_criteria || ''
    });
    setShowForm(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'upcoming': return 'text-blue-400 bg-blue-500/10';
      case 'due': return 'text-amber-400 bg-amber-500/10';
      case 'completed': return 'text-emerald-400 bg-emerald-500/10';
      case 'missed': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getDaysRemaining = (targetDate: string) => {
    if (!targetDate) return null;
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredMilestones = milestones.filter(milestone =>
    milestone.milestone_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    milestone.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    milestone.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const upcomingCount = milestones.filter(m => m.status === 'upcoming').length;
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const missedCount = milestones.filter(m => m.status === 'missed').length;
  const criticalCount = milestones.filter(m => m.is_critical && m.status !== 'completed').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/projects">المشاريع</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">المراحل الرئيسية</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <Flag className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">المراحل الرئيسية</h1>
              <p className="text-slate-400 mt-1">إدارة وتتبع المراحل الحرجة والمعالم</p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>مرحلة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قادمة</span>
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{upcomingCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">مكتملة</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{completedCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">حرجة</span>
              <Flag className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{criticalCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">فائتة</span>
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{missedCount}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الوصف، أو المشروع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredMilestones.length === 0 ? (
              <div className="p-12 text-center">
                <Flag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد مراحل مسجلة'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم المرحلة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المشروع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التاريخ المستهدف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الإكمال</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المسار الحرج</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredMilestones.map((milestone) => {
                    const daysRemaining = milestone.status !== 'completed' && milestone.status !== 'missed' 
                      ? getDaysRemaining(milestone.target_date || '') 
                      : null;
                    
                    return (
                      <tr 
                        key={milestone.id} 
                        className={`hover:bg-slate-800/30 transition-colors ${
                          milestone.is_critical ? 'border-l-4 border-l-rose-500' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              {milestone.is_critical && <Flag className="w-4 h-4 text-rose-400" />}
                              <span className="text-sm text-slate-200 font-medium">
                                {milestone.milestone_name}
                              </span>
                            </div>
                            {milestone.description && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                                {milestone.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {milestone.project_name || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                            {milestone.status === 'upcoming' ? 'قادمة' :
                             milestone.status === 'due' ? 'مستحقة' :
                             milestone.status === 'completed' ? 'مكتملة' : 'فائتة'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {milestone.target_date ? (
                            <div>
                              <div className="text-sm text-slate-300">
                                {new Date(milestone.target_date).toLocaleDateString('ar-LY')}
                              </div>
                              {daysRemaining !== null && (
                                <div className={`text-xs mt-1 ${
                                  daysRemaining < 0 ? 'text-rose-400' :
                                  daysRemaining <= 7 ? 'text-amber-400' : 'text-blue-400'
                                }`}>
                                  {daysRemaining < 0 ? `متأخر ${Math.abs(daysRemaining)} يوم` :
                                   daysRemaining === 0 ? 'اليوم' :
                                   `${daysRemaining} يوم متبقي`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {milestone.actual_completion_date ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>{new Date(milestone.actual_completion_date).toLocaleDateString('ar-LY')}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {milestone.is_critical ? (
                            <span className="px-3 py-1 rounded-full text-xs font-medium text-rose-400 bg-rose-500/10">
                              حرجة
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleEdit(milestone)}
                            className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors"
                          >
                            تعديل
                          </button>
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
                {editMilestone ? 'تعديل المرحلة' : 'مرحلة جديدة'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">اسم المرحلة *</label>
                <input
                  type="text"
                  required
                  value={formData.milestone_name}
                  onChange={(e) => setFormData({...formData, milestone_name: e.target.value})}
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">الحالة *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="upcoming">قادمة</option>
                    <option value="due">مستحقة</option>
                    <option value="completed">مكتملة</option>
                    <option value="missed">فائتة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">التاريخ المستهدف</label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({...formData, target_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ الإكمال الفعلي</label>
                <input
                  type="date"
                  value={formData.actual_completion_date}
                  onChange={(e) => setFormData({...formData, actual_completion_date: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">معايير الإكمال</label>
                <textarea
                  value={formData.completion_criteria}
                  onChange={(e) => setFormData({...formData, completion_criteria: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 min-h-[60px]"
                  placeholder="ما الذي يجب تحقيقه لاعتبار هذه المرحلة مكتملة؟"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_critical"
                  checked={formData.is_critical}
                  onChange={(e) => setFormData({...formData, is_critical: e.target.checked})}
                  className="w-5 h-5 bg-slate-800 border-slate-700 rounded"
                />
                <label htmlFor="is_critical" className="text-sm text-slate-300 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-rose-400" />
                  مرحلة حرجة (على المسار الحرج)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  {editMilestone ? 'تحديث' : 'إنشاء'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditMilestone(null);
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
