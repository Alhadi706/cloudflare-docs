'use client';
/**
 * RSCTopBar — شريط أدوات مركز الاستشعار عن بُعد
 * 3 وحدات رئيسية + قائمة أدوات متخصصة لكل وحدة
 */

import React, { useState } from 'react';
import { GisWorkspaceSwitcher } from '../../components/GisWorkspaceSwitcher';
import type { RSCModule, RSCTool } from './RemoteSensingShell';
import {
  Layers, ChevronDown, PanelLeft, PanelRight,
  Mountain, Satellite, Box, Activity,
  Waves, Wind, Sun, GitBranch, BarChart2,
  Eye, Scissors, Zap, Globe, RefreshCw,
} from 'lucide-react';

// ── Tool definitions per module ──────────────────────────────────────────────
const SPATIAL_TOOLS: { key: RSCTool; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'sa_buffer',      label: 'منطقة العازلة',     icon: Activity,  desc: 'إنشاء مناطق عازلة بمسافة محددة' },
  { key: 'sa_slope',       label: 'تحليل الانحدار',    icon: Mountain,  desc: 'احتساب درجة الانحدار من DEM' },
  { key: 'sa_aspect',      label: 'اتجاه المنحدر',     icon: Wind,      desc: 'الاتجاه الأمثل لسطح الانحدار' },
  { key: 'sa_hillshade',   label: 'الإضاءة الطبوغرافية', icon: Sun,     desc: 'نمذجة الظل والضوء الشمسي' },
  { key: 'sa_watershed',   label: 'أحواض التصريف',     icon: Waves,     desc: 'هيدرولوجيا — استخراج أحواض التصريف' },
  { key: 'sa_density',     label: 'كثافة الكيرنل',     icon: BarChart2, desc: 'Kernel Density Estimation' },
  { key: 'sa_interpolate', label: 'الاستيفاء المكاني', icon: GitBranch, desc: 'IDW / Kriging interpolation' },
  { key: 'sa_profile',     label: 'مقطع تضاريسي',      icon: BarChart2, desc: 'رسم مقطع ارتفاعي على مسار محدد' },
  { key: 'sa_overlay',     label: 'تحليل التداخل',     icon: Layers,    desc: 'Intersect / Union / Clip' },
];

const IMAGE_TOOLS: { key: RSCTool; label: string; icon: React.ElementType; desc: string; badge?: string }[] = [
  { key: 'ia_ndvi',      label: 'NDVI',        icon: Satellite, desc: 'مؤشر الغطاء النباتي المعياري', badge: 'NIR' },
  { key: 'ia_ndwi',      label: 'NDWI',        icon: Waves,     desc: 'مؤشر الماء المعياري', badge: 'Green' },
  { key: 'ia_savi',      label: 'SAVI',        icon: Satellite, desc: 'مؤشر النباتات المعدّل للتربة' },
  { key: 'ia_evi',       label: 'EVI',         icon: Satellite, desc: 'مؤشر النباتات المحسّن' },
  { key: 'ia_nbr',       label: 'NBR',         icon: Zap,       desc: 'نسبة الحروق المعيارية — الكوارث', badge: 'SWIR' },
  { key: 'ia_classify',  label: 'تصنيف الغطاء', icon: Globe,   desc: 'تصنيف إشرافي / غير إشرافي للمرئية' },
  { key: 'ia_change',    label: 'كشف التغيير', icon: Eye,       desc: 'مقارنة مرئيتين — رصد التغيرات' },
  { key: 'ia_pansharp',  label: 'Pan-Sharpening', icon: Zap,    desc: 'تحسين الدقة المكانية للصورة' },
  { key: 'ia_histogram', label: 'الطيف الإشعاعي', icon: BarChart2, desc: 'تحليل توزيع قيم الحزم الطيفية' },
];

const THREED_TOOLS: { key: RSCTool; label: string; icon: React.ElementType; desc: string }[] = [
  { key: '3d_contour',  label: 'خطوط الكنتور',    icon: Mountain, desc: 'استخراج خطوط التساوي من DEM' },
  { key: '3d_viewshed', label: 'منطقة الرؤية',    icon: Eye,      desc: 'Viewshed — ما يمكن رؤيته من نقطة' },
  { key: '3d_los',      label: 'خط البصر',         icon: Eye,      desc: 'Line of Sight بين نقطتين' },
  { key: '3d_cut_fill', label: 'الحفر والردم',     icon: Scissors, desc: 'احتساب حجم الحفر والردم' },
  { key: '3d_profile',  label: 'مقطع الارتفاع',   icon: BarChart2, desc: 'مقطع عرضي ثلاثي الأبعاد' },
  { key: '3d_shadow',   label: 'تحليل الظل',       icon: Sun,      desc: 'نمذجة الظل الشمسي حسب الوقت' },
  { key: '3d_skyline',  label: 'تحليل الأفق',      icon: Globe,    desc: 'Skyline الحضري من نقطة مراقبة' },
];

