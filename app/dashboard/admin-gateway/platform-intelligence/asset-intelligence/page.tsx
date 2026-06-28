'use client';

import React, { useState, useEffect } from 'react';
import { Layers, AlertTriangle, TrendingDown, Wrench, MapPin, Activity, Search, RefreshCw } from 'lucide-react';

interface HighRiskAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  risk_score: number;
  health_score: number;
  location?: {
    lat: number;
    lng: number;
  };
  issues: string[];
  recommended_actions: string[];
  estimated_cost?: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface DegradationZone {
  zone_id: string;
  zone_name: string;
  degradation_level: number;
  affected_assets: number;
  avg_health_score: number;
  geometry?: any;
  recommended_interventions: string[];
}

interface UrgentAction {
  action_id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  target_asset?: string;
  estimated_cost: number;
  deadline_days: number;
  department: string;
}

export default function AssetIntelligenceHub() {
  const [activeTab, setActiveTab] = useState<'high-risk' | 'degradation' | 'urgent-actions'>('high-risk');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for data
  const [highRiskAssets, setHighRiskAssets] = useState<HighRiskAsset[]>([]);
  const [degradationZones, setDegradationZones] = useState<DegradationZone[]>([]);
  const [urgentActions, setUrgentActions] = useState<UrgentAction[]>([]);

  // Fetch high-risk assets
  const fetchHighRiskAssets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/intelligence/high-risk-assets?threshold=0.7');
      if (response.ok) {
        const data = await response.json();
        setHighRiskAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch high-risk assets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch degradation zones
  const fetchDegradationZones = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/intelligence/degradation-zones');
      if (response.ok) {
        const data = await response.json();
        setDegradationZones(data.zones || []);
      }
    } catch (error) {
      console.error('Failed to fetch degradation zones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch urgent actions
  const fetchUrgentActions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/intelligence/urgent-actions');
      if (response.ok) {
        const data = await response.json();
        setUrgentActions(data.actions || []);
      }
    } catch (error) {
      console.error('Failed to fetch urgent actions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchHighRiskAssets();
    fetchDegradationZones();
    fetchUrgentActions();
  }, []);

  // Refresh current view
  const handleRefresh = () => {
    if (activeTab === 'high-risk') fetchHighRiskAssets();
    else if (activeTab === 'degradation') fetchDegradationZones();
    else if (activeTab === 'urgent-actions') fetchUrgentActions();
  };

  // Risk color helper
  const getRiskColor = (priority: string) => {
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

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-900/30 to-slate-900/50 p-6 rounded-2xl border border-indigo-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-500/50">
              <Layers className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">مركز ذكاء الأصول</h1>
              <p className="text-slate-300 mt-1">تحليل الأصول عالية المخاطر والصيانة التنبؤية المدعومة بالذكاء الاصطناعي</p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            disabled={loading}
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
                <div className="text-3xl font-bold text-red-400">{highRiskAssets.length}</div>
                <div className="text-slate-400 mt-1">أصول عالية المخاطر</div>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-400">{degradationZones.length}</div>
                <div className="text-slate-400 mt-1">مناطق التدهور</div>
              </div>
              <TrendingDown className="w-12 h-12 text-orange-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-amber-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-amber-400">{urgentActions.length}</div>
                <div className="text-slate-400 mt-1">إجراءات عاجلة</div>
              </div>
              <Wrench className="w-12 h-12 text-amber-400/50" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('high-risk')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'high-risk'
                ? 'bg-slate-800 text-indigo-400 border border-indigo-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            الأصول عالية المخاطر
          </button>
          <button
            onClick={() => setActiveTab('degradation')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'degradation'
                ? 'bg-slate-800 text-indigo-400 border border-indigo-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            مناطق التدهور
          </button>
          <button
            onClick={() => setActiveTab('urgent-actions')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'urgent-actions'
                ? 'bg-slate-800 text-indigo-400 border border-indigo-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            الإجراءات العاجلة
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pr-12 pl-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Activity className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* High-Risk Assets Tab */}
            {activeTab === 'high-risk' && (
              highRiskAssets.length > 0 ? (
                highRiskAssets
                  .filter(asset => 
                    searchQuery === '' || 
                    asset.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    asset.asset_type.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((asset, index) => (
                    <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-800 p-3 rounded-lg">
                            <Layers className="w-6 h-6 text-indigo-400" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-200">{asset.asset_name}</h3>
                            <p className="text-slate-400 text-sm mt-1">{asset.asset_type}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getRiskColor(asset.priority)}`}>
                          {asset.priority}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-800/50 p-4 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">درجة المخاطرة</div>
                          <div className="text-2xl font-bold text-red-400">{(asset.risk_score * 100).toFixed(0)}%</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">صحة الأصل</div>
                          <div className="text-2xl font-bold text-emerald-400">{(asset.health_score * 100).toFixed(0)}%</div>
                        </div>
                      </div>

                      {asset.issues && asset.issues.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-bold text-slate-300 mb-2">المشاكل المكتشفة:</div>
                          <ul className="space-y-1">
                            {asset.issues.map((issue, idx) => (
                              <li key={idx} className="text-slate-400 text-sm flex items-start gap-2">
                                <span className="text-red-400 mt-1">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {asset.recommended_actions && asset.recommended_actions.length > 0 && (
                        <div>
                          <div className="text-sm font-bold text-slate-300 mb-2">الإجراءات الموصى بها:</div>
                          <ul className="space-y-1">
                            {asset.recommended_actions.map((action, idx) => (
                              <li key={idx} className="text-slate-400 text-sm flex items-start gap-2">
                                <span className="text-indigo-400 mt-1">✓</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {asset.estimated_cost && (
                        <div className="mt-4 pt-4 border-t border-slate-800">
                          <div className="text-sm text-slate-400">التكلفة المقدرة:</div>
                          <div className="text-lg font-bold text-amber-400">{asset.estimated_cost.toLocaleString()} ريال</div>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد أصول عالية المخاطر في الوقت الحالي</p>
                </div>
              )
            )}

            {/* Degradation Zones Tab */}
            {activeTab === 'degradation' && (
              degradationZones.length > 0 ? (
                degradationZones.map((zone, index) => (
                  <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-orange-500/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-800 p-3 rounded-lg">
                          <MapPin className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-200">{zone.zone_name}</h3>
                          <p className="text-slate-400 text-sm mt-1">{zone.affected_assets} أصول متأثرة</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">مستوى التدهور</div>
                        <div className="text-2xl font-bold text-orange-400">{(zone.degradation_level * 100).toFixed(0)}%</div>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">متوسط الصحة</div>
                        <div className="text-2xl font-bold text-emerald-400">{(zone.avg_health_score * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    {zone.recommended_interventions && zone.recommended_interventions.length > 0 && (
                      <div>
                        <div className="text-sm font-bold text-slate-300 mb-2">التدخلات الموصى بها:</div>
                        <ul className="space-y-1">
                          {zone.recommended_interventions.map((intervention, idx) => (
                            <li key={idx} className="text-slate-400 text-sm flex items-start gap-2">
                              <span className="text-orange-400 mt-1">→</span>
                              <span>{intervention}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد مناطق تدهور مكتشفة</p>
                </div>
              )
            )}

            {/* Urgent Actions Tab */}
            {activeTab === 'urgent-actions' && (
              urgentActions.length > 0 ? (
                urgentActions
                  .filter(action => 
                    searchQuery === '' || 
                    action.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    action.department.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((action, index) => (
                    <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-amber-500/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="bg-slate-800 p-3 rounded-lg">
                            <Wrench className="w-6 h-6 text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-200">{action.title}</h3>
                            <p className="text-slate-400 text-sm mt-1">{action.description}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getRiskColor(action.severity)}`}>
                          {action.severity}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-400 mb-1">القسم المسؤول</div>
                          <div className="text-sm font-bold text-slate-200">{action.department}</div>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-400 mb-1">التكلفة المقدرة</div>
                          <div className="text-sm font-bold text-amber-400">{action.estimated_cost.toLocaleString()} ريال</div>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-400 mb-1">الموعد النهائي</div>
                          <div className="text-sm font-bold text-red-400">{action.deadline_days} يوم</div>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد إجراءات عاجلة مطلوبة</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
