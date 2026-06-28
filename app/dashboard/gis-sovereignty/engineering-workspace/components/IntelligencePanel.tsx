'use client';

import React, { useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, Brain, Zap,
  ChevronDown, ChevronUp, X, RefreshCw,
  Shield, TrendingDown, Search, Play,
  CheckCircle, AlertCircle, Info
} from 'lucide-react';
import { workspaceApi } from '@/store/apiService';
import { useProjectStore } from '@/store/projectStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

type Tab = 'twin' | 'alerts' | 'query' | 'simulate';

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  MODERATE: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  LOW: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  UNKNOWN: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

const EVENTS = [
  { value: 'pipe_failure', label: 'انكسار خط أنابيب' },
  { value: 'sensor_outage', label: 'عطل حساس' },
  { value: 'flood', label: 'فيضان' },
  { value: 'power_loss', label: 'انقطاع الكهرباء' },
];

const SEVERITIES = [
  { value: 'low', label: 'منخفض', color: 'text-blue-400' },
  { value: 'medium', label: 'متوسط', color: 'text-yellow-400' },
  { value: 'high', label: 'عالي', color: 'text-orange-400' },
  { value: 'critical', label: 'حرج', color: 'text-red-400' },
];

const QUERY_HINTS = [
  'أصول خطرة',
  'خطوط أنابيب',
  'حساسات معطلة',
  'خزانات',
  'risky assets',
  'pipeline',
];

