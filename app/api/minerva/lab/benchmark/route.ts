import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

// POST /api/minerva/lab/benchmark
// Runs all scenarios + generates report
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { version = 'dev' } = body;

  return new Promise<NextResponse>((resolve) => {
    const py = spawn('python3', ['-c', `
import sys, json
sys.path.insert(0, '.')
from minerva.lab.runner import BenchmarkRunner
from minerva.lab.report import ReportGenerator

runner = BenchmarkRunner(minerva_version="${version}")
results = runner.run_all()
report = ReportGenerator().generate(results, "${version}")
print(json.dumps({
    "ok": True,
    "results": [r.to_dict() for r in results],
    "report":  report.to_dict(),
    "report_md": report.to_markdown(),
}, ensure_ascii=False, default=str))
`], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
      timeout: 600_000,   // 10 minutes for full benchmark
    });

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    py.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    py.on('close', () => {
      try {
        const data = JSON.parse(stdout.trim().split('\n').pop() || '{}');
        resolve(NextResponse.json(data));
      } catch {
        resolve(NextResponse.json({
          ok: false, error: 'Benchmark failed', stderr: stderr.slice(-800),
        }, { status: 500 }));
      }
    });
  });
}
