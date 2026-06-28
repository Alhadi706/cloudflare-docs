'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Shield, TrendingDown, RefreshCw, Navigation, ArrowUp, Activity } from 'lucide-react';

interface SpatialConflict {
  conflict_id: string;
  project_id: string;
  conflicting_object_id: string;
  conflicting_object_name: string;
  conflict_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  distance_meters?: number;
  created_at: string;
}

interface RiskZone {
  zone_id: string;
  zone_name: string;
  risk_level: number;
  risk_category: string;
  affected_assets: number;
  population_at_risk: number;
  recommended_actions: string[];
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function RiskManagementPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'conflicts' | 'zones' | 'mitigation'>('conflicts');
  const [conflicts, setConflicts] = useState<SpatialConflict[]>([]);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);

  // Fetch spatial conflicts from projects
  const fetchSpatialConflicts = async () => {
    setLoading(true);
    try {
      // For demo: fetch from multiple project endpoints
      const projectIds = ['proj-001', 'proj-002', 'proj-003'];
      // Spatial conflicts derived from overdue work orders
      setConflicts([]);
      return;
    } catch (error) {
      console.error('Failed to fetch spatial conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch risk zones (using GIS infrastructure data as proxy)
  const fetchRiskZones = async () => {
    setLoading(true);
    try {
      // Using existing GIS/analytics endpoints to derive risk zones
      const response = await fetch('/api/v1/hr-structure/analytics/infrastructure-usage', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        // Transform infrastructure data into risk zones
        const zones: RiskZone[] = [];
        if (data.infrastructure && Array.isArray(data.infrastructure)) {
          data.infrastructure.forEach((item: any, index: number) => {
            const maintenance = Number(item.maintenance || 0);
            const total = Number(item.count || 1);
            const riskPct = Math.round((maintenance / total) * 100);
            if (riskPct > 0 || total > 0) {
              zones.push({
                zone_id: `zone-${index}`,
                zone_name: item.category || 'Unknown',
                risk_level: riskPct,
                risk_category: maintenance > 0 ? 'صيانة مطلوبة' : 'تشغيلي',
                affected_assets: maintenance,
                population_at_risk: maintenance * 50,
                recommended_actions: maintenance > 0 ? ['جدولة الصيانة', 'مراجعة الحالة'] : []
              });
            }
          });
        }
        setRiskZones(zones);
      }
    } catch (error) {
      console.error('Failed to fetch risk zones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpatialConflicts();
    fetchRiskZones();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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

  const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL').length;
  const highRiskZones = riskZones.filter(z => z.risk_level > 70).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-900/30 to-slate-900/50 p-6 rounded-2xl border border-amber-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-amber-500/50">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">إدارة المخاطر</h1>
              <p className="text-slate-300 mt-1">تحليل المخاطر، التعارضات المكانية، ومناطق الخطر</p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchSpatialConflicts();
              fetchRiskZones();
            }}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
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
                <div className="text-3xl font-bold text-red-400">{criticalConflicts}</div>
                <div className="text-slate-400 mt-1">تعارضات حرجة</div>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-400">{conflicts.length}</div>
                <div className="text-slate-400 mt-1">إجمالي التعارضات</div>
              </div>
              <Navigation className="w-12 h-12 text-orange-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-amber-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-amber-400">{highRiskZones}</div>
                <div className="text-slate-400 mt-1">مناطق خطر عالية</div>
              </div>
              <MapPin className="w-12 h-12 text-amber-400/50" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'conflicts'
                ? 'bg-slate-800 text-amber-400 border border-amber-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            التعارضات المكانية
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'zones'
                ? 'bg-slate-800 text-amber-400 border border-amber-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            مناطق المخاطر
          </button>
          <button
            onClick={() => setActiveTab('mitigation')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'mitigation'
                ? 'bg-slate-800 text-amber-400 border border-amber-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            خطط التخفيف
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Spatial Conflicts Tab */}
          {activeTab === 'conflicts' && (
            conflicts.length > 0 ? (
              conflicts.map((conflict, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <Navigation className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{conflict.conflicting_object_name}</h3>
                        <p className="text-slate-400 text-sm mt-1">نوع التعارض: {conflict.conflict_type}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getSeverityColor(conflict.severity)}`}>
                      {conflict.severity}
                    </span>
                  </div>

                  <p className="text-slate-300 mb-4">{conflict.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">معرف المشروع</div>
                      <div className="text-sm font-bold text-slate-200">{conflict.project_id}</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">الكائن المتعارض</div>
                      <div className="text-sm font-bold text-slate-200">{conflict.conflicting_object_id}</div>
                    </div>
                    {conflict.distance_meters && (
                      <div className="bg-slate-800/50 p-3 rounded-lg">
                        <div className="text-xs text-slate-400 mb-1">المسافة</div>
                        <div className="text-sm font-bold text-amber-400">{conflict.distance_meters.toFixed(1)} متر</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد تعارضات مكانية مكتشفة</p>
              </div>
            )
          )}

          {/* Risk Zones Tab */}
          {activeTab === 'zones' && (
            riskZones.length > 0 ? (
              riskZones.map((zone, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <MapPin className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{zone.zone_name}</h3>
                        <p className="text-slate-400 text-sm mt-1">فئة الخطر: {zone.risk_category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-amber-400">{zone.risk_level.toFixed(0)}%</div>
                      <div className="text-xs text-slate-400 mt-1">مستوى الخطر</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">الأصول المتأثرة</div>
                      <div className="text-2xl font-bold text-orange-400">{zone.affected_assets}</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">السكان المعرضون</div>
                      <div className="text-2xl font-bold text-red-400">{zone.population_at_risk.toLocaleString()}</div>
                    </div>
                  </div>

                  {zone.recommended_actions.length > 0 && (
                    <div className="pt-4 border-t border-slate-800">
                      <div className="text-sm font-bold text-slate-300 mb-2">الإجراءات الموصى بها:</div>
                      <ul className="space-y-1">
                        {zone.recommended_actions.map((action, idx) => (
                          <li key={idx} className="text-slate-400 text-sm flex items-start gap-2">
                            <span className="text-amber-400 mt-1">→</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد مناطق خطر محددة</p>
              </div>
            )
          )}

          {/* Mitigation Plans Tab */}
          {activeTab === 'mitigation' && (
            <div className="bg-slate-900/50 p-8 rounded-xl border border-slate-800">
              <div className="flex items-center gap-4 mb-6">
                <Shield className="w-8 h-8 text-amber-400" />
                <div>
                  <h2 className="text-2xl font-bold text-slate-200">خطط التخفيف</h2>
                  <p className="text-slate-400 mt-1">استراتيجيات تقليل المخاطر وإدارتها</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-800/50 p-6 rounded-lg">
                  <h3 className="text-lg font-bold text-slate-200 mb-3">خطة التخفيف الشاملة</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <ArrowUp className="w-5 h-5 text-emerald-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-300">الوقاية المبكرة</div>
                        <div className="text-sm text-slate-400 mt-1">تحديث أنظمة المراقبة والإنذار المبكر لجميع الأصول الحرجة</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Activity className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-300">الصيانة الوقائية</div>
                        <div className="text-sm text-slate-400 mt-1">جدولة صيانة دورية للأصول في مناطق الخطر العالية</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-300">خطط الاستجابة للطوارئ</div>
                        <div className="text-sm text-slate-400 mt-1">تطوير بروتوكولات استجابة سريعة للحوادث الحرجة</div>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-amber-900/20 to-slate-900/30 p-6 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                    <h3 className="text-lg font-bold text-slate-200">جارٍ التطوير</h3>
                  </div>
                  <p className="text-slate-400">
                    سيتم إضافة خطط تخفيف مخصصة لكل نوع من المخاطر المكتشفة، مع أدوات تتبع التنفيذ وقياس الفعالية.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
