'use client';
import React from 'react';
import {
  FileText, Download, CheckCircle, AlertTriangle, Shield,
  Printer, BookOpen, BarChart3, AlertCircle, ClipboardList,
  PenLine, Wrench, Info,
} from 'lucide-react';
import { CpAnalysis, CpEngineeringReport, CpFixedSegment } from '../types';
import { CP_STATUS_CONFIG, OVERALL_STATUS_CONFIG } from '../constants';

// ─── ISO 31000 Risk Matrix helpers ───────────────────────────────────────────

const RISK_CONSEQUENCE_LABELS = ['هامشي', 'طفيف', 'معتدل', 'رئيسي', 'كارثي'] as const;
const RISK_PROBABILITY_LABELS = ['نادر', 'بعيد', 'ممكن', 'محتمل', 'شبه مؤكد'] as const;

function getRiskColor(p: number, c: number): string {
  const score = p * c;
  if (score >= 15) return 'bg-red-600 text-white';
  if (score >= 8)  return 'bg-orange-500 text-white';
  if (score >= 4)  return 'bg-amber-400 text-slate-900';
  return 'bg-emerald-600 text-white';
}

function deriveRiskPosition(analysis: CpAnalysis): { p: number; c: number } {
  const notProt = analysis.compliance_summary?.not_protected_pct ?? analysis.stats.not_protected_pct ?? 0;
  const zones   = analysis.stats.critical_zones ?? 0;
  // Consequence: based on % unprotected pipeline
  const c = notProt >= 60 ? 5 : notProt >= 35 ? 4 : notProt >= 15 ? 3 : notProt >= 5 ? 2 : 1;
  // Probability: based on critical zone count
  const p = zones >= 10 ? 5 : zones >= 6 ? 4 : zones >= 3 ? 3 : zones >= 1 ? 2 : 1;
  return { p, c };
}

// ─── Recommendation generation ───────────────────────────────────────────────

interface RecommendationRow {
  priority:    'فوري' | 'عاجل' | 'مخطط' | 'دوري';
  action:      string;
  timeline:    string;
  standard:    string;
  color:       string;
  responsible: string;
  followUp:    string;
}

