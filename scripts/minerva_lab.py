#!/usr/bin/env python3
"""
MINERVA Lab CLI — scripts/minerva_lab.py
==========================================
Command-line runner for the Validation & Benchmark Laboratory.

Usage:
  # List all scenarios
  python3 scripts/minerva_lab.py list

  # Run a single scenario
  python3 scripts/minerva_lab.py run WATER_LEAK_TRIPOLI_001

  # Run all scenarios and generate report
  python3 scripts/minerva_lab.py benchmark --version 13.0.0

  # Run all + compare with saved baseline
  python3 scripts/minerva_lab.py benchmark --version 13.0.0 --baseline /tmp/baseline.json

  # Generate simulated alerts (UI testing)
  python3 scripts/minerva_lab.py simulate --n 20 --seed 42

ISOLATION: Lab results are never written to production tables.
"""

import sys
import json
import argparse
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def cmd_list(args):
    from minerva.lab.scenario import ScenarioLibrary
    scenarios = ScenarioLibrary.summary()
    print(f"\n{'='*65}")
    print(f"{'MINERVA Lab — Scenario Library':^65}")
    print(f"{'='*65}")
    for s in scenarios:
        gt_mark = "✓GT" if s["has_gt"] else "   "
        print(f"  {gt_mark}  [{s['type'][:20]:<20}]  {s['id']}")
        print(f"         {s['name']}")
        print(f"         {s['location']}  |  {s['period']}  |  expected: {s['expected']}")
        print()
    print(f"  Total: {len(scenarios)} scenarios")
    print(f"{'='*65}\n")


def cmd_run(args):
    from minerva.lab.runner import BenchmarkRunner
    print(f"\nRunning scenario: {args.scenario_id}")
    print(f"MINERVA version:  {args.version}\n")

    runner = BenchmarkRunner(
        minerva_version = args.version,
        frame_step_days = getattr(args, 'step', 10),
    )
    result = runner.run(args.scenario_id)

    print(f"{'='*55}")
    print(f"Result: {'✅ PASSED' if result.passed else '❌ FAILED'}")
    print(f"{'='*55}")
    print(f"  F1         : {result.detection.f1:.4f}")
    print(f"  Precision  : {result.detection.precision:.4f}")
    print(f"  Recall     : {result.detection.recall:.4f}")
    print(f"  FPR        : {result.detection.fpr:.4f}")
    print(f"  TP/FP/TN/FN: {result.detection.tp}/{result.detection.fp}/{result.detection.tn}/{result.detection.fn}")
    print(f"  Delay      : {result.timing.detection_delay_days or 'N/A'} days")
    print(f"  EO obs     : {result.n_eo_observations}")
    print(f"  Frames     : {result.n_frames}")
    print(f"  Duration   : {result.duration_seconds:.1f}s")
    if result.failure_reasons:
        print(f"\n  Failures:")
        for f in result.failure_reasons:
            print(f"    ✗ {f}")
    print(f"{'='*55}\n")

    if args.output:
        with open(args.output, "w") as fh:
            json.dump(result.to_dict(), fh, ensure_ascii=False, indent=2, default=str)
        print(f"Result saved to: {args.output}")


def cmd_benchmark(args):
    from minerva.lab.runner import BenchmarkRunner
    from minerva.lab.report import ReportGenerator

    print(f"\n{'='*60}")
    print(f"{'MINERVA Lab — Full Benchmark':^60}")
    print(f"  Version: {args.version}")
    print(f"{'='*60}\n")

    runner   = BenchmarkRunner(minerva_version=args.version)
    results  = runner.run_all()

    baseline = None
    if args.baseline and os.path.exists(args.baseline):
        print(f"Loading baseline from {args.baseline} ...")
        # Would load BenchmarkResults from JSON — simplified here
        print("  (baseline comparison not shown in CLI preview)")

    report = ReportGenerator().generate(results, args.version, baseline_results=baseline)
    report_dict = report.to_dict()

    print(report.to_markdown())

    output_path = args.output or f"/tmp/minerva_benchmark_{args.version}.json"
    with open(output_path, "w") as fh:
        json.dump(report_dict, fh, ensure_ascii=False, indent=2, default=str)
    print(f"\nReport saved to: {output_path}")

    md_path = output_path.replace(".json", ".md")
    with open(md_path, "w") as fh:
        fh.write(report.to_markdown())
    print(f"Markdown saved to: {md_path}")

    # Exit code: 0 = pass, 1 = fail (for CI)
    sys.exit(0 if report.overall_verdict == "PASS" else 1)


def cmd_simulate(args):
    from minerva.lab.alert_sim import AlertSimulator
    sim    = AlertSimulator(experiment_id=f"CLI-SIM-{args.seed or 'random'}")
    alerts = sim.generate(n=args.n, seed=args.seed)
    print(f"\nGenerated {len(alerts)} SIMULATED alerts (TEST DATA ONLY):\n")
    for alert in alerts:
        print(f"  {alert.severity:<8} | {alert.title[:55]}")
    print()
    if args.output:
        data = [a.to_dict() for a in alerts]
        with open(args.output, "w") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2, default=str)
        print(f"Saved to: {args.output}")


def main():
    parser = argparse.ArgumentParser(
        description="MINERVA Validation & Benchmark Laboratory CLI"
    )
    sub = parser.add_subparsers(dest="command")

    # list
    sub.add_parser("list", help="List all benchmark scenarios")

    # run
    p_run = sub.add_parser("run", help="Run a single scenario")
    p_run.add_argument("scenario_id", help="Scenario ID (e.g. WATER_LEAK_TRIPOLI_001)")
    p_run.add_argument("--version", default="dev", help="MINERVA version label")
    p_run.add_argument("--step",    type=int, default=10, help="Replay frame step (days)")
    p_run.add_argument("--output",  help="Save result JSON to file")

    # benchmark
    p_bench = sub.add_parser("benchmark", help="Run all scenarios + generate report")
    p_bench.add_argument("--version",  default="dev")
    p_bench.add_argument("--baseline", help="Baseline JSON file for regression comparison")
    p_bench.add_argument("--output",   help="Output JSON path")

    # simulate
    p_sim = sub.add_parser("simulate", help="Generate simulated alerts for UI testing")
    p_sim.add_argument("--n",     type=int, default=10, help="Number of alerts")
    p_sim.add_argument("--seed",  type=int, help="Random seed for reproducibility")
    p_sim.add_argument("--output", help="Save to JSON file")

    args = parser.parse_args()
    if args.command == "list":
        cmd_list(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "benchmark":
        cmd_benchmark(args)
    elif args.command == "simulate":
        cmd_simulate(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
