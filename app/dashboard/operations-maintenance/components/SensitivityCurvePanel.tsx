import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface SensitivityPoint {
  deltaLabel: string;
  critical: number;
  watch: number;
  safe: number;
  risky: number;
}

export function SensitivityCurvePanel({ data }: { data: SensitivityPoint[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">Sensitivity curve</p>
          <p className="text-base text-slate-400">أثر تغير الضغط بمقدار 0.1 bar على توزيع المخاطر</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          decision chart
        </span>
      </div>

      <div className="mt-3 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="4 6" />
            <XAxis dataKey="deltaLabel" tick={{ fill: '#cbd5e1', fontSize: 13 }} />
            <YAxis tick={{ fill: '#cbd5e1', fontSize: 13 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="risky" name="Risky total" stroke="#f97316" strokeWidth={3.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="حرج" name="Critical" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="مراقبة" name="Watch" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="آمن" name="Safe" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}