export default function IntelligencePanel({ onClose }: { onClose: () => void }) {
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setSpatialResults = useWorkspaceStore(s => s.setSpatialResults);
  const setBufferResult = useWorkspaceStore(s => s.setBufferResult);
  const clearSpatialAnalysis = useWorkspaceStore(s => s.clearSpatialAnalysis);

  const [activeTab, setActiveTab] = useState<Tab>('twin');
  const [loading, setLoading] = useState(false);

  // Digital Twin state
  const [twinData, setTwinData] = useState<any>(null);

  // Alerts state
  const [alertsData, setAlertsData] = useState<any>(null);

  // GIS Query state
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);

  // Simulation state
  const [simEvent, setSimEvent] = useState('pipe_failure');
  const [simSeverity, setSimSeverity] = useState('medium');
  const [simResult, setSimResult] = useState<any>(null);

  const requireProject = () => {
    if (!activeProjectId) {
      alert('يرجى اختيار مشروع أولاً');
      return false;
    }
    return true;
  };

  const loadTwin = useCallback(async () => {
    if (!requireProject()) return;
    setLoading(true);
    try {
      const data = await workspaceApi.getDigitalTwin(activeProjectId!);
      setTwinData(data);
      // Highlight high-risk assets on map
      if (data.high_risk?.length) {
        setSpatialResults(data.high_risk.filter((a: any) => a.geometry).map((a: any) => ({
          type: 'Feature',
          geometry: a.geometry,
          properties: { ...a, analysis_type: 'digital_twin' }
        })));
      }
    } catch (e: any) {
      alert('خطأ في تحميل التوأم الرقمي: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, setSpatialResults]);

  const loadAlerts = useCallback(async () => {
    if (!requireProject()) return;
    setLoading(true);
    try {
      const data = await workspaceApi.getIntelligenceAlerts(activeProjectId!);
      setAlertsData(data);
      // Show alert geometries on map
      const alertFeatures = data.alerts
        .filter((a: any) => a.geometry)
        .map((a: any) => ({ type: 'Feature', geometry: a.geometry, properties: { ...a, analysis_type: 'alert' } }));
      if (alertFeatures.length) setSpatialResults(alertFeatures);
    } catch (e: any) {
      alert('خطأ في تحميل التنبيهات: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, setSpatialResults]);

  const runQuery = useCallback(async () => {
    if (!queryText.trim()) return;
    setLoading(true);
    try {
      const data = await workspaceApi.gisQuery(queryText, activeProjectId ?? undefined);
      setQueryResult(data);
      if (data.features?.length) setSpatialResults(data.features);
      else clearSpatialAnalysis();
    } catch (e: any) {
      alert('خطأ في الاستعلام: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [queryText, activeProjectId, setSpatialResults, clearSpatialAnalysis]);

  const runSimulation = useCallback(async () => {
    if (!requireProject()) return;
    setLoading(true);
    try {
      const data = await workspaceApi.simulate(activeProjectId!, simEvent, simSeverity);
      setSimResult(data);
      if (data.features?.length) setSpatialResults(data.features);
    } catch (e: any) {
      alert('خطأ في المحاكاة: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, simEvent, simSeverity, setSpatialResults]);

  const healthColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'twin', label: 'التوأم الرقمي', icon: Activity, color: 'text-cyan-400' },
    { id: 'alerts', label: 'الإنذار المبكر', icon: AlertTriangle, color: 'text-orange-400' },
    { id: 'query', label: 'ذكاء GIS', icon: Brain, color: 'text-violet-400' },
    { id: 'simulate', label: 'المحاكاة', icon: Zap, color: 'text-amber-400' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 shadow-2xl" dir="rtl"
      style={{ height: '360px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="text-white font-semibold text-sm">مركز الذكاء التشغيلي</span>
          {!activeProjectId && (
            <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
              اختر مشروعاً للتفعيل
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />}
          <button onClick={() => { clearSpatialAnalysis(); onClose(); }}
            className="text-gray-400 hover:text-white p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all border-b-2 ${
                activeTab === t.id
                  ? `border-indigo-500 ${t.color} bg-indigo-500/10`
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="overflow-y-auto" style={{ height: '275px' }}>

        {/* ═══ DIGITAL TWIN ═══ */}
        {activeTab === 'twin' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-300">حالة الأصول في الوقت الحقيقي</span>
              <button onClick={loadTwin} disabled={loading}
                className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                تحديث
              </button>
            </div>

            {!twinData ? (
              <div className="flex flex-col items-center justify-center h-36 text-gray-500">
                <Activity className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">اضغط "تحديث" لتحميل بيانات التوأم الرقمي</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary Cards */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'الكلي', value: twinData.summary.total, color: 'text-white' },
                    { label: 'سليم', value: twinData.summary.healthy, color: 'text-emerald-400' },
                    { label: 'متوسط', value: twinData.summary.moderate, color: 'text-yellow-400' },
                    { label: 'حرج', value: twinData.summary.critical, color: 'text-red-400' },
                    { label: 'متوسط الصحة', value: twinData.summary.avg_health ? `${twinData.summary.avg_health}%` : 'N/A', color: healthColor(twinData.summary.avg_health) },
                  ].map(c => (
                    <div key={c.label} className="bg-gray-800 rounded-lg p-2 text-center">
                      <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                      <div className="text-xs text-gray-500">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* By-type breakdown */}
                {twinData.by_type.length > 0 && (
                  <div className="space-y-1">
                    {twinData.by_type.slice(0, 5).map((t: any) => (
                      <div key={t.asset_type} className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded">
                        <span className="text-xs text-gray-300 flex-1">{t.asset_type}</span>
                        <span className="text-xs text-gray-500">{t.total} أصل</span>
                        {t.avg_health !== null && (
                          <span className={`text-xs font-mono ${healthColor(t.avg_health)}`}>
                            {t.avg_health}%
                          </span>
                        )}
                        {t.at_risk > 0 && (
                          <span className="text-xs text-red-400 bg-red-500/10 px-1.5 rounded">
                            {t.at_risk} خطر
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {twinData.high_risk.length > 0 && (
                  <p className="text-xs text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {twinData.high_risk.length} أصل عالي الخطورة — تم تمييزها على الخريطة
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ EARLY WARNING ═══ */}
        {activeTab === 'alerts' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-300">التنبيهات النشطة</span>
              <button onClick={loadAlerts} disabled={loading}
                className="flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                فحص
              </button>
            </div>

            {!alertsData ? (
              <div className="flex flex-col items-center justify-center h-36 text-gray-500">
                <AlertTriangle className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">اضغط "فحص" لتحميل التنبيهات المبكرة</p>
              </div>
            ) : alertsData.total === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-emerald-500">
                <CheckCircle className="w-10 h-10 mb-2" />
                <p className="text-sm">لا توجد تنبيهات نشطة — الوضع سليم</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 mb-2">
                  {[
                    { label: 'حرج', value: alertsData.critical, key: 'CRITICAL' },
                    { label: 'عالي', value: alertsData.high, key: 'HIGH' },
                    { label: 'متوسط', value: alertsData.moderate, key: 'MODERATE' },
                  ].map(s => (
                    <div key={s.key} className={`flex-1 text-center p-2 rounded border ${SEVERITY_COLOR[s.key]}`}>
                      <div className="text-base font-bold">{s.value}</div>
                      <div className="text-xs">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {alertsData.alerts.slice(0, 15).map((a: any) => (
                    <div key={a.alert_id}
                      className={`flex items-start gap-2 px-3 py-2 rounded border ${SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.UNKNOWN}`}>
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{a.asset_name || a.asset_id}</div>
                        <div className="text-xs opacity-75 truncate">{a.description}</div>
                      </div>
                      <span className="text-xs shrink-0">{a.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ GIS AI QUERY ═══ */}
        {activeTab === 'query' && (
          <div className="p-4">
            <p className="text-xs text-gray-400 mb-3">استعلم عن الأصول بلغة طبيعية (عربي أو إنجليزي)</p>

            <div className="flex gap-2 mb-3">
              <input
                value={queryText}
                onChange={e => setQueryText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runQuery()}
                placeholder="مثال: أصول خطرة | خطوط أنابيب | حساسات معطلة"
                className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:border-violet-500"
              />
              <button onClick={runQuery} disabled={loading || !queryText.trim()}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded disabled:opacity-50">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Hints */}
            <div className="flex flex-wrap gap-1 mb-3">
              {QUERY_HINTS.map(h => (
                <button key={h} onClick={() => setQueryText(h)}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors">
                  {h}
                </button>
              ))}
            </div>

            {queryResult && (
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-400 font-medium">{queryResult.result_label}</span>
                  <span className="text-xs text-gray-400">{queryResult.count} نتيجة — تم تمييزها على الخريطة</span>
                </div>
                {queryResult.count === 0 && (
                  <p className="text-xs text-gray-500">لم يتم العثور على نتائج مطابقة</p>
                )}
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {queryResult.features?.slice(0, 10).map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                      <span className="text-gray-500">{f.properties.asset_type}</span>
                      <span className="flex-1 truncate">{f.properties.asset_name || f.properties.asset_id}</span>
                      {f.properties.health_score !== null && (
                        <span className={healthColor(f.properties.health_score)}>{f.properties.health_score}%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SIMULATION ═══ */}
        {activeTab === 'simulate' && (
          <div className="p-4">
            <p className="text-xs text-gray-400 mb-3">محاكاة سيناريو "ماذا يحدث لو؟" على الأصول</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">نوع الحدث</label>
                <select value={simEvent} onChange={e => setSimEvent(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-amber-500">
                  {EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">الشدة</label>
                <select value={simSeverity} onChange={e => setSimSeverity(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-amber-500">
                  {SEVERITIES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={runSimulation} disabled={loading || !activeProjectId}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded disabled:opacity-50 mb-3">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              تشغيل المحاكاة
            </button>

            {simResult && (
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-400">{simResult.event_label}</span>
                  <span className="text-xs text-gray-400">شدة: {simResult.severity}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'أصول متأثرة', value: simResult.total_affected, color: 'text-orange-400' },
                    { label: 'حرجة', value: simResult.critical_assets, color: 'text-red-400' },
                    { label: 'انخفاض صحة', value: `-${simResult.estimated_health_drop}%`, color: 'text-yellow-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-gray-900 rounded p-2 text-center">
                      <div className={`text-base font-bold ${c.color}`}>{c.value}</div>
                      <div className="text-xs text-gray-500">{c.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  نطاق التأثير: {simResult.epicenter.radius_m}م — الأصول المتأثرة مميزة على الخريطة
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
