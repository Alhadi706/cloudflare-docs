'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, TrendingUp, Zap, Calendar, DollarSign, AlertOctagon, RefreshCw, TrendingDown } from 'lucide-react';

interface InfrastructureForecast {
  project_id: string;
  project_name: string;
  asset_type: string;
  current_condition: number;
  predicted_failure_year: number;
  years_remaining: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  estimated_repair_cost: number;
  priority_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface BudgetForecast {
  category: string;
  current_spending: number;
  predicted_spending: number;
  variance_percentage: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

interface DigitalTwinPrediction {
  twin_id: string;
  twin_name: string;
  prediction_type: string;
  predicted_event: string;
  probability: number;
  estimated_date: string;
  recommended_action: string;
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function PredictiveAnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'forecasts' | 'budget' | 'twin'>('forecasts');
  const [forecasts, setForecasts] = useState<InfrastructureForecast[]>([]);
  const [budgetForecasts, setBudgetForecasts] = useState<BudgetForecast[]>([]);
  const [twinPredictions, setTwinPredictions] = useState<DigitalTwinPrediction[]>([]);

  // Fetch infrastructure forecasts
  const fetchForecasts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/hr-structure/forecasts/critical', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        if (data.forecasts && Array.isArray(data.forecasts)) {
          setForecasts(data.forecasts);
        }
      }
    } catch (error) {
      console.error('Failed to fetch forecasts:', error);
      // Generate demo data if API fails
      generateDemoForecasts();
    } finally {
      setLoading(false);
    }
  };

  // Generate demo forecasts
  const generateDemoForecasts = () => {
    const currentYear = new Date().getFullYear();
    const demoForecasts: InfrastructureForecast[] = [
      {
        project_id: 'proj-101',
        project_name: 'الطريق الدائري الشمالي',
        asset_type: 'road',
        current_condition: 65,
        predicted_failure_year: currentYear + 2,
        years_remaining: 2,
        confidence_level: 'HIGH',
        estimated_repair_cost: 5800000,
        priority_level: 'CRITICAL'
      },
      {
        project_id: 'proj-205',
        project_name: 'جسر وادي حنيفة',
        asset_type: 'bridge',
        current_condition: 72,
        predicted_failure_year: currentYear + 4,
        years_remaining: 4,
        confidence_level: 'MEDIUM',
        estimated_repair_cost: 3200000,
        priority_level: 'HIGH'
      },
      {
        project_id: 'proj-312',
        project_name: 'شبكة الصرف الصحي - المنطقة الغربية',
        asset_type: 'pipeline',
        current_condition: 58,
        predicted_failure_year: currentYear + 1,
        years_remaining: 1,
        confidence_level: 'HIGH',
        estimated_repair_cost: 8500000,
        priority_level: 'CRITICAL'
      }
    ];
    setForecasts(demoForecasts);
  };

  // Generate budget forecasts (demo)
  const generateBudgetForecasts = () => {
    const demoBudget: BudgetForecast[] = [
      {
        category: 'صيانة البنية التحتية',
        current_spending: 12500000,
        predicted_spending: 15800000,
        variance_percentage: 26.4,
        trend: 'UP'
      },
      {
        category: 'المشاريع الجديدة',
        current_spending: 45000000,
        predicted_spending: 42000000,
        variance_percentage: -6.7,
        trend: 'DOWN'
      },
      {
        category: 'التشغيل والإدارة',
        current_spending: 8200000,
        predicted_spending: 8500000,
        variance_percentage: 3.7,
        trend: 'STABLE'
      }
    ];
    setBudgetForecasts(demoBudget);
  };

  // Generate digital twin predictions (demo)
  const generateTwinPredictions = () => {
    const demoPredictions: DigitalTwinPrediction[] = [
      {
        twin_id: 'twin-001',
        twin_name: 'توأم رقمي - شبكة المياه',
        prediction_type: 'Failure Prediction',
        predicted_event: 'تسرب محتمل في المحطة الرئيسية',
        probability: 0.78,
        estimated_date: '2026-06-15',
        recommended_action: 'فحص فوري للصمامات والوصلات في المحطة'
      },
      {
        twin_id: 'twin-002',
        twin_name: 'توأم رقمي - شبكة الكهرباء',
        prediction_type: 'Load Prediction',
        predicted_event: 'زيادة حمل بنسبة 40% في الصيف',
        probability: 0.92,
        estimated_date: '2026-07-01',
        recommended_action: 'تعزيز القدرة الاستيعابية قبل موسم الصيف'
      }
    ];
    setTwinPredictions(demoPredictions);
  };

  useEffect(() => {
    fetchForecasts();
    generateBudgetForecasts();
    generateTwinPredictions();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-red-400 border-red-500/50 bg-red-500/10';
      case 'HIGH':
        return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
      case 'MEDIUM':
        return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
      case 'LOW':
        return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
      default:
        return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'UP') return <TrendingUp className="w-5 h-5 text-red-400" />;
    if (trend === 'DOWN') return <TrendingDown className="w-5 h-5 text-emerald-400" />;
    return <div className="w-5 h-5 flex items-center justify-center text-slate-400">→</div>;
  };

  const criticalForecasts = forecasts.filter(f => f.priority_level === 'CRITICAL').length;
  const avgYearsRemaining = forecasts.length > 0 
    ? (forecasts.reduce((sum, f) => sum + f.years_remaining, 0) / forecasts.length).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-teal-900/30 to-slate-900/50 p-6 rounded-2xl border border-teal-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-teal-500/50">
              <LineChart className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">التحليلات التنبؤية</h1>
              <p className="text-slate-300 mt-1">توقع الفشل، التنبؤ بالميزانية، وتحليل التوأم الرقمي</p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchForecasts();
              generateBudgetForecasts();
              generateTwinPredictions();
            }}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-red-400">{criticalForecasts}</div>
                <div className="text-slate-400 mt-1">توقعات حرجة</div>
              </div>
              <AlertOctagon className="w-12 h-12 text-red-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-400">{avgYearsRemaining}</div>
                <div className="text-slate-400 mt-1">متوسط السنوات المتبقية</div>
              </div>
              <Calendar className="w-12 h-12 text-orange-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-teal-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-teal-400">{forecasts.length}</div>
                <div className="text-slate-400 mt-1">إجمالي التوقعات</div>
              </div>
              <LineChart className="w-12 h-12 text-teal-400/50" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('forecasts')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'forecasts'
                ? 'bg-slate-800 text-teal-400 border border-teal-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            توقع الفشل
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'budget'
                ? 'bg-slate-800 text-teal-400 border border-teal-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            التنبؤ بالميزانية
          </button>
          <button
            onClick={() => setActiveTab('twin')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'twin'
                ? 'bg-slate-800 text-teal-400 border border-teal-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            التوأم الرقمي
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Infrastructure Forecasts Tab */}
          {activeTab === 'forecasts' && (
            forecasts.length > 0 ? (
              forecasts.map((forecast, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-teal-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <AlertOctagon className="w-6 h-6 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{forecast.project_name}</h3>
                        <p className="text-slate-400 text-sm mt-1">نوع الأصل: {forecast.asset_type}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getPriorityColor(forecast.priority_level)}`}>
                      {forecast.priority_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">الحالة الحالية</div>
                      <div className="text-2xl font-bold text-emerald-400">{forecast.current_condition}%</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">سنة الفشل المتوقعة</div>
                      <div className="text-2xl font-bold text-red-400">{forecast.predicted_failure_year}</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">السنوات المتبقية</div>
                      <div className="text-2xl font-bold text-orange-400">{forecast.years_remaining}</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">تكلفة الإصلاح</div>
                      <div className="text-lg font-bold text-amber-400">{forecast.estimated_repair_cost.toLocaleString()} دينار</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                      مستوى الثقة: <span className="font-bold text-slate-300">{forecast.confidence_level}</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      معرف المشروع: {forecast.project_id}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <LineChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد توقعات متاحة</p>
              </div>
            )
          )}

          {/* Budget Forecasts Tab */}
          {activeTab === 'budget' && (
            budgetForecasts.length > 0 ? (
              budgetForecasts.map((budget, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <DollarSign className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{budget.category}</h3>
                      </div>
                    </div>
                    {getTrendIcon(budget.trend)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">الإنفاق الحالي</div>
                      <div className="text-2xl font-bold text-blue-400">{budget.current_spending.toLocaleString()} دينار</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">الإنفاق المتوقع</div>
                      <div className="text-2xl font-bold text-emerald-400">{budget.predicted_spending.toLocaleString()} دينار</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">نسبة التغير</div>
                      <div className={`text-2xl font-bold ${budget.variance_percentage > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {budget.variance_percentage > 0 ? '+' : ''}{budget.variance_percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد توقعات ميزانية</p>
              </div>
            )
          )}

          {/* Digital Twin Predictions Tab */}
          {activeTab === 'twin' && (
            twinPredictions.length > 0 ? (
              twinPredictions.map((prediction, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <Zap className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{prediction.twin_name}</h3>
                        <p className="text-slate-400 text-sm mt-1">{prediction.prediction_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-400">{(prediction.probability * 100).toFixed(0)}%</div>
                      <div className="text-xs text-slate-400 mt-1">احتمالية</div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                    <div className="text-sm text-slate-400 mb-2">الحدث المتوقع:</div>
                    <div className="text-lg font-bold text-slate-200">{prediction.predicted_event}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">التاريخ المقدر</div>
                      <div className="text-sm font-bold text-amber-400">
                        {new Date(prediction.estimated_date).toLocaleDateString('ar-LY')}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">معرف التوأم</div>
                      <div className="text-sm font-bold text-slate-300">{prediction.twin_id}</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <div className="text-sm font-bold text-slate-300 mb-2">الإجراء الموصى به:</div>
                    <div className="text-sm text-teal-400">{prediction.recommended_action}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد توقعات من التوأم الرقمي</p>
              </div>
            )
          )}
        </div>

        {/* API Info */}
        <div className="bg-gradient-to-r from-teal-900/20 to-slate-900/30 p-6 rounded-xl border border-teal-500/30">
          <div className="flex items-center gap-3 mb-4">
            <LineChart className="w-6 h-6 text-teal-400" />
            <h3 className="text-lg font-bold text-slate-200">الاتصال بـ APIs التنبؤية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">توقعات البنية التحتية</div>
              <div className="text-sm font-mono text-teal-400">/api/v1/forecasts/critical</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">توقعات المشاريع</div>
              <div className="text-sm font-mono text-teal-400">/api/v1/projects/{'{id}'}/forecast</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">ملخص التوقعات</div>
              <div className="text-sm font-mono text-teal-400">/api/v1/forecasts/summary</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
