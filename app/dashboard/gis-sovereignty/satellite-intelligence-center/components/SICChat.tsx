'use client';
// ─── SICChat — Phase S11.2 ───────────────────────────────────────────────────
// Contextual intelligence assistant — fully grounded in the active report,
// AOI, selected years, comparison results, and simulation data.

import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Sparkles, AlertCircle,
} from 'lucide-react';
import type { AreaReport } from '@/lib/areaReportAPI';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  mapActionsCount?: number;
  metadata?: Record<string, any> | null;
}

export interface Props {
  areaReport?:        AreaReport | null;
  areaName?:          string | null;
  bbox?:              [number, number, number, number] | null;
  yearFrom?:          number | null;
  yearTo?:            number | null;
  // S11.2 — contextual data passed from right panel
  temporalNarrative?: string | null;   // Arabic temporal comparison result
  simulationNarrative?: string | null; // Arabic future simulation result
  simulationYear?:    number | null;
  activeMode?:        'report' | 'temporal' | 'simulation' | null;
}

// ─── Grounded system prompt builder ──────────────────────────────────────────

function buildSystemContext(p: Props): string {
  const lines: string[] = [];

  // Identity & ground rules
  lines.push(
    'أنت مستشار ذكاء اصطناعي متخصص في تحليل البيانات الجغرافية والفضائية لمدينة طرابلس وليبيا.',
    'دورك: مساعدة المسؤولين البلديين والمهندسين على فهم بيانات المنطقة واتخاذ قرارات مدروسة.',
    '',
    'قواعد الإجابة:',
    '- تحدث دائماً بالعربية الفصحى.',
    '- لا تستخدم مصطلحات تقنية مثل NDVI أو bbox أو API أو coordinates.',
    '- لا تخترع أرقاماً غير موجودة في السياق أدناه.',
    '- إجاباتك مباشرة وعملية. لا ضجيج ولا تمهيد طويل.',
    '- عندما تُلخّص، استخدم العناوين والنقاط المرقمة.',
    '- عندما تُوصي، اذكر الجهة المسؤولة والأولوية.',
    '- إذا سُئلت عن شيء غير موجود في البيانات، قل ذلك بصراحة.',
    '',
  );

  // Active mode label
  const modeLabel =
    p.activeMode === 'temporal'   ? 'مقارنة زمنية (تاريخية)' :
    p.activeMode === 'simulation' ? `توقع مستقبلي حتى ${p.simulationYear ?? ''}` :
    'تقرير المنطقة الحالية';
  lines.push(`الوضع الحالي للمنظومة: ${modeLabel}`, '');

  // Area identification
  if (p.areaName) lines.push(`اسم المنطقة المحفوظة: ${p.areaName}`);
  if (p.bbox) {
    const [minLon, minLat, maxLon, maxLat] = p.bbox;
    lines.push(
      `الموقع الجغرافي: من (${minLat.toFixed(3)}°ش، ${minLon.toFixed(3)}°ش) إلى (${maxLat.toFixed(3)}°ش، ${maxLon.toFixed(3)}°ش)`,
      '',
    );
  }

  // Full area report context
  if (p.areaReport) {
    const r = p.areaReport;
    const e = r.spatial_estimates;
    const env = r.environment_summary;
    const risk = r.risk_signals;

    lines.push(
      '═══ تقرير المنطقة الفضائي ═══',
      '',
      `الملخص: ${r.human_summary}`,
      '',
      '— الأرقام الرئيسية —',
      `• النطاق الإداري: ${e.zone_ar}`,
      `• المساحة: ${e.area_hectares >= 100 ? `${e.area_km2.toFixed(2)} كم²` : `${e.area_hectares.toFixed(1)} هكتار`}`,
      `• المباني: ~${e.buildings_count.toLocaleString('ar-LY')} مبنى (متوسط ${e.floors_avg.toFixed(0)} طوابق)`,
      `• السكان المُقدَّرون: ~${e.population_est.toLocaleString('ar-LY')} نسمة`,
      `• الأشجار: ~${e.trees_count.toLocaleString('ar-LY')} شجرة`,
      `• الطرق المعبّدة: ${e.road_km_paved.toFixed(1)} كم — غير معبّدة: ${e.road_km_unpaved.toFixed(1)} كم`,
      `• المرافق الحكومية: ${e.gov_facilities} مرفق`,
      '',
      '— البيئة —',
      `• الغطاء النباتي: ${env.vegetation_status}${env.vegetation_pct != null ? ` (${env.vegetation_pct.toFixed(0)}%)` : ''}`,
      `• درجة الحرارة السطحية: ${env.heat_level}${env.temp_mean_c != null ? ` (${env.temp_mean_c.toFixed(0)}°م)` : ''}`,
      `• حالة التربة والرطوبة: ${env.soil_moisture}`,
      `• مسطحات مائية: ${env.surface_water ? 'موجودة' : 'لا توجد'}`,
      `• مصدر البيانات: ${env.satellite_enriched ? 'أقمار صناعية + تقدير هندسي' : 'تقدير جغرافي إقليمي'}`,
      '',
      '— المخاطر —',
      `• خطر الفيضانات: ${risk.flood_risk}`,
      `• خطر الحرائق: ${risk.fire_risk}`,
      `• الإجهاد الحراري: ${risk.heat_stress}`,
      '',
    );

    if (r.recommendations.length > 0) {
      lines.push('— التوصيات —');
      r.recommendations.forEach((rec, i) => {
        const pri = rec.priority === 'high' ? '🔴 عاجل' : rec.priority === 'medium' ? '🟡 متوسط' : '🔵 للمعلومية';
        lines.push(`${i + 1}. [${pri}] ${rec.text}`);
        lines.push(`   الجهة: ${rec.department}`);
      });
      lines.push('');
    }

    lines.push(`الثقة في البيانات: ${r.meta.confidence}`, '');
  }

  // Temporal comparison context
  if (p.temporalNarrative && p.yearFrom && p.yearTo) {
    lines.push(
      `═══ المقارنة الزمنية: ${p.yearFrom} ← ${p.yearTo} ═══`,
      '',
      p.temporalNarrative,
      '',
    );
  }

  // Simulation context
  if (p.simulationNarrative && p.simulationYear) {
    lines.push(
      `═══ التوقع المستقبلي حتى ${p.simulationYear} ═══`,
      '⚠️ هذه توقعات — وليست بيانات فعلية. يجب التعامل معها كسيناريو تخطيطي.',
      '',
      p.simulationNarrative,
      '',
    );
  }

  return lines.join('\n');
}

