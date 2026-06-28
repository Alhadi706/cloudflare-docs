'use client';
import React from 'react';
import { Bell, Info, AlertTriangle } from 'lucide-react';
import type { SemanticLevel } from '@/lib/satelliteIntelAPI';

const CONFIG: Record<SemanticLevel, {
  label: string; bg: string; text: string; border: string; Icon: React.FC<any>;
}> = {
  informational: { label: 'معلوماتي',  bg: 'bg-slate-800/60',  text: 'text-slate-300',  border: 'border-slate-600/40', Icon: Info },
  advisory:      { label: 'تحذيري',   bg: 'bg-amber-950/60',  text: 'text-amber-300',  border: 'border-amber-600/50', Icon: AlertTriangle },
  alert:         { label: 'إنذار',    bg: 'bg-rose-950/60',   text: 'text-rose-300',   border: 'border-rose-600/50',  Icon: Bell },
};

interface Props {
  value: SemanticLevel;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export default function SemanticLevelBadge({ value, showIcon = true, size = 'sm' }: Props) {
  const cfg = CONFIG[value] ?? CONFIG.informational;
  const px = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  const IconComp = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${px} ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {showIcon && <IconComp className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}
