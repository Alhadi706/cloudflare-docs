'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Search, AlertTriangle, TrendingDown, TrendingUp, ChevronLeft, Calendar } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface AssetHealth {
  id: number;
  asset_id?: number;
  asset_name: string;
  asset_name_ar?: string;
  asset_code?: string;
  asset_type?: string;
  health_score?: number;
  condition?: string;
  status?: string;
  last_inspection?: string;
  next_inspection?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  maintenance_history_count?: number;
  issues_count?: number;
  risk_level?: string;
  uptime_percentage?: number;
  failure_rate?: number;
  current_value?: number;
  acquisition_cost?: number;
}

interface AssetEvent {
  id: number;
  asset_id: number;
  event_type: string;
  event_date: string;
  description: string;
  severity?: string;
}

export default function AssetHealthPage() {
  const [assets, setAssets] = useState<AssetHealth[]>([]);
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    fetchAssetHealth();
    fetchAssetEvents();
  }, []);
  const statusToHealth = (status: string) => {
    switch (status) {
      case 'operational': return 90;
      case 'maintenance': return 50;
      case 'decommissioned': return 10;
      default: return 70;
    }
  };

  const statusToRisk = (status: string) => {
    switch (status) {
      case 'operational': return 'low';
      case 'maintenance': return 'medium';
      case 'decommissioned': return 'critical';
      default: return 'low';
    }
  };

  const fetchAssetHealth = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/asset-health', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = (data.assets || []).map((a: any) => ({
          ...a,
          health_score: statusToHealth(a.status),
          condition: a.status === 'operational' ? 'good' : a.status === 'maintenance' ? 'fair' : 'poor',
          risk_level: statusToRisk(a.status),
          last_inspection: a.last_maintenance_date,
          next_inspection: a.next_maintenance_date,
        }));
        setAssets(mapped);
      }
    } catch (error) {
      console.error('Error fetching asset health:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetEvents = async () => {
    // Events endpoint not available yet
    setEvents([]);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10';
    if (score >= 60) return 'text-blue-400 bg-blue-500/10';
    if (score >= 40) return 'text-amber-400 bg-amber-500/10';
    if (score >= 20) return 'text-orange-400 bg-orange-500/10';
    return 'text-rose-400 bg-rose-500/10';
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'low': return 'text-emerald-400 bg-emerald-500/10';
      case 'medium': return 'text-amber-400 bg-amber-500/10';
      case 'high': return 'text-orange-400 bg-orange-500/10';
      case 'critical': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition?.toLowerCase()) {
      case 'excellent': return 'text-emerald-400 bg-emerald-500/10';
      case 'good': return 'text-blue-400 bg-blue-500/10';
      case 'fair': return 'text-amber-400 bg-amber-500/10';
      case 'poor': return 'text-orange-400 bg-orange-500/10';
      case 'critical': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.asset_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = 
      riskFilter === 'all' || asset.risk_level?.toLowerCase() === riskFilter.toLowerCase();

    return matchesSearch && matchesRisk;
  });

  const avgHealthScore = assets.length > 0 
    ? Math.round(assets.reduce((sum, a) => sum + (a.health_score || 0), 0) / assets.length)
    : 0;

  const criticalAssets = assets.filter(a => a.risk_level === 'critical' || a.health_score < 40).length;
  const healthyAssets = assets.filter(a => a.health_score >= 80).length;
  const needsAttention = assets.filter(a => a.issues_count && a.issues_count > 0).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/assets">الأصول</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">صحة الأصول</span>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
              <Activity className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">صحة الأصول</h1>
              <p className="text-slate-400 mt-1">مراقبة الحالة التشغيلية والتحليل الزمني</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">متوسط الصحة</span>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-100">{avgHealthScore}</span>
              <span className="text-sm text-slate-400">/ 100</span>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">أصول سليمة</span>
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{healthyAssets}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">يحتاج انتباه</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{needsAttention}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">حالة حرجة</span>
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{criticalAssets}</div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">جميع المستويات</option>
            <option value="low">منخفض</option>
            <option value="medium">متوسط</option>
            <option value="high">عالي</option>
            <option value="critical">حرج</option>
          </select>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm || riskFilter !== 'all' ? 'لا توجد نتائج' : 'لا توجد بيانات صحة للأصول'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الأصل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">درجة الصحة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">مستوى الخطر</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نسبة التشغيل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">آخر فحص</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الفحص القادم</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المشاكل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                        {asset.asset_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-2 w-20">
                            <div 
                              className={`h-2 rounded-full ${
                                asset.health_score >= 80 ? 'bg-emerald-500' :
                                asset.health_score >= 60 ? 'bg-blue-500' :
                                asset.health_score >= 40 ? 'bg-amber-500' :
                                asset.health_score >= 20 ? 'bg-orange-500' :
                                'bg-rose-500'
                              }`}
                              style={{ width: `${asset.health_score}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${
                            asset.health_score >= 80 ? 'text-emerald-400' :
                            asset.health_score >= 60 ? 'text-blue-400' :
                            asset.health_score >= 40 ? 'text-amber-400' :
                            asset.health_score >= 20 ? 'text-orange-400' :
                            'text-rose-400'
                          }`}>
                            {asset.health_score}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConditionColor(asset.condition)}`}>
                          {asset.condition}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(asset.risk_level || '')}`}>
                          {asset.risk_level || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {asset.uptime_percentage ? (
                          <div className="flex items-center gap-1">
                            {asset.uptime_percentage >= 95 ? (
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-amber-400" />
                            )}
                            <span>{asset.uptime_percentage}%</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {asset.last_inspection 
                          ? new Date(asset.last_inspection).toLocaleDateString('ar-LY')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {asset.next_inspection ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(asset.next_inspection).toLocaleDateString('ar-LY')}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {asset.issues_count && asset.issues_count > 0 ? (
                          <span className="px-2 py-1 bg-rose-500/10 text-rose-400 rounded text-xs font-medium">
                            {asset.issues_count}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-600/30 transition-colors">
                          تفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Events Section */}
        {events.length > 0 && (
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              الأحداث الأخيرة
            </h3>
            <div className="space-y-3">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        event.event_type === 'failure' ? 'bg-rose-500/10 text-rose-400' :
                        event.event_type === 'maintenance' ? 'bg-blue-500/10 text-blue-400' :
                        event.event_type === 'inspection' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {event.event_type}
                      </span>
                      <span className="text-sm text-slate-400">
                        {new Date(event.event_date).toLocaleDateString('ar-LY')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
