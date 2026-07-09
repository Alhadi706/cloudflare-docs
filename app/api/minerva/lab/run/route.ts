import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// POST /api/minerva/lab/run
// Body: { scenario_id: string, version: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { scenario_id, version = 'dev' } = body;

  if (!scenario_id) {
    return NextResponse.json({ error: 'scenario_id required' }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    const py = spawn('python3', ['-c', `
import sys, json, time
sys.path.insert(0, '.')
from minerva.lab.runner import BenchmarkRunner

runner = BenchmarkRunner(minerva_version="${version}", frame_step_days=10)
try:
    result = runner.run("${scenario_id}")
    print(json.dumps({"ok": True, "result": result.to_dict()}, ensure_ascii=False, default=str))
except Exception as e:
    import traceback
    print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}, ensure_ascii=False))
`], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
      timeout: 180_000,   // 3 minutes max
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
          ok: false,
          error: 'Parse error',
          stderr: stderr.slice(-500),
        }, { status: 500 }));
      }
    });
  });
}
