'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, Plus, Search, ChevronLeft, Calendar, TrendingUp, Users, MapIcon, MapPin, Building2, Trash2, Crosshair, User, Map, Crown, Mail, BarChart2, Target, Layers } from 'lucide-react';
import Link from 'next/link';
import { createProjectBoundary } from '@/lib/erpSpatialService';
import MapLocationPicker from '@/components/MapLocationPicker';
import { apiClient } from '@/lib/productionApiClient';
import { formatCurrency } from '@/lib/formatters';
import { useErpContextStore } from '@/store/erpContextStore';
import { getUserAuthHeaders, useUserStore } from '@/store/useUserStore';
import { useGisEngine } from '@/store/gisEngine';

interface Project {
  id: string | number;
  name?: string;  // Backend field
  project_name?: string;  // Dashboard field
  description?: string;
  project_code?: string;
  status: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  deadline?: string;
  progress_percentage?: number;
  budget?: number;  // Backend field
  budget_allocated?: number;  // Dashboard field
  budget_spent?: number;
  project_manager?: string;
  department?: string;
  team_members?: number;
  created_at?: string;
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [employees, setEmployees] = useState<{id: number; name: string; role: string}[]>([]);
  // ── مواقع أولية داخل فورم المشروع ──────────────────────────
  interface InitialSite { name: string; site_type: string; latitude: string; longitude: string; }
  const [initialSites, setInitialSites] = useState<InitialSite[]>([]);
  const [siteMapTarget, setSiteMapTarget] = useState<number | null>(null); // index of site picking
  const addInitialSite = () => setInitialSites(p => [...p, { name: '', site_type: 'field', latitude: '', longitude: '' }]);
  const removeInitialSite = (i: number) => setInitialSites(p => p.filter((_, idx) => idx !== i));
  const updateInitialSite = (i: number, field: keyof InitialSite, val: string) =>
    setInitialSites(p => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active',
    budget: '',
    department: 'قسم إدارة المشاريع',
    organization: '',
    primary_admin_user_id: '',
    start_date: '',
    end_date: '',
    deadline: '',
    lat: '',
    lon: '',
    location_name: '',
    priority: 'normal',
    progress_percentage: '0',
    project_type: 'construction',
  });

  const { setActiveProject, loadProjects: reloadErpProjects } = useErpContextStore();
  const refreshAll = useGisEngine((s) => s.refreshAll);
  const currentUser = useUserStore((s) => s.current);

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await apiClient.getEmployees();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    console.log('🗂️ [DEBUG] تحديث projects:', projects.length, 'مشروع');
  }, [projects]);

  // Helper: توحيد الحقول بين Backend والDashboard
  const normalizeProject = (project: Project) => ({
    ...project,
    project_name: project.project_name || project.name || '',
    project_code: project.project_code || project.code || '',
    budget_allocated: project.budget_allocated || project.budget || 0,
    priority: project.priority || 'normal',
    progress_percentage: project.progress_percentage || (project as any).progress_pct || 0
  });

  const fetchProjects = async () => {
    try {
      console.log('🔍 [DEBUG] بدء جلب المشاريع من projects_core');
      
      const data = await apiClient.getProjects();
      
      console.log('📦 [DEBUG] Response:', data);
      
      if (Array.isArray(data)) {
        setProjects(data);
        console.log('✅ [DEBUG] تم تحميل', data.length, 'مشروع من projects_core');
        
        // مزامنة تلقائية مع GIS: ربط كل مشروع بـ gis_data
        syncProjectsWithGIS(data);
      } else {
        console.error('❌ [DEBUG] البيانات ليست Array:', data);
        setProjects([]);
      }
    } catch (error) {
      console.error('❌ [ERROR] خطأ في جلب المشاريع:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // ── مزامنة تلقائية: ربط المشاريع بـ gis_data ──────────────────────────
  const syncProjectsWithGIS = async (projectsList: Project[]) => {
    for (const project of projectsList) {
      try {
        // إذا كان المشروع له إحداثيات، تأكد من وجوده في gis_data
        const lat = (project as any).latitude || (project as any).lat;
        const lon = (project as any).longitude || (project as any).lon;
        const projId = project.id;
        
        if (lat && lon) {
          await createProjectBoundary({
            project_id: projId,
            project_name: (project as any).name || (project as any).project_name || 'Project',
            boundary_type: 'point',
            coordinates: [[parseFloat(lon.toString()), parseFloat(lat.toString())]],
            description: project.description || ''
          });
          console.log(`✅ تم ربط المشروع ${projId} بـ GIS`);
        }
      } catch (err) {
        // تجاهل الأخطاء، قد يكون المشروع مرتبطاً بالفعل
        console.debug(`⚠️ مشروع ${project.id} - GIS sync:`, err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSaving(true);
    try {
      // ── بناء الـ payload بحقول backend الصحيحة ──────────────────────────
      const payload: Record<string, any> = {
        name:                   formData.name.trim(),
        code:                   formData.code.trim() || `PRJ-${Date.now()}`,
        status:                 formData.status,
        description:            formData.description || null,
        budget:                 formData.budget ? parseFloat(formData.budget) : null,
        department:             formData.department || null,
        start_date:             formData.start_date || null,
        end_date:               formData.end_date || null,
        latitude:               formData.lat ? parseFloat(formData.lat) : null,
        longitude:              formData.lon ? parseFloat(formData.lon) : null,
        lat:                    formData.lat ? parseFloat(formData.lat) : null,
        lon:                    formData.lon ? parseFloat(formData.lon) : null,
        location_name:          formData.location_name || null,
        priority:               formData.priority || 'normal',
      };

      let savedProject;
      if (editProject) {
        savedProject = await apiClient.updateProject(editProject.id as any, payload);
      } else {
        savedProject = await apiClient.createProject(payload);
      }
      
      if (savedProject) {
        // مزامنة مع قاعدة البيانات المكانية إذا كانت الإحداثيات موجودة
        const savedId = savedProject.project?.id || savedProject.id;
        if (!savedId) throw new Error('فشل إنشاء المشروع: معرّف غير صالح');

        // إنشاء المواقع الأولية
        for (const site of initialSites) {
          if (!site.name.trim()) continue;
          try {
            await apiClient.createProjectSite(savedId, {
              name: site.name.trim(),
              site_type: site.site_type,
              latitude: site.latitude ? parseFloat(site.latitude) : null,
              longitude: site.longitude ? parseFloat(site.longitude) : null,
              status: 'active'
            });
          } catch (siteErr) { console.warn('site creation failed:', siteErr); }
        }
        setInitialSites([]);

        if (payload.lat && payload.lon) {
          try {
            await createProjectBoundary({
              project_id: savedId,
              project_name: payload.name,
              boundary_type: 'point',
              coordinates: [[payload.lon, payload.lat]],
              description: payload.description || ''
            });
          } catch (spatErr) {
            console.warn('⚠️ فشلت مزامنة GIS:', spatErr);
          }
        }
        
        fetchProjects();
        reloadErpProjects(); // تحديث قائمة المشاريع في الشريط العلوي
        await refreshAll();
        // اختيار المشروع الجديد تلقائياً إذا لم يكن هناك مشروع محدد
        if (savedId && !editProject) {
          setActiveProject(String(savedId));
        }
        setShowForm(false);
        setEditProject(null);
        resetForm();
      } else {
          console.error('❌ خطأ في إنشاء المشروع: لم يُرجع الخادم بيانات صالحة');
          setFormError('تعذّر حفظ المشروع: لم يُرجع الخادم بيانات صالحة، يرجى المحاولة مرة أخرى');
      }
    } catch (error) {
      console.error('Error saving project:', error);
      setFormError('تعذّر الاتصال بالخادم. يرجى التحقق من تشغيل الخدمة والمحاولة مرة أخرى.');
    } finally {
      setFormSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', code: '', description: '', status: 'active',
      budget: '', department: 'قسم إدارة المشاريع',
      organization: '', primary_admin_user_id: '',
      start_date: '', end_date: '', lat: '', lon: '',
      deadline: '', location_name: '',
      priority: 'normal', progress_percentage: '0',
    });
    setInitialSites([]);
  };

  const handleEdit = (project: Project) => {
    setEditProject(project);
    setFormData({
      name: (project as any).name || (project as any).project_name || '',
      code: (project as any).code || (project as any).project_code || '',
      description: project.description || '',
      status: project.status || 'active',
      budget: ((project as any).budget || (project as any).budget_allocated || '').toString(),
      department: (project as any).department || 'قسم إدارة المشاريع',
      organization: (project as any).organization || '',
      primary_admin_user_id: (project as any).primary_admin_user_id?.toString() || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      deadline: project.deadline || '',
      lat: ((project as any).lat ?? (project as any).latitude)?.toString() || '',
      lon: ((project as any).lon ?? (project as any).longitude)?.toString() || '',
      location_name: (project as any).location_name || '',
      priority: project.priority || 'normal',
      progress_percentage: (project.progress_percentage || (project as any).progress_pct || 0).toString(),
    });
    setShowForm(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'planning': return 'text-slate-400 bg-slate-500/10';
      case 'active': return 'text-emerald-400 bg-emerald-500/10';
      case 'on_hold': return 'text-amber-400 bg-amber-500/10';
      case 'completed': return 'text-blue-400 bg-blue-500/10';
      case 'cancelled': return 'text-rose-400 bg-rose-500/10';
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

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-emerald-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-amber-500';
    return 'bg-slate-500';
  };

  // تم نقل formatCurrency إلى /lib/formatters.ts

  const getDaysRemaining = (deadline: string) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredProjects = projects
    .map(normalizeProject)
    .filter(project =>
      project.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_manager?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  console.log('🎯 [DEBUG] عدد الكلي:', projects.length);
  console.log('🎯 [DEBUG] عدد المفلترة:', filteredProjects.length);

  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const avgProgress = projects.length > 0 
    ? projects.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / projects.length 
    : 0;
  const overdueProjects = projects.filter(p => {
    if (!p.deadline || p.status === 'completed') return false;
    const days = getDaysRemaining(p.deadline);
    return days !== null && days < 0;
  }).length;

  return (
    <div className="min-h-full bg-transparent p-3 md:p-4" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ── Breadcrumb + Manager button ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">بوابة النظام</Link>
            <ChevronLeft className="w-4 h-4 rotate-180" />
            <Link href="/dashboard/admin-gateway/projects" className="hover:text-slate-200 transition-colors">إدارة المشاريع</Link>
            <ChevronLeft className="w-4 h-4 rotate-180" />
            <span className="text-slate-200">قائمة المشاريع</span>
          </div>
          <Link
            href="/dashboard/admin-gateway/projects/manager"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/20 transition-colors shrink-0"
          >
            <Crown className="w-3.5 h-3.5" />
            لوحة مدير الإدارة
          </Link>
        </div>

        {/* ── شريط التبويبات الموحد + أقسام سريعة ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-xl border border-white/15 bg-white/5 p-1 backdrop-blur-xl">
            <span className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-purple-600 text-white shadow">
              قائمة المشاريع
            </span>
            <Link
              href="/dashboard/admin-gateway/project-control"
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              مراقبة التنفيذ
            </Link>
          </div>
          {/* ── أقسام الإدارة السريعة ── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { href: '/dashboard/admin-gateway/projects/correspondence', icon: Mail,     label: 'المراسلات الموحدة', color: 'text-sky-300',    border: 'border-sky-500/20',    bg: 'bg-sky-500/10'    },
              { href: '/dashboard/admin-gateway/projects/map',            icon: Map,      label: 'عرض الخرائط',       color: 'text-cyan-300',   border: 'border-cyan-500/20',   bg: 'bg-cyan-500/10'   },
              { href: '/dashboard/admin-gateway/projects/dashboard',      icon: BarChart2,label: 'لوحة القيادة',       color: 'text-rose-300',   border: 'border-rose-500/20',   bg: 'bg-rose-500/10'   },
              { href: '/dashboard/admin-gateway/projects/milestones',     icon: Target,   label: 'الجداول',            color: 'text-amber-300',  border: 'border-amber-500/20',  bg: 'bg-amber-500/10'  },
              { href: '/dashboard/admin-gateway/projects/budget',         icon: TrendingUp,label: 'الميزانية',          color: 'text-emerald-300',border: 'border-emerald-500/20',bg: 'bg-emerald-500/10'},
              { href: '/dashboard/admin-gateway/projects/documents',      icon: Layers,   label: 'الوثائق',            color: 'text-violet-300', border: 'border-violet-500/20', bg: 'bg-violet-500/10' },
            ].map(({ href, icon: Icon, label, color, border, bg }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg border ${border} ${bg} px-2.5 py-1 text-xs ${color} hover:opacity-80 transition-opacity`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <FolderKanban className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">قائمة المشاريع</h1>
              <p className="text-white/75 mt-1">إدارة وتتبع جميع المشاريع</p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>مشروع جديد</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/75 text-sm">مشاريع نشطة</span>
              <FolderKanban className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{activeProjects}</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/75 text-sm">مشاريع مكتملة</span>
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{completedProjects}</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/75 text-sm">متوسط الإنجاز</span>
              <TrendingUp className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-white">{avgProgress.toFixed(0)}%</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/75 text-sm">متأخرة</span>
              <Calendar className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-white">{overdueProjects}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الكود، الوصف، أو المدير..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-12 text-white placeholder-white/55 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-12 text-center">
                <FolderKanban className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد مشاريع مسجلة'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-black/20">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم المشروع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">كود المشروع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأولوية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نسبة الإنجاز</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الميزانية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المدير</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النهاية المستهدفة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredProjects.map((project) => {
                    const daysRemaining = getDaysRemaining(project.deadline || '');
                    
                    return (
                      <tr key={project.id} className="hover:bg-white/10 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm text-slate-200 font-medium">{project.project_name}</div>
                            {project.description && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                                {project.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                          {project.project_code || 'PRJ-' + project.id}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                            {project.status === 'planning' ? 'تخطيط' :
                             project.status === 'active' ? 'نشط' :
                             project.status === 'on_hold' ? 'متوقف' :
                             project.status === 'completed' ? 'مكتمل' : 'ملغي'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority)}`}>
                            {project.priority === 'critical' ? 'حرج' :
                             project.priority === 'high' ? 'عالي' :
                             project.priority === 'normal' ? 'عادي' : 'منخفض'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">{project.progress_percentage}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${getProgressColor(project.progress_percentage)}`}
                                style={{ width: `${project.progress_percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {project.budget_allocated ? formatCurrency(project.budget_allocated) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {project.project_manager || '-'}
                        </td>
                        <td className="px-6 py-4">
                          {project.deadline ? (
                            <div>
                              <div className="text-sm text-slate-300">
                                {new Date(project.deadline).toLocaleDateString('ar-LY')}
                              </div>
                              {daysRemaining !== null && (
                                <div className={`text-xs mt-1 ${
                                  daysRemaining < 0 ? 'text-rose-400' :
                                  daysRemaining <= 7 ? 'text-amber-400' : 'text-emerald-400'
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
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEdit(project)}
                              className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors"
                            >
                              تعديل
                            </button>
                            <Link
                              href={`/dashboard/admin-gateway/projects/sites?project_id=${project.id}&project_name=${encodeURIComponent(normalizeProject(project).project_name)}`}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors"
                            >
                              <Building2 size={11} />
                              المواقع
                            </Link>
                            <Link
                              href={`/dashboard/gis-sovereignty/engineering-workspace?project=${project.id}`}
                              className="flex items-center gap-1 px-3 py-1 bg-teal-600/20 text-teal-400 rounded-lg text-xs hover:bg-teal-600/30 transition-colors"
                              title="فتح المشروع على الخريطة"
                            >
                              <Map size={11} />
                              خريطة
                            </Link>
                            <Link
                              href={`/dashboard/admin-gateway/projects/${project.id}`}
                              className="flex items-center gap-1 px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs hover:bg-cyan-600/30 transition-colors font-semibold"
                              title="عرض المشروع 360°"
                            >
                              360°
                            </Link>
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
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-100">
                  {editProject ? 'تعديل المشروع' : 'مشروع جديد'}
                </h2>
                {/* ── شارة المستأجر الحالي — مرئية وصريحة — ── */}
                <div className="flex items-center gap-2 bg-violet-900/30 border border-violet-500/40 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-slate-400">المستأجر:</span>
                  <span className="text-xs font-bold text-violet-300">INFRA_OPS</span>
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">()</span>
                  <span className="mx-1 text-slate-600">|</span>
                  <span className="text-xs text-slate-400">المستخدم:</span>
                  <span className="text-xs font-medium text-emerald-300">{currentUser?.full_name || currentUser?.name || currentUser?.username || ''}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">{currentUser?.role || (currentUser?.roles?.[0] ?? '')}</span>
                  <span className="text-xs text-slate-500">(يُرسل تلقائياً)</span>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">اسم المشروع *</label>
                  <input
                    type="text"
                    required
                    dir="rtl"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="مشروع صيانة الشبكة"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">كود المشروع *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="PRJ-2026-001"
                  />
                  <p className="text-xs text-slate-500 mt-1">يُولَّد تلقائياً إذا تُرك فارغاً</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الوصف</label>
                <textarea
                  dir="rtl"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="وصف تفصيلي للمشروع..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الحالة *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="planning">تخطيط</option>
                    <option value="active">نشط</option>
                    <option value="on_hold">متوقف</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
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

              {/* نوع المشروع — يحدد دورة حياته */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
                <label className="block text-sm font-semibold text-slate-200 mb-2">نوع المشروع *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'construction',          label: '🏗️ إنشاء / تطوير',       desc: 'ينتج أصلاً تشغيلياً جديداً عند الاستلام' },
                    { val: 'maintenance_contract',  label: '🔧 عقد صيانة كبرى',       desc: 'يُحدِّث أصلاً موجوداً — لا يُنشئ أصلاً جديداً' },
                  ].map(opt => (
                    <button
                      key={opt.val} type="button"
                      onClick={() => setFormData({...formData, project_type: opt.val})}
                      className={`text-right p-3 rounded-xl border text-xs transition-all ${
                        (formData as any).project_type === opt.val
                          ? opt.val === 'construction'
                            ? 'bg-violet-500/20 border-violet-500/60 text-violet-200'
                            : 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ البدء</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الموعد النهائي</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">نسبة الإنجاز (%)</label>
                  <input
                    type="number"
                    value={formData.progress_percentage}
                    onChange={(e) => setFormData({...formData, progress_percentage: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الميزانية المخصصة (د.ل)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* ── المسؤول الأول + الجهة ──────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-violet-400" />
                    المسؤول الأول عن المشروع
                  </label>
                  <select
                    value={formData.primary_admin_user_id}
                    onChange={(e) => setFormData({...formData, primary_admin_user_id: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">— اختر موظفاً —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id.toString()}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الجهة / المنظمة</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.organization}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="شركة تشغيل وصيانة البنية التحتية"
                  />
                </div>
              </div>

              {/* حقول مكانية */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapIcon className="w-5 h-5 text-green-400" />
                  <h3 className="text-sm font-medium text-slate-200">الموقع الجغرافي للمشروع</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">اسم الموقع / العنوان</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={formData.location_name}
                      onChange={(e) => setFormData({...formData, location_name: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="مثال: منطقة الشمال — طريق الساحل الغربي"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="w-full px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 text-green-400 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{formData.lat && formData.lon ? 'تعديل الموقع من الخريطة' : 'تحديد الموقع من الخريطة'}</span>
                  </button>
                  
                  {formData.lat && formData.lon && (
                    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">خط العرض:</span>
                        <span className="text-green-400 font-mono">{parseFloat(formData.lat).toFixed(6)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">خط الطول:</span>
                        <span className="text-green-400 font-mono">{parseFloat(formData.lon).toFixed(6)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">💡 انقر على الخريطة لتحديد الموقع الجغرافي للمشروع</p>
              </div>

              {/* ── مواقع أولية (Initial Sites) ─────────────────────── */}
              {!editProject && (
                <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-400" />
                      <h3 className="text-sm font-medium text-slate-200">مواقع أولية للمشروع</h3>
                      <span className="text-xs text-slate-500">(اختياري)</span>
                    </div>
                    <button
                      type="button"
                      onClick={addInitialSite}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 rounded-lg text-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة موقع
                    </button>
                  </div>

                  {initialSites.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">
                      يمكنك إضافة مواقع للمشروع مباشرةً عند الإنشاء — أو إضافتها لاحقاً من صفحة المواقع
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {initialSites.map((site, i) => (
                        <div key={i} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-5 text-center font-mono">{i + 1}</span>
                            <input
                              type="text"
                              value={site.name}
                              onChange={e => updateInitialSite(i, 'name', e.target.value)}
                              placeholder="اسم الموقع *"
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                            />
                            <select
                              value={site.site_type}
                              onChange={e => updateInitialSite(i, 'site_type', e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none"
                            >
                              <option value="field">ميداني</option>
                              <option value="administrative">إداري</option>
                              <option value="operational">تشغيلي</option>
                              <option value="storage">مخزن</option>
                              <option value="maintenance">صيانة</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => { setSiteMapTarget(i); setShowMapPicker(true); }}
                              title="اختر من الخريطة"
                              className={`p-1.5 rounded-lg border transition-colors ${
                                site.latitude && site.longitude
                                  ? 'bg-green-600/20 border-green-500/40 text-green-400'
                                  : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Crosshair className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeInitialSite(i)}
                              className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {site.latitude && site.longitude && (
                            <div className="flex items-center gap-1.5 text-xs text-green-400 pr-5">
                              <MapPin className="w-3 h-3" />
                              {parseFloat(site.latitude).toFixed(5)}, {parseFloat(site.longitude).toFixed(5)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* رسالة الخطأ */}
              {formError && (
                <div className="flex items-start gap-3 bg-red-900/30 border border-red-700/50 rounded-xl p-4">
                  <span className="text-red-400 text-lg">⚠️</span>
                  <p className="text-red-300 text-sm">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={formSaving}
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {formSaving ? (
                    <><span className="animate-spin">⏳</span> جاري الحفظ...</>
                  ) : (
                    editProject ? 'تحديث' : 'إنشاء المشروع'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditProject(null);
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

      {/* Map Location Picker — shared for project + initial sites */}
      <MapLocationPicker
        isOpen={showMapPicker}
        onClose={() => { setShowMapPicker(false); setSiteMapTarget(null); }}
        onLocationSelect={(lat, lng, label) => {
          if (siteMapTarget !== null) {
            updateInitialSite(siteMapTarget, 'latitude', lat.toString());
            updateInitialSite(siteMapTarget, 'longitude', lng.toString());
          } else {
            setFormData(prev => ({
              ...prev,
              lat: lat.toString(),
              lon: lng.toString(),
              // auto-fill location_name from reverse geocode if user hasn't typed one yet
              location_name: label && !prev.location_name ? label : prev.location_name,
            }));
          }
        }}
        initialLatitude={
          siteMapTarget !== null && initialSites[siteMapTarget]?.latitude
            ? parseFloat(initialSites[siteMapTarget].latitude)
            : formData.lat ? parseFloat(formData.lat) : undefined
        }
        initialLongitude={
          siteMapTarget !== null && initialSites[siteMapTarget]?.longitude
            ? parseFloat(initialSites[siteMapTarget].longitude)
            : formData.lon ? parseFloat(formData.lon) : undefined
        }
      />
    </div>
  );
}
