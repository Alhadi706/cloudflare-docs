'use client';

import React, { useState, useEffect } from 'react';
import { X, MapPin, DollarSign, Users, Calendar, Wrench, Package, FileText, Sparkles, ChevronDown, Loader2 } from 'lucide-react';
import { resolveTenantContext, tenantHeaders } from '@/lib/gis/tenantContext';

interface Project {
  id: string;
  name: string;
  status: string;
  budget: number;
  organization: string;
  location_name: string;
  latitude: number;
  longitude: number;
  start_date?: string;
  end_date?: string;
  description?: string;
}

interface ProjectDetails extends Project {
  employees_count?: number;
  assets_count?: number;
  maintenance_count?: number;
  budget_spent?: number;
}

interface AIInsight {
  summary: string;
  risks: string[];
  recommendations: string[];
  status_analysis: string;
}

interface RelatedDataCounts {
  maintenance: number;
  work_orders: number;
  assets: number;
  employees: number;
}

interface ProjectSmartSidebarProps {
  projectId: string | null;
  onClose: () => void;
  onModuleSelect?: (module: string, projectId: string) => void;
}

export default function ProjectSmartSidebar({ projectId, onClose, onModuleSelect }: ProjectSmartSidebarProps) {
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight | null>(null);
  const [relatedCounts, setRelatedCounts] = useState<RelatedDataCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('');

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
      fetchRelatedCounts();
      fetchAIInsights();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const tenant = resolveTenantContext();
      console.log('🔍 جاري جلب تفاصيل المشروع:', projectId);
      
      const response = await fetch(`/api/v1/workspace/projects/${projectId}/details`, {
        headers: tenantHeaders(tenant)
      });
      
      if (response.ok) {
        const data = await response.json();
        setProject(data);
        console.log('✅ تم تحميل التفاصيل:', data);
      } else {
        console.error('❌ Failed to fetch project details');
      }
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedCounts = async () => {
    if (!projectId) return;
    
    try {
      const tenant = resolveTenantContext();
      // Fetch counts in parallel
      const [maintenance, workOrders, assets] = await Promise.all([
        fetch(`/api/v1/workspace/projects/${projectId}/maintenance/count`, {
          headers: tenantHeaders(tenant)
        }).then(r => r.ok ? r.json() : { count: 0 }),
        
        fetch(`/api/v1/workspace/projects/${projectId}/work-orders/count`, {
          headers: tenantHeaders(tenant)
        }).then(r => r.ok ? r.json() : { count: 0 }),
        
        fetch(`/api/v1/workspace/projects/${projectId}/assets/count`, {
          headers: tenantHeaders(tenant)
        }).then(r => r.ok ? r.json() : { count: 0 })
      ]);

      setRelatedCounts({
        maintenance: maintenance.count || 0,
        work_orders: workOrders.count || 0,
        assets: assets.count || 0,
        employees: 0 // Will implement employee count if needed
      });
    } catch (error) {
      console.error('❌ Error fetching counts:', error);
    }
  };

  const fetchAIInsights = async () => {
    if (!projectId) return;
    
    setAiLoading(true);
    try {
      const tenant = resolveTenantContext();
      console.log('🧠 جاري طلب AI Insights...');
      
      const prompt = `حلل هذا المشروع بشكل احترافي:
المشروع: ${project?.name || 'مشروع'}
الحالة: ${project?.status || 'غير محدد'}
الميزانية: ${project?.budget || 0}
الموقع: ${project?.location_name || 'غير محدد'}

قدم:
1. ملخص سريع (جملتين)
2. المخاطر المحتملة (3 نقاط)
3. التوصيات (3 نقاط)
4. تحليل الحالة`;

      const response = await fetch('/api/v1/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tenantHeaders(tenant),
        },
        body: JSON.stringify({
          question: prompt,
          language: 'ar',
          module: 'gis',
          context: {
            user_role: 'tenant_admin',
            project_id: projectId,
            entity_type: 'project',
          },
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.answer && !data.response) {
          throw new Error('EMPTY_RESPONSE_FROM_BACKEND');
        }
        
        // Parse AI response into structured format
        const insights: AIInsight = {
          summary: (data.answer || data.response).substring(0, 200),
          risks: ['تحليل المخاطر قيد المعالجة'],
          recommendations: ['توصيات قيد التحليل'],
          status_analysis: 'جاري التحليل'
        };
        
        setAiInsights(insights);
        console.log('✅ AI Insights:', insights);
      }
    } catch (error) {
      console.error('❌ AI Error:', error);
      setAiInsights({
        summary: 'ERROR: فشل جلب الاستجابة من الخادم',
        risks: [],
        recommendations: [],
        status_analysis: 'غير متوفر'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleModuleClick = (module: string) => {
    setSelectedModule(module);
    if (onModuleSelect && projectId) {
      onModuleSelect(module, projectId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'active': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      'in_progress': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'completed': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      'planning': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      'on_hold': 'bg-slate-500/20 text-slate-400 border-slate-500/50'
    };
    return colors[status] || colors['planning'];
  };

  if (!projectId) return null;

  return (
    <div className="absolute top-0 left-0 w-96 h-full bg-slate-900/95 backdrop-blur-lg border-r border-slate-700 shadow-2xl overflow-y-auto z-50">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-100">تحليل ذكي</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        )}

        {/* Project Overview */}
        {!loading && project && (
          <>
            {/* Project Name */}
            <div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">{project.name}</h3>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400">الميزانية</span>
                </div>
                <div className="text-lg font-bold text-slate-100">
                  {formatCurrency(project.budget || 0)}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400">الموقع</span>
                </div>
                <div className="text-sm font-medium text-slate-100 truncate">
                  {project.location_name || 'غير محدد'}
                </div>
              </div>

              {project.start_date && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-slate-400">تاريخ البدء</span>
                  </div>
                  <div className="text-sm font-medium text-slate-100">
                    {new Date(project.start_date).toLocaleDateString('ar-LY')}
                  </div>
                </div>
              )}

              {project.organization && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-400">الجهة</span>
                  </div>
                  <div className="text-sm font-medium text-slate-100 truncate">
                    {project.organization}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {project.description && (
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
                <p className="text-sm text-slate-300 leading-relaxed">{project.description}</p>
              </div>
            )}

            {/* AI Insights */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-lg p-4 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h4 className="font-bold text-slate-100">التحليل الذكي</h4>
              </div>

              {aiLoading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">جاري التحليل...</span>
                </div>
              ) : aiInsights ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-300 leading-relaxed">{aiInsights.summary}</p>
                  </div>
                  
                  {aiInsights.risks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-400 mb-1">⚠️ المخاطر:</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        {aiInsights.risks.map((risk, i) => (
                          <li key={i}>• {risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiInsights.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-emerald-400 mb-1">💡 التوصيات:</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        {aiInsights.recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">التحليل غير متوفر</p>
              )}
            </div>

            {/* Related Modules */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                عرض البيانات المرتبطة
              </label>
              <select
                value={selectedModule}
                onChange={(e) => handleModuleClick(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="">اختر وحدة...</option>
                <option value="maintenance">🔧 أوامر الصيانة {relatedCounts && `(${relatedCounts.maintenance})`}</option>
                <option value="work-orders">📋 أوامر العمل {relatedCounts && `(${relatedCounts.work_orders})`}</option>
                <option value="assets">📦 الأصول {relatedCounts && `(${relatedCounts.assets})`}</option>
                <option value="employees">👥 الموظفين {relatedCounts && `(${relatedCounts.employees})`}</option>
              </select>
            </div>

            {/* Module Cards */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleModuleClick('maintenance')}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg p-3 transition-all text-right"
              >
                <Wrench className="w-5 h-5 text-orange-400 mb-2" />
                <div className="text-2xl font-bold text-slate-100">
                  {relatedCounts?.maintenance || 0}
                </div>
                <div className="text-xs text-slate-400">سجلات صيانة</div>
              </button>

              <button
                onClick={() => handleModuleClick('work-orders')}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg p-3 transition-all text-right"
              >
                <FileText className="w-5 h-5 text-blue-400 mb-2" />
                <div className="text-2xl font-bold text-slate-100">
                  {relatedCounts?.work_orders || 0}
                </div>
                <div className="text-xs text-slate-400">أوامر عمل</div>
              </button>

              <button
                onClick={() => handleModuleClick('assets')}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg p-3 transition-all text-right"
              >
                <Package className="w-5 h-5 text-purple-400 mb-2" />
                <div className="text-2xl font-bold text-slate-100">
                  {relatedCounts?.assets || 0}
                </div>
                <div className="text-xs text-slate-400">أصول</div>
              </button>

              <button
                onClick={() => handleModuleClick('employees')}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg p-3 transition-all text-right"
              >
                <Users className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-2xl font-bold text-slate-100">
                  {relatedCounts?.employees || 0}
                </div>
                <div className="text-xs text-slate-400">موظفين</div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