// ─── Suggested questions (context-aware) ─────────────────────────────────────

function getSuggestions(p: Props): string[] {
  if (!p.areaReport) return [];

  const base = [
    'لخّص هذا التقرير في فقرة واحدة للمدير',
    'ما أهم المشاكل في هذه المنطقة وأولوياتها؟',
    'ما التوصيات العاجلة للبلدية؟',
  ];

  const env = p.areaReport.environment_summary;
  if (env.vegetation_status && env.vegetation_status.includes('منخفض')) {
    base.push('هل المنطقة تحتاج حملة تشجير؟ كيف تُنظَّم؟');
  }
  if (p.areaReport.risk_signals.flood_risk !== 'منخفض') {
    base.push('ما الإجراءات الوقائية من خطر الفيضانات؟');
  }
  if (p.temporalNarrative) {
    base.push(`ما أبرز التغييرات بين ${p.yearFrom} و${p.yearTo}؟`);
  }
  if (p.simulationNarrative) {
    base.push(`ما أبرز التحديات المتوقعة حتى ${p.simulationYear}؟`);
  }
  base.push('أي الجهات الحكومية المسؤولة عن هذه المنطقة؟');
  return base.slice(0, 5);
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? 'bg-blue-600/30' : 'bg-violet-600/30'
      }`}>
        {isUser
          ? <User size={12} className="text-blue-300" />
          : <Bot size={12} className="text-violet-300" />}
      </div>
      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
        isUser
          ? 'bg-blue-600/20 border border-blue-700/30 text-blue-100'
          : 'bg-slate-800/60 border border-slate-700/30 text-slate-200'
      }`}>
        {msg.content}
        {!isUser && (msg.mapActionsCount || 0) > 0 && (
          <div className="mt-2 text-[10px] text-cyan-300">map_actions: {msg.mapActionsCount}</div>
        )}
        {!isUser && msg.metadata && (
          <div className="mt-1 text-[10px] text-slate-400 break-all">
            metadata: {JSON.stringify(msg.metadata)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SICChat(props: Props) {
  const { areaReport, areaName, bbox, yearFrom, yearTo,
          temporalNarrative, simulationNarrative, simulationYear, activeMode } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat when area changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [areaReport?.report_id]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: q, ts: Date.now() }]);
    setInput('');
    setLoading(true);
    setError(null);

    const systemContext = buildSystemContext(props);

    try {
      const res = await fetch('/api/v1/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientTenantHeaders(),
        },
        body: JSON.stringify({
          question: q,
          language: 'ar',
          module: 'satellite_intelligence',
          context: {
            system_context: systemContext,
            user_role: 'tenant_admin',
            entity_type: 'satellite_area',
            ...(bbox ? { lon: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 } : {}),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        setError(`AI_REQUEST_FAILED: ${res.status} ${err}`);
        return;
      }

      const data = await res.json();
      const answer = data.response ?? data.answer;
      if (!answer) {
        setError('AI_EMPTY_RESPONSE');
        return;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        ts: Date.now(),
        mapActionsCount: Array.isArray(data.map_actions) ? data.map_actions.length : 0,
        metadata: data.metadata ?? null,
      }]);
    } catch (e: any) {
      setError(`AI_CONNECTION_ERROR: ${e?.message || 'unknown_error'}`);
    } finally {
      setLoading(false);
    }
  };

  const hasArea = !!areaReport;
  const suggestions = getSuggestions(props);

  // Context badge
  const contextLabel =
    simulationNarrative ? `توقع ${simulationYear}` :
    temporalNarrative   ? `${yearFrom} – ${yearTo}` :
    hasArea             ? areaName ?? 'تقرير نشط' : null;

  return (
    <div className="flex flex-col h-full min-h-[420px]" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 shrink-0">
        <Sparkles size={12} className="text-violet-400" />
        <span className="text-xs font-bold text-slate-300">المساعد الذكي</span>
        {contextLabel && (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 mr-auto">
            {contextLabel}
          </span>
        )}
        {loading && (
          <span className="text-[9px] text-violet-400 animate-pulse ml-1">يفكر…</span>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {messages.length === 0 && (
          <div className="py-4 text-center">
            <Bot size={26} className="text-slate-700 mx-auto mb-2" />
            {!hasArea ? (
              <div className="flex items-center gap-1.5 justify-center px-3 py-2 rounded-xl bg-amber-950/20 border border-amber-800/30 mx-2">
                <AlertCircle size={12} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300/80">ارسم منطقة على الخريطة أولاً ثم اسأل</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-500 mb-3">
                  المساعد مُطّلع على بيانات المنطقة — اسأل ما تريد
                </p>
                <div className="flex flex-col gap-1.5 px-1">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={loading}
                      className="w-full text-right text-[11px] px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/30 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((m, i) => <Bubble key={i} msg={m} />)}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600/30 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-violet-300" />
            </div>
            <div className="bg-slate-800/60 border border-slate-700/30 rounded-xl px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      <div className="border-t border-slate-800/60 p-2.5 shrink-0">
        <form
          onSubmit={e => { e.preventDefault(); send(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || !hasArea}
            placeholder={hasArea ? 'اكتب سؤالك…' : 'ارسم منطقة أولاً'}
            className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !hasArea}
            className="w-7 h-7 rounded-xl bg-violet-600/80 hover:bg-violet-600 disabled:opacity-30 flex items-center justify-center transition-colors"
          >
            <Send size={13} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
