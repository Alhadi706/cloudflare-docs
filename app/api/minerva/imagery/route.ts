import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const ROOT   = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts', 'minerva_imagery.py');

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const input = JSON.stringify(body);

    const result = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout')); }, 60_000);
      const child = spawn('python3', [SCRIPT], { cwd: ROOT });
      let stdout = '', stderr = '';
      child.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      child.on('close', () => {
        clearTimeout(timer);
        if (stdout.trim()) resolve(stdout.trim());
        else reject(new Error(stderr.slice(0, 400) || 'No output'));
      });
      child.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
      child.stdin.write(input);
      child.stdin.end();
    });

    return NextResponse.json(JSON.parse(result));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 400) : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
