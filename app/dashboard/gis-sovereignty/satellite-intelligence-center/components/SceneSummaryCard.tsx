'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Satellite, Shield, AlertTriangle, Info } from 'lucide-react';
import type { SceneSummaryContract } from '@/lib/satelliteIntelAPI';
import ConfidenceBadge from './ConfidenceBadge';
import SemanticLevelBadge from './SemanticLevelBadge';
import ValidityVerdictBadge from './ValidityVerdictBadge';

const INDICATOR_LABELS: Record<string, string> = {
  ndvi: 'NDVI', ndwi: 'NDWI', mndwi: 'MNDWI', nbr: 'NBR',
  ndbi: 'NDBI', savi: 'SAVI', evi: 'EVI', bai: 'BAI', bsi: 'BSI', dnbr: 'dNBR',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  none: 'text-slate-400',
  low: 'text-emerald-400',
  moderate: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
  suppressed: 'text-slate-500',
};

interface Props {
  summary: SceneSummaryContract;
  compact?: boolean;
}

export default function SceneSummaryCard({ summary, compact = false }: Props) {
  const [expanded, setExpanded] = useState(!compact);
  const { quality, provenance, indicators, intelligence_outputs, limitations } = summary;

  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Satellite className={`w-4 h-4 shrink-0 ${provenance.data_is_real ? 'text-blue-400' : 'text-amber-400'}`} />
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-slate-200 truncate max-w-[260px]" title={summary.scene_uid}>
              {summary.scene_uid}
            </p>
            <p className="text-[10px] text-slate-500">
              {provenance.acquisition_date} · {provenance.data_is_real ? 'COG حقيقي' : 'محاكاة'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge value={quality.confidence_class} />
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-800/60">
          {/* Quality Block */}
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-300">جودة المشهد</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <ConfidenceBadge value={quality.confidence_class} size="md" />
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                quality.operational_grade === 'operational'
                  ? 'bg-blue-950/50 text-blue-300 border-blue-700/40'
                  : quality.operational_grade === 'advisory'
                  ? 'bg-amber-950/50 text-amber-300 border-amber-700/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/40'
              }`}>
                {quality.operational_grade === 'operational' ? 'تشغيلي' :
                 quality.operational_grade === 'advisory' ? 'استشاري' : 'مرجعي فقط'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-mono bg-slate-800/50 text-slate-400 border-slate-700/40">
                {(quality.quality_score * 100).toFixed(0)}% جودة
              </span>
            </div>
            {quality.limitations.length > 0 && (
              <div className="flex items-start gap-1.5 bg-amber-950/20 border border-amber-800/30 rounded-lg p-2 mt-1">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300/80 leading-tight">{quality.limitations[0]}</p>
              </div>
            )}
          </div>

          {/* Indicators Grid */}
          {indicators.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-300 mb-2">المؤشرات الطيفية</p>
              <div className="grid grid-cols-2 gap-1.5">
                {indicators.map(ind => (
                  <div key={ind.indicator_type} className={`bg-slate-800/40 rounded-lg p-2 border ${
                    ind.validity.verdict === 'suppressed'
                      ? 'border-slate-700/30 opacity-50'
                      : 'border-slate-700/50'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-slate-200">
                        {INDICATOR_LABELS[ind.indicator_type] ?? ind.indicator_type.toUpperCase()}
                      </span>
                      <ValidityVerdictBadge value={ind.validity.verdict} showIcon={false} />
                    </div>
                    <p className="text-sm font-mono font-bold text-white">
                      {ind.validity.verdict === 'suppressed' ? '—' : ind.mean.toFixed(3)}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate">{ind.interpretation.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intelligence Outputs */}
          {intelligence_outputs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-300 mb-2">مخرجات الاستخبارات</p>
              <div className="space-y-2">
                {intelligence_outputs.map(out => (
                  <div key={out.output_type} className={`rounded-lg border p-2.5 ${
                    out.validity.verdict === 'suppressed'
                      ? 'bg-slate-800/20 border-slate-700/30 opacity-50'
                      : 'bg-slate-800/40 border-slate-700/50'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-200 capitalize">
                        {out.output_type.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <SemanticLevelBadge value={out.semantic_level} />
                        <ValidityVerdictBadge value={out.validity.verdict} showIcon={false} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">التصنيف:</span>
                      <span className={`text-[10px] font-mono font-bold ${CLASSIFICATION_COLORS[out.effective_classification] ?? 'text-slate-300'}`}>
                        {out.effective_classification}
                      </span>
                      {out.raw_classification !== out.effective_classification && (
                        <span className="text-[9px] text-slate-500 line-through">{out.raw_classification}</span>
                      )}
                    </div>
                    {!compact && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-slate-500 leading-tight line-clamp-2">{out.use_guidance}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Global Limitations */}
          {limitations && limitations.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-2.5">
              <p className="text-[10px] font-semibold text-slate-400 mb-1">قيود الاستخدام</p>
              <ul className="space-y-0.5">
                {limitations.map((lim, i) => (
                  <li key={i} className="text-[9px] text-slate-500 leading-tight">• {lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
