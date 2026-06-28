// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Spatial Analytics - Risk Zones, Clusters & Heatmaps
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, AlertTriangle, TrendingUp, Layers, Zap } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface SpatialAnalyticsData {
  asset_density: Array<{
    asset_type: string;
    count: number;
    centroid: string;
  }>;
  risk_assets: Array<{
    asset_id: string;
    asset_name: string;
    health_score: number;
    asset_type: string;
    location: string;
  }>;
  failure_clusters: Array<{
    asset_id: string;
    asset_name: string;
    maintenance_count: number;
    location: string;
  }>;
  coverage_stats: {
    total_monitored: number;
    coverage_area: number;
  };
}

export default function SpatialAnalytics() {
  const [data, setData] = useState<SpatialAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<'risk' | 'density' | 'clusters'>('risk');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    fetchSpatialData();
  }, []);

  useEffect(() => {
    if (data && mapContainer.current && !map.current) {
      initializeMap();
    }
  }, [data]);

  useEffect(() => {
    if (map.current && data) {
      updateMapLayer();
    }
  }, [activeLayer, data]);

  const fetchSpatialData = async () => {
    try {
      const response = await fetch('/api/v1/intelligence/spatial-analytics');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch spatial analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      center: [46.6753, 24.7136], // Riyadh
      zoom: 11
    });

    map.current.on('load', () => {
      updateMapLayer();
    });
  };

  const updateMapLayer = () => {
    if (!map.current || !data) return;

    // Remove existing layers and sources
    ['risk-layer', 'density-layer', 'cluster-layer'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    ['risk-source', 'density-source', 'cluster-source'].forEach(sourceId => {
      if (map.current!.getSource(sourceId)) {
        map.current!.removeSource(sourceId);
      }
    });

    // Add appropriate layer based on selection
    if (activeLayer === 'risk' && data.risk_assets.length > 0) {
      addRiskLayer();
    } else if (activeLayer === 'clusters' && data.failure_clusters.length > 0) {
      addClustersLayer();
    } else if (activeLayer === 'density' && data.asset_density.length > 0) {
      addDensityLayer();
    }
  };

  const addRiskLayer = () => {
    if (!map.current || !data) return;

    const features = data.risk_assets
      .filter(asset => asset.location)
      .map(asset => {
        const location = JSON.parse(asset.location);
        return {
          type: 'Feature' as const,
          properties: {
            asset_id: asset.asset_id,
            asset_name: asset.asset_name,
            health_score: asset.health_score,
            asset_type: asset.asset_type
          },
          geometry: location
        };
      });

    map.current.addSource('risk-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features
      }
    });

    // Add heatmap layer
    map.current.addLayer({
      id: 'risk-layer',
      type: 'heatmap',
      source: 'risk-source',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'health_score'],
          0, 1,
          40, 0.8,
          60, 0.5,
          80, 0.2
        ],
        'heatmap-intensity': 1,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0, 0, 0, 0)',
          0.2, 'rgb(220, 38, 38)',
          0.4, 'rgb(251, 146, 60)',
          0.6, 'rgb(251, 191, 36)',
          0.8, 'rgb(34, 197, 94)',
          1, 'rgb(16, 185, 129)'
        ],
        'heatmap-radius': 30,
        'heatmap-opacity': 0.7
      }
    });

    // Add circle layer for individual assets
    map.current.addLayer({
      id: 'risk-points',
      type: 'circle',
      source: 'risk-source',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'health_score'],
          0, '#ef4444',
          40, '#f59e0b',
          60, '#3b82f6',
          80, '#10b981'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add popups
    map.current.on('click', 'risk-points', (e: any) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const prop = feature.properties;
      
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 10px; color: #000;">
            <strong>${prop.asset_name}</strong><br/>
            <span style="font-size: 12px;">${prop.asset_id}</span><br/>
            <span style="color: ${prop.health_score < 40 ? '#ef4444' : '#f59e0b'};">
              صحة: ${prop.health_score}%
            </span>
          </div>
        `)
        .addTo(map.current!);
    });

    map.current.on('mouseenter', 'risk-points', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'risk-points', () => {
      map.current!.getCanvas().style.cursor = '';
    });
  };

  const addClustersLayer = () => {
    if (!map.current || !data) return;

    const features = data.failure_clusters
      .filter(cluster => cluster.location)
      .map(cluster => {
        const location = JSON.parse(cluster.location);
        return {
          type: 'Feature' as const,
          properties: {
            asset_id: cluster.asset_id,
            asset_name: cluster.asset_name,
            maintenance_count: cluster.maintenance_count
          },
          geometry: location
        };
      });

    map.current.addSource('cluster-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features
      }
    });

    map.current.addLayer({
      id: 'cluster-layer',
      type: 'circle',
      source: 'cluster-source',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'maintenance_count'],
          2, 10,
          5, 20,
          10, 30
        ],
        'circle-color': '#ef4444',
        'circle-opacity': 0.6,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    map.current.on('click', 'cluster-layer', (e: any) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const prop = feature.properties;
      
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 10px; color: #000;">
            <strong>${prop.asset_name}</strong><br/>
            <span style="color: #ef4444;">
              ${prop.maintenance_count} أعطال
            </span>
          </div>
        `)
        .addTo(map.current!);
    });
  };

  const addDensityLayer = () => {
    // Simple implementation - can be enhanced with actual density calculation
    if (!map.current || !data) return;

    const features = data.asset_density
      .filter(d => d.centroid)
      .map(d => {
        const centroid = JSON.parse(d.centroid);
        return {
          type: 'Feature' as const,
          properties: {
            asset_type: d.asset_type,
            count: d.count
          },
          geometry: centroid
        };
      });

    map.current.addSource('density-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features
      }
    });

    map.current.addLayer({
      id: 'density-layer',
      type: 'circle',
      source: 'density-source',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          1, 15,
          10, 25,
          20, 35
        ],
        'circle-color': '#06b6d4',
        'circle-opacity': 0.5,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">جاري تحميل التحليل المكاني...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Controls */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-cyan-400" />
            التحليل المكاني المتقدم
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveLayer('risk')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeLayer === 'risk'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline-block mr-2" />
              مناطق الخطر
            </button>
            <button
              onClick={() => setActiveLayer('clusters')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeLayer === 'clusters'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4 inline-block mr-2" />
              بؤر الأعطال
            </button>
            <button
              onClick={() => setActiveLayer('density')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeLayer === 'density'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-4 h-4 inline-block mr-2" />
              كثافة الأصول
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 overflow-hidden">
        <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-900/20 p-6 rounded-xl border border-rose-500/30">
          <h3 className="text-lg font-semibold text-rose-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            أصول خطرة
          </h3>
          <div className="text-4xl font-bold text-white mb-1">
            {data?.risk_assets.length || 0}
          </div>
          <p className="text-sm text-slate-400">أصل بصحة منخفضة (&lt;60%)</p>
        </div>

        <div className="bg-amber-900/20 p-6 rounded-xl border border-amber-500/30">
          <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            بؤر أعطال
          </h3>
          <div className="text-4xl font-bold text-white mb-1">
            {data?.failure_clusters.length || 0}
          </div>
          <p className="text-sm text-slate-400">منطقة بأعطال متكررة</p>
        </div>

        <div className="bg-cyan-900/20 p-6 rounded-xl border border-cyan-500/30">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            نطاق التغطية
          </h3>
          <div className="text-4xl font-bold text-white mb-1">
            {data?.coverage_stats.total_monitored || 0}
          </div>
          <p className="text-sm text-slate-400">أصل مراقب</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">المفتاح:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500" />
            <span className="text-slate-300">صحة ممتازة (80%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="text-slate-300">صحة جيدة (60-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span className="text-slate-300">صحة متوسطة (40-59%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-rose-500" />
            <span className="text-slate-300">صحة حرجة (&lt;40%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
