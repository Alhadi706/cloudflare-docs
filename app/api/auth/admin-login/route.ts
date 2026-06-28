import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'SovereignAdmin2026!';

function makeToken(email: string, role: string): string {
  const payload = Buffer.from(JSON.stringify({ email, role, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET || 'sovereign-dev-secret')
    .update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password === ADMIN_PASSWORD) {
    const token = makeToken('admin@system', 'super_admin');
    return NextResponse.json({ token, role: 'super_admin' });
  }
  return NextResponse.json({ detail: 'كلمة مرور غير صحيحة' }, { status: 401 });
}