function buildRecommendations(analysis: CpAnalysis): RecommendationRow[] {
  const recs: RecommendationRow[] = [];
  const notProt = analysis.compliance_summary?.not_protected_pct ?? analysis.stats.not_protected_pct ?? 0;
  const marginal = analysis.compliance_summary?.marginal_pct ?? analysis.stats.marginal_pct ?? 0;
  const zones   = analysis.stats.critical_zones ?? 0;
  const anomalies = analysis.data_quality?.anomaly_count ?? 0;

  if (notProt > 0) {
    recs.push({
      priority:    zones >= 3 ? 'فوري' : 'عاجل',
      action:      `إجراء مسح مفصّل للمقاطع غير المحمية (${notProt.toFixed(1)}٪ من الخط) والتحقق من مصادر الحماية الكاثودية`,
      timeline:    zones >= 3 ? 'خلال 7 أيام' : 'خلال 30 يوماً',
      standard:    'NACE SP0169 §6.2',
      color:       'text-red-400',
      responsible: 'مهندس الحماية الكاثودية',
      followUp:    zones >= 3 ? 'أسبوع واحد' : '30 يوماً',
    });
  }
  if (marginal > 10) {
    recs.push({
      priority:    'عاجل',
      action:      `مراجعة إعدادات محولات الحماية الكاثودية لرفع جهد الحماية في المناطق الهامشية (${marginal.toFixed(1)}٪)`,
      timeline:    'خلال 14 يوماً',
      standard:    'ISO 15589-1 §8.3',
      color:       'text-amber-400',
      responsible: 'مشرف أنظمة TRU',
      followUp:    '14 يوماً',
    });
  }
  if (anomalies > 0) {
    recs.push({
      priority:    'مخطط',
      action:      `مراجعة ${anomalies} قيمة شاذة في قياسات الجهد وإعادة المسح عند نقاط الشذوذ للتحقق من دقة البيانات`,
      timeline:    'خلال 60 يوماً',
      standard:    'NACE SP0207 §4.1',
      color:       'text-sky-400',
      responsible: 'فريق بيانات المسح',
      followUp:    '60 يوماً',
    });
  }
  recs.push({
    priority:    'دوري',
    action:      'إجراء مسح CP سنوي شامل لجميع مسارات الأنابيب وتحديث سجلات الحماية الكاثودية',
    timeline:    'سنوياً',
    responsible: 'قسم النزاهة الهيكلية',
    followUp:    'سنوي — ربع أول',
    standard:    'ASME B31.8 §862.214',
    color:       'text-slate-400',
  });
  recs.push({
    priority:    'دوري',
    action:      'فحص حالة الطلاء الواقي وإصلاح نقاط الكشف خلال جولات الصيانة الوقائية',
    timeline:    'نصف سنوي',
    standard:    'ISO 15589-1 §9.2',
    color:       'text-slate-400',
    responsible: 'فريق الصيانة الوقائية',
    followUp:    'كل 6 أشهر',
  });
  return recs;
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function calcStats(values: number[]) {
  if (!values.length) return { mean: null, min: null, max: null, stddev: null };
  const mean   = values.reduce((a, b) => a + b, 0) / values.length;
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return { mean, min, max, stddev };
}

// ─── Printable HTML builder ───────────────────────────────────────────────────

function buildReportPrintHtml(
  report: CpEngineeringReport,
  analysis: CpAnalysis,
  cfg: { label: string; bg: string; text: string; icon: string },
  recs: RecommendationRow[],
): string {
  const hc = analysis.overall_status === 'SAFE' ? '#059669'
           : analysis.overall_status === 'AT_RISK' ? '#d97706' : '#dc2626';

  const potentials = (analysis.chart_data ?? [])
    .map(d => d.natural_potential).filter((v): v is number => v != null);
  const ps = calcStats(potentials);

  const segRows = report.worst_segments.map(s =>
    `<tr>
      <td class="mono">${s.start_distance}–${s.end_distance}</td>
      <td><span class="b-${s.classification === 'NOT_PROTECTED' ? 'r' : s.classification === 'MARGINAL' ? 'a' : 'g'}">${s.classification === 'NOT_PROTECTED' ? 'غير محمية' : s.classification === 'MARGINAL' ? 'هامشية' : 'محمية'}</span></td>
      <td class="mono">${s.avg_potential != null ? s.avg_potential.toFixed(1) : '—'}</td>
      <td><span class="b-${s.severity_score >= 8 ? 'r' : s.severity_score >= 5 ? 'a' : 'g'}">${s.severity_score}/10</span></td>
      <td>${s.risk_explanation ?? '—'}</td>
    </tr>`).join('');

  const recRows = recs.map(r =>
    `<tr>
      <td><span class="b-${r.priority === 'فوري' ? 'r' : r.priority === 'عاجل' ? 'a' : r.priority === 'مخطط' ? 'bl' : 'sl'}">${r.priority}</span></td>
      <td>${r.action}</td>
      <td class="nw">${r.timeline}</td>
      <td class="nw">${r.responsible}</td>
      <td class="mono sm">${r.standard}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>تقرير الحماية الكاثودية — ${report.pipeline_id ?? ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff;padding:18mm;line-height:1.5}
  h1{font-size:18px;font-weight:900;color:${hc}}
  h2{font-size:13px;font-weight:700;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #e2e8f0;color:#0f172a}
  .meta{font-size:10px;color:#64748b;margin-top:4px}
  .stamp{display:inline-flex;gap:16px;align-items:center;background:${hc}1a;border:2px solid ${hc};border-radius:8px;padding:10px 20px;margin:12px 0}
  .pct{font-size:30px;font-weight:900;color:${hc};line-height:1}
  .sl1{font-size:10px;color:#64748b}
  .krow{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;text-align:center;flex:1;min-width:80px}
  .kv{font-size:18px;font-weight:800}
  .kl{font-size:9px;color:#64748b;margin-top:2px}
  .bar{height:14px;border-radius:7px;overflow:hidden;display:flex;margin:8px 0}
  .bl{display:flex;gap:14px;font-size:9px;color:#64748b;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px}
  th{background:#f1f5f9;text-align:right;padding:5px 7px;font-size:9.5px;font-weight:600;border:1px solid #e2e8f0;color:#475569}
  td{padding:4px 7px;border:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .mono{font-family:'Courier New',monospace}
  .sm{font-size:9px}
  .nw{white-space:nowrap}
  .b-r{background:#fee2e2;color:#b91c1c;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .b-a{background:#fff7ed;color:#c2410c;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .b-g{background:#d1fae5;color:#065f46;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .b-bl{background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .b-sl{background:#f1f5f9;color:#475569;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .narrative{background:#f8fafc;border-right:3px solid ${hc};padding:8px 12px;font-size:10.5px;line-height:1.7;color:#374151;margin:8px 0;border-radius:0 6px 6px 0}
  .stds{columns:2;font-size:9px;color:#64748b;list-style:none}
  .stds li{padding:2px 0;border-bottom:1px dotted #e2e8f0}
  .stds li span{color:#7c3aed;font-family:monospace}
  .footer{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
  @media print{body{padding:12mm}@page{margin:12mm}}
</style></head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid ${hc};margin-bottom:16px">
  <div><h1>تقرير الحماية الكاثودية</h1><p class="meta">NACE SP0169 / ISO 15589-1 / ASME B31.8</p></div>
  <div style="text-align:left"><p class="meta">رقم التقرير: <span class="mono">${report.report_id.slice(0, 8).toUpperCase()}</span></p><p class="meta">تاريخ الإصدار: ${new Date(report.generated_at).toLocaleString('ar-LY')}</p></div>
</div>

<div class="stamp">
  <div><div class="pct">${report.compliance.protected_pct.toFixed(0)}%</div><div class="sl1">محمية (NACE ≤−850 mV CSE)</div></div>
  <div style="width:1px;height:40px;background:${hc};opacity:.3"></div>
  <div><div style="font-size:20px;font-weight:900;color:${hc}">${cfg.label}</div><div class="sl1">الخط: ${report.pipeline_id ?? 'غير محدد'} &nbsp;·&nbsp; ${report.compliance.compliant ? '✓ مطابق لـ NACE' : '✗ غير مطابق لـ NACE'}</div></div>
</div>

<h2>الملخص التنفيذي</h2>
<div class="narrative">${report.manager_summary}</div>
<div class="krow">
  <div class="kpi"><div class="kv">${report.data_quality.total_points.toLocaleString()}</div><div class="kl">نقاط القياس</div></div>
  <div class="kpi"><div class="kv" style="color:#ef4444">${report.compliance.critical_zones}</div><div class="kl">مناطق حرجة</div></div>
  <div class="kpi"><div class="kv" style="color:${report.data_quality.confidence_score >= .8 ? '#10b981' : report.data_quality.confidence_score >= .6 ? '#f59e0b' : '#ef4444'}">${Math.round(report.data_quality.confidence_score * 100)}%</div><div class="kl">ثقة البيانات</div></div>
  <div class="kpi"><div class="kv" style="color:#f59e0b">${report.data_quality.anomaly_count}</div><div class="kl">قيم شاذة</div></div>
</div>

<h2>مطابقة معيار NACE SP0169</h2>
<div class="bar">
  <div style="width:${report.compliance.protected_pct}%;background:#10b981"></div>
  <div style="width:${report.compliance.marginal_pct}%;background:#f59e0b"></div>
  <div style="width:${report.compliance.not_protected_pct}%;background:#ef4444;flex:1 0 0"></div>
</div>
<div class="bl"><span>■ محمية ${report.compliance.protected_pct.toFixed(1)}%</span><span>■ هامشية ${report.compliance.marginal_pct.toFixed(1)}%</span><span>■ غير محمية ${report.compliance.not_protected_pct.toFixed(1)}%</span></div>

${ps.mean !== null ? `
<h2>التحليل الإحصائي للجهد الكاثودي</h2>
<div class="krow">
  <div class="kpi"><div class="kv mono" style="color:#0ea5e9">${ps.mean!.toFixed(1)}</div><div class="kl">متوسط الجهد (mV)</div></div>
  <div class="kpi"><div class="kv mono" style="color:#10b981">${ps.min!.toFixed(1)}</div><div class="kl">أدنى جهد (mV)</div></div>
  <div class="kpi"><div class="kv mono" style="color:#ef4444">${ps.max!.toFixed(1)}</div><div class="kl">أعلى جهد (mV)</div></div>
  <div class="kpi"><div class="kv mono" style="color:#f59e0b">±${ps.stddev!.toFixed(1)}</div><div class="kl">الانحراف المعياري σ</div></div>
</div>` : ''}

${report.worst_segments.length > 0 ? `
<h2>المقاطع الحرجة — أعلى ${report.worst_segments.length} خطورة</h2>
<table><thead><tr><th>المقطع (م)</th><th>التصنيف</th><th>متوسط الجهد (mV)</th><th>درجة الخطورة</th><th>التفسير</th></tr></thead>
<tbody>${segRows}</tbody></table>` : ''}

<h2>جدول التوصيات الهندسية وخطة الإجراءات التصحيحية (CAP)</h2>
<table><thead><tr><th>الأولوية</th><th>الإجراء المطلوب</th><th>الجدول الزمني</th><th>الجهة المسؤولة</th><th>المعيار المرجعي</th></tr></thead>
<tbody>${recRows}</tbody></table>

<h2>المراجع القياسية المعتمدة</h2>
<ul class="stds">
  <li><span>NACE SP0169-2013</span> &nbsp; Control of External Corrosion on Underground Metallic Piping Systems</li>
  <li><span>ISO 15589-1:2015</span> &nbsp; CP of Pipeline Transportation Systems</li>
  <li><span>ASME B31.8-2022</span> &nbsp; Gas Transmission and Distribution Piping Systems</li>
  <li><span>ISO 31000:2018</span> &nbsp; Risk Management – Guidelines</li>
  <li><span>NACE SP0207-2007</span> &nbsp; Performing Close-Interval Potential Surveys</li>
</ul>

<h2>كتلة الاعتماد والتوقيعات</h2>
<p style="font-size:9px;color:#64748b;margin-bottom:8px">يُعدّ هذا التقرير رسمياً عند اكتمال التوقيعات أدناه — ISO 9001:2015 §7.5.2</p>
<table style="margin-top:4px">
  <thead><tr>
    <th style="width:25%">الدور</th>
    <th style="width:30%">الاسم والمسمى الوظيفي</th>
    <th style="width:20%">التوقيع</th>
    <th style="width:25%">التاريخ</th>
  </tr></thead>
  <tbody>
    <tr><td style="height:28px"><strong>معدّ التقرير</strong><br><span style="font-size:9px;color:#64748b">مهندس الحماية الكاثودية</span></td><td></td><td></td><td></td></tr>
    <tr><td style="height:28px"><strong>مراجع التقرير</strong><br><span style="font-size:9px;color:#64748b">مشرف قسم النزاهة</span></td><td></td><td></td><td></td></tr>
    <tr><td style="height:28px"><strong>معتمِد التقرير</strong><br><span style="font-size:9px;color:#64748b">مدير الهندسة</span></td><td></td><td></td><td></td></tr>
  </tbody>
</table>
<p style="font-size:8.5px;color:#94a3b8;margin-top:8px">ختم هندسي رسمي مطلوب للإصدارات الخارجية وفق متطلبات NACE §3.2</p>

<div class="footer">
  <span>رقم التقرير: <span class="mono">${report.report_id}</span></span>
  <span>NACE SP0169 / ISO 15589-1 / ASME B31.8 / ISO 31000</span>
  <span>تاريخ الإصدار: ${new Date(report.generated_at).toLocaleDateString('ar-LY')}</span>
</div>
</body></html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportPanel({
  analysis,
  onGoToAnalysis,
}: {
  analysis: CpAnalysis | null;
  onGoToAnalysis: () => void;
}) {
  const [generated, setGenerated] = React.useState<CpEngineeringReport | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);

  function generateReport() {
    if (!analysis) return;
    setGenerating(true);
    setTimeout(() => {
      const worstSegs = [...analysis.fixed_segments]
        .sort((a, b) => b.severity_score - a.severity_score)
        .slice(0, 5);

      const report: CpEngineeringReport = {
        report_id:      crypto.randomUUID(),
        generated_at:   new Date().toISOString(),
        pipeline_id:    analysis.session.pipeline_id ?? null,
        session_ids:    [analysis.session.session_id],
        nace_standard:  'SP0169',
        overall_status: analysis.overall_status,
        compliance: {
          compliant:         analysis.compliance_summary?.compliant ?? false,
          protected_pct:     analysis.compliance_summary?.protected_pct ?? analysis.stats.protected_pct,
          marginal_pct:      analysis.compliance_summary?.marginal_pct ?? 0,
          not_protected_pct: analysis.compliance_summary?.not_protected_pct ?? 0,
          critical_zones:    analysis.stats.critical_zones,
          notes:             analysis.compliance_summary?.notes ?? '',
        },
        data_quality: {
          confidence_score: analysis.data_quality?.confidence_score ?? 0,
          total_points:     analysis.stats.total_points,
          anomaly_count:    analysis.data_quality?.anomaly_count ?? 0,
        },
        worst_segments:  worstSegs,
        recommendation:  analysis.recommendation,
        manager_summary: analysis.manager_summary,
      };
      setGenerated(report);
      setGenerating(false);
    }, 400);
  }

  function downloadJSON() {
    if (!generated || !analysis) return;
    const payload = {
      ...generated,
      extended: {
        stats: analysis.stats,
        data_quality: analysis.data_quality,
        compliance_summary: analysis.compliance_summary,
        all_segments: analysis.fixed_segments,
        recommendations: buildRecommendations(analysis),
        iso_standard_refs: [
          'NACE SP0169-2013: Control of External Corrosion on Underground or Submerged Metallic Piping Systems',
          'ISO 15589-1:2015: Petroleum, Petrochemical and Natural Gas Industries – CP of Pipeline Transportation Systems',
          'ASME B31.8-2022: Gas Transmission and Distribution Piping Systems',
          'ISO 31000:2018: Risk Management – Guidelines',
          'NACE SP0207-2007: Performing Close-Interval Potential Surveys',
        ],
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cp_engineering_report_${generated.report_id.slice(0, 8)}.json`;
    a.click();
  }

  function printReport() {
    if (!generated || !analysis) return;
    const cfgLocal = OVERALL_STATUS_CONFIG[analysis.overall_status] ?? OVERALL_STATUS_CONFIG.CRITICAL;
    const recsLocal = buildRecommendations(analysis);
    const html = buildReportPrintHtml(generated, analysis, cfgLocal, recsLocal);
    const w = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center">
        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 mb-1">لا توجد بيانات تحليل لتوليد تقرير</p>
        <p className="text-xs text-slate-600 mb-4">افتح تبويب «تحليل المسح» واختر خطًا وجلسة مسح أولاً</p>
        <button onClick={onGoToAnalysis}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-medium">
          الانتقال لتحليل المسح
        </button>
      </div>
    );
  }

  const overallCfg  = OVERALL_STATUS_CONFIG[analysis.overall_status] ?? OVERALL_STATUS_CONFIG.CRITICAL;
  const riskPos     = generated ? deriveRiskPosition(analysis) : null;
  const recs        = generated ? buildRecommendations(analysis) : [];

  // Potential statistics from chart_data
  const potentials  = (analysis.chart_data ?? [])
    .map(d => d.natural_potential)
    .filter((v): v is number => v != null);
  const potStats    = calcStats(potentials);

  const priorityBadge: Record<string, string> = {
    'فوري':   'bg-red-500/20 text-red-300 border-red-500/40',
    'عاجل':   'bg-orange-500/20 text-orange-300 border-orange-500/40',
    'مخطط':   'bg-sky-500/20 text-sky-300 border-sky-500/40',
    'دوري':   'bg-slate-700/60 text-slate-400 border-slate-600',
  };

  return (
    <div className="space-y-4" ref={reportRef}>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              التقرير الهندسي — NACE SP0169 / ISO 15589-1
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              الخط: {analysis.session.pipeline_id ?? 'غير محدد'} &nbsp;·&nbsp;
              تاريخ المسح: {analysis.session.survey_date ?? '—'} &nbsp;·&nbsp;
              {analysis.stats.total_points.toLocaleString()} نقطة قياس
            </p>
          </div>
          <div className="flex items-center gap-2">
            {generated && (
              <>
                <button onClick={printReport}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-medium transition-colors">
                  <Printer className="w-4 h-4" /> طباعة
                </button>
                <button onClick={downloadJSON}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" /> JSON
                </button>
              </>
            )}
            <button onClick={generateReport} disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium transition-colors disabled:opacity-50">
              <FileText className="w-4 h-4" />
              {generating ? 'جاري التوليد…' : generated ? 'إعادة التوليد' : 'توليد التقرير'}
            </button>
          </div>
        </div>
      </div>

      {generated && (
        <>
          {/* ── 1. Cover / Stamp ─────────────────────────────────────────────── */}
          <div className={`rounded-2xl border p-6 ${overallCfg.bg}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                  Cathodic Protection Engineering Report
                </p>
                <h1 className={`text-xl font-extrabold ${overallCfg.text}`}>
                  تقرير الحماية الكاثودية — {overallCfg.label}
                </h1>
                <p className="text-xs text-slate-400">
                  رقم التقرير: <span className="font-mono">{generated.report_id}</span>
                </p>
                <p className="text-xs text-slate-400">
                  تاريخ الإصدار: {new Date(generated.generated_at).toLocaleString('ar-LY')}
                </p>
              </div>

              {/* Compliance stamp */}
              <div className={`rounded-2xl border-2 border-current/30 px-6 py-4 text-center ${overallCfg.text}`}>
                <p className="text-4xl font-black leading-none">
                  {generated.compliance.protected_pct.toFixed(0)}%
                </p>
                <p className="text-xs mt-1 font-semibold">محمية (NACE ≤−850 mV)</p>
                <p className={`text-xs mt-1 font-bold px-2 py-0.5 rounded-full ${generated.compliance.compliant ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  {generated.compliance.compliant ? '✓ مطابق' : '✗ غير مطابق'}
                </p>
              </div>
            </div>

            {/* Standards badges */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-current/20">
              {['NACE SP0169', 'ISO 15589-1', 'ASME B31.8', 'ISO 31000'].map(s => (
                <span key={s} className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-black/20 border border-current/20 opacity-80">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* ── 1b. Pipeline System Description ─────────────────────────────── */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" /> وصف المنظومة — Pipeline System Description
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { label: 'معرّف الخط',        value: analysis.session.pipeline_id ?? '—' },
                { label: 'تاريخ المسح',        value: analysis.session.survey_date ?? '—' },
                { label: 'نوع المسح',          value: 'Close-Interval Survey (CIPS)' },
                { label: 'قطب المرجع',         value: 'Cu/CuSO₄ (CSE)' },
                { label: 'طول الخط المُسَّح',  value: analysis.stats.total_points ? `${analysis.stats.total_points.toLocaleString()} نقطة` : '—' },
                { label: 'معيار التصنيف',      value: 'NACE SP0169 §6.2.2 — ≤−850 mV' },
              ].map(item => (
                <div key={item.label} className="bg-slate-800/50 rounded-lg p-2.5">
                  <p className="text-slate-500 text-[10px] mb-0.5">{item.label}</p>
                  <p className="text-slate-200 font-medium font-mono">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. Executive Summary ─────────────────────────────────────────── */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-cyan-400" /> الملخص التنفيذي
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{generated.manager_summary}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'نقاط القياس',     value: generated.data_quality.total_points.toLocaleString(), sub: 'إجمالي' },
                { label: 'المناطق الحرجة',  value: String(generated.compliance.critical_zones),           sub: 'NACE §6.2' },
                { label: 'ثقة البيانات',    value: `${Math.round(generated.data_quality.confidence_score * 100)}%`, sub: 'نسبة الثقة' },
                { label: 'قيم شاذة',        value: String(generated.data_quality.anomaly_count),           sub: 'تحتاج مراجعة' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-white">{kpi.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{kpi.label}</p>
                  <p className="text-[10px] text-slate-600">{kpi.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. NACE Compliance Breakdown ─────────────────────────────────── */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> مطابقة معيار NACE SP0169
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-400">{generated.compliance.protected_pct.toFixed(1)}%</p>
                <p className="text-xs text-emerald-300 mt-1 font-semibold">محمية</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Potential ≤ −850 mV CSE</p>
              </div>
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-amber-400">{generated.compliance.marginal_pct.toFixed(1)}%</p>
                <p className="text-xs text-amber-300 mt-1 font-semibold">هامشية</p>
                <p className="text-[10px] text-slate-500 mt-0.5">−850 mV &lt; E ≤ −700 mV</p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-red-400">{generated.compliance.not_protected_pct.toFixed(1)}%</p>
                <p className="text-xs text-red-300 mt-1 font-semibold">غير محمية</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Potential &gt; −700 mV CSE</p>
              </div>
            </div>
            {/* Protection bar */}
            <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
              <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${generated.compliance.protected_pct}%` }} />
              <div className="bg-amber-400 transition-all"                  style={{ width: `${generated.compliance.marginal_pct}%` }} />
              <div className="bg-red-500 rounded-r-full transition-all"     style={{ width: `${generated.compliance.not_protected_pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0%</span><span>امتداد الخط</span><span>100%</span>
            </div>
            {generated.compliance.notes && (
              <p className="text-xs text-slate-400 mt-3 border-t border-slate-700 pt-3">{generated.compliance.notes}</p>
            )}
          </div>

          {/* ── 4. Statistical Analysis ──────────────────────────────────────── */}
          {potStats.mean != null && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" /> التحليل الإحصائي للجهد الكاثودي
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'متوسط الجهد (Mean)',    value: `${potStats.mean!.toFixed(1)} mV`,   color: 'text-sky-300' },
                  { label: 'أدنى جهد (Min)',         value: `${potStats.min!.toFixed(1)} mV`,   color: 'text-emerald-400' },
                  { label: 'أعلى جهد (Max)',         value: `${potStats.max!.toFixed(1)} mV`,   color: 'text-red-400' },
                  { label: 'الانحراف المعياري (σ)',  value: `±${potStats.stddev!.toFixed(1)} mV`, color: 'text-amber-400' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-3">
                * قياسات الجهد بالنسبة لأقطاب المرجع Cu/CuSO₄ (CSE) — معيار NACE SP0169 §6.2.2
              </p>
            </div>
          )}

          {/* ── 5. ISO 31000 Risk Matrix ─────────────────────────────────────── */}
          {riskPos && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-400" /> مصفوفة المخاطر — ISO 31000:2018
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                الاحتمالية × العواقب — الخلية المظللة = موضع خط الأنابيب الحالي
              </p>
              <div className="overflow-x-auto">
                <table className="text-[10px] w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-slate-500 text-left pr-2 w-20 pb-1">الاحتمالية ↓ / العواقب →</th>
                      {RISK_CONSEQUENCE_LABELS.map((c, ci) => (
                        <th key={c} className="text-center text-slate-400 font-semibold pb-1 px-1">{c}<br/><span className="text-slate-600">C{ci+1}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_PROBABILITY_LABELS.map((prob, pi) => (
                      <tr key={prob}>
                        <td className="text-slate-400 pr-2 py-0.5 font-semibold">
                          {prob} <span className="text-slate-600">P{pi+1}</span>
                        </td>
                        {RISK_CONSEQUENCE_LABELS.map((_, ci) => {
                          const isActive = (pi + 1) === riskPos.p && (ci + 1) === riskPos.c;
                          return (
                            <td key={ci} className="p-0.5">
                              <div className={`rounded text-center py-1 px-2 font-bold transition-all
                                ${getRiskColor(pi + 1, ci + 1)}
                                ${isActive ? 'ring-2 ring-white scale-110 shadow-lg z-10 relative' : 'opacity-60'}`}>
                                {(pi + 1) * (ci + 1)}
                                {isActive && <span className="block text-[8px] font-normal">← الخط</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
                {[
                  { color: 'bg-red-600',     label: '15–25 مخاطرة عالية جداً — تدخل فوري' },
                  { color: 'bg-orange-500',  label: '8–12 مخاطرة عالية — تدخل عاجل' },
                  { color: 'bg-amber-400',   label: '4–6 مخاطرة متوسطة — مراقبة مستمرة' },
                  { color: 'bg-emerald-600', label: '1–3 مخاطرة منخفضة — إجراء دوري' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded ${l.color}`} />
                    <span className="text-slate-400">{l.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Critical Segments ─────────────────────────────────────────── */}
          {generated.worst_segments.length > 0 && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                المقاطع الحرجة — أولوية التدخل
                <span className="text-xs text-slate-500 font-normal">({generated.worst_segments.length} مقاطع / مرتبة حسب درجة الخطورة)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="text-right py-2 pr-3">المسافة (م)</th>
                      <th className="text-right py-2">التصنيف</th>
                      <th className="text-right py-2">متوسط الجهد</th>
                      <th className="text-right py-2">درجة الخطورة</th>
                      <th className="text-right py-2 pl-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.worst_segments.map((seg: CpFixedSegment) => {
                      const cfg = CP_STATUS_CONFIG[seg.classification as keyof typeof CP_STATUS_CONFIG] ?? CP_STATUS_CONFIG.UNKNOWN;
                      return (
                        <tr key={seg.seg_id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 pr-3 font-mono text-white">{seg.start_distance}–{seg.end_distance}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center gap-1 font-semibold ${cfg.color}`}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-slate-300">
                            {seg.avg_potential != null ? `${seg.avg_potential.toFixed(1)} mV` : '—'}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                <div className={`h-full rounded-full ${seg.severity_score >= 8 ? 'bg-red-500' : seg.severity_score >= 5 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                  style={{ width: `${seg.severity_score * 10}%` }} />
                              </div>
                              <span className="text-slate-300 font-semibold">{seg.severity_score}/10</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-slate-400 pl-3">{seg.risk_explanation ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 7. Recommendations Table ─────────────────────────────────────── */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyan-400" /> جدول التوصيات الهندسية
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-right py-2 pr-3">الأولوية</th>
                    <th className="text-right py-2">الإجراء المطلوب</th>
                    <th className="text-right py-2">الجدول الزمني</th>
                    <th className="text-right py-2">الجهة المسؤولة</th>
                    <th className="text-right py-2 pl-3">المعيار المرجعي</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityBadge[r.priority]}`}>
                          {r.priority}
                        </span>
                      </td>
                      <td className={`py-2.5 leading-relaxed max-w-xs ${r.color}`}>{r.action}</td>
                      <td className="py-2.5 text-slate-300 whitespace-nowrap">{r.timeline}</td>
                      <td className="py-2.5 text-slate-400 whitespace-nowrap">{r.responsible}</td>
                      <td className="py-2.5 font-mono text-slate-500 pl-3">{r.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 8. Signature Block ───────────────────────────────────────────── */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-violet-400" /> كتلة الاعتماد والتوقيعات
            </h3>
            <p className="text-[10px] text-slate-500 mb-4">يُعدّ التقرير رسمياً عند اكتمال التوقيعات — ISO 9001:2015 §7.5.2</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { role: 'معدّ التقرير',   title: 'مهندس الحماية الكاثودية', border: 'border-cyan-500/30' },
                { role: 'مراجع التقرير', title: 'مشرف قسم النزاهة',        border: 'border-blue-500/30' },
                { role: 'معتمِد التقرير', title: 'مدير الهندسة',            border: 'border-violet-500/30' },
              ].map(s => (
                <div key={s.role} className={`border ${s.border} rounded-xl p-4`}>
                  <p className="text-xs font-bold text-slate-200 mb-0.5">{s.role}</p>
                  <p className="text-[10px] text-slate-500 mb-3">{s.title}</p>
                  <div className="border-b border-slate-600 mb-2" style={{ height: 32 }} />
                  <p className="text-[10px] text-slate-600">الاسم / التوقيع / التاريخ</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-3 text-center">
              ختم هندسي رسمي مطلوب للإصدارات الخارجية — NACE §3.2
            </p>
          </div>

          {/* ── 9. Methodology ───────────────────────────────────────────────── */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-400" /> المنهجية والمراجع القياسية
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
              <div>
                <p className="font-semibold text-slate-300 mb-2">منهجية القياس</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>مسح الجهد بالفترات المتقاربة (Close-Interval Survey)</li>
                  <li>قياس الجهد عند إيقاف التيار (Instant-Off Potential)</li>
                  <li>استخدام أقطاب مرجع Cu/CuSO₄ (CSE)</li>
                  <li>تصنيف NACE بناءً على معيار ≤−850 mV vs CSE</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-300 mb-2">المراجع القياسية</p>
                <ul className="space-y-1">
                  {[
                    ['NACE SP0169-2013', 'Control of External Corrosion on Underground Metallic Piping'],
                    ['ISO 15589-1:2015', 'CP of Pipeline Transportation Systems'],
                    ['ASME B31.8-2022',  'Gas Transmission and Distribution Piping Systems'],
                    ['ISO 31000:2018',   'Risk Management – Guidelines'],
                    ['NACE SP0207-2007', 'Close-Interval Potential Surveys'],
                  ].map(([code, title]) => (
                    <li key={code} className="flex gap-2">
                      <span className="font-mono text-violet-400 shrink-0">{code}</span>
                      <span className="text-slate-500">{title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[10px] text-slate-600">
            <span>رقم التقرير: <span className="font-mono">{generated.report_id}</span></span>
            <span>تاريخ الإصدار: {new Date(generated.generated_at).toLocaleDateString('ar-LY')}</span>
            <span>NACE SP0169 / ISO 15589-1 / ASME B31.8</span>
          </div>
        </>
      )}
    </div>
  );
}
