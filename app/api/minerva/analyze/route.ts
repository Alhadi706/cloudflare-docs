import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const ROOT   = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts', 'minerva_analyze.py');
const TIMEOUT = 90_000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = JSON.stringify(body);

    const result = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('MINERVA engine timeout (90s)'));
      }, TIMEOUT);

      const child = spawn('python3', [SCRIPT], { cwd: ROOT });
      let stdout = '', stderr = '';

      child.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      child.on('close', (code: number) => {
        clearTimeout(timer);
        if (stdout.trim()) resolve(stdout.trim());
        else reject(new Error(stderr.slice(0, 500) || `exit ${code}`));
      });
      child.on('error', (e: Error) => { clearTimeout(timer); reject(e); });

      child.stdin.write(input);
      child.stdin.end();
    });

    return NextResponse.json(JSON.parse(result));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 500) : 'Engine error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
