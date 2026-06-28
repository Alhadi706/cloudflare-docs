export interface EngineeringWatchlistItem {
  id: string;
  name: string;
  stationLabel: string;
  equipmentCode: string;
  riskLevel: 'آمن' | 'مراقبة' | 'حرج' | 'safe' | 'watch' | 'critical';
  panelClass: string;
  badgeClass: string;
  pressureLabel: string;
  marginLabel: string;
  note: string;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function EngineeringWatchlistPanel({
  items,
  onSelect,
}: {
  items: EngineeringWatchlistItem[];
  onSelect: (assetId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((point) => (
        <button
          key={point.id}
          onClick={() => onSelect(point.id)}
          className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${point.panelClass}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{point.name}</p>
              <p className="mt-1 text-xs text-slate-300">{point.stationLabel} · {point.equipmentCode}</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${point.badgeClass}`}>
              {point.riskLevel}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <InfoTile label="Pressure" value={point.pressureLabel} />
            <InfoTile label="Margin" value={point.marginLabel} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-300">{point.note}</p>
        </button>
      ))}
    </div>
  );
}