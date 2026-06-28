// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Asset Intelligence Dashboard - Health, Risk & Monitoring
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, TrendingDown, CheckCircle, MapPin, Clock, Shield } from 'lucide-react';

interface AssetHealthData {
  overall_health: {
    total_assets: number;
    avg_health: number;
    excellent: number;
    good: number;
    fair: number;
    critical: number;
  };
  health_by_type: Array<{
    asset_type: string;
    count: number;
    avg_health: number;
  }>;
  critical_assets: Array<{
    asset_id: string;
    asset_name: string;
    asset_type: string;
    health_score: number;
    status: string;
    location?: string;
  }>;
  maintenance_backlog: {
    backlog_count: number;
    estimated_hours: number;
  };
}

export default function AssetIntelligenceDashboard() {
  const [data, setData] = useState<AssetHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/v1/intelligence/health-dashboard');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch asset health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'ممتاز';
    if (score >= 60) return 'جيد';
    if (score >= 40) return 'متوسط';
    return 'حرج';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">جاري تحميل بيانات صحة الأصول...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const overall = data.overall_health;

  return (
    <div className="space-y-6">
      
      {/* Overall Health Summary */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Activity className="w-7 h-7 text-cyan-400" />
          نظرة عامة على صحة الأصول
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <div className="text-3xl font-bold text-white mb-1">{overall.total_assets}</div>
            <div className="text-sm text-slate-400">إجمالي الأصول</div>
          </div>
          
          <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-500/30">
            <div className="text-3xl font-bold text-emerald-400 mb-1">{overall.excellent}</div>
            <div className="text-sm text-emerald-400/70">ممتاز (80%+)</div>
          </div>
          
          <div className="bg-amber-900/20 p-4 rounded-lg border border-amber-500/30">
            <div className="text-3xl font-bold text-amber-400 mb-1">{overall.fair}</div>
            <div className="text-sm text-amber-400/70">متوسط (40-59%)</div>
          </div>
          
          <div className="bg-rose-900/20 p-4 rounded-lg border border-rose-500/30">
            <div className="text-3xl font-bold text-rose-400 mb-1">{overall.critical}</div>
            <div className="text-sm text-rose-400/70">حرج (&lt;40%)</div>
          </div>
        </div>

        {/* Health Score Visualization */}
        <div className="bg-slate-800/30 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300 font-medium">متوسط صحة الأصول</span>
            <span className={`text-2xl font-bold ${getHealthColor(overall.avg_health)}`}>
              {overall.avg_health.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                overall.avg_health >= 80 ? 'bg-emerald-500' :
                overall.avg_health >= 60 ? 'bg-blue-500' :
                overall.avg_health >= 40 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${overall.avg_health}%` }}
            />
          </div>
        </div>
      </div>

      {/* Health by Asset Type */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          صحة الأصول حسب النوع
        </h3>
        <div className="space-y-3">
          {data.health_by_type.map((type, index) => (
            <div key={index} className="bg-slate-800/30 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-slate-200 font-medium">{type.asset_type}</span>
                  <span className="text-xs text-slate-500">({type.count} أصل)</span>
                </div>
                <span className={`text-lg font-bold ${getHealthColor(type.avg_health)}`}>
                  {type.avg_health.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    type.avg_health >= 80 ? 'bg-emerald-500' :
                    type.avg_health >= 60 ? 'bg-blue-500' :
                    type.avg_health >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${type.avg_health}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Assets Requiring Attention */}
      <div className="bg-rose-900/10 border border-rose-500/30 p-6 rounded-xl">
        <h3 className="text-xl font-semibold text-rose-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          أصول حرجة تتطلب اهتماماً فورياً ({data.critical_assets.length})
        </h3>
        
        {data.critical_assets.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
            <p className="text-emerald-400 font-medium">جميع الأصول في حالة جيدة</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {data.critical_assets.map((asset, index) => (
              <div 
                key={index}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 hover:border-rose-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-slate-400">{asset.asset_id}</span>
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400">
                        {asset.asset_type}
                      </span>
                    </div>
                    <h4 className="text-white font-medium">{asset.asset_name}</h4>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getHealthColor(asset.health_score)}`}>
                      {asset.health_score}%
                    </div>
                    <div className="text-xs text-slate-500">{getHealthLabel(asset.health_score)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  {asset.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {asset.location}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs ${
                    asset.status === 'critical' 
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  }`}>
                    {asset.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance Backlog */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          أعمال الصيانة المتراكمة
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-900/20 p-4 rounded-lg border border-amber-500/30">
            <div className="text-3xl font-bold text-amber-400 mb-1">
              {data.maintenance_backlog.backlog_count}
            </div>
            <div className="text-sm text-amber-400/70">أمر عمل معلق</div>
          </div>
          <div className="bg-amber-900/20 p-4 rounded-lg border border-amber-500/30">
            <div className="text-3xl font-bold text-amber-400 mb-1">
              {(data.maintenance_backlog.estimated_hours || 0).toFixed(0)}
            </div>
            <div className="text-sm text-amber-400/70">ساعة عمل مقدرة</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-cyan-900/10 border border-cyan-500/30 p-6 rounded-xl">
        <h3 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          توصيات ذكية
        </h3>
        <ul className="space-y-3">
          {overall.critical > 5 && (
            <li className="flex items-start gap-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <span className="text-slate-300">
                يوجد <strong className="text-rose-400">{overall.critical}</strong> أصل في حالة حرجة. يُنصح بجدولة صيانة عاجلة.
              </span>
            </li>
          )}
          {overall.avg_health < 70 && (
            <li className="flex items-start gap-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span className="text-slate-300">
                متوسط صحة الأصول أقل من 70%. يُنصح بمراجعة خطة الصيانة الوقائية.
              </span>
            </li>
          )}
          {data.maintenance_backlog.backlog_count > 30 && (
            <li className="flex items-start gap-3 text-sm">
              <Clock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span className="text-slate-300">
                تراكم كبير في أوامر العمل ({data.maintenance_backlog.backlog_count}). يُنصح بتخصيص موارد إضافية.
              </span>
            </li>
          )}
          {overall.critical === 0 && overall.avg_health > 80 && (
            <li className="flex items-start gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-emerald-300">
                حالة ممتازة! جميع الأصول في صحة جيدة. استمر على نفس المنهج.
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
