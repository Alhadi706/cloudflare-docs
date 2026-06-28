'use client';
import React from 'react';
import { CheckCircle, ArrowDownCircle, XCircle } from 'lucide-react';
import type { ValidityVerdict } from '@/lib/satelliteIntelAPI';

const CONFIG: Record<ValidityVerdict, {
  label: string; bg: string; text: string; border: string; Icon: React.FC<any>;
}> = {
  accepted:    { label: 'مقبول',     bg: 'bg-emerald-950/50', text: 'text-emerald-400', border: 'border-emerald-700/40', Icon: CheckCircle },
  downgraded:  { label: 'مخفَّض',   bg: 'bg-amber-950/50',   text: 'text-amber-400',   border: 'border-amber-700/40',   Icon: ArrowDownCircle },
  suppressed:  { label: 'مُعطَّل',  bg: 'bg-rose-950/50',    text: 'text-rose-400',    border: 'border-rose-700/40',    Icon: XCircle },
};

interface Props {
  value: ValidityVerdict;
  showIcon?: boolean;
  reason?: string | null;
  rules?: string[];
}

export default function ValidityVerdictBadge({ value, showIcon = true, reason, rules }: Props) {
  const cfg = CONFIG[value] ?? CONFIG.suppressed;
  const IconComp = cfg.Icon;
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {showIcon && <IconComp className="w-3 h-3" />}
        {cfg.label}
      </span>
      {reason && (
        <span className="text-[9px] text-rose-400/70 font-mono leading-tight max-w-[160px] truncate" title={reason}>
          ↳ {reason}
        </span>
      )}
      {!reason && rules && rules.length > 0 && (
        <span className="text-[9px] text-slate-500 font-mono leading-tight max-w-[160px] truncate" title={rules.join(', ')}>
          ↳ {rules[0]}
        </span>
      )}
    </div>
  );
}
