'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Target, Users, Building, Leaf, ThumbsUp, AlertCircle } from 'lucide-react';

interface CityPerformance {
  overall_score: number;
  dimensions: {
    infrastructure_health: number;
    operational_efficiency: number;
    service_quality: number;
    environmental_compliance: number;
    citizen_satisfaction: number;
  };
  period: string;
  comparison_to_last_period: number;
}

interface InfrastructureUsage {
  category: string;
  utilization_rate: number;
  capacity: number;
  current_usage: number;
  peak_usage: number;
  efficiency_score: number;
  recommendations: string[];
}

interface ServiceGap {
  service_type: string;
  gap_severity: 'HIGH' | 'MEDIUM' | 'LOW';
  affected_population: number;
  current_coverage: number;
  required_coverage: number;
  estimated_cost: number;
  priority_zones: string[];
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [cityPerformance, setCityPerformance] = useState<CityPerformance | null>(null);
  const [infrastructureUsage, setInfrastructureUsage] = useState<InfrastructureUsage[]>([]);
  const [serviceGaps, setServiceGaps] = useState<ServiceGap[]>([]);
  const [activeTab, setActiveTab] = useState<'performance' | 'usage' | 'gaps'>('performance');

  // Fetch city performance
  const fetchCityPerformance = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/hr-structure/analytics/city-performance', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        setCityPerformance(data);
      }
    } catch (error) {
      console.error('Failed to fetch city performance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch infrastructure usage
  const fetchInfrastructureUsage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/hr-structure/analytics/infrastructure-usage', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        setInfrastructureUsage(data.infrastructure || []);
      }
    } catch (error) {
      console.error('Failed to fetch infrastructure usage:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch service gaps
  const fetchServiceGaps = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/hr-structure/analytics/service-gaps', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        setServiceGaps(data.gaps || []);
      }
    } catch (error) {
      console.error('Failed to fetch service gaps:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCityPerformance();
    fetchInfrastructureUsage();
    fetchServiceGaps();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getGapColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'text-red-400 border-red-500/50 bg-red-500/10';
      case 'MEDIUM':
        return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
      case 'LOW':
        return 'text-blue-400 border-blue-500/50 bg-blue-500/10';
      default:
        return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-900/30 to-slate-900/50 p-6 rounded-2xl border border-emerald-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-emerald-500/50">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">التحليلات والرؤى</h1>
              <p className="text-slate-300 mt-1">أداء المدينة والبنية التحتية والتحليل التشغيلي</p>
            </div>
          </div>
        </div>

        {/* Overall Score Card */}
        {cityPerformance && (
          <div className="bg-gradient-to-br from-emerald-900/20 via-slate-900/50 to-blue-900/20 p-8 rounded-2xl border border-emerald-500/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-200 mb-2">الأداء العام للمدينة</h2>
                <p className="text-slate-400">الفترة: {cityPerformance.period}</p>
              </div>
              <div className="text-center">
                <div className={`text-6xl font-bold ${getScoreColor(cityPerformance.overall_score)}`}>
                  {cityPerformance.overall_score.toFixed(1)}
                </div>
                <div className="text-slate-400 text-sm mt-2">من 100</div>
                {cityPerformance.comparison_to_last_period !== 0 && (
                  <div className={`mt-2 text-sm font-bold ${
                    cityPerformance.comparison_to_last_period > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {cityPerformance.comparison_to_last_period > 0 ? '+' : ''}
                    {cityPerformance.comparison_to_last_period.toFixed(1)}% من الفترة السابقة
                  </div>
                )}
              </div>
            </div>

            {/* Performance Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-5 h-5 text-blue-400" />
                  <div className="text-sm text-slate-400">صحة البنية التحتية</div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(cityPerformance.dimensions.infrastructure_health)}`}>
                  {cityPerformance.dimensions.infrastructure_health.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">الوزن: 25%</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-purple-400" />
                  <div className="text-sm text-slate-400">الكفاءة التشغيلية</div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(cityPerformance.dimensions.operational_efficiency)}`}>
                  {cityPerformance.dimensions.operational_efficiency.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">الوزن: 25%</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <div className="text-sm text-slate-400">جودة الخدمة</div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(cityPerformance.dimensions.service_quality)}`}>
                  {cityPerformance.dimensions.service_quality.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">الوزن: 20%</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Leaf className="w-5 h-5 text-emerald-400" />
                  <div className="text-sm text-slate-400">الامتثال البيئي</div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(cityPerformance.dimensions.environmental_compliance)}`}>
                  {cityPerformance.dimensions.environmental_compliance.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">الوزن: 15%</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="w-5 h-5 text-amber-400" />
                  <div className="text-sm text-slate-400">رضا المواطنين</div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(cityPerformance.dimensions.citizen_satisfaction)}`}>
                  {cityPerformance.dimensions.citizen_satisfaction.toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">الوزن: 15%</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'performance'
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            تفاصيل الأداء
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'usage'
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            استخدام البنية التحتية
          </button>
          <button
            onClick={() => setActiveTab('gaps')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'gaps'
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            فجوات الخدمة
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Infrastructure Usage Tab */}
          {activeTab === 'usage' && (
            infrastructureUsage.length > 0 ? (
              infrastructureUsage.map((item, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-200">{item.category}</h3>
                    <div className={`text-2xl font-bold ${getScoreColor(item.efficiency_score)}`}>
                      {item.efficiency_score.toFixed(0)}%
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">معدل الاستخدام</span>
                      <span className="text-sm font-bold text-slate-300">{item.utilization_rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          item.utilization_rate > 90 ? 'bg-red-500' :
                          item.utilization_rate > 75 ? 'bg-yellow-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${item.utilization_rate}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">السعة الإجمالية</div>
                      <div className="text-lg font-bold text-slate-200">{item.capacity.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">الاستخدام الحالي</div>
                      <div className="text-lg font-bold text-cyan-400">{item.current_usage.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">أعلى استخدام</div>
                      <div className="text-lg font-bold text-amber-400">{item.peak_usage.toLocaleString()}</div>
                    </div>
                  </div>

                  {item.recommendations && item.recommendations.length > 0 && (
                    <div className="pt-4 border-t border-slate-800">
                      <div className="text-sm font-bold text-slate-300 mb-2">التوصيات:</div>
                      <ul className="space-y-1">
                        {item.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-slate-400 text-sm flex items-start gap-2">
                            <span className="text-emerald-400 mt-1">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد بيانات استخدام متاحة</p>
              </div>
            )
          )}

          {/* Service Gaps Tab */}
          {activeTab === 'gaps' && (
            serviceGaps.length > 0 ? (
              serviceGaps
                .sort((a, b) => {
                  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                  return severityOrder[a.gap_severity] - severityOrder[b.gap_severity];
                })
                .map((gap, index) => (
                  <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-800 p-3 rounded-lg">
                          <AlertCircle className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-200">{gap.service_type}</h3>
                          <p className="text-slate-400 text-sm mt-1">
                            {gap.affected_population.toLocaleString()} مواطن متأثر
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getGapColor(gap.gap_severity)}`}>
                        {gap.gap_severity === 'HIGH' && 'عالية'}
                        {gap.gap_severity === 'MEDIUM' && 'متوسطة'}
                        {gap.gap_severity === 'LOW' && 'منخفضة'}
                      </span>
                    </div>

                    {/* Coverage Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">التغطية الحالية</span>
                        <span className="text-sm font-bold text-slate-300">{gap.current_coverage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500 transition-all"
                          style={{ width: `${gap.current_coverage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-500">التغطية المطلوبة: {gap.required_coverage.toFixed(1)}%</span>
                        <span className="text-xs text-red-400 font-bold">
                          فجوة: {(gap.required_coverage - gap.current_coverage).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">التكلفة المقدرة</div>
                        <div className="text-2xl font-bold text-amber-400">
                          {gap.estimated_cost.toLocaleString()} ريال
                        </div>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">المناطق ذات الأولوية</div>
                        <div className="text-sm text-slate-300 mt-1">
                          {gap.priority_zones.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد فجوات خدمة مكتشفة</p>
              </div>
            )
          )}

          {/* Performance Details Tab */}
          {activeTab === 'performance' && cityPerformance && (
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <h2 className="text-2xl font-bold text-slate-200 mb-4">تحليل الأداء التفصيلي</h2>
              <p className="text-slate-400 leading-relaxed">
                يتم حساب الأداء العام للمدينة من خلال 5 أبعاد رئيسية:
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg mt-1">
                    <Building className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-200">صحة البنية التحتية (25%)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      تقييم حالة الطرق، المباني، الشبكات، والمرافق العامة
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-purple-500/20 p-2 rounded-lg mt-1">
                    <Target className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-200">الكفاءة التشغيلية (25%)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      معدلات إنجاز المشاريع، أوقات الاستجابة، وتكلفة التشغيل
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-cyan-500/20 p-2 rounded-lg mt-1">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-200">جودة الخدمة (20%)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      مستوى الخدمات المقدمة، التغطية، وتوفر المرافق
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-lg mt-1">
                    <Leaf className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-200">الامتثال البيئي (15%)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      الالتزام بالمعايير البيئية والاستدامة
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-amber-500/20 p-2 rounded-lg mt-1">
                    <ThumbsUp className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-200">رضا المواطنين (15%)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      تقييم المواطنين للخدمات وتجربتهم العامة
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
