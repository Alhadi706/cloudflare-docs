'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Layers, Navigation, Map, Crosshair, Circle, RefreshCw } from 'lucide-react';

interface GISAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  location: {
    lat: number;
    lng: number;
  };
  properties: Record<string, any>;
}

interface SpatialAnalysis {
  analysis_id: string;
  analysis_type: string;
  area_sqm: number;
  perimeter_m: number;
  centroid: { lat: number; lng: number };
  buffer_zone?: any;
}

interface ConflictPoint {
  point_id: string;
  conflict_type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  location: { lat: number; lng: number };
  description: string;
  affected_projects: string[];
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

export default function SpatialIntelligencePage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'analysis' | 'conflicts'>('assets');
  const [gisAssets, setGisAssets] = useState<GISAsset[]>([]);
  const [analyses, setAnalyses] = useState<SpatialAnalysis[]>([]);
  const [conflicts, setConflictPoints] = useState<ConflictPoint[]>([]);

  // Fetch GIS assets
  const fetchGISAssets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/hr-structure/analytics/infrastructure-usage', { headers: getTenantHeaders() });
      if (response.ok) {
        const data = await response.json();
        const items = data.infrastructure || [];
        setGisAssets(items.map((item: any, i: number) => ({ ...item, id: i, lat: 32.9 + i * 0.01, lng: 13.18 + i * 0.01 })));
      }
    } catch (error) {
      console.error('Failed to fetch GIS assets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate dummy spatial analyses (في الإنتاج سيتم جلبها من API)
  const generateAnalyses = () => {
    const dummyAnalyses: SpatialAnalysis[] = [
      {
        analysis_id: 'ana-001',
        analysis_type: 'Buffer Analysis',
        area_sqm: 125000,
        perimeter_m: 1450,
        centroid: { lat: 24.7136, lng: 46.6753 }
      },
      {
        analysis_id: 'ana-002',
        analysis_type: 'Proximity Analysis',
        area_sqm: 89000,
        perimeter_m: 1120,
        centroid: { lat: 24.6820, lng: 46.7210 }
      },
      {
        analysis_id: 'ana-003',
        analysis_type: 'Overlay Analysis',
        area_sqm: 205000,
        perimeter_m: 1890,
        centroid: { lat: 24.7450, lng: 46.6920 }
      }
    ];
    setAnalyses(dummyAnalyses);
  };

  // Generate dummy conflict points (في الإنتاج سيتم جلبها من spatial_conflict API)
  const generateConflicts = () => {
    const dummyConflicts: ConflictPoint[] = [
      {
        point_id: 'conf-001',
        conflict_type: 'Overlapping Infrastructure',
        severity: 'HIGH',
        location: { lat: 24.7136, lng: 46.6753 },
        description: 'تداخل بين شبكة الصرف الصحي وخط الغاز',
        affected_projects: ['proj-101', 'proj-205']
      },
      {
        point_id: 'conf-002',
        conflict_type: 'Proximity Warning',
        severity: 'MEDIUM',
        location: { lat: 24.6820, lng: 46.7210 },
        description: 'قرب زائد من منطقة سكنية',
        affected_projects: ['proj-312']
      }
    ];
    setConflictPoints(dummyConflicts);
  };

  useEffect(() => {
    fetchGISAssets();
    generateAnalyses();
    generateConflicts();
  }, []);

  const getSeverityColor = (severity: string) => {
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
        <div className="flex items-center justify-between bg-gradient-to-r from-cyan-900/30 to-slate-900/50 p-6 rounded-2xl border border-cyan-500/30">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-cyan-500/50">
              <MapPin className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الذكاء المكاني</h1>
              <p className="text-slate-300 mt-1">التحليل المكاني المتقدم وكشف التعارضات الجغرافية</p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchGISAssets();
              generateAnalyses();
              generateConflicts();
            }}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-cyan-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-cyan-400">{gisAssets.length}</div>
                <div className="text-slate-400 mt-1">أصول GIS</div>
              </div>
              <Map className="w-12 h-12 text-cyan-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-400">{analyses.length}</div>
                <div className="text-slate-400 mt-1">تحليلات مكانية</div>
              </div>
              <Layers className="w-12 h-12 text-blue-400/50" />
            </div>
          </div>
          
          <div className="bg-slate-900/50 p-6 rounded-xl border border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-400">{conflicts.length}</div>
                <div className="text-slate-400 mt-1">نقاط تعارض</div>
              </div>
              <Crosshair className="w-12 h-12 text-orange-400/50" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'assets'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            أصول GIS
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'analysis'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            التحليلات المكانية
          </button>
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
              activeTab === 'conflicts'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            كشف التعارضات
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* GIS Assets Tab */}
          {activeTab === 'assets' && (
            gisAssets.length > 0 ? (
              gisAssets.slice(0, 10).map((asset, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <Map className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{asset.asset_name}</h3>
                        <p className="text-slate-400 text-sm mt-1">نوع: {asset.asset_type}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Navigation className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-400">
                            {asset.location.lat.toFixed(4)}°, {asset.location.lng.toFixed(4)}°
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد أصول GIS متاحة</p>
              </div>
            )
          )}

          {/* Spatial Analysis Tab */}
          {activeTab === 'analysis' && (
            analyses.length > 0 ? (
              analyses.map((analysis, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <Layers className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{analysis.analysis_type}</h3>
                        <p className="text-slate-400 text-sm mt-1">معرف: {analysis.analysis_id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">المساحة</div>
                      <div className="text-2xl font-bold text-cyan-400">{(analysis.area_sqm / 1000).toFixed(1)} km²</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">المحيط</div>
                      <div className="text-2xl font-bold text-blue-400">{(analysis.perimeter_m / 1000).toFixed(2)} km</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">النقطة المركزية</div>
                      <div className="text-sm font-bold text-slate-300">
                        {analysis.centroid.lat.toFixed(4)}°, {analysis.centroid.lng.toFixed(4)}°
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد تحليلات مكانية</p>
              </div>
            )
          )}

          {/* Conflict Detection Tab */}
          {activeTab === 'conflicts' && (
            conflicts.length > 0 ? (
              conflicts.map((conflict, index) => (
                <div key={index} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <Crosshair className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-200">{conflict.conflict_type}</h3>
                        <p className="text-slate-400 text-sm mt-1">{conflict.description}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full border text-sm font-bold ${getSeverityColor(conflict.severity)}`}>
                      {conflict.severity}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">الموقع</div>
                      <div className="text-sm font-bold text-slate-200">
                        {conflict.location.lat.toFixed(4)}°, {conflict.location.lng.toFixed(4)}°
                      </div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">المشاريع المتأثرة</div>
                      <div className="text-sm font-bold text-orange-400">
                        {conflict.affected_projects.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Crosshair className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد تعارضات مكانية مكتشفة</p>
              </div>
            )
          )}
        </div>

        {/* API Info Panel */}
        <div className="bg-gradient-to-r from-cyan-900/20 to-slate-900/30 p-6 rounded-xl border border-cyan-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Circle className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-bold text-slate-200">الاتصال بـ APIs المكانية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">أصول GIS</div>
              <div className="text-sm font-mono text-cyan-400">/api/gis_assets</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">التعارضات المكانية</div>
              <div className="text-sm font-mono text-cyan-400">/api/v1/projects/{'{id}'}/spatial-conflicts</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400 mb-2">GIS المتقدم</div>
              <div className="text-sm font-mono text-cyan-400">/gis/*</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
