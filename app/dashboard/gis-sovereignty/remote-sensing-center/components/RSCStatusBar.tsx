'use client';

import React from 'react';
import type { RSCModule, RSCTool } from './RemoteSensingShell';
import { Activity } from 'lucide-react';

const MODULE_HELP: Record<RSCModule, string> = {
  spatial: 'Spatial Analyst · تحليل البيانات النقطية (Raster) · نمذجة الهيدرولوجيا والمحاكاة',
  image:   'Image Analyst · معالجة المرئيات الفضائية · الكشف الطيفي · تصنيف الغطاء الأرضي',
  '3d':    '3D Analyst · نمذجة DEM/DSM · تحليل التضاريس · خط البصر والمنطقة المرئية',
};

const TOOL_HINT: Partial<Record<RSCTool, string>> = {
  sa_buffer:      'انقر على الخريطة لتحديد مركز العازلة أو ارسم مضلعاً',
  sa_slope:       'محدد AOI مطلوب — استخدم زر نطاق العمل',
  sa_watershed:   'انقر على نقطة صرف لبدء احتساب الحوض',
  sa_hillshade:   'اضبط زاوية الشمس واتجاهها من المعاملات',
  ia_ndvi:        'يتطلب حزم NIR + Red من Sentinel-2 أو Landsat',
  ia_ndwi:        'يتطلب حزم Green + NIR',
  ia_classify:    'حدد نطاق AOI ثم اختر طريقة التصنيف والعدد',
  ia_change:      'اختر تاريخين مختلفين من لوحة الوقت',
  '3d_viewshed':  'انقر على الخريطة لتحديد نقطة المراقبة',
  '3d_contour':   'حدد فاصل الكنتور المناسب لمقياس الخريطة',
};

interface Props {
  activeModule: RSCModule;
  activeTool: RSCTool;
  processing: boolean;
}

export default function RSCStatusBar({ activeModule, activeTool, processing }: Props) {
  const hint = TOOL_HINT[activeTool];
  const moduleLabel = MODULE_HELP[activeModule];

  return (
    <div className="h-7 flex items-center gap-3 px-4 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-400 flex-shrink-0" dir="rtl">
      <Activity className="w-3 h-3 text-slate-600 flex-shrink-0" />
      <span className="truncate">{moduleLabel}</span>
      {hint && (
        <>
          <span className="text-slate-700">·</span>
          <span className="text-cyan-400/80 truncate">💡 {hint}</span>
        </>
      )}
      <div className="flex-1" />
      {processing && (
        <span className="text-cyan-400 animate-pulse">⏳ جاري تنفيذ التحليل…</span>
      )}
      <span className="text-slate-600">مركز الاستشعار عن بُعد · RSC v1.0</span>
    </div>
  );
}
