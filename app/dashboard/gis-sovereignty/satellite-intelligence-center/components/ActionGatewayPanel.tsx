'use client';
// ─── ActionGatewayPanel ───────────────────────────────────────────────────────
// Tab 1 panel — the "what do you want to do?" gateway.
// Shows a brief situation paragraph and clear action paths to downstream functions.
// This communicates that the center is a gateway, not the final analysis workstation.

import React from 'react';
import Link from 'next/link';
import {
  GitCompare,
  Download,
  Layers,
  Compass,
  ExternalLink,
  Info,
  ArrowLeft,
} from 'lucide-react';
import type { SceneSummaryContract } from '@/lib/satelliteIntelAPI';

interface Props {
  summary: SceneSummaryContract | null;
  sceneUid: string | null;
  onNavigate: (tab: 'compare' | 'technical' | 'export') => void;
}

// ─── Gateway action definitions ───────────────────────────────────────────────

interface GwAction {
  id: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  color: string;
  bg: string;
  href?: string;
  tab?: 'compare' | 'technical' | 'export';
  requiresScene?: boolean;
}

const GW_ACTIONS: GwAction[] = [
  {
    id: 'compare',
    icon: GitCompare,
    title: 'مقارنة مشهدين',
    description: 'قارن المنطقة بين تاريخين لرصد التغيرات',
    color: 'text-purple-400',
    bg: 'bg-purple-950/20 border-purple-700/40 hover:border-purple-600/60',
    tab: 'compare',
    requiresScene: true,
  },
  {
    id: 'engineering',
    icon: Compass,
    title: 'مساحة العمل الهندسية',
    description: 'افتح المنطقة في بيئة التحرير والتحليل المتقدم',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/20 border-emerald-700/40 hover:border-emerald-600/60',
    href: '/dashboard/gis-sovereignty/engineering-workspace',
  },
  {
    id: 'export',
    icon: Download,
    title: 'تصدير التقرير',
    description: 'نزّل الملخص التحليلي أو عقد المقارنة بصيغة JSON',
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/20 border-cyan-700/40 hover:border-cyan-600/60',
    tab: 'export',
    requiresScene: true,
  },
  {
    id: 'technical',
    icon: Layers,
    title: 'التقرير التقني',
    description: 'مؤشرات طيفية، قيم الثقة، والتفاصيل التقنية الكاملة',
    color: 'text-slate-400',
    bg: 'bg-slate-800/30 border-slate-600/30 hover:border-slate-500/50',
    tab: 'technical',
    requiresScene: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActionGatewayPanel({ summary, sceneUid, onNavigate }: Props) {
  const hasResult = !!summary;

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-4">

      {/* ── Situation paragraph ──────────────────────────────────────────── */}
      {hasResult ? (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-300 mb-1.5">الوضع الميداني</p>
          <p className="text-xs text-slate-400 leading-relaxed">{summary!.summary_text}</p>
        </div>
      ) : (
        <div className="bg-slate-800/20 border border-slate-700/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <p className="text-[11px] font-semibold text-slate-400">لا يوجد تحليل حالياً</p>
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed">
            اختر مشهداً ونوع التحليل من شريط التحكم أعلاه ثم اضغط «تشغيل التحليل»
          </p>
        </div>
      )}

      {/* ── Gateway context label ────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-2">
          الخطوات التالية — ماذا تريد أن تفعل؟
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {GW_ACTIONS.map(action => {
            const IconComp = action.icon;
            const disabled = !!(action.requiresScene && !sceneUid);

            const card = (
              <div
                className={`rounded-xl border p-3 flex flex-col gap-1.5 transition-all h-full ${action.bg} ${
                  disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between">
                  <IconComp className={`w-4 h-4 ${action.color} shrink-0`} />
                  {action.href && (
                    <ExternalLink className="w-3 h-3 text-slate-600 opacity-60 shrink-0" />
                  )}
                  {action.tab && !disabled && !action.href && (
                    <ArrowLeft className="w-3 h-3 text-slate-600 opacity-50 shrink-0" />
                  )}
                </div>
                <p className={`text-[11px] font-semibold text-slate-200`}>{action.title}</p>
                <p className="text-[9px] text-slate-500 leading-snug">{action.description}</p>
              </div>
            );

            if (action.href && !disabled) {
              return (
                <Link key={action.id} href={action.href} className="block">
                  {card}
                </Link>
              );
            }

            return (
              <button
                key={action.id}
                disabled={disabled}
                className="text-right"
                onClick={() => {
                  if (action.tab) onNavigate(action.tab);
                }}
              >
                {card}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Gateway context note ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700/15 bg-slate-800/10 px-4 py-3">
        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wide mb-1">
          الدور التشغيلي لهذا المركز
        </p>
        <p className="text-[9px] text-slate-600 leading-relaxed">
          هذا المركز نقطة استعراض وتوجيه — التحليل المتخصص يتم في الوحدات الهندسية
          والتخطيطية والطارئة التي تستهلك هذه الإشارات مباشرة.
        </p>
      </div>

      {/* ── Coming soon ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700/15 bg-slate-800/5 px-4 py-3">
        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wide mb-1">قريباً</p>
        <p className="text-[9px] text-slate-700 leading-relaxed">
          إرسال التحليل مباشرة إلى الأقسام المختصة (الصيانة · التخطيط · الطوارئ · المساحة)
        </p>
      </div>
    </div>
  );
}
