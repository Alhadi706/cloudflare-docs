'use client';
/**
 * MapToggleButton — Phase 3
 * ════════════════════════════════════════════════════════════════
 * A single button that shows/hides the department map.
 * Reads and writes useDeptMapStore.
 *
 * Usage (in any dept header):
 *   <MapToggleButton />
 *
 * The AdminGatewayLayout reads the same store and switches its render mode.
 */
import React from 'react';
import { Map, EyeOff } from 'lucide-react';
import { useDeptMapStore } from '@/store/deptMapStore';

interface MapToggleButtonProps {
  /** Optional extra className */
  className?: string;
  /** Show text label next to icon (default: true) */
  showLabel?: boolean;
}

export default function MapToggleButton({
  className = '',
  showLabel = true,
}: MapToggleButtonProps) {
  const { mapHidden, toggleMap } = useDeptMapStore();

  return (
    <button
      type="button"
      onClick={toggleMap}
      title={mapHidden ? 'إظهار الخريطة' : 'إخفاء الخريطة'}
      className={`
        inline-flex items-center gap-2 rounded-xl border px-3 py-1.5
        text-[13px] font-semibold transition-all duration-200
        ${mapHidden
          ? 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-900/20 hover:text-cyan-300'
          : 'border-cyan-500/50 bg-cyan-900/20 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/30'
        }
        ${className}
      `.trim()}
    >
      {mapHidden
        ? <Map    className="h-4 w-4 shrink-0" />
        : <EyeOff className="h-4 w-4 shrink-0" />
      }
      {showLabel && (
        <span className="hidden sm:inline">
          {mapHidden ? 'إظهار الخريطة' : 'إخفاء الخريطة'}
        </span>
      )}
    </button>
  );
}
