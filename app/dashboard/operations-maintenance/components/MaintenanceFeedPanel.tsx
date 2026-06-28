import { EarlyWarningPanel, type EarlyWarningSignal } from './EarlyWarningPanel';
import { PriorityEnginePanel, type PriorityCandidate } from './PriorityEnginePanel';
import { SensitivityCurvePanel, type SensitivityPoint } from './SensitivityCurvePanel';
import { WhatIfScenarioPanel, type WhatIfImpact } from './WhatIfScenarioPanel';

type MaintenanceState = 'stable' | 'planned' | 'attention';

export interface TopStressedSector {
  sector: string;
  critical: number;
  watch: number;
  avgPressure: number;
  minMargin: number;
}

export interface MaintenanceFeedItem {
  id: string;
  name: string;
  stationLabel: string;
  sector: string;
  maintenanceState: MaintenanceState;
  note: string;
}

export interface PriorityAbComparison {
  baselineVersion: string;
  candidateVersion: string;
  baselineMean: number;
  candidateMean: number;
  meanDelta: number;
  overlapTop4: number;
  improvedCount: number;
}

function formatBar(value?: number) {
  return `${(value ?? 0).toFixed(2)} bar`;
}

function StatusChip({ state }: { state: MaintenanceState }) {
  const labels = {
    stable: 'مستقر',
    planned: 'مخطط',
    attention: 'انتباه',
  } as const;

  const styles = {
    stable: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
    planned: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
    attention: 'border-rose-500/25 bg-rose-500/10 text-rose-100',
  } as const;

  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${styles[state]}`}>{labels[state]}</span>;
}

export function MaintenanceFeedPanel({
  priorityCandidates,
  dqPenalty,
  earlyWarningSignals,
  whatIfTitle,
  whatIfImpacts,
  sensitivityCurve,
  modelVersion,
  priorityAbComparison,
  topStressedSectors,
  maintenanceFeed,
}: {
  priorityCandidates: PriorityCandidate[];
  dqPenalty: number;
  earlyWarningSignals: EarlyWarningSignal[];
  whatIfTitle: string;
  whatIfImpacts: WhatIfImpact[];
  sensitivityCurve: SensitivityPoint[];
  modelVersion: string;
  priorityAbComparison: PriorityAbComparison;
  topStressedSectors: TopStressedSector[];
  maintenanceFeed: MaintenanceFeedItem[];
}) {
  return (
    <>
      <PriorityEnginePanel candidates={priorityCandidates} dqPenalty={dqPenalty} />
      <EarlyWarningPanel signals={earlyWarningSignals} />
      <WhatIfScenarioPanel title={whatIfTitle} impacts={whatIfImpacts} />
      <SensitivityCurvePanel data={sensitivityCurve} />
      <div className="mt-3 flex justify-end">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          model {modelVersion}
        </span>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Priority A/B comparison</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {priorityAbComparison.baselineVersion} to {priorityAbComparison.candidateVersion}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/55 px-2 py-2 text-slate-300">
            Avg top-4 ({priorityAbComparison.baselineVersion}): <span className="font-semibold text-white">{priorityAbComparison.baselineMean.toFixed(1)}</span>
          </div>
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-2 py-2 text-cyan-100">
            Avg top-4 ({priorityAbComparison.candidateVersion}): <span className="font-semibold">{priorityAbComparison.candidateMean.toFixed(1)}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/55 px-2 py-2 text-slate-300">
            Delta: <span className="font-semibold text-white">{priorityAbComparison.meanDelta >= 0 ? '+' : ''}{priorityAbComparison.meanDelta.toFixed(1)}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/55 px-2 py-2 text-slate-300">
            Top-4 overlap: <span className="font-semibold text-white">{priorityAbComparison.overlapTop4}/4</span> · Improved assets: <span className="font-semibold text-white">{priorityAbComparison.improvedCount}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Top stressed sectors</p>
            <p className="text-xs text-slate-400">أقوى 3 قطاعات من حيث عدد النقاط الحرجة وأدنى margin</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            phase 3
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {topStressedSectors.map((sector, index) => (
            <div key={sector.sector} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-white">{index + 1}. {sector.sector}</p>
                <p className="text-xs text-slate-400">Critical {sector.critical} · Watch {sector.watch} · Avg {formatBar(sector.avgPressure)}</p>
              </div>
              <p className="text-sm font-semibold text-amber-100">{formatBar(sector.minMargin)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {maintenanceFeed.slice(0, 5).map((point) => (
          <div key={point.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{point.name}</p>
                <p className="mt-1 text-xs text-slate-400">{point.stationLabel} · {point.sector}</p>
              </div>
              <StatusChip state={point.maintenanceState} />
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-300">{point.note}</p>
          </div>
        ))}
      </div>
    </>
  );
}