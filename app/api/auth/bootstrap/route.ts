import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs';
import path from 'path';
import { verifyAuthToken } from '@/lib/auth-tokens';
import { completeOnboarding } from '@/lib/user-store';

const BOOTSTRAP_FILE = path.join(process.cwd(), '.data', 'bootstrap.json');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Mark onboarding_complete for the calling user
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token) {
      const payload = verifyAuthToken(token);
      if (payload?.email) {
        completeOnboarding(payload.email);
      }
    }
  } catch (e) {
    console.warn('[bootstrap] Could not mark onboarding_complete:', e);
  }

  // Persist bootstrap config locally
  try {
    const dir = path.dirname(BOOTSTRAP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BOOTSTRAP_FILE, JSON.stringify({ ...body, saved_at: Date.now() }, null, 2));
  } catch (e) {
    console.warn('[bootstrap] Could not save bootstrap file:', e);
  }

  // Also try to forward to backend (port 8000) — non-fatal if unavailable
  try {
    await fetch('http://127.0.0.1:8000/api/v1/admin/bootstrap', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': req.headers.get('Authorization') || '',
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* backend endpoint optional */ }

  return NextResponse.json({ success: true });
}

