import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerToken } from '@/lib/owner-auth';
import { pgPool } from '@/lib/db-pg';

export async function GET(req: NextRequest) {
  const claims = verifyOwnerToken(req.headers.get('authorization'));
  if (!claims) return NextResponse.json({ detail: 'غير مصرح' }, { status: 401 });

  // جلب المستخدمين المنشط الذي سجل كمالك
  try {
    const { rows } = await pgPool.query(
      `SELECT id, email, role, status FROM auth_users WHERE email=$1 LIMIT 1`,
      [claims.email]
    );

    return NextResponse.json({
      owner: {
        email: claims.email,
        role: claims.role,
        db_role: rows[0]?.role || null,
        status: rows[0]?.status || 'active',
      }
    });
  } catch {
    return NextResponse.json({
      owner: { email: claims.email, role: claims.role }
    });
  }
}
