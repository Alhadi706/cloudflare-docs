'use client';
import { RLE_COLOR, RISK_COLOR } from '../constants';

export function RleChip({ status }: { status: string }) {
  const cls = RLE_COLOR[status] ?? RLE_COLOR['unknown'];
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

export function RiskChip({ cls }: { cls: string }) {
  const color = RISK_COLOR[cls] ?? RISK_COLOR['medium'];
  return (
    <span className={`text-xs font-semibold ${color}`}>{cls}</span>
  );
}
