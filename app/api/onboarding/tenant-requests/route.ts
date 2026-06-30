import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db-pg';
import { verifyOwnerToken } from '@/lib/owner-auth';

export async function GET(req: NextRequest) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  const statusFilter = req.nextUrl.searchParams.get('status'); // pending | approved | rejected | all

  try {
    const whereClause = statusFilter && statusFilter !== 'all'
      ? `WHERE status = $1`
      : '';
    const params = statusFilter && statusFilter !== 'all' ? [statusFilter] : [];

    const { rows } = await pgPool.query(
      `SELECT id, organization_name, organization_type,
              contact_full_name, contact_email, contact_phone,
              notes, status, requested_at, tenant_id, activation_code
       FROM auth_tenant_requests
       ${whereClause}
       ORDER BY requested_at DESC`,
      params
    );

    return NextResponse.json({ requests: rows });
  } catch (err) {
    console.error('[tenant-requests GET]', err);
    return NextResponse.json({ detail: 'خطأ داخلي' }, { status: 500 });
  }
}
