'use client';

import React, { useState } from 'react';
import { Layers, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import AssetLeftPanel from '../engineering-workspace/components/AssetLeftPanel';

export default function SharedAssetCompactPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const isEngineeringWorkspaceRoute = pathname.startsWith('/dashboard/gis-sovereignty/engineering-workspace');
  const shouldShowOutsideEngineering =
    pathname.startsWith('/dashboard/admin-gateway') ||
    pathname.startsWith('/dashboard/map-shell') ||
    pathname.startsWith('/dashboard/gis-sovereignty');

  if (isEngineeringWorkspaceRoute) return null;
  if (!shouldShowOutsideEngineering) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-16 right-3 z-40 inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-slate-900/85 px-3 py-2 text-xs text-cyan-100 backdrop-blur-sm hover:bg-slate-800/90"
          title="عرض قائمة الأصول"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>قائمة الأصول</span>
        </button>
      )}

      {open && (
        <div className="absolute top-16 right-3 z-40 w-[280px] max-h-[72vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/90 shadow-2xl backdrop-blur-md" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">الأصول المكانية</div>
              <div className="text-[10px] text-slate-400">نفس قائمة الإدارة الهندسية</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              title="إخفاء"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <AssetLeftPanel
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            onCreatePrincipal={() => {}}
            mode="general"
          />
        </div>
      )}
    </>
  );
}
