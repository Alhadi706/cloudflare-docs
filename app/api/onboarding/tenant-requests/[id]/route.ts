import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db-pg';
import { verifyOwnerToken } from '@/lib/owner-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const { review_notes } = await req.json().catch(() => ({})) as { review_notes?: string };

  try {
    const { rowCount } = await pgPool.query(
      `UPDATE auth_tenant_requests
       SET status='rejected', reviewed_at=$1, reviewed_by=$2, review_notes=$3
       WHERE id=$4 AND status='pending'`,
      [Date.now(), claims.email, review_notes || 'تم الرفض من بوابة مالك المنصة', params.id]
    );
    if (!rowCount) return NextResponse.json({ detail: 'الطلب غير موجود أو تمت معالجته' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reject]', err);
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
      `DELETE FROM auth_tenant_requests WHERE id=$1`,
      [params.id]
    );
    if (!rowCount) return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[delete request]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}
