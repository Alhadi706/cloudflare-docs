'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Map } from 'lucide-react';

const LEGEND_ITEMS = [
  { color: '#f97316', label: 'نتائج التحليل المكاني', desc: 'buffer / تقاطع' },
  { color: '#3b82f6', label: 'أصول قريبة', desc: 'نتائج البحث في النطاق' },
  { color: '#8b5cf6', label: 'أصول متقاطعة', desc: 'تقاطع المضلع' },
  { color: '#22c55e', label: 'مشاريع / سليمة', desc: 'صحة ≥ 70%' },
  { color: '#ef4444', label: 'خطر عالٍ', desc: 'صحة < 40%' },
  { color: '#00e5ff', label: 'رسم يدوي', desc: 'معالم مرسومة' },
  { color: '#f59e0b', label: 'محاكاة', desc: 'سيناريوهات توقعية' },
];

export default function MapLegend() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="absolute bottom-5 left-5 z-30 bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 rounded-xl shadow-2xl text-slate-200 select-none min-w-[200px]"
      dir="rtl"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/60 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Map className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-300">دليل الألوان</span>
        </div>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        }
      </button>

      {/* Items */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}88` }}
              />
              <div>
                <p className="text-[11px] text-slate-200 leading-tight">{item.label}</p>
                <p className="text-xs text-slate-500 leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