const MODULE_CONFIG: Record<RSCModule, {
  label: string; color: string; activeBg: string; borderColor: string;
  tools: { key: RSCTool; label: string; icon: React.ElementType; desc: string; badge?: string }[];
}> = {
  spatial: {
    label: 'Spatial Analyst', color: 'text-blue-300', activeBg: 'bg-blue-600', borderColor: 'border-blue-500/40',
    tools: SPATIAL_TOOLS,
  },
  image: {
    label: 'Image Analyst', color: 'text-emerald-300', activeBg: 'bg-emerald-600', borderColor: 'border-emerald-500/40',
    tools: IMAGE_TOOLS,
  },
  '3d': {
    label: '3D Analyst', color: 'text-purple-300', activeBg: 'bg-purple-600', borderColor: 'border-purple-500/40',
    tools: THREED_TOOLS,
  },
};

interface Props {
  activeModule: RSCModule;
  setActiveModule: (m: RSCModule) => void;
  activeTool: RSCTool;
  setActiveTool: (t: RSCTool) => void;
  processing: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
}

export default function RSCTopBar({
  activeModule, setActiveModule, activeTool, setActiveTool,
  processing, leftOpen, rightOpen, toggleLeft, toggleRight,
}: Props) {
  const cfg = MODULE_CONFIG[activeModule];

  const isActive = (key: RSCTool) => activeTool === key;
  const toggle   = (key: RSCTool, none: RSCTool) => setActiveTool(activeTool === key ? none : key);

  const noneKey: RSCTool = activeModule === 'spatial' ? 'sa_none' : activeModule === 'image' ? 'ia_none' : '3d_none';

  return (
    <div className="flex flex-col border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm flex-shrink-0" dir="rtl">

      {/* ── Row 1: identity + workspace switcher ─────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-slate-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <Satellite className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-bold text-white">مركز الاستشعار عن بُعد</span>
            <span className="text-[10px] text-slate-400 mr-2">Remote Sensing Center · v1.0</span>
          </div>
        </div>
        <div className="flex-1" />
        <GisWorkspaceSwitcher />
        <button onClick={toggleLeft}  title="اللوحة اليسرى"  className={`p-1.5 rounded transition-colors ${leftOpen  ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-400 hover:text-slate-200'}`}><PanelLeft  className="w-4 h-4" /></button>
        <button onClick={toggleRight} title="اللوحة اليمنى" className={`p-1.5 rounded transition-colors ${rightOpen ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-400 hover:text-slate-200'}`}><PanelRight className="w-4 h-4" /></button>
      </div>

      {/* ── Row 2: module selector + tools ──────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

        {/* Module tabs */}
        <div className="flex items-center gap-1 border-l border-slate-700 pl-3 ml-1 flex-shrink-0">
          {(['spatial', 'image', '3d'] as RSCModule[]).map(m => {
            const c = MODULE_CONFIG[m];
            return (
              <button
                key={m}
                onClick={() => setActiveModule(m)}
                className={[
                  'px-3 py-1.5 rounded text-xs font-bold transition-all flex-shrink-0 border',
                  activeModule === m
                    ? `${c.activeBg} text-white ${c.borderColor}`
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800',
                ].join(' ')}
              >
                {m === 'spatial' ? '⚙' : m === 'image' ? '🛰' : '🧊'} {c.label}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-700 flex-shrink-0 mx-1" />

        {/* Tool buttons for active module */}
        {cfg.tools.map(t => {
          const Icon = t.icon;
          const active = isActive(t.key);
          return (
            <button
              key={t.key}
              onClick={() => toggle(t.key, noneKey)}
              title={t.desc}
              disabled={processing}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all flex-shrink-0 border',
                active
                  ? `${cfg.activeBg} text-white ${cfg.borderColor} shadow-lg`
                  : 'text-slate-300 border-slate-700/50 hover:bg-slate-800 hover:text-white',
                processing ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.badge && (
                <span className="text-[9px] bg-slate-700 text-slate-300 px-1 rounded">{t.badge}</span>
              )}
            </button>
          );
        })}

        {processing && (
          <div className="flex items-center gap-1.5 px-3 ml-2 flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span className="text-xs text-cyan-400">معالجة…</span>
          </div>
        )}
      </div>
    </div>
  );
}
