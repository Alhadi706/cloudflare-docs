'use client';
import React from 'react';
import type { ConfidenceClass } from '@/lib/satelliteIntelAPI';

const CONFIG: Record<ConfidenceClass, { label: string; bg: string; text: string; border: string }> = {
  high:   { label: 'ثقة عالية',   bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-600/50' },
  medium: { label: 'ثقة متوسطة', bg: 'bg-amber-950/60',   text: 'text-amber-300',   border: 'border-amber-600/50'   },
  low:    { label: 'ثقة منخفضة', bg: 'bg-rose-950/60',    text: 'text-rose-300',    border: 'border-rose-700/50'    },
};

interface Props {
  value: ConfidenceClass;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function ConfidenceBadge({ value, showLabel = true, size = 'sm' }: Props) {
  const cfg = CONFIG[value] ?? CONFIG.low;
  const px = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-mono font-semibold ${px} ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value === 'high' ? 'bg-emerald-400' : value === 'medium' ? 'bg-amber-400' : 'bg-rose-400'}`} />
      {showLabel ? cfg.label : value.toUpperCase()}
    </span>
  );
}
