"""
MINERVA Lab — Scientific Report Generator
==========================================
Produces a reproducible, versioned benchmark report.

The report is stored as JSON (machine-readable) and
rendered as Markdown (human-readable).

Contents:
  • Experiment configuration
  • Data sources and coverage
  • Benchmark results per scenario
  • Regression comparison (if baseline provided)
  • Maps and visualizations (as data, rendered by UI)
  • Lessons learned and recommendations
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any

from minerva.lab.metrics import BenchmarkResult
from minerva.lab.runner import RegressionComparison


@dataclass
class ScientificReport:
    """Full benchmark report for a lab session."""
    report_id:        str
    title:            str
    minerva_version:  str
    run_date:         str = field(default_factory=lambda: datetime.now().isoformat())

    # Configuration
    scenarios_tested: List[str] = field(default_factory=list)
    data_sources:     List[str] = field(default_factory=list)
    total_duration_s: float = 0.0

    # Results
    results:         List[BenchmarkResult] = field(default_factory=list)
    comparisons:     List[RegressionComparison] = field(default_factory=list)

    # Summary statistics
    n_passed:        int = 0
    n_failed:        int = 0
    mean_f1:         float = 0.0
    mean_precision:  float = 0.0
    mean_recall:     float = 0.0
    mean_fpr:        float = 0.0
    mean_delay_days: Optional[float] = None

    # Overall verdict
    overall_verdict:    str = "PENDING"  # "PASS" | "FAIL" | "PARTIAL"
    regression_verdict: str = "UNKNOWN"  # "IMPROVED" | "UNCHANGED" | "REGRESSED"

    # Qualitative sections
    lessons_learned:   List[str] = field(default_factory=list)
    recommendations:   List[str] = field(default_factory=list)
    notes:             str = ""

    def compute_summary(self) -> None:
        """Aggregate statistics across all results."""
        if not self.results:
            return

        self.n_passed = sum(1 for r in self.results if r.passed)
        self.n_failed = len(self.results) - self.n_passed

        f1s         = [r.detection.f1 for r in self.results]
        precisions  = [r.detection.precision for r in self.results]
        recalls     = [r.detection.recall for r in self.results]
        fprs        = [r.detection.fpr for r in self.results]
        delays      = [r.timing.detection_delay_days for r in self.results
                       if r.timing.detection_delay_days is not None]

        self.mean_f1        = round(sum(f1s) / len(f1s), 4)
        self.mean_precision = round(sum(precisions) / len(precisions), 4)
        self.mean_recall    = round(sum(recalls) / len(recalls), 4)
        self.mean_fpr       = round(sum(fprs) / len(fprs), 4)
        self.mean_delay_days = round(sum(delays) / len(delays), 1) if delays else None

        self.overall_verdict = "PASS" if self.n_failed == 0 else (
            "PARTIAL" if self.n_passed > 0 else "FAIL"
        )

        if self.comparisons:
            any_regressed = any(c.verdict == "REGRESSED" for c in self.comparisons)
            any_improved  = any(c.verdict == "IMPROVED"  for c in self.comparisons)
            if any_regressed:
                self.regression_verdict = "REGRESSED"
            elif any_improved:
                self.regression_verdict = "IMPROVED"
            else:
                self.regression_verdict = "UNCHANGED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id":        self.report_id,
            "title":            self.title,
            "minerva_version":  self.minerva_version,
            "run_date":         self.run_date,
            "scenarios_tested": self.scenarios_tested,
            "data_sources":     self.data_sources,
            "total_duration_s": round(self.total_duration_s, 2),
            "summary": {
                "n_passed":       self.n_passed,
                "n_failed":       self.n_failed,
                "n_total":        len(self.results),
                "mean_f1":        self.mean_f1,
                "mean_precision": self.mean_precision,
                "mean_recall":    self.mean_recall,
                "mean_fpr":       self.mean_fpr,
                "mean_delay_days":self.mean_delay_days,
                "overall_verdict":self.overall_verdict,
                "regression_verdict": self.regression_verdict,
            },
            "results":     [r.to_dict() for r in self.results],
            "comparisons": [c.to_dict() for c in self.comparisons],
            "lessons_learned":  self.lessons_learned,
            "recommendations":  self.recommendations,
            "notes":            self.notes,
        }

    def to_markdown(self) -> str:
        """Render a human-readable Markdown report."""
        lines = [
            f"# تقرير التحقق العلمي — MINERVA {self.minerva_version}",
            f"**التاريخ:** {self.run_date[:10]}  ",
            f"**معرف التقرير:** `{self.report_id}`  ",
            "",
            "---",
            "",
            "## ملخص",
            "",
            f"| المعيار | القيمة |",
            f"|---------|--------|",
            f"| الإصدار | `{self.minerva_version}` |",
            f"| سيناريوهات تم اختبارها | {len(self.results)} |",
            f"| ناجح / فاشل | {self.n_passed} / {self.n_failed} |",
            f"| متوسط F1 | {self.mean_f1:.3f} |",
            f"| متوسط Precision | {self.mean_precision:.3f} |",
            f"| متوسط Recall | {self.mean_recall:.3f} |",
            f"| معدل الإيجابيات الكاذبة | {self.mean_fpr:.3f} |",
            f"| متوسط تأخر الكشف | {self.mean_delay_days or 'N/A'} يوم |",
            f"| الحكم العام | **{self.overall_verdict}** |",
            "",
        ]

        if self.comparisons:
            lines += [
                "## مقارنة الإصدارات (Regression)",
                "",
                "| السيناريو | الحكم | Δ F1 | Δ FPR | Δ تأخر |",
                "|-----------|-------|------|-------|--------|",
            ]
            for c in self.comparisons:
                badge = {"IMPROVED": "✅", "UNCHANGED": "➖", "REGRESSED": "❌"}.get(c.verdict, "?")
                delay = f"{c.delay_delta:+d}d" if c.delay_delta else "N/A"
                lines.append(
                    f"| {c.scenario_id} | {badge} {c.verdict} "
                    f"| {c.f1_delta:+.3f} | {c.fpr_delta:+.3f} | {delay} |"
                )
            lines.append("")

        lines += ["## نتائج السيناريوهات", ""]
        for r in self.results:
            status = "✅ ناجح" if r.passed else "❌ فاشل"
            lines += [
                f"### {r.scenario_id}  {status}",
                f"- **F1:** {r.detection.f1:.3f}  |  "
                f"**Precision:** {r.detection.precision:.3f}  |  "
                f"**Recall:** {r.detection.recall:.3f}",
                f"- **FPR:** {r.detection.fpr:.3f}  |  "
                f"**تأخر الكشف:** {r.timing.detection_delay_days or 'N/A'} يوم",
                f"- **مشاهدات EO:** {r.n_eo_observations}  |  "
                f"**إطارات:** {r.n_frames}",
            ]
            if r.failure_reasons:
                lines.append(f"- **أسباب الفشل:** {' | '.join(r.failure_reasons)}")
            lines.append("")

        if self.lessons_learned:
            lines += ["## دروس مستفادة", ""]
            for i, lesson in enumerate(self.lessons_learned, 1):
                lines.append(f"{i}. {lesson}")
            lines.append("")

        if self.recommendations:
            lines += ["## توصيات", ""]
            for i, rec in enumerate(self.recommendations, 1):
                lines.append(f"{i}. {rec}")
            lines.append("")

        lines += [
            "---",
            f"*MINERVA Validation Lab — تقرير قابل للتكرار*  ",
            f"*الإصدار: {self.minerva_version} | التاريخ: {self.run_date[:10]}*",
        ]
        return "\n".join(lines)


class ReportGenerator:
    """Generates ScientificReport from benchmark results."""

    def generate(
        self,
        results:         List[BenchmarkResult],
        minerva_version: str,
        report_id:       Optional[str] = None,
        baseline_results: Optional[List[BenchmarkResult]] = None,
    ) -> ScientificReport:
        import uuid as _uuid
        rid = report_id or f"RPT-{_uuid.uuid4().hex[:8].upper()}"

        report = ScientificReport(
            report_id       = rid,
            title           = f"MINERVA Validation Report — {minerva_version}",
            minerva_version = minerva_version,
            scenarios_tested= [r.scenario_id for r in results],
            data_sources    = ["sentinel-2-l2a", "sentinel-1-rtc",
                               "modis-11A1-061", "open-meteo"],
            total_duration_s= sum(r.duration_seconds for r in results),
            results         = results,
        )

        # Regression comparison
        if baseline_results:
            baseline_map = {r.scenario_id: r for r in baseline_results}
            for result in results:
                baseline = baseline_map.get(result.scenario_id)
                if baseline:
                    comp = RegressionComparison.compare(baseline, result)
                    report.comparisons.append(comp)

        report.compute_summary()
        self._add_qualitative_analysis(report)
        return report

    def _add_qualitative_analysis(self, report: ScientificReport) -> None:
        """Auto-generate lessons and recommendations from results."""
        lessons = []
        recs    = []

        if report.mean_fpr > 0.15:
            lessons.append(f"معدل الإيجابيات الكاذبة مرتفع ({report.mean_fpr:.0%}) — يؤثر على ثقة المشغّل")
            recs.append("رفع حد الثقة الأدنى لإطلاق الإنذار")

        if report.mean_recall < 0.70:
            lessons.append(f"معدل الكشف (Recall={report.mean_recall:.2f}) دون المستهدف 0.80")
            recs.append("مراجعة عتبات الإنذار — قد تكون محافظة أكثر مما ينبغي")

        if report.mean_delay_days and report.mean_delay_days > 30:
            lessons.append(f"متوسط تأخر الكشف مرتفع ({report.mean_delay_days:.0f} يوم)")
            recs.append("تقليل FRAME_STEP_DAYS في Replay Engine لتحسين دقة التوقيت")

        if report.overall_verdict == "PASS":
            lessons.append("جميع السيناريوهات نجحت — الإصدار جاهز للإنتاج")

        report.lessons_learned = lessons or ["لا دروس استثنائية في هذا التشغيل"]
        report.recommendations = recs or ["مواصلة المراقبة الدورية لجودة النموذج"]
