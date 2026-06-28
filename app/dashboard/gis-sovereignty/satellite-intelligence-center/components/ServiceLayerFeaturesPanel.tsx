'use client';
/**
 * ServiceLayerFeaturesPanel
 * Shows features in a selected service layer, and lets user add/delete them.
 * "Add point" mode passes a callback down to the map via onEnterAddPointMode.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Trash2, Loader2, AlertCircle, X, ChevronRight, Eye } from 'lucide-react';
import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';
import type { ServiceLayerRecord } from '@/lib/serviceLayersAPI';
import type { FacilityType } from './ServiceLayerCreateDialog';
import { LAYER_TEMPLATES } from './ServiceLayerCreateDialog';

export interface LayerFeature {
  id: string;
  layer_id: string;
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  properties: {
    name: string;
    facility_type: FacilityType;
    description?: string;
    status?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export type AddPointModePayload = {
  layerId: string;
  facilityType: FacilityType;
  color: string;
  onPointPicked: (lon: number, lat: number) => void;
};

interface Props {
  layer: ServiceLayerRecord;
  onClose: () => void;
  onEnterAddPointMode: (payload: AddPointModePayload) => void;
  onFeaturesChanged?: () => void;
}

const FACILITY_LABELS: Record<FacilityType, string> = {
  hospital:       'مستشفى',
  health_center:  'مركز صحي',
  school:         'مدرسة',
  university:     'جامعة',
  water_tank:     'خزان مياه',
  pump_station:   'محطة ضخ',
  power_station:  'محطة كهرباء',
  warehouse:      'مستودع',
  fire_station:   'إطفاء',
  police:         'شرطة',
  mosque:         'مسجد',
  market:         'سوق',
  admin_building: 'مبنى إداري',
  road:           'طريق',
  boundary:       'حدود',
  custom:         'مخصص',
};

function getTemplate(type: FacilityType) {
  return LAYER_TEMPLATES.find((t) => t.type === type) ?? LAYER_TEMPLATES[LAYER_TEMPLATES.length - 1];
}

function getLayerTemplate(layer: ServiceLayerRecord) {
  // Try to infer from metadata.facility_type or layer.type
  const ft = (layer.metadata?.facility_type as FacilityType) ?? 'custom';
  return getTemplate(ft);
}

export default function ServiceLayerFeaturesPanel({ layer, onClose, onEnterAddPointMode, onFeaturesChanged }: Props) {
  const [features, setFeatures]   = useState<LayerFeature[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [addingName, setAddingName] = useState('');
  const [selectedType, setSelectedType] = useState<FacilityType>(
    (layer.metadata?.facility_type as FacilityType) ?? 'custom'
  );

  const tpl = getLayerTemplate(layer);

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithClientTenantRetry(`/api/gis/service-layers/${layer.id}/features`);
      if (!res.ok) throw new Error(`load_failed:${res.status}`);
      const data = await res.json();
      setFeatures(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'فشل تحميل العناصر');
    } finally {
      setLoading(false);
    }
  }, [layer.id]);

  useEffect(() => { loadFeatures(); }, [loadFeatures]);

  const handleEnterAddMode = () => {
    if (!addingName.trim()) {
      alert('أدخل اسم المرفق أولاً');
      return;
    }
    const featureTpl = getTemplate(selectedType);
    onEnterAddPointMode({
      layerId: layer.id,
      facilityType: selectedType,
      color: featureTpl.color,
      onPointPicked: async (lon, lat) => {
        try {
          await fetchWithClientTenantRetry(`/api/gis/service-layers/${layer.id}/features`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              geometry: { type: 'Point', coordinates: [lon, lat] },
              properties: { name: addingName.trim(), facility_type: selectedType },
            }),
          });
          setAddingName('');
          await loadFeatures();
          onFeaturesChanged?.();
        } catch {
          setError('فشل حفظ النقطة');
        }
      },
    });
  };

  const handleDelete = async (fid: string) => {
    if (!window.confirm('حذف هذا العنصر؟')) return;
    setDeleting(fid);
    try {
      await fetchWithClientTenantRetry(`/api/gis/service-layers/${layer.id}/features/${fid}`, { method: 'DELETE' });
      setFeatures((prev) => prev.filter((f) => f.id !== fid));
      onFeaturesChanged?.();
    } catch {
      setError('فشل حذف العنصر');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border-t border-slate-800" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{tpl.emoji}</span>
          <span className="text-[11px] font-bold text-slate-200 truncate">{layer.name}</span>
          <span className="text-[9px] text-slate-500 shrink-0">{features.length} عنصر</span>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 shrink-0"><X size={13} /></button>
      </div>

      {/* Add new feature row */}
      <div className="px-3 py-2 border-b border-slate-800/60 shrink-0 space-y-1.5">
        <div className="flex gap-1.5">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as FacilityType)}
            className="h-7 flex-1 px-2 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {LAYER_TEMPLATES.map((t) => (
              <option key={t.type} value={t.type}>{t.emoji} {t.labelAr}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEnterAddMode(); }}
            placeholder="اسم المرفق..."
            className="h-7 flex-1 px-2 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleEnterAddMode}
            className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold flex items-center gap-1 shrink-0"
            title="انقر على الخريطة لتحديد موقع المرفق"
          >
            <MapPin size={11} />
            تحديد موقع
          </button>
        </div>
        <p className="text-[9px] text-slate-600">أدخل الاسم ثم انقر «تحديد موقع» وانقر على الخريطة</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 flex items-center gap-1.5 rounded border border-rose-700/40 bg-rose-950/30 px-2 py-1.5 shrink-0">
          <AlertCircle size={11} className="text-rose-400 shrink-0" />
          <span className="text-[9px] text-rose-300">{error}</span>
          <button onClick={() => setError(null)} className="mr-auto text-slate-600 hover:text-slate-400"><X size={10} /></button>
        </div>
      )}

      {/* Feature list */}
      <div className="flex-1 overflow-y-auto py-1 px-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[10px]">جارٍ التحميل...</span>
          </div>
        ) : features.length === 0 ? (
          <div className="py-6 text-center">
            <MapPin size={22} className="mx-auto mb-2 text-slate-700" />
            <p className="text-[10px] text-slate-500">لا توجد عناصر بعد</p>
            <p className="text-[9px] text-slate-600 mt-0.5">أضف اسماً وانقر «تحديد موقع»</p>
          </div>
        ) : (
          features.map((feat) => {
            const ft = feat.properties.facility_type ?? 'custom';
            const ftpl = getTemplate(ft as FacilityType);
            const coords = feat.geometry.type === 'Point'
              ? (feat.geometry.coordinates as number[])
              : null;
            return (
              <div
                key={feat.id}
                className="flex items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/40 px-2 py-1.5 mb-1"
              >
                <span className="text-base leading-none shrink-0">{ftpl.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-200 truncate font-semibold">{feat.properties.name}</p>
                  <p className="text-[9px] text-slate-500">
                    {FACILITY_LABELS[ft as FacilityType] ?? ft}
                    {coords ? ` · ${coords[1]?.toFixed(4)}°, ${coords[0]?.toFixed(4)}°` : ''}
                  </p>
                </div>
                {deleting === feat.id ? (
                  <Loader2 size={11} className="animate-spin text-slate-500 shrink-0" />
                ) : (
                  <button
                    onClick={() => handleDelete(feat.id)}
                    className="text-slate-700 hover:text-rose-400 shrink-0"
                    title="حذف"
                  ><Trash2 size={11} /></button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
