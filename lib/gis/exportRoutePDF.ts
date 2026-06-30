/**
 * GIS Optimal Path — PDF Report Generator
 * Uses jsPDF + jspdf-autotable for professional A4 Arabic/English report
 * Direction: RTL (Arabic), numbers: LTR
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface PathResult {
  priority: string;
  infra_type?: string;
  stats: {
    total_distance_km: number;
    direct_distance_km: number;
    efficiency_score: number;
    notes?: string[];
  };
  engineering: {
    dem_source?: string;
    routing_source?: string;
    standards?: string[];
    standards_ref?: string;
    quantities?: Array<{ desc: string; qty: number; unit: string; note?: string }>;
    cut_m3?: number;
    fill_m3?: number;
    elev_min_m?: number;
    elev_max_m?: number;
    infra_specific?: Record<string, unknown>;
    cost_estimate?: {
      direct_lyd: number;
      direct_usd: number;
      with_contingency_lyd: number;
      with_contingency_usd: number;
      currency_note: string;
      breakdown: Array<{ desc: string; qty: number; unit: string; rate_lyd: number; total_lyd: number }>;
    };
    work_program?: Array<{ phase: string; duration_wk: number; start_wk: number; end_wk: number; crew: string }>;
    risk_register?: Array<{ id: string; risk: string; category: string; probability: number; impact: number; score: number; mitigation: string }>;
  };
}

const INFRA_LABELS: Record<string, string> = {
  road:       'طريق',
  sewer:      'شبكة صرف صحي',
  water_pipe: 'خط مياه',
  power_line: 'خط كهرباء هوائي',
  telecom:    'كابل اتصالات',
  general:    'بنية تحتية عامة',
};

const PRIORITY_LABELS: Record<string, string> = {
  shortest:          'أقصر مسار',
  easiest_terrain:   'أسهل تضاريس',
  least_obstacles:   'أقل عقبات',
  balanced:          'متوازن',
};

export async function exportRoutePDF(
  result: PathResult,
  start: [number, number],
  end: [number, number],
) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; const H = 297;
  const ML = 15; const MR = 15; const MT = 15;
  const CW = W - ML - MR; // content width = 180mm
  let y = MT;

  const infra    = result.infra_type ?? 'general';
  const infraLbl = INFRA_LABELS[infra] ?? infra;
  const totalKm  = result.stats.total_distance_km;
  const eng      = result.engineering;
  const ce       = eng.cost_estimate;
  const wp       = eng.work_program ?? [];
  const rr       = eng.risk_register ?? [];
  const sp       = eng.infra_specific as Record<string, unknown> ?? {};

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);          // slate-900
  doc.rect(0, 0, W, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL DASHBOARD — GIS Infrastructure Analysis', W / 2, 10, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Infrastructure: ${infraLbl}  |  Route: ${totalKm.toFixed(2)} km`, W / 2, 18, { align: 'center' });
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}  |  Priority: ${PRIORITY_LABELS[result.priority] ?? result.priority}`, W / 2, 25, { align: 'center' });

  y = 38;
  doc.setTextColor(15, 23, 42);

  // ── Section helper ───────────────────────────────────────────────────────────
  const section = (title: string) => {
    if (y > H - 40) { doc.addPage(); y = MT; }
    doc.setFillColor(30, 41, 59);   // slate-800
    doc.rect(ML, y, CW, 7, 'F');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, ML + 3, y + 5);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    y += 10;
  };

  const kv = (label: string, value: string, yPos?: number) => {
    const row = yPos ?? y;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label + ':', ML, row + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), ML + 55, row + 3.5);
    if (!yPos) y += 6;
  };

  const newPage = () => { doc.addPage(); y = MT; };

  // ── 1. Route summary ────────────────────────────────────────────────────────
  section('1. Route Summary  |  ملخص المسار');

  // Two-column layout
  const colW = CW / 2 - 3;
  const col2x = ML + colW + 6;
  const summaryY = y;

  kv('Infrastructure Type', infraLbl, summaryY);
  kv('Total Distance', `${totalKm.toFixed(3)} km`, summaryY + 6);
  kv('Direct Distance', `${result.stats.direct_distance_km.toFixed(3)} km`, summaryY + 12);
  kv('Detour Factor', `${(totalKm / result.stats.direct_distance_km).toFixed(2)}×`, summaryY + 18);

  // Right column
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  const rc = (lbl: string, val: string, row: number) => {
    doc.text(lbl + ':', col2x, summaryY + row + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, col2x + 42, summaryY + row + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
  };
  rc('Routing Source', eng.routing_source ?? 'OSRM', 0);
  rc('Elevation Min', `${eng.elev_min_m ?? '—'} m`, 6);
  rc('Elevation Max', `${eng.elev_max_m ?? '—'} m`, 12);
  rc('Efficiency Score', `${result.stats.efficiency_score ?? '—'} / 100`, 18);

  y = summaryY + 30;

  // Coordinates
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Start: [${start[0].toFixed(5)}, ${start[1].toFixed(5)}]   End: [${end[0].toFixed(5)}, ${end[1].toFixed(5)}]`, ML, y);
  y += 8;

  // ── 2. Bill of Quantities ──────────────────────────────────────────────────
  section('2. Bill of Quantities (BOQ)  |  جدول الكميات');

  if (eng.quantities?.length) {
    (doc as any).autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      styles:       { fontSize: 8, cellPadding: 2 },
      headStyles:   { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      head: [['#', 'Description  |  البيان', 'Qty', 'Unit', 'Notes']],
      body: eng.quantities.map((q, i) => [
        i + 1,
        q.desc,
        q.qty.toLocaleString(),
        q.unit,
        (q.note ?? '').slice(0, 45),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── 3. Cost Estimate ────────────────────────────────────────────────────────
  if (ce) {
    if (y > H - 60) newPage();
    section('3. Cost Estimate  |  تقدير التكلفة');

    // Summary box
    doc.setFillColor(240, 253, 244);   // green-50
    doc.roundedRect(ML, y, CW, 18, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);    // green-600
    doc.text(`Direct Cost: ${ce.direct_lyd.toLocaleString()} LYD  =  USD ${ce.direct_usd.toLocaleString()}`, ML + 4, y + 7);
    doc.setTextColor(161, 98, 7);     // yellow-700
    doc.text(`Total (incl. 25% add-ons): ${ce.with_contingency_lyd.toLocaleString()} LYD  =  USD ${ce.with_contingency_usd.toLocaleString()}`, ML + 4, y + 13);
    doc.setTextColor(15, 23, 42);
    y += 22;

    (doc as any).autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      styles:       { fontSize: 7.5, cellPadding: 1.8 },
      headStyles:   { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: { 0: { cellWidth: 70 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      head: [['Item  |  البند', 'Unit', 'Qty', 'Rate (LYD)', 'Total (LYD)']],
      body: ce.breakdown.map(b => [
        b.desc.slice(0, 48),
        b.unit,
        b.qty.toLocaleString(),
        b.rate_lyd.toLocaleString(),
        b.total_lyd.toLocaleString(),
      ]),
      foot: [['TOTAL DIRECT COST', '', '', '', ce.direct_lyd.toLocaleString()]],
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Currency note: ${ce.currency_note}  |  +15% contingency, +10% engineering fee`, ML, y);
    y += 8;
  }

  // ── 4. Work Program ────────────────────────────────────────────────────────
  if (wp.length > 0) {
    if (y > H - 60) newPage();
    section('4. Construction Work Program  |  برنامج الإنشاء');

    const totalWk = Math.max(...wp.map(p => p.end_wk));

    (doc as any).autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      styles:       { fontSize: 7.5, cellPadding: 1.8 },
      headStyles:   { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 249, 255] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      head: [['Phase  |  المرحلة', 'Crew  |  الطاقم', 'Duration (wk)', 'Start W', 'End W']],
      body: wp.map(p => [p.phase, p.crew.slice(0, 32), p.duration_wk, p.start_wk, p.end_wk]),
      foot: [[`Total Project Duration: ${totalWk} weeks ≈ ${(totalWk / 4.3).toFixed(1)} months`, '', totalWk, 1, totalWk]],
      footStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold' },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── 5. Risk Register ────────────────────────────────────────────────────────
  if (rr.length > 0) {
    if (y > H - 70) newPage();
    section('5. Risk Register  |  سجل المخاطر  (ISO 31000:2018)');

    (doc as any).autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      styles:       { fontSize: 7, cellPadding: 1.6 },
      headStyles:   { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 18 }, 3: { halign: 'center', cellWidth: 12 }, 4: { halign: 'center', cellWidth: 12 }, 5: { halign: 'center', cellWidth: 12 } },
      head: [['ID', 'Risk  |  الخطر', 'Category', 'P', 'I', 'Score']],
      body: rr.map(r => {
        const level = r.score >= 12 ? 'HIGH' : r.score >= 6 ? 'MED' : 'LOW';
        return [r.id, r.risk.slice(0, 48), r.category, r.probability, r.impact, `${r.score} [${level}]`];
      }),
      didParseCell: (data: any) => {
        if (data.column.index === 5 && data.section === 'body') {
          const score = parseInt(data.cell.text[0]);
          data.cell.styles.textColor = score >= 12 ? [220, 38, 38] : score >= 6 ? [161, 98, 7] : [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // Mitigation table
    if (y < H - 40) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Risk Mitigation Measures:', ML, y + 4);
      y += 8;
      (doc as any).autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        styles:       { fontSize: 7, cellPadding: 1.5 },
        headStyles:   { fillColor: [71, 85, 105], textColor: 255 },
        columnStyles: { 0: { cellWidth: 12 } },
        head: [['ID', 'Mitigation  |  إجراء الحد']],
        body: rr.filter(r => r.score >= 6).map(r => [r.id, r.mitigation.slice(0, 90)]),
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
  }

  // ── 6. Engineering Standards ────────────────────────────────────────────────
  if (eng.standards?.length) {
    if (y > H - 50) newPage();
    section('6. Applied Standards  |  المعايير الهندسية المطبقة');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    eng.standards.forEach(s => {
      if (y > H - 20) newPage();
      doc.text(`• ${s}`, ML + 3, y + 3);
      y += 5;
    });
    if (eng.standards_ref) {
      y += 2;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Reference: ${eng.standards_ref}`, ML + 3, y);
      y += 6;
    }
  }

  // ── Road-specific sections ─────────────────────────────────────────────────
  if (infra === 'road') {
    const pd = (sp.pavement_design as any);
    if (pd) {
      if (y > H - 60) newPage();
      section('7. Pavement Structural Design — AASHTO 1993  |  تصميم الرصف الهيكلي');
      (doc as any).autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
        body: [
          ['Design Traffic (ADT)', `${pd.adt.toLocaleString()} veh/day`],
          ['Design Period ESALs (W18)', `${pd.w18_esals.toLocaleString()}`],
          ['Subgrade CBR', `${pd.cbr_subgrade}%`],
          ['Resilient Modulus (MR)', `${pd.mr_psi.toLocaleString()} psi`],
          ['Reliability Level', `${pd.reliability_pct}%`],
          ['Required SN', `${pd.sn_required}`],
          ['Actual SN (designed)', `${pd.sn_actual}`],
          ['AC Surface Thickness', `${pd.ac_thickness_mm} mm`],
          ['Base Course', `${pd.base_thickness_mm} mm (CBR≥80%)`],
          ['Subgrade Improvement', `${pd.subgrade_mm} mm (CBR≥10%)`],
        ],
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Horizontal alignment
    const ha = (sp.horizontal_alignment as any);
    const va = (sp.vertical_alignment as any);
    if (ha?.pi_table?.length) {
      if (y > H - 60) newPage();
      section('8. Horizontal Alignment (PI Table)  |  المحاذاة الأفقية — جدول PI');
      (doc as any).autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [109, 40, 217] },
        head: [['Station (km)', 'Δ (°)', 'R (m)', 'T (m)', 'L_arc (m)', 'Status']],
        body: ha.pi_table.slice(0, 15).map((p: any) => [
          p.station_km, p.delta_deg, p.R_m, p.T_m, p.L_m, p.ok ? '✓ OK' : '⚠ FAIL',
        ]),
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
    if (va?.pvi_table?.length) {
      if (y > H - 60) newPage();
      section('9. Vertical Alignment (PVI Table)  |  المحاذاة الرأسية — جدول PVI');
      (doc as any).autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [14, 116, 144] },
        head: [['Station (km)', 'g1 (%)', 'g2 (%)', 'A', 'K', 'L_vc (m)', 'Type', 'SSD']],
        body: va.pvi_table.slice(0, 15).map((p: any) => [
          p.station_km, p.g1_pct, p.g2_pct, p.A, p.K, p.L_vc_m,
          p.type === 'crest' ? 'Crest▲' : 'Sag▼',
          p.ok ? '✓' : '⚠',
        ]),
        didParseCell: (data: any) => {
          if (data.column.index === 7 && data.section === 'body') {
            data.cell.styles.textColor = data.cell.text[0] === '✓' ? [22, 163, 74] : [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
  }

  // ── Footer on each page ────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Digital Dashboard GIS — Confidential Engineering Report  |  Page ${i} of ${pageCount}`,
      W / 2, H - 4, { align: 'center' },
    );
  }

  const fileName = `GIS_${infraLbl.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
