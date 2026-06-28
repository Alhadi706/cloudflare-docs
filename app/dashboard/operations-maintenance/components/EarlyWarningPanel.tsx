type EngineeringRiskLevel = 'آمن' | 'مراقبة' | 'حرج' | 'safe' | 'watch' | 'critical';

export interface EarlyWarningSignal {
  id: string;
  name: string;
  stationLabel: string;
  sector: string;
  score: number;
  etaHours: number;
  riskLevel: EngineeringRiskLevel;
  trigger: string;
}

function riskTone(riskLevel: EngineeringRiskLevel) {
  if (riskLevel === 'حرج' || riskLevel === 'critical') return 'border-rose-500/35 bg-rose-500/10 text-rose-100';
  if (riskLevel === 'مراقبة' || riskLevel === 'watch') return 'border-amber-500/35 bg-amber-500/10 text-amber-100';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
}

export function EarlyWarningPanel({ signals }: { signals: EarlyWarningSignal[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Early warning signals</p>
          <p className="text-xs text-slate-400">تنبيه مبكر مبني على اقتراب هامش + ضغط + ملاحظة الصيانة</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          phase 5
        </span>
      </div>

      {signals.length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          No active warnings above threshold.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {signals.map((signal) => (
            <div key={signal.id} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{signal.name}</p>
                  <p className="text-xs text-slate-400">{signal.stationLabel} · {signal.sector}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${riskTone(signal.riskLevel)}`}>
                  {signal.riskLevel}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Signal {signal.score.toFixed(0)}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">ETA {signal.etaHours}h</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{signal.trigger}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}