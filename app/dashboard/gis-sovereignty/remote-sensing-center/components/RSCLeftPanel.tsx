'use client';
/**
 * RSCLeftPanel — لوحة الطبقات والإعدادات
 * Sentinel-2 / Landsat / DEM layers + band selectors + analysis params
 */

import React, { useState } from 'react';
import type { RSCModule, RSCTool } from './RemoteSensingShell';
import { Layers, ChevronDown, ChevronRight, Eye, EyeOff, Play, Upload, Info } from 'lucide-react';

// ── Satellite datasets ───────────────────────────────────────────────────────
const DATASETS = [
  {
    id: 'sentinel2',
    label: 'Sentinel-2 MSI',
    desc: 'دقة 10م — 13 حزمة طيفية',
    bands: ['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'B8 (NIR)', 'B11 (SWIR1)', 'B12 (SWIR2)'],
    color: '#22d3ee',
    available: true,
  },
  {
    id: 'sentinel1',
    label: 'Sentinel-1 SAR',
    desc: 'رادار — VV/VH polarization',
    bands: ['VV', 'VH'],
    color: '#a78bfa',
    available: true,
  },
  {
    id: 'landsat9',
    label: 'Landsat-9 OLI/TIRS',
    desc: 'دقة 30م — 11 حزمة',
    bands: ['Band 2', 'Band 3', 'Band 4', 'Band 5', 'Band 6', 'Band 10'],
    color: '#f59e0b',
    available: true,
  },
  {
    id: 'srtm',
    label: 'SRTM DEM 30m',
    desc: 'ارتفاعات رقمية عالمية',
    bands: ['Elevation'],
    color: '#84cc16',
    available: true,
  },
  {
    id: 'cop_dem',
    label: 'Copernicus DEM 10m',
    desc: 'أعلى دقة متاحة مجاناً',
    bands: ['Elevation'],
    color: '#34d399',
    available: true,
  },
];

// ── Spectral index reference ─────────────────────────────────────────────────
const INDEX_REF = [
  { key: 'ia_ndvi', name: 'NDVI', formula: '(NIR−Red)/(NIR+Red)', range: '−1 → +1', good: '>0.4 نباتات كثيفة' },
  { key: 'ia_ndwi', name: 'NDWI', formula: '(Green−NIR)/(Green+NIR)', range: '−1 → +1', good: '>0 مسطحات مائية' },
  { key: 'ia_savi', name: 'SAVI', formula: '1.5(NIR−Red)/(NIR+Red+0.5)', range: '−1 → +1', good: 'أراضٍ جافة' },
  { key: 'ia_evi',  name: 'EVI',  formula: '2.5(NIR−Red)/(NIR+6R−7.5B+1)', range: '−1 → +1', good: 'تقليل تأثير الغلاف الجوي' },
  { key: 'ia_nbr',  name: 'NBR',  formula: '(NIR−SWIR)/(NIR+SWIR)', range: '−1 → +1', good: '<−0.1 حرائق' },
];

interface Props {
  activeModule: RSCModule;
  activeTool: RSCTool;
  setActiveTool: (t: RSCTool) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  setAnalysisResult: (r: any) => void;
}

export default function RSCLeftPanel({
  activeModule, activeTool, setActiveTool,
  processing, setProcessing, setAnalysisResult,
}: Props) {
  const [expandedDataset, setExpandedDataset] = useState<string | null>('sentinel2');
  const [visibleDatasets, setVisibleDatasets] = useState<Set<string>>(new Set(['sentinel2', 'srtm']));
  const [selectedBands, setSelectedBands] = useState<Record<string, string>>({
    sentinel2: 'B4 (Red)', sentinel1: 'VV', landsat9: 'Band 4', srtm: 'Elevation', cop_dem: 'Elevation',
  });

  const toggleVisible = (id: string) => {
    setVisibleDatasets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Active index info
  const indexInfo = INDEX_REF.find(i => i.key === activeTool);

  return (
    <div className="w-64 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden" dir="rtl">

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-2">
        <Layers className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-bold text-slate-200">مصادر البيانات</span>
      </div>

      {/* Dataset list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 p-2">
        {DATASETS.map(ds => {
          const expanded = expandedDataset === ds.id;
          const visible  = visibleDatasets.has(ds.id);
          return (
            <div key={ds.id} className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900/50">
              {/* Dataset header */}
              <div className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedDataset(expanded ? null : ds.id)}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ds.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-200 truncate">{ds.label}</div>
                  <div className="text-[9px] text-slate-400 truncate">{ds.desc}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleVisible(ds.id); }}
                  className="p-0.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {visible ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                {expanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              </div>
              {/* Band selector */}
              {expanded && (
                <div className="px-3 pb-2.5 pt-1 border-t border-slate-800/50 space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">الحزمة النشطة</label>
                    <select
                      value={selectedBands[ds.id]}
                      onChange={e => setSelectedBands(p => ({ ...p, [ds.id]: e.target.value }))}
                      className="w-full text-[10px] bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1"
                    >
                      {ds.bands.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  {ds.available && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      <span className="text-[9px] text-green-400">متاح عبر API</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Upload custom */}
        <button className="w-full mt-2 py-2 rounded-lg border border-dashed border-slate-700 text-slate-400 text-[11px] hover:border-cyan-500/50 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          رفع GeoTIFF / Shapefile
        </button>
      </div>

      {/* Spectral index info card */}
      {indexInfo && (
        <div className="mx-2 mb-2 p-2.5 rounded-lg bg-emerald-900/30 border border-emerald-500/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-300">{indexInfo.name}</span>
          </div>
          <code className="text-[10px] text-emerald-200 block mb-1 font-mono">{indexInfo.formula}</code>
          <div className="text-[9px] text-slate-400">نطاق: <span className="text-slate-300">{indexInfo.range}</span></div>
          <div className="text-[9px] text-emerald-400 mt-0.5">{indexInfo.good}</div>
        </div>
      )}

      {/* Quick run */}
      {activeTool !== 'sa_none' && activeTool !== 'ia_none' && activeTool !== '3d_none' && (
        <div className="p-2 border-t border-slate-800">
          <button
            onClick={() => {
              setProcessing(true);
              setTimeout(() => {
                setProcessing(false);
                setAnalysisResult({ tool: activeTool, timestamp: new Date().toISOString(), status: 'done' });
              }, 2500);
            }}
            disabled={processing}
            className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            تشغيل التحليل
          </button>
        </div>
      )}
    </div>
  );
}
