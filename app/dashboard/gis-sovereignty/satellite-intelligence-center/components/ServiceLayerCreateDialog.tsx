'use client';
/**
 * ServiceLayerCreateDialog — modal for creating a new service layer with type + icon.
 */
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

export type FacilityType =
  | 'hospital' | 'health_center' | 'school' | 'university'
  | 'water_tank' | 'pump_station' | 'power_station' | 'warehouse'
  | 'fire_station' | 'police' | 'mosque' | 'market'
  | 'admin_building' | 'road' | 'boundary' | 'custom';

export interface LayerTemplate {
  type: FacilityType;
  labelAr: string;
  emoji: string;
  color: string;
  geometry_type: 'point' | 'line' | 'polygon' | 'mixed';
  layer_type: 'service-point' | 'service-area' | 'network' | 'planning' | 'custom';
}

export const LAYER_TEMPLATES: LayerTemplate[] = [
  { type: 'hospital',       labelAr: 'مستشفى',           emoji: '🏥', color: '#ef4444', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'health_center',  labelAr: 'مركز صحي',         emoji: '⚕️', color: '#f97316', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'school',         labelAr: 'مدرسة',            emoji: '🏫', color: '#3b82f6', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'university',     labelAr: 'جامعة / معهد',     emoji: '🎓', color: '#6366f1', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'water_tank',     labelAr: 'خزان مياه',        emoji: '🪣', color: '#06b6d4', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'pump_station',   labelAr: 'محطة ضخ / صرف',    emoji: '⚙️', color: '#0ea5e9', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'power_station',  labelAr: 'محطة كهرباء',      emoji: '⚡', color: '#eab308', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'warehouse',      labelAr: 'مستودع / مخزن',    emoji: '🏭', color: '#78716c', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'fire_station',   labelAr: 'إطفاء / دفاع مدني',emoji: '🚒', color: '#dc2626', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'police',         labelAr: 'مركز شرطة / أمن',  emoji: '👮', color: '#1d4ed8', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'mosque',         labelAr: 'مسجد',             emoji: '🕌', color: '#16a34a', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'market',         labelAr: 'سوق / مركز تجاري', emoji: '🛒', color: '#a855f7', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'admin_building', labelAr: 'مبنى إداري / بلدية',emoji: '🏛️', color: '#64748b', geometry_type: 'point',   layer_type: 'service-point' },
  { type: 'road',           labelAr: 'طريق / شبكة مواصلات',emoji: '🛣️', color: '#f59e0b', geometry_type: 'line',  layer_type: 'network'       },
  { type: 'boundary',       labelAr: 'حدود / منطقة',     emoji: '🗺️', color: '#84cc16', geometry_type: 'polygon', layer_type: 'planning'      },
  { type: 'custom',         labelAr: 'مخصص',             emoji: '📍', color: '#94a3b8', geometry_type: 'mixed',   layer_type: 'custom'        },
];

interface Props {
  onConfirm: (payload: { name: string; template: LayerTemplate; municipality_key?: string | null }) => void;
  onClose: () => void;
  municipalities?: { key: string; labelAr: string }[];
}

export default function ServiceLayerCreateDialog({ onConfirm, onClose, municipalities = [] }: Props) {
  const [name, setName]           = useState('');
  const [selected, setSelected]   = useState<LayerTemplate>(LAYER_TEMPLATES[0]);
  const [municipalityKey, setMunicipalityKey] = useState<string>('');

  const handleConfirm = () => {
    const finalName = name.trim() || selected.labelAr;
    onConfirm({ name: finalName, template: selected, municipality_key: municipalityKey || null });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h2 className="text-[13px] font-bold text-slate-100">إنشاء طبقة خدمات جديدة</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={15} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Type grid */}
          <div>
            <p className="text-[10px] text-slate-400 font-semibold mb-2">نوع الطبقة</p>
            <div className="grid grid-cols-4 gap-1.5">
              {LAYER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.type}
                  onClick={() => {
                    setSelected(tpl);
                    if (!name) setName('');
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                    selected.type === tpl.type
                      ? 'border-blue-500 bg-blue-600/20 ring-1 ring-blue-500/40'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                  }`}
                  style={selected.type === tpl.type ? { borderColor: tpl.color + '99' } : {}}
                >
                  <span className="text-lg leading-none">{tpl.emoji}</span>
                  <span className="text-[9px] text-slate-300 leading-tight">{tpl.labelAr}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-1">اسم الطبقة</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selected.labelAr}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Municipality (optional) */}
          {municipalities.length > 0 && (
            <div>
              <label className="block text-[10px] text-slate-400 font-semibold mb-1">البلدية (اختياري)</label>
              <select
                value={municipalityKey}
                onChange={(e) => setMunicipalityKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-[12px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">كل ليبيا</option>
                {municipalities.map((m) => (
                  <option key={m.key} value={m.key}>{m.labelAr}</option>
                ))}
              </select>
            </div>
          )}

          {/* Preview */}
          <div
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
            style={{ borderColor: selected.color + '50', backgroundColor: selected.color + '10' }}
          >
            <span className="text-2xl">{selected.emoji}</span>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: selected.color }}>
                {name.trim() || selected.labelAr}
              </p>
              <p className="text-[9px] text-slate-500">
                {selected.geometry_type === 'point' ? 'نقاط' :
                 selected.geometry_type === 'line'  ? 'خطوط' :
                 selected.geometry_type === 'polygon' ? 'مضلعات' : 'مختلط'}
                {' · '}
                {municipalityKey || 'كل ليبيا'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-[11px] text-slate-400 hover:text-slate-200 hover:border-slate-600"
            >إلغاء</button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <Check size={13} />
              إنشاء الطبقة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
