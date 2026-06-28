'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Play, TrendingUp, Clock, DollarSign, Users, MapPin, FileText } from 'lucide-react';

interface Scenario {
  scenario_id: string;
  name: string;
  description: string;
  scenario_type: string;
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED';
  created_at: string;
  parameters: Record<string, any>;
  result_summary?: {
    impact_score: number;
    cost_estimate: number;
    affected_population: number;
    implementation_time_days: number;
  };
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function ScenarioSimulationPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    scenario_type: 'urban_expansion',
    parameters: {}
  });

  const scenarioTypes = [
    { value: 'urban_expansion', label: 'التوسع العمراني', icon: <MapPin className="w-5 h-5" /> },
    { value: 'traffic_impact', label: 'تأثير الحركة المرورية', icon: <TrendingUp className="w-5 h-5" /> },
    { value: 'infrastructure_upgrade', label: 'ترقية البنية التحتية', icon: <Zap className="w-5 h-5" /> },
    { value: 'budget_allocation', label: 'تخصيص الميزانية', icon: <DollarSign className="w-5 h-5" /> },
    { value: 'disaster_response', label: 'الاستجابة للكوارث', icon: <FileText className="w-5 h-5" /> }
  ];

  // Fetch scenarios
  const fetchScenarios = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/hr-structure/scenarios', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const handleCreateScenario = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
        body: JSON.stringify(newScenario)
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setNewScenario({ name: '', description: '', scenario_type: 'urban_expansion', parameters: {} });
        fetchScenarios();
      }
    } catch (error) {
      console.error('Failed to create scenario:', error);
    }
  };

  const handleRunSimulation = async (scenarioId: string) => {
    try {
      const response = await fetch(`/api/v1/hr-structure/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
        body: JSON.stringify({ iterations: 1000, method: 'monte_carlo' })
      });
      
      if (response.ok) {
        fetchScenarios();
      }
    } catch (error) {
      console.error('Failed to run simulation:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10';
      case 'RUNNING':
        return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
      case 'READY':
        return 'text-purple-400 border-purple-500/50 bg-purple-500/10';
      case 'DRAFT':
        return 'text-slate-400 border-slate-500/50 bg-slate-500/10';
      default:
        return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      DRAFT: 'مسودة',
      READY: 'جاهز',
      RUNNING: 'قيد التشغيل',
      COMPLETED: 'مكتمل'
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-slate-900/50 p-6 rounded-2xl border border-purple-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-purple-500/50">
              <Zap className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">محاكاة السيناريوهات</h1>
              <p className="text-slate-300 mt-1">تحليل التأثير وتخطيط السيناريوهات المستقبلية</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
          >
            <Zap className="w-5 h-5" />
            سيناريو جديد
          </button>
        </div>

        {/* Scenario Types Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {scenarioTypes.map((type, index) => (
            <div key={index} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-purple-400">{type.icon}</div>
                <div className="text-sm font-bold text-slate-300">{type.label}</div>
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {scenarios.filter(s => s.scenario_type === type.value).length}
              </div>
            </div>
          ))}
        </div>

        {/* Scenarios List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-16 text-slate-400">
              <Zap className="w-8 h-8 mx-auto mb-4 animate-pulse" />
              <p>جارٍ التحميل...</p>
            </div>
          ) : scenarios.length > 0 ? (
            scenarios.map((scenario, index) => (
              <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-slate-800 p-3 rounded-lg">
                      {scenarioTypes.find(t => t.value === scenario.scenario_type)?.icon || <FileText className="w-6 h-6 text-purple-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-200">{scenario.name}</h3>
                        <span className={`px-3 py-1 rounded-full border text-xs font-bold ${getStatusColor(scenario.status)}`}>
                          {getStatusLabel(scenario.status)}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">{scenario.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="text-xs text-slate-500">
                          النوع: {scenarioTypes.find(t => t.value === scenario.scenario_type)?.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          تاريخ الإنشاء: {new Date(scenario.created_at).toLocaleDateString('ar-LY')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {scenario.status === 'READY' && (
                    <button
                      onClick={() => handleRunSimulation(scenario.scenario_id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      تشغيل المحاكاة
                    </button>
                  )}
                </div>

                {scenario.result_summary && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <div className="text-xs text-slate-400">درجة التأثير</div>
                      </div>
                      <div className="text-2xl font-bold text-purple-400">
                        {scenario.result_summary.impact_score.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <div className="text-xs text-slate-400">التكلفة المقدرة</div>
                      </div>
                      <div className="text-lg font-bold text-amber-400">
                        {scenario.result_summary.cost_estimate.toLocaleString()} دينار
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <div className="text-xs text-slate-400">السكان المتأثرون</div>
                      </div>
                      <div className="text-lg font-bold text-blue-400">
                        {scenario.result_summary.affected_population.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <div className="text-xs text-slate-400">وقت التنفيذ</div>
                      </div>
                      <div className="text-lg font-bold text-cyan-400">
                        {scenario.result_summary.implementation_time_days} يوم
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-16 text-slate-400">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد سيناريوهات متاحة</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-purple-400 hover:text-purple-300 underline"
              >
                إنشاء أول سيناريو
              </button>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-slate-200 mb-6">إنشاء سيناريو جديد</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">اسم السيناريو</label>
                  <input
                    type="text"
                    value={newScenario.name}
                    onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500"
                    placeholder="مثال: توسعة الطريق الدائري الثالث"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">الوصف</label>
                  <textarea
                    value={newScenario.description}
                    onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500 h-24"
                    placeholder="وصف تفصيلي للسيناريو..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">نوع السيناريو</label>
                  <select
                    value={newScenario.scenario_type}
                    onChange={(e) => setNewScenario({ ...newScenario, scenario_type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    {scenarioTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleCreateScenario}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition-colors"
                >
                  إنشاء السيناريو
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
