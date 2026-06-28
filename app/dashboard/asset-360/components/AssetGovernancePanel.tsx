import React from 'react';
import { CheckSquare, GanttChartSquare, ShieldCheck } from 'lucide-react';

function iconFor(type: string) {
  if (type === 'workflow') return <GanttChartSquare className="h-4 w-4 text-cyan-700" />;
  if (type === 'approval') return <CheckSquare className="h-4 w-4 text-emerald-700" />;
  return <ShieldCheck className="h-4 w-4 text-violet-700" />;
}

export default function AssetGovernancePanel({
  actions,
}: {
  actions: any[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-violet-700" />
        <h3 className="text-base font-semibold text-slate-900">Governance Actions</h3>
      </div>

      {!actions.length ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No governance activity found for this asset yet.</p>
      ) : (
        <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
          {actions.slice(0, 30).map((action) => (
            <div key={String(action.id)} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {iconFor(String(action.action_type || 'audit'))}
                  <p className="truncate text-sm font-semibold text-slate-900">{action.title || action.id}</p>
                </div>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                  {String(action.status || 'unknown')}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{String(action.actor || '-')} • {String(action.at || '-')}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
