import React from 'react';
import { Clock3 } from 'lucide-react';

function colorFor(kind: string): string {
  switch (kind) {
    case 'asset':
      return 'bg-sky-500';
    case 'relationship':
      return 'bg-fuchsia-500';
    case 'document':
    case 'photo':
      return 'bg-indigo-500';
    case 'work_order':
    case 'maintenance':
      return 'bg-amber-500';
    case 'governance':
      return 'bg-violet-500';
    default:
      return 'bg-slate-500';
  }
}

export default function OperationalTimeline({
  events,
}: {
  events: any[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-slate-700" />
        <h3 className="text-base font-semibold text-slate-900">Operational Timeline</h3>
      </div>

      {!events.length ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No timeline events available.</p>
      ) : (
        <ol className="mt-4 max-h-[28rem] space-y-3 overflow-auto pr-1">
          {events.slice(0, 80).map((event) => (
            <li key={String(event.id)} className="relative rounded-lg border border-slate-200 px-3 py-2">
              <span className={`absolute left-2 top-3 h-2.5 w-2.5 rounded-full ${colorFor(String(event.kind || ''))}`} />
              <div className="pl-4">
                <p className="text-sm font-semibold text-slate-900">{event.title || event.id}</p>
                <p className="text-xs text-slate-500">{event.subtitle || '-'}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>{String(event.kind || 'event')}</span>
                  <span>{String(event.status || '-')}</span>
                  <span>{String(event.at || '-')}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
