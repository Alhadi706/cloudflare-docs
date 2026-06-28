'use client';

// ═══════════════════════════════════════════════════════════════════════════════
//  التقارير الإدارية — Management Reports Panel
//  موجَّه للإدارة العليا وصناع القرار — Multi-pipeline aggregate view
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import {
  FileText, Printer, BarChart3, AlertTriangle, Shield, ShieldOff,
  CheckCircle, TrendingDown, Calendar, Wrench, AlertCircle, RefreshCw,
  Sparkles, BookOpen, Activity, ClipboardList, Info, Layers,
} from 'lucide-react';
import { CpPipeline, CpAnalysis } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
  };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

const STATUS_LABEL: Record<string, string> = {
  CRITICAL: 'يحتاج تدخلاً عاجلاً',
  WARNING:  'يحتاج متابعة',
  GOOD:     'وضعه مقبول',
};

const STATUS_COLOR_MAP: Record<string, string> = {
  CRITICAL: '#dc2626',
  WARNING:  '#d97706',
  GOOD:     '#059669',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportPeriod = 'monthly' | 'quarterly' | 'annual' | 'custom';

type SectionKey =
  | 'executive'
  | 'network'
  | 'alerts'
  | 'predictions'
  | 'workorders'
  | 'budget'
  | 'compliance'
  | 'recs';

interface PipelineResult {
  pipeline_id:  string | null;
  display_name: string;
  session_id:   string;
  session_date: string | null;
  cp_installed: 'YES' | 'NO' | null;
  cp_year:      number | null;
  analysis:     CpAnalysis;
}

interface AggData {
  results:           PipelineResult[];
  totalPipelines:    number;
  criticalCount:     number;
  warningCount:      number;
  goodCount:         number;
  avgProt:           number;
  totalCritZones:    number;
  compliantCount:    number;
  predEligible:      number;
  withCp:            number;
  withoutCp:         number;
  cpUnknown:         number;
  worst:             PipelineResult | null;
  best:              PipelineResult | null;
}

// ─── Section configuration ────────────────────────────────────────────────────

const SECTION_CONFIG: { key: SectionKey; label: string; desc: string; icon: string }[] = [
  { key: 'executive',   label: 'الصورة الكاملة',           desc: 'ملخص الوضع دفعة واحدة',                   icon: '📋' },
  { key: 'network',     label: 'وضع كل خط أنابيب',         desc: 'جدول مبسط بحالة كل خط والإجراء المطلوب', icon: '🗺' },
  { key: 'alerts',      label: 'ما يستدعي الاهتمام',        desc: 'الخطوط والمشاكل التي تحتاج قراراً',       icon: '⚠️' },
  { key: 'predictions', label: 'التوقعات المستقبلية',       desc: 'هل الوضع يتحسن أم يتدهور؟',               icon: '📈' },
  { key: 'workorders',  label: 'الأعمال المطلوبة',          desc: 'ماذا نحتاج وفي أي وقت؟',                  icon: '🔧' },
  { key: 'budget',      label: 'الأولويات المالية',         desc: 'أين ينبغي إنفاق الميزانية؟',               icon: '💰' },
  { key: 'compliance',  label: 'مطابقة المعايير الدولية',   desc: 'هل نحن ضمن المعايير المعتمدة؟',            icon: '✅' },
  { key: 'recs',        label: 'قرارات مقترحة للإدارة',    desc: 'ما نحتاجه من الإدارة العليا',               icon: '📌' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodLabel(type: ReportPeriod, from: string, to: string): string {
  const now = new Date();
  if (type === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `شهر ${d.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}`;
  }
  if (type === 'quarterly') {
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const prevQ = q === 1 ? 4 : q - 1;
    const yr    = q === 1 ? now.getFullYear() - 1 : now.getFullYear();
    return `الربع ${prevQ === 1 ? 'الأول' : prevQ === 2 ? 'الثاني' : prevQ === 3 ? 'الثالث' : 'الرابع'} ${yr}`;
  }
  if (type === 'annual') return `عام ${now.getFullYear() - 1}`;
  if (from && to) return `من ${from} إلى ${to}`;
  return `عام ${now.getFullYear()}`;
}

function buildAgg(results: PipelineResult[], pipelines: CpPipeline[]): AggData {
  const criticalCount = results.filter(r => r.analysis.overall_status === 'CRITICAL').length;
  const warningCount  = results.filter(r => r.analysis.overall_status === 'WARNING').length;
  const goodCount     = results.filter(r => r.analysis.overall_status === 'GOOD').length;
  const avgProt       = results.length
    ? results.reduce((s, r) => s + (r.analysis.stats.protected_pct ?? 0), 0) / results.length
    : 0;
  const totalCritZones  = results.reduce((s, r) => s + (r.analysis.stats.critical_zones ?? 0), 0);
  const compliantCount  = results.filter(r => r.analysis.compliance_summary?.compliant).length;
  const sorted          = [...results].sort(
    (a, b) => (a.analysis.stats.protected_pct ?? 0) - (b.analysis.stats.protected_pct ?? 0),
  );
  return {
    results,
    totalPipelines: results.length,
    criticalCount,
    warningCount,
    goodCount,
    avgProt,
    totalCritZones,
    compliantCount,
    predEligible: pipelines.filter(p => p.has_multi_survey).length,
    withCp:       results.filter(r => r.cp_installed === 'YES').length,
    withoutCp:    results.filter(r => r.cp_installed === 'NO').length,
    cpUnknown:    results.filter(r => !r.cp_installed).length,
    worst: sorted[0] ?? null,
    best:  sorted[sorted.length - 1] ?? null,
  };
}

function statusColors(s: string) {
  return s === 'CRITICAL'
    ? { bg: 'bg-red-900/30',    border: 'border-red-500/40',    text: 'text-red-300',    badge: 'bg-red-600 text-white' }
    : s === 'WARNING'
    ? { bg: 'bg-amber-900/20',  border: 'border-amber-500/30',  text: 'text-amber-300',  badge: 'bg-amber-500 text-white' }
    : { bg: 'bg-emerald-900/20', border: 'border-emerald-500/30', text: 'text-emerald-300', badge: 'bg-emerald-600 text-white' };
}

// ─── Narrative generator (smart Arabic templates) ────────────────────────────

function buildNarrative(agg: AggData, periodLabel: string) {
  const { totalPipelines, criticalCount, warningCount, goodCount, avgProt, totalCritZones, compliantCount } = agg;

  const executive = criticalCount > 0
    ? `خلال ${periodLabel}، يستدعي وضع شبكة الأنابيب اهتماماً عاجلاً. من أصل ${totalPipelines} خط مُراقَب، هناك ${criticalCount} خط${criticalCount > 1 ? ' تحتاج' : ' يحتاج'} إجراءً فورياً${warningCount > 0 ? `، و${warningCount} خط${warningCount > 1 ? ' تحتاج' : ' يحتاج'} متابعة دقيقة` : ''}${goodCount > 0 ? `، في حين ${goodCount} خط${goodCount > 1 ? ' تعمل' : ' يعمل'} بشكل سليم` : ''}. مستوى الحماية الإجمالي بلغ ${avgProt.toFixed(0)}٪. التأخير في التدخل يعني تكاليف إصلاح أعلى مستقبلاً وقد يؤثر على استمرارية العمليات.`
    : warningCount > 0
    ? `خلال ${periodLabel}، تسير شبكة الأنابيب بشكل مقبول مع بعض الخطوط التي تستحق المتابعة. ${goodCount} خط${goodCount > 1 ? ' تعمل' : ' يعمل'} بشكل جيد، و${warningCount} خط${warningCount > 1 ? ' تحتاج' : ' يحتاج'} متابعة دورية للحفاظ على مستوى الحماية. لا توجد حالات طارئة الآن، لكن التأخير في الصيانة الدورية قد يرفع المخاطر لاحقاً. مستوى الحماية الإجمالي ${avgProt.toFixed(0)}٪.`
    : `خلال ${periodLabel}، تعمل شبكة الأنابيب بمستوى جيد. جميع الخطوط الـ ${totalPipelines} المُراقَبة تحقق المتطلبات المطلوبة بمستوى حماية ${avgProt.toFixed(0)}٪. لا توجد مشاكل تستدعي تدخلاً في الوقت الراهن.`;

  const alerts = totalCritZones > 0
    ? `رُصدت مواقع تحتاج إلى متابعة في ${totalCritZones} نقطة عبر الشبكة${agg.worst ? `، أكثر الخطوط احتياجاً للصيانة هو خط "${agg.worst.display_name}" بمستوى حماية ${agg.worst.analysis.stats.protected_pct.toFixed(0)}٪ فقط` : ''}. هذه المواقع هي أجزاء من الخط معرضة لتآكل تدريجي إذا لم يُتخذ إجراء في الوقت المناسب. التدخل المبكر يمنع تصاعد المشكلة ويوفر التكلفة على المدى البعيد.`
    : `لم تُرصد مواقع تستدعي اهتماماً عاجلاً في الفترة الحالية. يُنصح بالاستمرار في الفحص الدوري المعتاد للحفاظ على هذا المستوى.`;

  const workorders = criticalCount > 0
    ? `بناءً على نتائج الفحص، يُوصى بتنفيذ ${criticalCount} عملية صيانة عاجلة للخطوط ذات الأولوية القصوى خلال أسبوع إلى أسبوعين كحد أقصى.${warningCount > 0 ? ` كذلك يُقترح جدولة ${warningCount} عملية صيانة دورية للخطوط التي تحتاج متابعة خلال الشهرين القادمين.` : ''}${agg.withoutCp > 0 ? ` يُستحسن أيضاً إدراج ${agg.withoutCp} خط غير مجهز بمنظومة الحماية من الصدأ ضمن خطة الاستثمار القادمة.` : ''}`
    : warningCount > 0
    ? `لا توجد أعمال طارئة في الوقت الراهن، غير أنه يُوصى بجدولة ${warningCount} عملية صيانة دورية للخطوط التي تحتاج متابعة خلال الشهرين القادمين. التأخير في التدخل قد يرفع مستوى المخاطر لاحقاً.`
    : 'لا تستدعي الحالة الراهنة أي أعمال طارئة. يُكتفى بالجدول الاعتيادي للفحص السنوي الشامل.';

  const recItems = [
    criticalCount > 0 && `الموافقة على ميزانية طارئة للصيانة العاجلة لـ ${criticalCount} خط${criticalCount > 1 ? ' تحتاج' : ' يحتاج'} تدخلاً فورياً.`,
    criticalCount > 0 && `تفويض الفريق الفني بالبدء في أعمال الصيانة خلال أسبوع كحد أقصى.`,
    warningCount  > 0 && `جدولة متابعة دورية لـ ${warningCount} خط${warningCount > 1 ? ' تحتاج' : ' يحتاج'} مراقبة، خلال الشهر القادم.`,
    agg.withoutCp > 0 && `دراسة تجهيز ${agg.withoutCp} خط غير محمي بمنظومة الوقاية من الصدأ، ضمن خطة الاستثمار الرأسمالي القادمة.`,
    `الإبقاء على برنامج الفحص السنوي الشامل وتحديث سجلات الخطوط بعد كل فحص.`,
  ].filter(Boolean) as string[];
  const arabicNums = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const recs = recItems.map((item, i) => `${arabicNums[i]}. ${item}`).join('\n');

  return { executive, alerts, workorders, recs };
}

// ─── Print HTML builder ────────────────────────────────────────────────────────

function buildPrintHtml(
  agg:         AggData,
  sections:    Set<SectionKey>,
  periodLabel: string,
  aiMode:      boolean,
  reportDate:  string,
): string {
  const narr      = buildNarrative(agg, periodLabel);
  const mainColor = agg.criticalCount > 0 ? '#dc2626' : agg.warningCount > 0 ? '#d97706' : '#059669';
  const mainLabel = agg.criticalCount > 0 ? 'حرجة — تدخل عاجل' : agg.warningCount > 0 ? 'تحت المراقبة' : 'جيدة';

  const netRows = agg.results.map(r => {
    const actionNeeded = r.analysis.overall_status === 'CRITICAL'
      ? 'صيانة عاجلة — خلال أسبوع'
      : r.analysis.overall_status === 'WARNING'
      ? 'متابعة دورية — خلال شهر'
      : 'لا يوجد — الوضع جيد';
    const actionColor = r.analysis.overall_status === 'CRITICAL' ? '#dc2626'
      : r.analysis.overall_status === 'WARNING' ? '#d97706' : '#059669';
    return `<tr>
      <td><b>${r.display_name}</b></td>
      <td>${r.session_date ? new Date(r.session_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }) : '—'}</td>
      <td><span style="color:${STATUS_COLOR_MAP[r.analysis.overall_status]};font-weight:700">${STATUS_LABEL[r.analysis.overall_status]}</span></td>
      <td>${r.analysis.stats.protected_pct.toFixed(0)}%</td>
      <td>${r.cp_installed === 'YES' ? `✓ مجهز${r.cp_year ? ` منذ ${r.cp_year}` : ''}` : r.cp_installed === 'NO' ? '✗ غير مجهز' : '—'}</td>
      <td style="color:${actionColor};font-weight:600">${actionNeeded}</td>
    </tr>`;
  }).join('');

  const woRows = [
    agg.criticalCount > 0 ? `<tr style="background:#fee2e2"><td style="color:#dc2626;font-weight:700">🔴 عاجل — خلال أسبوع</td><td>صيانة شاملة لمنظومة الحماية من الصدأ</td><td style="font-weight:700">${agg.criticalCount} خط${agg.criticalCount > 1 ? ' تحتاج' : ' يحتاج'} تدخلاً فورياً</td><td>فريق الصيانة</td></tr>` : '',
    agg.warningCount  > 0 ? `<tr style="background:#fef3c7"><td style="color:#d97706;font-weight:700">🟡 مجدول — خلال شهر</td><td>فحص دوري وصيانة وقائية</td><td>${agg.warningCount} خط${agg.warningCount > 1 ? ' تحتاج' : ' يحتاج'} متابعة</td><td>مشرف الصيانة</td></tr>` : '',
    agg.withoutCp > 0 ? `<tr style="background:#eff6ff"><td style="color:#1d4ed8;font-weight:700">🔵 ضمن الخطة السنوية</td><td>دراسة تجهيز بمنظومة الحماية من الصدأ</td><td>${agg.withoutCp} خط غير مجهز</td><td>الإدارة الفنية والمالية</td></tr>` : '',
    `<tr><td>🟢 دوري — سنوياً</td><td>فحص وقائي شامل لجميع الخطوط وتحديث السجلات</td><td>الشبكة الكاملة (${agg.totalPipelines} خط)</td><td>قسم السلامة والصيانة</td></tr>`,
  ].filter(Boolean).join('');

  const complianceRows = agg.results.map(r =>
    `<tr>
      <td><b>${r.display_name}</b></td>
      <td>${r.analysis.stats.protected_pct.toFixed(0)}%</td>
      <td style="color:${r.analysis.compliance_summary?.compliant ? '#059669' : '#dc2626'};font-weight:700">
        ${r.analysis.compliance_summary?.compliant ? '✓ ضمن المعايير' : '✗ يحتاج تحسين'}
      </td>
      <td style="font-size:11px;color:#64748b">
        ${r.analysis.compliance_summary?.compliant ? 'لا يوجد إجراء مطلوب' : 'يُوصى بجدولة صيانة وقائية'}
      </td>
    </tr>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>التقرير الإداري — سلامة شبكة الأنابيب</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1e293b;font-size:13px;direction:rtl;line-height:1.7}
  .cover{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:#fff;padding:60px 52px;text-align:center;page-break-after:always}
  .cover .org{font-size:11px;color:#64748b;margin-bottom:12px;letter-spacing:1px;text-transform:uppercase}
  .cover h1{font-size:28px;font-weight:900;margin-bottom:6px}
  .cover h2{font-size:15px;color:#94a3b8;margin-bottom:32px;font-weight:400}
  .status-badge{display:inline-block;padding:12px 36px;border-radius:40px;font-size:18px;font-weight:700;margin:8px auto;background:${mainColor};color:#fff;letter-spacing:0.3px}
  .kpis{display:flex;justify-content:center;gap:20px;margin-top:36px;flex-wrap:wrap}
  .kpi{background:rgba(255,255,255,.08);border-radius:16px;padding:20px 28px;min-width:120px;border:1px solid rgba(255,255,255,.06)}
  .kpi .num{font-size:40px;font-weight:900;line-height:1}
  .kpi .lbl{font-size:11px;color:#94a3b8;margin-top:6px}
  .cover-note{margin-top:28px;font-size:11px;color:#475569;padding-top:20px;border-top:1px solid rgba(255,255,255,.06)}
  .page{padding:44px 52px}
  h2.sec{font-size:15px;font-weight:700;border-right:4px solid #3b82f6;padding-right:14px;margin:36px 0 16px;color:#1e40af;page-break-after:avoid;display:flex;align-items:center;gap:8px}
  .narr{background:#f8fafc;border-right:3px solid #94a3b8;padding:16px 20px;margin:10px 0 20px;border-radius:6px;line-height:2;font-size:13px;color:#334155;white-space:pre-line}
  .narr.red{border-right-color:#fca5a5;background:#fef2f2}
  .narr.yellow{border-right-color:#fcd34d;background:#fffbeb}
  .decision-box{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:18px 22px;margin:16px 0}
  .decision-box.urgent{background:#fef2f2;border-color:#fca5a5}
  .decision-box.watch{background:#fffbeb;border-color:#fcd34d}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
  th{background:#1e3a5f;color:#fff;padding:10px 14px;text-align:right;font-weight:600}
  td{padding:9px 14px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:middle}
  tr:nth-child(even) td{background:#f8fafc}
  .kpi-row{display:flex;gap:14px;margin:16px 0;flex-wrap:wrap}
  .kpi-card{flex:1;min-width:110px;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;background:#fff}
  .kpi-card .num{font-size:28px;font-weight:800;line-height:1}
  .kpi-card .lbl{font-size:11px;color:#64748b;margin-top:5px}
  .tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
  .tag-red{background:#fee2e2;color:#dc2626}
  .tag-yellow{background:#fef3c7;color:#d97706}
  .tag-green{background:#dcfce7;color:#16a34a}
  .footer{text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding:18px 52px;margin-top:36px}
  @media print{.pb{page-break-before:always}}
</style>
</head>
<body>
<!-- ▸ Cover --><div class="cover">
  <div class="org">تقرير إداري — قسم السلامة وصيانة الأنابيب</div>
  <h1>تقرير سلامة شبكة الأنابيب</h1>
  <h2>${periodLabel}</h2>
  <div class="status-badge">${mainLabel}</div>
  <div class="kpis">
    <div class="kpi"><div class="num" style="color:#38bdf8">${agg.totalPipelines}</div><div class="lbl">خط مُراقَب</div></div>
    <div class="kpi"><div class="num" style="color:${agg.criticalCount > 0 ? '#f87171' : '#4ade80'}">${agg.criticalCount}</div><div class="lbl">يحتاج تدخلاً عاجلاً</div></div>
    <div class="kpi"><div class="num" style="color:#fbbf24">${agg.warningCount}</div><div class="lbl">يحتاج متابعة</div></div>
    <div class="kpi"><div class="num" style="color:#4ade80">${agg.goodCount}</div><div class="lbl">وضعه مقبول</div></div>
    <div class="kpi"><div class="num" style="color:${agg.avgProt >= 80 ? '#4ade80' : agg.avgProt >= 60 ? '#fbbf24' : '#f87171'}">${agg.avgProt.toFixed(0)}%</div><div class="lbl">مستوى الحماية</div></div>
  </div>
  <div class="cover-note">تاريخ الإصدار: ${reportDate} | سري — للاستخدام الداخلي فقط</div>
</div>

<!-- ▸ Body --><div class="page">
${sections.has('executive') ? `
  <h2 class="sec">📋 الصورة الكاملة دفعة واحدة</h2>
  ${aiMode ? `<div class="narr">${narr.executive}</div>` : ''}
  <div class="kpi-row">
    <div class="kpi-card"><div class="num" style="color:#ef4444">${agg.criticalCount}</div><div class="lbl">يحتاج تدخلاً عاجلاً</div></div>
    <div class="kpi-card"><div class="num" style="color:#f59e0b">${agg.warningCount}</div><div class="lbl">يحتاج متابعة</div></div>
    <div class="kpi-card"><div class="num" style="color:#10b981">${agg.goodCount}</div><div class="lbl">وضعه مقبول</div></div>
    <div class="kpi-card"><div class="num" style="color:#3b82f6">${agg.avgProt.toFixed(0)}%</div><div class="lbl">مستوى الحماية الإجمالي</div></div>
    <div class="kpi-card"><div class="num" style="color:#8b5cf6">${agg.withCp}</div><div class="lbl">مجهز بمنظومة الحماية</div></div>
  </div>
  ${agg.criticalCount > 0 ? `<div class="decision-box urgent"><b style="color:#dc2626">⚠ قرار مطلوب:</b> ${agg.criticalCount} خط${agg.criticalCount > 1 ? ' تحتاج' : ' يحتاج'} موافقة فورية على الصيانة العاجلة.</div>` : agg.warningCount > 0 ? `<div class="decision-box watch"><b style="color:#d97706">📋 للمعلومية:</b> ${agg.warningCount} خط${agg.warningCount > 1 ? ' تحتاج' : ' يحتاج'} متابعة دورية، لا يوجد إجراء طارئ الآن.</div>` : `<div class="decision-box"><b style="color:#16a34a">✓ الوضع جيد:</b> لا توجد إجراءات عاجلة مطلوبة في هذه الفترة.</div>`}
` : ''}

${sections.has('network') ? `
  <h2 class="sec" style="margin-top:48px">🗺 بيانات مرجعية — وضع كل خط أنابيب</h2>
  <p style="font-size:11px;color:#64748b;margin-bottom:10px">هذا الجدول مرجعي تفصيلي للفريق الفني. متخذ القرار يحتاج فقط للمعلومات الموجزة في الأقسام السابقة.</p>
  <table>
    <tr><th>اسم الخط</th><th>تاريخ آخر فحص</th><th>الوضع الراهن</th><th>مستوى الحماية</th><th>منظومة الحماية من الصدأ</th><th>الإجراء المطلوب</th></tr>
    ${netRows}
  </table>
` : ''}

${sections.has('alerts') ? `
  <div class="pb"></div>
  <h2 class="sec">⚠️ ما يستدعي اهتمامك</h2>
  ${aiMode ? `<div class="narr ${agg.criticalCount > 0 ? 'red' : 'yellow'}">${narr.alerts}</div>` : ''}
  ${agg.results.filter(r => r.analysis.overall_status !== 'GOOD').length === 0
    ? `<div class="decision-box"><b style="color:#16a34a">✓ لا توجد مشاكل:</b> جميع الخطوط تعمل بشكل سليم في هذه الفترة.</div>`
    : `<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      ${agg.criticalCount > 0 ? `<div style="flex:1;min-width:140px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:900;color:#dc2626">${agg.criticalCount}</div><div style="font-size:12px;color:#b91c1c;margin-top:4px">خط تحتاج تدخلاً عاجلاً</div></div>` : ''}
      ${agg.warningCount  > 0 ? `<div style="flex:1;min-width:140px;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:900;color:#d97706">${agg.warningCount}</div><div style="font-size:12px;color:#92400e;margin-top:4px">خط تحتاج متابعة</div></div>` : ''}
      <div style="flex:1;min-width:140px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;text-align:center"><div style="font-size:32px;font-weight:900;color:#16a34a">${agg.goodCount}</div><div style="font-size:12px;color:#166534;margin-top:4px">خط وضعه مقبول</div></div>
    </div>
    ${agg.criticalCount > 0 ? `<div class="decision-box urgent" style="margin-bottom:14px">
      <b style="color:#dc2626">ماذا يحدث إن لم نتدخل؟</b><br/>
      <span style="font-size:12px;color:#7f1d1d">الخطوط الحرجة تتعرض لتآكل متسارع يصعب إصلاحه لاحقاً — تكلفة الصيانة الآن أقل بكثير من تكلفة الإصلاح لاحقاً، كما قد يؤدي إلى تعطل في العمليات.</span>
    </div>` : ''}
    <p style="font-size:11px;color:#64748b;margin-bottom:8px">الخطوط الثلاثة الأكثر احتياجاً للعناية الفورية:</p>
    <table>
    <tr><th>الخط</th><th>الوضع</th><th>نسبة الحماية</th><th>القرار المطلوب</th><th>الجدول الزمني</th></tr>
    ${agg.results
      .filter(r => r.analysis.overall_status !== 'GOOD')
      .sort((a, b) => (a.analysis.stats.protected_pct ?? 0) - (b.analysis.stats.protected_pct ?? 0))
      .slice(0, 3)
      .map(r => `<tr>
        <td><b>${r.display_name}</b></td>
        <td><span class="tag ${r.analysis.overall_status === 'CRITICAL' ? 'tag-red' : 'tag-yellow'}">${STATUS_LABEL[r.analysis.overall_status]}</span></td>
        <td>${r.analysis.stats.protected_pct.toFixed(0)}%</td>
        <td style="font-size:12px">${r.analysis.overall_status === 'CRITICAL' ? 'الموافقة على ميزانية الصيانة العاجلة' : 'جدولة فحص دوري'}</td>
        <td style="font-size:12px;font-weight:600;color:${r.analysis.overall_status === 'CRITICAL' ? '#dc2626' : '#d97706'}">${r.analysis.overall_status === 'CRITICAL' ? 'خلال أسبوع' : 'خلال شهر'}</td>
      </tr>`).join('')}
    </table>
    ${agg.results.filter(r => r.analysis.overall_status !== 'GOOD').length > 3
      ? `<p style="font-size:11px;color:#64748b;margin-top:6px;font-style:italic">└ للاطلاع على بيانات جميع الخطوط الـ ${agg.results.filter(r => r.analysis.overall_status !== 'GOOD').length}، راجع جدول الحالة التفصيلي في الصفحة التالية.</p>`
      : ''}
    `}
` : ''}

${sections.has('workorders') ? `
  <h2 class="sec">🔧 الأعمال المطلوبة</h2>
  ${aiMode ? `<div class="narr">${narr.workorders}</div>` : ''}
  <table>
    <tr><th>متى؟</th><th>ماذا نحتاج؟</th><th>أي خط؟</th><th>الجهة المسؤولة</th></tr>
    ${woRows}
  </table>
` : ''}

${sections.has('budget') ? `
  <h2 class="sec">💰 الأولويات المالية</h2>
  <div class="narr" style="font-size:12px">الجدول أدناه يُحدد أولويات الإنفاق بناءً على نتائج الفحص. التكاليف الفعلية تتحدد بعد تقييم ميداني من الفريق الفني.</div>
  <table>
    <tr><th>الأولوية</th><th>طبيعة العمل</th><th>الخطوط المشمولة</th><th>التوقيت المقترح</th><th>مستوى الأهمية</th></tr>
    ${agg.criticalCount > 0 ? `<tr style="background:#fee2e2"><td style="color:#dc2626;font-weight:700">🔴 فوري</td><td>صيانة طارئة لمنظومة الحماية من الصدأ</td><td>${agg.criticalCount} خط</td><td>خلال أسبوع</td><td style="font-weight:700">قصوى — لا يُؤجَّل</td></tr>` : ''}
    ${agg.warningCount  > 0 ? `<tr style="background:#fef3c7"><td style="color:#d97706;font-weight:700">🟡 عاجل</td><td>صيانة وقائية وفحص دوري</td><td>${agg.warningCount} خط</td><td>خلال شهر إلى شهرين</td><td>عالية — لا يُؤخَّر أكثر</td></tr>` : ''}
    ${agg.withoutCp     > 0 ? `<tr style="background:#eff6ff"><td style="color:#1d4ed8;font-weight:700">🔵 مخطط</td><td>تجهيز خطوط بمنظومة الحماية من الصدأ</td><td>${agg.withoutCp} خط</td><td>ضمن الخطة الرأسمالية</td><td>استثمارية — تُقلل التكلفة مستقبلاً</td></tr>` : ''}
    <tr><td>🟢 دوري</td><td>فحص وقائي سنوي للشبكة</td><td>${agg.totalPipelines} خط</td><td>سنوياً</td><td>منخفضة — ميزانية تشغيلية</td></tr>
  </table>
` : ''}

${sections.has('compliance') ? `
  <div class="pb"></div>
  <h2 class="sec">✅ مطابقة المعايير الدولية للحماية</h2>
  <div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap">
    <div style="flex:1;min-width:130px;background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:18px;text-align:center">
      <div style="font-size:38px;font-weight:900;color:#16a34a">${agg.compliantCount}</div>
      <div style="font-size:12px;color:#166534;margin-top:5px">خط ضمن المعايير</div>
    </div>
    <div style="flex:1;min-width:130px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:18px;text-align:center">
      <div style="font-size:38px;font-weight:900;color:#dc2626">${agg.totalPipelines - agg.compliantCount}</div>
      <div style="font-size:12px;color:#b91c1c;margin-top:5px">خط تحتاج تحسين</div>
    </div>
    <div style="flex:1;min-width:130px;background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:18px;text-align:center">
      <div style="font-size:38px;font-weight:900;color:#1d4ed8">${agg.totalPipelines > 0 ? Math.round((agg.compliantCount/agg.totalPipelines)*100) : 0}%</div>
      <div style="font-size:12px;color:#1e40af;margin-top:5px">نسبة المطابقة</div>
    </div>
  </div>
  ${agg.compliantCount < agg.totalPipelines ? `
  <p style="font-size:12px;color:#64748b;margin-bottom:10px">تفاصيل الخطوط غير المستوفية للمعايير (للمرجع الفني):</p>
  <table>
    <tr><th>الخط</th><th>نسبة الحماية</th><th>هل يستوفي المعايير؟</th><th>ما المطلوب؟</th></tr>
    ${complianceRows}
  </table>` : `<div class="decision-box"><b style="color:#16a34a">✓ جميع الخطوط مستوفية:</b> جميع الخطوط تحقق المعايير الدولية في هذه الفترة.</div>`}
` : ''}

${sections.has('recs') ? `
  <h2 class="sec">📌 قرارات مقترحة للإدارة العليا</h2>
  ${aiMode ? `<div class="narr">${narr.recs}</div>` : ''}
  <table>
    <tr><th>الأولوية</th><th>القرار المقترح</th><th>الجهة المسؤولة</th><th>متى؟</th></tr>
    ${agg.criticalCount > 0 ? `<tr style="background:#fee2e2"><td style="color:#dc2626;font-weight:700">🔴 فوري</td><td>الموافقة على ميزانية صيانة طارئة لـ ${agg.criticalCount} خط${agg.criticalCount > 1 ? ' تحتاج' : ' يحتاج'} تدخلاً عاجلاً</td><td>مدير الصيانة والإدارة المالية</td><td>خلال أسبوع</td></tr>` : ''}
    ${agg.warningCount  > 0 ? `<tr style="background:#fef3c7"><td style="color:#d97706;font-weight:700">🟡 قريب</td><td>جدولة صيانة وقائية لـ ${agg.warningCount} خط${agg.warningCount > 1 ? ' تحتاج' : ' يحتاج'} متابعة</td><td>مشرف الصيانة</td><td>خلال 30 يوماً</td></tr>` : ''}
    ${agg.withoutCp     > 0 ? `<tr style="background:#eff6ff"><td style="color:#1d4ed8;font-weight:700">🔵 مخطط</td><td>إدراج تجهيز ${agg.withoutCp} خط بمنظومة الحماية من الصدأ في خطة الاستثمار القادمة</td><td>الإدارة الفنية والمالية</td><td>ضمن الخطة الرأسمالية</td></tr>` : ''}
    <tr><td>🟢 سنوي</td><td>الإبقاء على برنامج الفحص الوقائي السنوي للشبكة كاملة</td><td>قسم السلامة والصيانة</td><td>سنوياً</td></tr>
  </table>
` : ''}
</div>
<div class="footer">
  تقرير إداري سري — سلامة شبكة الأنابيب | تاريخ الإصدار: ${reportDate} | للاستخدام الداخلي فقط
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════════

interface AdminReportsPanelProps {
  pipelines:        CpPipeline[];
  pipelinesLoading: boolean;
  onGoToAnalysis:   () => void;
  onGoToSessions:   () => void;
}

export function AdminReportsPanel({
  pipelines,
  pipelinesLoading,
  onGoToAnalysis,
  onGoToSessions,
}: AdminReportsPanelProps) {
  const [reportType, setReportType] = useState<ReportPeriod>('quarterly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [sections,   setSections]   = useState<Set<SectionKey>>(
    new Set(['executive', 'network', 'alerts', 'workorders', 'compliance', 'recs'] as SectionKey[]),
  );
  const [aiMode,    setAiMode]    = useState(true);
  const [loading,   setLoading]   = useState(false);
  const [aggData,   setAggData]   = useState<AggData | null>(null);
  const [error,     setError]     = useState('');

  const periodLabel = getPeriodLabel(reportType, customFrom, customTo);

  const toggleSection = (key: SectionKey) => {
    setSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    setAggData(null);
    const results: PipelineResult[] = [];

    for (const pipeline of pipelines) {
      if (!pipeline.sessions.length) continue;
      const latestSession = [...pipeline.sessions].sort((a, b) => {
        const da = a.survey_date ? new Date(a.survey_date).getTime() : 0;
        const db = b.survey_date ? new Date(b.survey_date).getTime() : 0;
        return db - da;
      })[0];

      try {
        const params = new URLSearchParams({ segment_size: '100' });
        const res = await fetch(`/api/v1/corrosion/cp-analysis/${latestSession.session_id}?${params}`, { headers: getHeaders() });
        if (!res.ok) continue;
        const analysis: CpAnalysis = await res.json();
        results.push({
          pipeline_id:  pipeline.pipeline_id ?? null,
          display_name: pipeline.display_name,
          session_id:   latestSession.session_id,
          session_date: latestSession.survey_date ?? null,
          cp_installed: latestSession.cp_system_installed ?? null,
          cp_year:      latestSession.cp_installation_year ?? null,
          analysis,
        });
      } catch { /* skip failed */ }
    }

    if (!results.length) {
      setError('لم يُعثر على بيانات تحليل. تأكد من رفع جلسات المسح وتحليلها أولاً.');
      setLoading(false);
      return;
    }
    setAggData(buildAgg(results, pipelines));
    setLoading(false);
  }, [pipelines]);

  const handlePrint = useCallback(() => {
    if (!aggData) return;
    const reportDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = buildPrintHtml(aggData, sections, periodLabel, aiMode, reportDate);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }, [aggData, sections, periodLabel, aiMode]);

  // ─── Guard states ────────────────────────────────────────────────────────────
  if (pipelinesLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" /> جاري تحميل البيانات...
      </div>
    );
  }
  if (!pipelines.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <FileText className="w-12 h-12 text-slate-600" />
        <p className="text-slate-300 font-semibold">لا توجد خطوط مُسَّحة</p>
        <p className="text-sm text-slate-500">يجب رفع جلسات مسح CP أولاً لتوليد التقارير الإدارية</p>
        <button
          onClick={onGoToSessions}
          className="px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-medium hover:bg-orange-500/30 transition-colors"
        >
          الانتقال إلى جلسات المسح
        </button>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">التقارير الإدارية</h2>
            <p className="text-xs text-slate-400">تقارير شاملة موجهة للإدارة العليا وصناع القرار — جميع الخطوط</p>
          </div>
        </div>
        {aggData && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-600/30 transition-colors"
          >
            <Printer className="w-4 h-4" /> طباعة / PDF
          </button>
        )}
      </div>

      {/* ── Configuration ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Period */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" /> نوع التقرير والفترة
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'monthly',   label: 'شهري' },
              { key: 'quarterly', label: 'ربع سنوي' },
              { key: 'annual',    label: 'سنوي' },
              { key: 'custom',    label: 'مخصص' },
            ] as { key: ReportPeriod; label: string }[]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setReportType(opt.key)}
                className={`py-2 rounded-lg text-xs font-semibold transition-all border ${
                  reportType === opt.key
                    ? 'bg-blue-600/30 border-blue-500/40 text-blue-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {reportType === 'custom' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">من تاريخ</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">إلى تاريخ</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-1">الفترة المحددة</p>
            <p className="text-sm text-white font-medium">{periodLabel}</p>
          </div>
        </div>

        {/* Sections */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" /> محتويات التقرير
          </h3>
          <div className="space-y-2">
            {SECTION_CONFIG.map(sec => (
              <label key={sec.key} className="flex items-center gap-2.5 cursor-pointer group" onClick={() => toggleSection(sec.key)}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                  sections.has(sec.key) ? 'bg-blue-600 border-blue-500' : 'border-slate-600'
                }`}>
                  {sections.has(sec.key) && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                  {sec.icon} {sec.label}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-700/50">
            <button
              onClick={() => setSections(new Set(SECTION_CONFIG.map(s => s.key)))}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >تحديد الكل</button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setSections(new Set(['executive', 'alerts', 'recs'] as SectionKey[]))}
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >ملخص فقط</button>
          </div>
        </div>

        {/* Options + Generate */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" /> خيارات التقرير
          </h3>

          {/* AI Narrative toggle */}
          <div
            onClick={() => setAiMode(v => !v)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              aiMode ? 'bg-purple-900/20 border-purple-500/30' : 'bg-slate-800/50 border-slate-700'
            }`}
          >
            <div className={`w-9 h-5 rounded-full relative transition-all ${aiMode ? 'bg-purple-600' : 'bg-slate-600'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${aiMode ? 'right-0.5' : 'left-0.5'}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">الصياغة التلقائية</p>
              <p className="text-xs text-slate-500">نص سردي احترافي لكل قسم</p>
            </div>
            <Sparkles className={`w-4 h-4 mr-auto transition-colors ${aiMode ? 'text-purple-400' : 'text-slate-600'}`} />
          </div>

          {/* Network summary */}
          <div className="bg-slate-800/50 rounded-xl p-3 space-y-1.5">
            <p className="text-xs text-slate-500 font-medium mb-2">الشبكة الحالية</p>
            {[
              { label: 'الخطوط', value: pipelines.length, color: 'text-white' },
              { label: 'إجمالي الجلسات', value: pipelines.reduce((s, p) => s + p.session_count, 0), color: 'text-white' },
              { label: 'مؤهلة للتنبؤ', value: pipelines.filter(p => p.has_multi_survey).length, color: 'text-purple-300' },
            ].map((row, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-400">{row.label}</span>
                <span className={`font-medium ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> جاري التوليد ({pipelines.length} خط)...</>
              : <><Activity className="w-4 h-4" /> توليد التقرير</>
            }
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* ═════════════════════════════ REPORT OUTPUT ════════════════════════════ */}
      {aggData && (
        <div className="space-y-5">

          {/* Status banner */}
          <div className={`flex items-center justify-between rounded-2xl border p-5 ${
            aggData.criticalCount > 0 ? 'bg-red-900/20 border-red-500/30'
            : aggData.warningCount > 0 ? 'bg-amber-900/20 border-amber-500/30'
            : 'bg-emerald-900/20 border-emerald-500/30'
          }`}>
            <div className="flex-1 min-w-0 ml-4">
              <p className="text-xs text-slate-400 mb-1">التقرير الإداري — {periodLabel}</p>
              <h3 className={`text-xl font-bold mb-2 ${
                aggData.criticalCount > 0 ? 'text-red-200' : aggData.warningCount > 0 ? 'text-amber-200' : 'text-emerald-200'
              }`}>
                {aggData.criticalCount > 0 ? '⚠ تنبيه — يتطلب تدخلاً عاجلاً'
                  : aggData.warningCount > 0 ? '⚡ تحت المراقبة — متابعة مطلوبة'
                  : '✓ الوضع مقبول — متابعة اعتيادية'}
              </h3>
              {aiMode && (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {buildNarrative(aggData, periodLabel).executive}
                </p>
              )}
            </div>
            <div className="text-center shrink-0">
              <p className={`text-5xl font-black tabular-nums ${
                aggData.avgProt >= 80 ? 'text-emerald-300' : aggData.avgProt >= 60 ? 'text-amber-300' : 'text-red-300'
              }`}>{aggData.avgProt.toFixed(0)}%</p>
              <p className="text-xs text-slate-400 mt-1">متوسط الحماية</p>
            </div>
          </div>

          {/* ── Executive KPIs ── */}
          {sections.has('executive') && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'خط حرج',        value: aggData.criticalCount,    color: aggData.criticalCount > 0 ? 'text-red-300' : 'text-slate-500', border: 'border-red-500/30' },
                { label: 'تحت المراقبة',  value: aggData.warningCount,     color: 'text-amber-300',   border: 'border-amber-500/30' },
                { label: 'حالة جيدة',     value: aggData.goodCount,        color: 'text-emerald-300', border: 'border-emerald-500/30' },
                { label: 'مواقع تحتاج متابعة', value: aggData.totalCritZones,  color: 'text-purple-300',  border: 'border-purple-500/30' },
                { label: 'ضمن المعايير',   value: `${aggData.compliantCount}/${aggData.totalPipelines}`, color: 'text-blue-300', border: 'border-blue-500/30' },
              ].map((k, i) => (
                <div key={i} className={`bg-slate-900/50 rounded-xl border ${k.border} p-4 text-center`}>
                  <p className={`text-3xl font-black tabular-nums ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Network Status Table ── */}
          {sections.has('network') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
                <Layers className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-300">وضع كل خط أنابيب</h3>
                <span className="text-xs text-slate-600 mr-auto">{aggData.totalPipelines} خط مُحلَّل</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60">
                      {['الخط', 'تاريخ الفحص', 'الوضع الراهن', 'مستوى الحماية', 'منظومة الحماية', 'ضمن المعايير', 'الإجراء'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-right text-slate-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggData.results.map((r, i) => {
                      const sc  = statusColors(r.analysis.overall_status);
                      const pct = r.analysis.stats.protected_pct;
                      return (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{r.display_name}</td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                            {r.session_date ? new Date(r.session_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.badge}`}>
                              {STATUS_LABEL[r.analysis.overall_status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`tabular-nums ${pct >= 80 ? 'text-emerald-300' : pct >= 60 ? 'text-amber-300' : 'text-red-300'}`}>
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold ${r.analysis.compliance_summary?.compliant ? 'text-emerald-300' : 'text-red-300'}`}>
                              {r.analysis.compliance_summary?.compliant ? '✓ ضمن المعايير' : '✗ يحتاج تحسين'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={r.analysis.overall_status === 'CRITICAL' ? 'text-red-300 font-semibold' : r.analysis.overall_status === 'WARNING' ? 'text-amber-300' : 'text-slate-500'}>
                              {r.analysis.overall_status === 'CRITICAL' ? 'صيانة عاجلة' : r.analysis.overall_status === 'WARNING' ? 'متابعة دورية' : 'لا يوجد'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.cp_installed === 'YES' ? (
                              <span className="flex items-center gap-1 text-green-300 text-xs">
                                <Shield className="w-3 h-3" />{r.cp_year ?? 'محمي'}
                              </span>
                            ) : r.cp_installed === 'NO' ? (
                              <span className="flex items-center gap-1 text-red-300 text-xs">
                                <ShieldOff className="w-3 h-3" />غير محمي
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Alerts ── */}
          {sections.has('alerts') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> ما يستدعي الاهتمام
              </h3>
              {aiMode && (
                <p className="text-xs text-slate-400 leading-relaxed mb-4 bg-amber-900/10 border-r-2 border-amber-500/40 rounded-r-lg pl-3 pr-3 py-2">
                  {buildNarrative(aggData, periodLabel).alerts}
                </p>
              )}
              {aggData.results.filter(r => r.analysis.overall_status !== 'GOOD').length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-300 text-sm py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  لا توجد تنبيهات — جميع الخطوط في وضع جيد
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {aggData.criticalCount > 0 && (
                      <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 text-center">
                        <p className="text-3xl font-black text-red-300">{aggData.criticalCount}</p>
                        <p className="text-xs text-red-400 mt-1">يحتاج تدخلاً عاجلاً</p>
                      </div>
                    )}
                    {aggData.warningCount > 0 && (
                      <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl p-3 text-center">
                        <p className="text-3xl font-black text-amber-300">{aggData.warningCount}</p>
                        <p className="text-xs text-amber-400 mt-1">يحتاج متابعة</p>
                      </div>
                    )}
                    <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-xl p-3 text-center">
                      <p className="text-3xl font-black text-emerald-300">{aggData.goodCount}</p>
                      <p className="text-xs text-emerald-400 mt-1">وضعه مقبول</p>
                    </div>
                  </div>
                  {aggData.criticalCount > 0 && (
                    <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-300 mb-1">ماذا يحدث إن لم نتدخل؟</p>
                      <p className="text-xs text-slate-400">الخطوط الحرجة تتعرض لتآكل متسارع — تكلفة الصيانة الآن أقل بكثير من تكلفة الإصلاح لاحقاً، وقد يؤدي إلى تعطل في العمليات.</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">الخطوط الأكثر احتياجاً للعناية الفورية:</p>
                  <div className="space-y-2">
                    {aggData.results
                      .filter(r => r.analysis.overall_status !== 'GOOD')
                      .sort((a, b) => (a.analysis.stats.protected_pct ?? 0) - (b.analysis.stats.protected_pct ?? 0))
                      .slice(0, 3)
                      .map((r, i) => {
                        const sc = statusColors(r.analysis.overall_status);
                        return (
                          <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${sc.bg} ${sc.border}`}>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${sc.badge}`}>{STATUS_LABEL[r.analysis.overall_status]}</span>
                            <span className="text-xs text-slate-300 flex-1">{r.analysis.overall_status === 'CRITICAL' ? 'يحتاج موافقة على صيانة عاجلة' : 'يُوصى بجدولة فحص دوري'}</span>
                            <span className={`text-sm font-black shrink-0 ${sc.text}`}>{r.analysis.stats.protected_pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                  </div>
                  {aggData.results.filter(r => r.analysis.overall_status !== 'GOOD').length > 3 && (
                    <p className="text-xs text-slate-500 text-center">+ {aggData.results.filter(r => r.analysis.overall_status !== 'GOOD').length - 3} خطوط أخرى — للتفاصيل الكاملة راجع التقرير المطبوع</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Predictions ── */}
          {sections.has('predictions') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-purple-400" /> التوقعات المستقبلية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">مؤهلة للتنبؤ (مسوحات متعددة)</p>
                  <p className="text-3xl font-black text-purple-300">{aggData.predEligible}</p>
                  <p className="text-xs text-slate-500 mt-1">من {aggData.totalPipelines} خط</p>
                  {aggData.predEligible === 0 && (
                    <p className="text-xs text-amber-400 mt-2">⚠ التنبؤ يتطلب فحصين على الأقل للخط الواحد</p>
                  )}
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">منظومة الحماية من الصدأ</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="flex items-center gap-1 text-green-300"><Shield className="w-3 h-3" />مجهز بمنظومة الحماية</span><span className="font-bold text-white">{aggData.withCp}</span></div>
                    <div className="flex justify-between text-xs"><span className="flex items-center gap-1 text-red-300"><ShieldOff className="w-3 h-3" />غير مجهز</span><span className="font-bold text-white">{aggData.withoutCp}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">غير محدد</span><span className="text-slate-400">{aggData.cpUnknown}</span></div>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">أفضل / أسوأ أداء</p>
                  {aggData.best && (
                    <p className="text-xs text-emerald-300 mb-1">
                      ✓ أفضل: <span className="font-medium text-white">{aggData.best.display_name}</span> ({aggData.best.analysis.stats.protected_pct.toFixed(1)}%)
                    </p>
                  )}
                  {aggData.worst && (
                    <p className="text-xs text-red-300">
                      ✗ يحتاج اهتمام: <span className="font-medium text-white">{aggData.worst.display_name}</span> ({aggData.worst.analysis.stats.protected_pct.toFixed(1)}%)
                    </p>
                  )}
                </div>
              </div>
              {aggData.predEligible > 0 && (
                <div className="mt-3 text-xs text-slate-400 bg-purple-900/10 border border-purple-500/20 rounded-lg p-3 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-400" />
                  <span>{aggData.predEligible} خط مؤهل لتحليل التنبؤ التفصيلي. انتقل إلى تبويب "التنبؤ المتقدم" لمراجعة معدلات التدهور والعمر التقديري لكل خط.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Work Orders ── */}
          {sections.has('workorders') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                <Wrench className="w-4 h-4 text-orange-400" /> الأعمال المطلوبة
              </h3>
              {aiMode && (
                <p className="text-xs text-slate-400 leading-relaxed mb-4 bg-orange-900/10 border-r-2 border-orange-500/40 rounded-r-lg px-3 py-2">
                  {buildNarrative(aggData, periodLabel).workorders}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60">
                      {['الأولوية', 'نوع العمل', 'الخط / الموقع', 'الجهة المسؤولة', 'الجدول الزمني'].map(h => (
                        <th key={h} className="px-3 py-2 text-right text-slate-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggData.criticalCount > 0 && (
                      <tr className="border-b border-slate-800/50 bg-red-900/10">
                        <td className="px-3 py-2"><span className="bg-red-600 text-white rounded-full px-2 py-0.5 font-bold whitespace-nowrap">فوري</span></td>
                        <td className="px-3 py-2 text-slate-300">صيانة شاملة لمنظومة الحماية من الصدأ</td>
                        <td className="px-3 py-2 text-white font-medium">{aggData.criticalCount} خط {aggData.criticalCount > 1 ? 'تحتاج' : 'يحتاج'} تدخلاً عاجلاً</td>
                        <td className="px-3 py-2 text-slate-400">فريق الصيانة</td>
                        <td className="px-3 py-2 text-red-300 whitespace-nowrap">خلال 7 أيام</td>
                      </tr>
                    )}
                    {aggData.warningCount > 0 && (
                      <tr className="border-b border-slate-800/50 bg-amber-900/10">
                        <td className="px-3 py-2"><span className="bg-amber-600 text-white rounded-full px-2 py-0.5 font-bold whitespace-nowrap">مجدول</span></td>
                        <td className="px-3 py-2 text-slate-300">فحص دوري وصيانة وقائية</td>
                        <td className="px-3 py-2 text-white font-medium">{aggData.warningCount} خط {aggData.warningCount > 1 ? 'تحتاج' : 'يحتاج'} متابعة</td>
                        <td className="px-3 py-2 text-slate-400">مشرف الصيانة</td>
                        <td className="px-3 py-2 text-amber-300 whitespace-nowrap">خلال 30 يوماً</td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-800/50">
                      <td className="px-3 py-2"><span className="bg-slate-600 text-white rounded-full px-2 py-0.5 whitespace-nowrap">دوري</span></td>
                      <td className="px-3 py-2 text-slate-300">فحص وقائي سنوي شامل وتحديث السجلات</td>
                      <td className="px-3 py-2 text-slate-400">الشبكة الكاملة ({aggData.totalPipelines} خط)</td>
                      <td className="px-3 py-2 text-slate-400">قسم السلامة والصيانة</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">سنوياً</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Budget Priorities ── */}
          {sections.has('budget') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> الأولويات المالية (تقديرية)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                التقديرات إرشادية وتستند إلى معايير الصناعة. التكاليف الفعلية تتفاوت بحسب الموقع وتفاصيل العقود.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {aggData.criticalCount > 0 && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-xs text-red-300 font-semibold mb-1">🔴 فوري — حرج</p>
                    <p className="text-2xl font-black text-white">{aggData.criticalCount} خط</p>
                    <p className="text-xs text-slate-400 mt-1">صيانة شاملة لمنظومة الحماية</p>
                    <p className="text-xs text-red-300 mt-2 font-medium">أولوية قصوى في الميزانية</p>
                  </div>
                )}
                {aggData.warningCount > 0 && (
                  <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
                    <p className="text-xs text-amber-300 font-semibold mb-1">🟡 عاجل — متوسط</p>
                    <p className="text-2xl font-black text-white">{aggData.warningCount} خط</p>
                    <p className="text-xs text-slate-400 mt-1">صيانة وقائية وضبط أنظمة الحماية</p>
                    <p className="text-xs text-amber-300 mt-2 font-medium">جدولة خلال الربع القادم</p>
                  </div>
                )}
                {aggData.withoutCp > 0 && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-xs text-blue-300 font-semibold mb-1">🔵 استثمار — مخطط</p>
                    <p className="text-2xl font-black text-white">{aggData.withoutCp} خط</p>
                    <p className="text-xs text-slate-400 mt-1">تجهيز خطوط بمنظومة الحماية من الصدأ</p>
                    <p className="text-xs text-blue-300 mt-2 font-medium">ضمن خطة الاستثمار الرأسمالي</p>
                  </div>
                )}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-400 font-semibold mb-1">🟢 دوري — سنوي</p>
                  <p className="text-2xl font-black text-white">{aggData.totalPipelines} خط</p>
                  <p className="text-xs text-slate-400 mt-1">فحص وقائي سنوي وتحديث السجلات</p>
                  <p className="text-xs text-slate-500 mt-2">الميزانية الاعتيادية</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Compliance ── */}
          {sections.has('compliance') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> مطابقة المعايير الدولية للحماية
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'مستوفٍ للمعيار', v: aggData.compliantCount, c: 'text-emerald-300' },
                  { label: 'غير مستوفٍ', v: aggData.totalPipelines - aggData.compliantCount, c: 'text-red-300' },
                  { label: 'نسبة الامتثال', v: `${aggData.totalPipelines ? ((aggData.compliantCount / aggData.totalPipelines) * 100).toFixed(0) : 0}%`, c: 'text-blue-300' },
                  { label: 'المتوسط العام', v: `${aggData.avgProt.toFixed(1)}%`, c: aggData.avgProt >= 80 ? 'text-emerald-300' : 'text-amber-300' },
                ].map((k, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-black tabular-nums ${k.c}`}>{k.v}</p>
                    <p className="text-xs text-slate-400 mt-1">{k.label}</p>
                  </div>
                ))}
              </div>
              {aggData.totalPipelines - aggData.compliantCount > 0 ? (
                <div className="mt-1 text-xs text-slate-400 bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                  <span>{aggData.totalPipelines - aggData.compliantCount} خط{aggData.totalPipelines - aggData.compliantCount > 1 ? ' لا تستوفي' : ' لا يستوفي'} المعايير الدولية للحماية. للتفاصيل الكاملة لكل خط، راجع التقرير المطبوع.</span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>جميع الخطوط مستوفية للمعايير الدولية في هذه الفترة.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Recommendations ── */}
          {sections.has('recs') && (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                <ClipboardList className="w-4 h-4 text-indigo-400" /> التوصيات للإدارة العليا
              </h3>
              {aiMode && (
                <pre className="text-xs text-slate-300 leading-relaxed bg-indigo-900/10 border-r-2 border-indigo-500/40 rounded-r-lg px-3 py-3 mb-4 whitespace-pre-wrap font-sans">
                  {buildNarrative(aggData, periodLabel).recs}
                </pre>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60">
                      {['الأولوية', 'التوصية', 'الجهة المسؤولة', 'الإطار الزمني'].map(h => (
                        <th key={h} className="px-3 py-2 text-right text-slate-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggData.criticalCount > 0 && (
                      <tr className="border-b border-slate-800/50 bg-red-900/10">
                        <td className="px-3 py-2 whitespace-nowrap"><span className="bg-red-600 text-white rounded-full px-2 py-0.5 font-bold text-xs">فوري</span></td>
                        <td className="px-3 py-2 text-slate-300">الإذن بتنفيذ أعمال تأهيل CP على الخطوط الحرجة ({aggData.criticalCount} خط)</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">مدير الصيانة</td>
                        <td className="px-3 py-2 text-red-300 whitespace-nowrap">خلال أسبوع</td>
                      </tr>
                    )}
                    {aggData.warningCount > 0 && (
                      <tr className="border-b border-slate-800/50 bg-amber-900/10">
                        <td className="px-3 py-2 whitespace-nowrap"><span className="bg-amber-600 text-white rounded-full px-2 py-0.5 font-bold text-xs">عاجل</span></td>
                        <td className="px-3 py-2 text-slate-300">جدولة مراجعة منظومة الحماية على خطوط المراقبة ({aggData.warningCount} خط)</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">قسم النزاهة الهيكلية</td>
                        <td className="px-3 py-2 text-amber-300 whitespace-nowrap">خلال 30 يوماً</td>
                      </tr>
                    )}
                    {aggData.withoutCp > 0 && (
                      <tr className="border-b border-slate-800/50">
                        <td className="px-3 py-2 whitespace-nowrap"><span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">مخطط</span></td>
                        <td className="px-3 py-2 text-slate-300">دراسة تجهيز {aggData.withoutCp} خط بنظام CP ضمن خطة الاستثمار الرأسمالي</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">الإدارة الفنية</td>
                        <td className="px-3 py-2 text-blue-300 whitespace-nowrap">ربع سنوي</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap"><span className="bg-slate-600 text-white rounded-full px-2 py-0.5 text-xs">دوري</span></td>
                      <td className="px-3 py-2 text-slate-300">تفعيل برنامج المسح السنوي الشامل وتحديث سجلات قاعدة البيانات</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">فريق مسح CP</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">سنوياً</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500">
            <span>
              تم إنشاء التقرير: {new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })} |
              {' '}Digital Dashboard — إدارة التآكل | NACE SP0169
            </span>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> طباعة / PDF
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
