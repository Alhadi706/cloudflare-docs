'use client';

import React from 'react';

type VerticalTimelineViewProps = {
  events?: Array<Record<string, any>>;
  title?: string;
};

export function VerticalTimelineView({ events = [], title = 'الخط الزمني' }: VerticalTimelineViewProps) {
  const list = Array.isArray(events) ? events : [];
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      {list.length === 0 ? (
        <p className="text-xs text-slate-400">لا توجد أحداث متاحة حاليًا.</p>
      ) : (
        <div className="space-y-2">
          {list.slice(0, 20).map((e, i) => (
            <div key={i} className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              {String((e as any).title ?? (e as any).name ?? `Event ${i + 1}`)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
