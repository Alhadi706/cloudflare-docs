import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db-pg';
import { verifyOwnerToken } from '@/lib/owner-auth';
import { randomUUID } from 'crypto';

// إنشاء جدول المساعدين إذا لم يكن موجوداً
async function ensureTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS platform_assistants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'assistant',
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      created_by TEXT
    )
  `);
}

export async function GET(req: NextRequest) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  try {
    await ensureTable();
    const { rows } = await pgPool.query(
      `SELECT id, name, email, role, notes, active, created_at, updated_at
       FROM platform_assistants ORDER BY created_at DESC`
    );
    return NextResponse.json({ assistants: rows });
  } catch (err) {
    console.error('[assistants GET]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const { name, email, role, notes } = await req.json() as {
    name?: string; email?: string; role?: string; notes?: string;
  };

  if (!name?.trim()) return NextResponse.json({ detail: 'الاسم مطلوب' }, { status: 400 });
  if (!email?.trim()) return NextResponse.json({ detail: 'البريد مطلوب' }, { status: 400 });

  try {
    await ensureTable();
    const now = Date.now();
    const id = randomUUID();
    const { rows } = await pgPool.query(
      `INSERT INTO platform_assistants (id, name, email, role, notes, active, created_at, updated_at, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6, $6, $7)
       RETURNING id, name, email, role, notes, active, created_at, updated_at`,
      [id, name.trim(), email.trim().toLowerCase(), role || 'assistant', notes?.trim() || null, now, claims.email]
    );
    return NextResponse.json({ assistant: rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ detail: 'البريد مستخدم مسبقاً' }, { status: 409 });
    }
    console.error('[assistants POST]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}
