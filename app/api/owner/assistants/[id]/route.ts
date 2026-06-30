import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db-pg';
import { verifyOwnerToken } from '@/lib/owner-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const { active, role, notes } = await req.json() as { active?: boolean; role?: string; notes?: string };

  try {
    const { rows } = await pgPool.query(
      `UPDATE platform_assistants
       SET active = COALESCE($1, active),
           role   = COALESCE($2, role),
           notes  = COALESCE($3, notes),
           updated_at = $4
       WHERE id = $5
       RETURNING id, name, email, role, notes, active, created_at, updated_at`,
      [active ?? null, role ?? null, notes ?? null, Date.now(), params.id]
    );
    if (!rows.length) return NextResponse.json({ detail: 'غير موجود' }, { status: 404 });
    return NextResponse.json({ assistant: rows[0] });
  } catch (err) {
    console.error('[assistants PATCH]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  try {
    const { rowCount } = await pgPool.query(
      `DELETE FROM platform_assistants WHERE id=$1`,
      [params.id]
    );
    if (!rowCount) return NextResponse.json({ detail: 'غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[assistants DELETE]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}
