'use client';

import React from 'react';

export interface PriorityCandidate {
  id: string;
  name: string;
  stationLabel: string;
  sector: string;
  score: number;
  riskLabel: 'safe' | 'watch' | 'critical';
  reasons: string[];
}

function scoreTone(score: number) {
  if (score >= 80) return 'border-rose-500/25 bg-rose-500/10 text-rose-100';
  if (score >= 60) return 'border-amber-500/25 bg-amber-500/10 text-amber-100';
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100';
}

export function PriorityEnginePanel({
  candidates,
  dqPenalty,
}: {
  candidates: PriorityCandidate[];
  dqPenalty: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Decision-grade priority engine</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            يرتب أوامر التدخل تلقائيًا حسب الخطر، مع عقوبة جودة بيانات ثابتة قبل إصدار القرار.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
          phase 4
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
        <p className="font-semibold text-white">Scoring rule</p>
        <p className="mt-2 leading-6">
          Priority Score = 0.35 × margin pressure + 0.25 × risk severity + 0.20 × maintenance state + 0.20 × sector stress
        </p>
        <p className="mt-2 text-xs text-slate-400">DQ penalty applied: {dqPenalty.toFixed(1)} points</p>
      </div>

      <div className="mt-4 space-y-2">
        {candidates.length > 0 ? (
          candidates.map((candidate) => (
            <div key={candidate.id} className={`rounded-xl border p-3 ${scoreTone(candidate.score)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{candidate.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{candidate.stationLabel} · {candidate.sector}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{candidate.score.toFixed(1)}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">{candidate.riskLabel}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-100">
                {candidate.reasons.map((reason) => (
                  <span key={reason} className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-1">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">لا توجد مرشحات كافية لحساب الأولوية.</p>
        )}
      </div>
    </div>
  );
}
