'use client';
import { Info } from 'lucide-react';

export function KpiCard({
  label, value, icon, color, highlight,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-slate-900/60 rounded-xl border ${color} p-4 flex items-center gap-3`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className={`text-2xl font-bold ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-700/60">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-10 text-center">
      <Info className="w-10 h-10 mx-auto mb-3 text-slate-600" />
      <p className="text-slate-400">{msg}</p>
    </div>
  );
}
