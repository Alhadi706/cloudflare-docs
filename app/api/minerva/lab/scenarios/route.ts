import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// GET /api/minerva/lab/scenarios
// Returns the scenario library from Python
export async function GET() {
  return new Promise<NextResponse>((resolve) => {
    const script = path.join(process.cwd(), 'scripts', 'minerva_lab.py');
    const py = spawn('python3', [script, 'list', '--json'], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    py.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    py.on('close', (code) => {
      // If --json flag not supported yet, fall back to Python import
      try {
        const data = JSON.parse(stdout);
        resolve(NextResponse.json({ scenarios: data.scenarios || [] }));
      } catch {
        // Fallback: call Python directly via a small inline script
        const py2 = spawn('python3', ['-c', `
import sys, json
sys.path.insert(0, '.')
from minerva.lab.scenario import ScenarioLibrary
print(json.dumps(ScenarioLibrary.summary()))
`], { cwd: process.cwd(), env: { ...process.env, PYTHONPATH: process.cwd() } });

        let out2 = '';
        py2.stdout.on('data', (d: Buffer) => { out2 += d.toString(); });
        py2.on('close', () => {
          try {
            const scenarios = JSON.parse(out2.trim());
            resolve(NextResponse.json({ scenarios }));
          } catch {
            resolve(NextResponse.json({ scenarios: [], error: stderr }, { status: 500 }));
          }
        });
      }
    });
  });
}
