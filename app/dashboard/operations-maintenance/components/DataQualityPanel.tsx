'use client';

import React from 'react';

export interface DataQualitySummary {
  totalRows: number;
  validRows: number;
  duplicatesRemoved: number;
  invalidStationRows: number;
  invalidInvertRows: number;
  placeholderTokens: number;
  uniqueSectors: number;
  qualityScore: number;
}

export interface RejectedRow {
  key: string;
  equipmentCode: string;
  station: string;
  reason: string;
}

function QualityBadge({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const tones = {
    default: 'border-white/10 bg-white/5 text-slate-100',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
  } as const;

  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function DataQualityPanel({ qualitySummary, rejectedRows }: { qualitySummary: DataQualitySummary; rejectedRows: RejectedRow[] }) {
  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QualityBadge label="Phase 1 quality" value={`${qualitySummary.qualityScore}%`} tone={qualitySummary.qualityScore < 80 ? 'warning' : 'default'} />
        <QualityBadge label="Valid rows" value={`${qualitySummary.validRows}/${qualitySummary.totalRows}`} />
        <QualityBadge label="Duplicates removed" value={qualitySummary.duplicatesRemoved.toString()} tone={qualitySummary.duplicatesRemoved > 0 ? 'warning' : 'default'} />
        <QualityBadge label="Invalid station" value={qualitySummary.invalidStationRows.toString()} tone={qualitySummary.invalidStationRows > 0 ? 'danger' : 'default'} />
        <QualityBadge label="Invalid invert" value={qualitySummary.invalidInvertRows.toString()} tone={qualitySummary.invalidInvertRows > 0 ? 'danger' : 'default'} />
        <QualityBadge label="Placeholder tokens" value={qualitySummary.placeholderTokens.toString()} tone={qualitySummary.placeholderTokens > 0 ? 'warning' : 'default'} />
        <QualityBadge label="Unique sectors" value={qualitySummary.uniqueSectors.toString()} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Rejected rows</p>
            <p className="text-xs text-slate-400">أول 10 صفوف تم استبعادها أثناء التنظيف، مع سبب الرفض</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
            phase 2
          </span>
        </div>
        {rejectedRows.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Equipment</th>
                  <th className="px-3 py-2 font-medium">Station</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-100">
                {rejectedRows.map((row) => (
                  <tr key={row.key} className="bg-slate-950/30">
                    <td className="px-3 py-2">{row.equipmentCode}</td>
                    <td className="px-3 py-2 text-slate-300">{row.station}</td>
                    <td className="px-3 py-2 text-rose-200">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">لا توجد صفوف مرفوضة في البيانات الحالية.</p>
        )}
      </div>
    </div>
  );
}