type EngineeringRiskLevel = 'آمن' | 'مراقبة' | 'حرج' | 'safe' | 'watch' | 'critical';

export interface WhatIfImpact {
  id: string;
  name: string;
  stationLabel: string;
  sector: string;
  currentMarginBar: number;
  projectedMarginBar: number;
  currentRisk: EngineeringRiskLevel;
  projectedRisk: EngineeringRiskLevel;
}

function riskClass(risk: EngineeringRiskLevel) {
  if (risk === 'حرج' || risk === 'critical') return 'border-rose-500/35 bg-rose-500/10 text-rose-100';
  if (risk === 'مراقبة' || risk === 'watch') return 'border-amber-500/35 bg-amber-500/10 text-amber-100';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
}

function formatBar(value: number) {
  return `${value.toFixed(2)} bar`;
}

export function WhatIfScenarioPanel({
  title,
  impacts,
}: {
  title: string;
  impacts: WhatIfImpact[];
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">What-if scenario</p>
          <p className="text-xs text-slate-400">{title}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          phase 6
        </span>
      </div>

      {impacts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          No high-risk نقاط to simulate.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {impacts.map((impact) => (
            <div key={impact.id} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{impact.name}</p>
                  <p className="text-xs text-slate-400">{impact.stationLabel} · {impact.sector}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={`rounded-full border px-2 py-1 font-semibold uppercase ${riskClass(impact.currentRisk)}`}>
                    {impact.currentRisk}
                  </span>
                  <span className="text-slate-400">to</span>
                  <span className={`rounded-full border px-2 py-1 font-semibold uppercase ${riskClass(impact.projectedRisk)}`}>
                    {impact.projectedRisk}
                  </span>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                  Current margin: <span className="font-semibold text-white">{formatBar(impact.currentMarginBar)}</span>
                </div>
                <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                  Projected margin: <span className="font-semibold">{formatBar(impact.projectedMarginBar)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}