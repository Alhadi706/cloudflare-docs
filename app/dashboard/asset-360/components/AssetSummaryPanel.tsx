import React from 'react';
import { Building2, Calendar, Hash, Layers, MapPin, Network, ShieldCheck } from 'lucide-react';

function valueOrDash(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '-';
}

function fmtDate(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return text;
  return dt.toLocaleString('en-GB');
}

export default function AssetSummaryPanel({
  asset,
  completionScore,
}: {
  asset: Record<string, any>;
  completionScore?: { score?: number; label?: string } | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-sky-700" />
          <h2 className="text-lg font-semibold text-slate-900">Asset Summary</h2>
        </div>
        {completionScore?.score != null && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Completion {completionScore.score}%
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem icon={<Hash className="h-4 w-4" />} label="Asset ID" value={valueOrDash(asset.id)} />
        <InfoItem icon={<Layers className="h-4 w-4" />} label="Type" value={valueOrDash(asset.asset_type)} />
        <InfoItem icon={<ShieldCheck className="h-4 w-4" />} label="Status" value={valueOrDash(asset.status || asset.handover_status)} />
        <InfoItem icon={<Network className="h-4 w-4" />} label="Classification" value={valueOrDash(asset.classification)} />
        <InfoItem icon={<MapPin className="h-4 w-4" />} label="Owner Department" value={valueOrDash(asset.owner_department)} />
        <InfoItem icon={<Calendar className="h-4 w-4" />} label="Created" value={fmtDate(asset.created_at)} />
      </div>

      {completionScore?.label && (
        <p className="mt-3 text-xs text-slate-500">Documentation label: {completionScore.label}</p>
      )}
    </section>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
