/**
 * AssetSummaryPanel — Phase 9: Full Asset 360 Summary
 * Dark theme, Arabic labels, comprehensive data display
 */
import React from 'react';
import { Building2, Calendar, Hash, Layers, MapPin, Network, ShieldCheck, Activity, DollarSign, Wrench, Tag, GitBranch, User } from 'lucide-react';
import Link from 'next/link';

function valueOrDash(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '—';
}

function fmtDate(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  try {
    const dt = new Date(text);
    if (Number.isNaN(dt.getTime())) return text;
    return dt.toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return text; }
}

function fmtCurrency(value: unknown): string {
  const n = parseFloat(String(value ?? ''));
  if (isNaN(n)) return '—';
  return n.toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 });
}

const ASSET_CLASS_LABELS: Record<string, { label: string; color: string }> = {
  site_asset:     { label: 'أصل موقعي', color: 'text-cyan-400 bg-cyan-500/10' },
  compound:       { label: 'مجمع (أصل رئيسي)', color: 'text-violet-400 bg-violet-500/10' },
  linear:         { label: 'أصل خطي (أنبوب/طريق)', color: 'text-emerald-400 bg-emerald-500/10' },
  component_slot: { label: 'فتحة مكوّن', color: 'text-amber-400 bg-amber-500/10' },
  vehicle:        { label: 'مركبة/معدة', color: 'text-blue-400 bg-blue-500/10' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:          { label: 'نشط ✓', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
  inactive:        { label: 'غير نشط', color: 'text-slate-400 bg-slate-700/50 border-slate-600' },
  maintenance:     { label: 'قيد الصيانة', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  decommissioned:  { label: 'خارج الخدمة', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  under_review:    { label: 'قيد المراجعة', color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' },
};

export default function AssetSummaryPanel({
  asset,
  completionScore,
}: {
  asset: Record<string, any>;
  completionScore?: { score?: number; label?: string } | null;
}) {
  const assetClass  = ASSET_CLASS_LABELS[asset.asset_class || asset.classification] || null;
  const statusCfg   = STATUS_CONFIG[asset.status || asset.handover_status || 'active'];
  const healthScore = parseInt(String(asset.health_score ?? asset.condition_score ?? 100));
  const healthColor = healthScore >= 80 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <section className="space-y-4" dir="rtl">

      {/* Top row — status + class */}
      <div className="flex items-center gap-3 flex-wrap">
        {statusCfg && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        )}
        {assetClass && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${assetClass.color}`}>
            {assetClass.label}
          </span>
        )}
        {completionScore?.score != null && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 mr-auto">
            اكتمال التوثيق: {completionScore.score}%
          </span>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard icon={<Hash className="h-4 w-4 text-slate-400"/>} label="معرّف الأصل" value={valueOrDash(asset.id || asset.asset_id)} mono />
        <InfoCard icon={<Building2 className="h-4 w-4 text-slate-400"/>} label="اسم الأصل" value={valueOrDash(asset.asset_name || asset.name)} />
        <InfoCard icon={<Tag className="h-4 w-4 text-slate-400"/>} label="نوع الأصل" value={valueOrDash(asset.asset_type)} />
        <InfoCard icon={<MapPin className="h-4 w-4 text-slate-400"/>} label="الإدارة المالكة" value={valueOrDash(asset.owner_department || asset.department_owner)} />
        <InfoCard icon={<Network className="h-4 w-4 text-slate-400"/>} label="الموقع / الموقع" value={valueOrDash(asset.site_name || asset.location || asset.site_id)} />
        <InfoCard icon={<Calendar className="h-4 w-4 text-slate-400"/>} label="تاريخ التشغيل" value={fmtDate(asset.installation_date || asset.acquisition_date || asset.created_at)} />

        {/* Health Score */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
            <Activity className="h-4 w-4"/>درجة الصحة
          </div>
          <div className={`text-2xl font-bold ${healthColor}`}>
            {isNaN(healthScore) ? '—' : `${healthScore}%`}
          </div>
        </div>

        {/* Parent Asset */}
        {(asset.parent_asset_id || asset.parent_asset_name) && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
              <GitBranch className="h-4 w-4"/>الأصل الرئيسي
            </div>
            <Link href={`/dashboard/admin-gateway/assets/${asset.parent_asset_id}`}
              className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 truncate block">
              {asset.parent_asset_name || asset.parent_asset_id}
            </Link>
          </div>
        )}

        {/* Acquisition Value */}
        {(asset.acquisition_value || asset.purchase_value) && (
          <InfoCard icon={<DollarSign className="h-4 w-4 text-slate-400"/>} label="قيمة الاقتناء"
            value={fmtCurrency(asset.acquisition_value || asset.purchase_value)} />
        )}

        {/* Responsible person */}
        {asset.responsible_person && (
          <InfoCard icon={<User className="h-4 w-4 text-slate-400"/>} label="المسؤول" value={valueOrDash(asset.responsible_person)} />
        )}

        {/* Component slot name */}
        {asset.component_slot_name && (
          <InfoCard icon={<Wrench className="h-4 w-4 text-amber-400"/>} label="اسم الفتحة" value={valueOrDash(asset.component_slot_name)} />
        )}
      </div>

      {/* Description */}
      {asset.description && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">الوصف</p>
          <p className="text-sm text-slate-300">{asset.description}</p>
        </div>
      )}

      {completionScore?.label && (
        <p className="text-xs text-slate-600">توثيق: {completionScore.label}</p>
      )}
    </section>
  );
}

function InfoCard({ icon, label, value, mono = false }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">{icon}<span>{label}</span></div>
      <div className={`text-sm font-semibold text-slate-200 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
