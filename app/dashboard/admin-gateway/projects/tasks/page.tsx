'use client';

import React, { useState, useEffect } from 'react';
import { ListChecks, Plus, Search, ChevronLeft, Clock, User, AlertCircle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface Task {
  id: number;
  task_name: string;
  description?: string;
  project_id?: number;
  project_name?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  parent_task_id?: number;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_date?: string;
  dependencies?: number[];
  created_at?: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    task_name: '',
    description: '',
    project_id: '',
    status: 'todo',
    priority: 'normal',
    assigned_to: '',
    parent_task_id: '',
    estimated_hours: '',
    due_date: ''
  });
  const BASE = '/api/v1/hr-structure';

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${BASE}/project-tasks`, {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editTask 
        ? `${BASE}/project-tasks/${editTask.id}`
        : `${BASE}/project-tasks`;
      const method = editTask ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        fetchTasks();
        setShowForm(false);
        setEditTask(null);
        setFormData({
          task_name: '',
          description: '',
          project_id: '',
          status: 'todo',
          priority: 'normal',
          assigned_to: '',
          parent_task_id: '',
          estimated_hours: '',
          due_date: ''
        });
      }
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleEdit = (task: Task) => {
    setEditTask(task);
    setFormData({
      task_name: task.task_name,
      description: task.description || '',
      project_id: task.project_id?.toString() || '',
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      parent_task_id: task.parent_task_id?.toString() || '',
      estimated_hours: task.estimated_hours?.toString() || '',
      due_date: task.due_date || ''
    });
    setShowForm(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'todo': return 'text-slate-400 bg-slate-500/10';
      case 'in_progress': return 'text-blue-400 bg-blue-500/10';
      case 'review': return 'text-violet-400 bg-violet-500/10';
      case 'blocked': return 'text-rose-400 bg-rose-500/10';
      case 'done': return 'text-emerald-400 bg-emerald-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-rose-400 bg-rose-500/10';
      case 'high': return 'text-amber-400 bg-amber-500/10';
      case 'normal': return 'text-blue-400 bg-blue-500/10';
      case 'low': return 'text-emerald-400 bg-emerald-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getDaysRemaining = (dueDate: string) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredTasks = tasks.filter(task =>
    task.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todoTasks = tasks.filter(t => t.status === 'todo').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    const days = getDaysRemaining(t.due_date);
    return days !== null && days < 0;
  }).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/projects">المشاريع</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">المهام</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <ListChecks className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">المهام</h1>
              <p className="text-slate-400 mt-1">إدارة وتتبع المهام والأنشطة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="tasks" onSuccess={fetchTasks} />
            <button 
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>مهمة جديدة</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قائمة الانتظار</span>
              <ListChecks className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{todoTasks}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قيد التنفيذ</span>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{inProgressTasks}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">مكتملة</span>
              <ListChecks className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{completedTasks}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">متأخرة</span>
              <AlertCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{overdueTasks}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الوصف، المشروع، أو المسؤول..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <ListChecks className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد مهام مسجلة'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم المهمة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المشروع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأولوية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المسؤول</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الوقت المقدر</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموعد النهائي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTasks.map((task) => {
                    const daysRemaining = getDaysRemaining(task.due_date || '');
                    
                    return (
                      <tr key={task.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm text-slate-200 font-medium">
                              {task.parent_task_id && <span className="text-slate-500 mr-2">└─</span>}
                              {task.task_name}
                            </div>
                            {task.description && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {task.project_name || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {task.status === 'todo' ? 'قائمة انتظار' :
                             task.status === 'in_progress' ? 'قيد التنفيذ' :
                             task.status === 'review' ? 'مراجعة' :
                             task.status === 'blocked' ? 'محظور' : 'مكتمل'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority === 'critical' ? 'حرج' :
                             task.priority === 'high' ? 'عالي' :
                             task.priority === 'normal' ? 'عادي' : 'منخفض'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-400">
                              {task.assigned_to || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {task.estimated_hours ? `${task.estimated_hours} ساعة` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {task.due_date ? (
                            <div>
                              <div className="text-sm text-slate-300">
                                {new Date(task.due_date).toLocaleDateString('ar-LY')}
                              </div>
                              {daysRemaining !== null && task.status !== 'done' && (
                                <div className={`text-xs mt-1 ${
                                  daysRemaining < 0 ? 'text-rose-400' :
                                  daysRemaining <= 3 ? 'text-amber-400' : 'text-emerald-400'
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
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleEdit(task)}
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
                {editTask ? 'تعديل المهمة' : 'مهمة جديدة'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">اسم المهمة *</label>
                <input
                  type="text"
                  required
                  value={formData.task_name}
                  onChange={(e) => setFormData({...formData, task_name: e.target.value})}
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
                    <option value="todo">قائمة انتظار</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="review">مراجعة</option>
                    <option value="blocked">محظور</option>
                    <option value="done">مكتمل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الأولوية *</label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="low">منخفض</option>
                    <option value="normal">عادي</option>
                    <option value="high">عالي</option>
                    <option value="critical">حرج</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">المسؤول</label>
                  <input
                    type="text"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الوقت المقدر (ساعات)</label>
                  <input
                    type="number"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData({...formData, estimated_hours: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الموعد النهائي</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  {editTask ? 'تحديث' : 'إنشاء'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditTask(null);
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
