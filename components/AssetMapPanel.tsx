'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Maximize2, X, Loader } from 'lucide-react';
import { getAssetSpatial, openAssetOnMap, NavigationTarget } from '@/lib/erpSpatialService';

interface AssetMapPanelProps {
  assetId: number;
  assetName?: string;
  onClose?: () => void;
}

export default function AssetMapPanel({ assetId, assetName, onClose }: AssetMapPanelProps) {
  const [loading, setLoading] = useState(true);
  const [navData, setNavData] = useState<NavigationTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadAssetLocation();
  }, [assetId]);

  const loadAssetLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssetSpatial(assetId);
      if (data.latitude && data.longitude) {
        setNavData({
          asset_id: assetId,
          asset_name: data.asset_name,
          center: {
            latitude: data.latitude,
            longitude: data.longitude
          },
          zoom: 16,
          health_score: data.health_score
        });
      } else {
        setError('لا توجد إحداثيات مكانية لهذا الأصل');
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل موقع الأصل');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    openAssetOnMap(assetId);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
         style={{ width: '400px', height: '300px' }}>
      
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100">الموقع على الخريطة</h3>
            <p className="text-xs text-slate-400 truncate max-w-[250px]">
              {navData?.asset_name || assetName || `أصل #${assetId}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenInNewTab}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            title="فتح في تبويب جديد"
          >
            <Maximize2 className="w-4 h-4 text-slate-400" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              title="إغلاق"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative h-[calc(100%-57px)]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <Loader className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Navigation className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">{error}</p>
            <button
              onClick={loadAssetLocation}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : navData?.center ? (
          <>
            {/* Static Map Placeholder - Replace with actual map component */}
            <div className="absolute inset-0 bg-slate-800">
              <div 
                className="w-full h-full relative"
                style={{
                  backgroundImage: `url(https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/pin-s-marker+3b82f6(${navData.center.longitude},${navData.center.latitude})/${navData.center.longitude},${navData.center.latitude},${navData.zoom},0/400x243@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {/* Health indicator */}
                {navData.health_score !== undefined && (
                  <div className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-300">صحة الأصل: </span>
                    <span className={`text-sm font-bold ${
                      navData.health_score >= 80 ? 'text-emerald-400' :
                      navData.health_score >= 50 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {navData.health_score.toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* Coordinates */}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur px-3 py-2 rounded-lg border border-slate-700">
                  <div className="text-xs text-slate-400 font-mono">
                    {navData.center.latitude.toFixed(6)}, {navData.center.longitude.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Open in full map button */}
            <button
              onClick={handleOpenInNewTab}
              className="absolute top-2 right-2 px-3 py-1.5 bg-blue-600/90 backdrop-blur hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <Navigation className="w-4 h-4" />
              <span>فتح مركز التحكم</span>
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-slate-400 text-sm">لا تتوفر معلومات الموقع</p>
          </div>
        )}
      </div>
    </div>
  );
}
