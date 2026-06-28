function InfoTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const tones = {
    default: 'border-white/10 bg-slate-950/60 text-slate-100',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
  } as const;

  return (
    <div className={`rounded-xl border p-2 ${tones[tone]}`}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function PressureMixPanel({
  points,
}: {
  points: { hydraulic_pressure_bar?: number; safety_margin_bar?: number; pipe_bar_grade_bar?: number }[];
}) {
  const n = points.length || 1;
  const avgPressure = points.reduce((s, p) => s + (p.hydraulic_pressure_bar ?? 0), 0) / n;
  const peakPressure = Math.max(...points.map((p) => p.hydraulic_pressure_bar ?? 0));
  const avgMargin = points.reduce((s, p) => s + (p.safety_margin_bar ?? 0), 0) / n;
  return (
    <div className="grid grid-cols-3 gap-3">
      <InfoTile label="متوسط الضغط" value={avgPressure.toFixed(2) + ' bar'} tone="default" />
      <InfoTile label="ذروة الضغط" value={peakPressure.toFixed(2) + ' bar'} tone="warning" />
      <InfoTile label="هامش الأمان" value={avgMargin.toFixed(2) + ' bar'} tone={avgMargin < 0.5 ? 'danger' : 'default'} />
    </div>
  );
}