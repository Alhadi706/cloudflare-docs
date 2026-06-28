import React from 'react';
import { CheckCircle2, Clock4, Wrench } from 'lucide-react';

function badgeClass(status: string): string {
  const s = status.toLowerCase();
  if (['completed', 'closed', 'closed_no_issue'].includes(s)) return 'bg-emerald-100 text-emerald-700';
  if (['in_progress', 'pending'].includes(s)) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export default function AssetMaintenancePanel({
  maintenance,
}: {
  maintenance: {
    history: any[];
    open_work_orders: any[];
    completed_work: any[];
    counters: { total: number; open: number; completed: number };
  };
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5 text-amber-700" />
        <h3 className="text-base font-semibold text-slate-900">Maintenance History</h3>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Metric label="Total" value={maintenance.counters.total} />
        <Metric label="Open" value={maintenance.counters.open} icon={<Clock4 className="h-3.5 w-3.5 text-amber-700" />} />
        <Metric label="Completed" value={maintenance.counters.completed} icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />} />
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">Open Work Orders</h4>
        <WorkOrderList items={maintenance.open_work_orders} emptyText="No open work orders" />
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">Completed Work</h4>
        <WorkOrderList items={maintenance.completed_work} emptyText="No completed work records" />
      </div>
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <div className="flex items-center justify-center gap-1 text-slate-500">{icon}<span>{label}</span></div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function WorkOrderList({ items, emptyText }: { items: any[]; emptyText: string }) {
  if (!items.length) {
    return <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="mt-2 max-h-52 space-y-2 overflow-auto pr-1">
      {items.slice(0, 20).map((wo) => (
        <div key={String(wo.id)} className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{wo.work_order_number || wo.title || wo.id}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass(String(wo.status || ''))}`}>
              {String(wo.status || 'unknown')}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{wo.description || wo.work_type || '-'}</p>
        </div>
      ))}
    </div>
  );
}
