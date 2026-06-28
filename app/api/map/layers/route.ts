/**
 * GET /api/map/layers
 * ──────────────────────────────────────────────────────────────────────────────
 * Returns the authenticated caller's map layer scope.
 * UnifiedMapEngine calls this on mount to know which layer packs to enable.
 *
 * Response:
 *   { layerPacks: string[], canToggleLayers: bool, canEditFeatures: bool, role, dept }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken }           from '@/lib/auth-tokens';
import { getLayerScope }             from '@/lib/rbac';
import type { UserRole, DepartmentCode } from '@/lib/user-store';

export async function GET(req: NextRequest) {
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  // Unauthenticated → return base-only scope (read-only)
  if (!token) {
    return NextResponse.json({
      layerPacks:      ['base'],
      canToggleLayers: false,
      canEditFeatures: false,
      role:            'guest',
      dept:            null,
    });
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return NextResponse.json({ detail: 'الجلسة غير صالحة' }, { status: 401 });
  }

  const role     = decoded.role            as UserRole;
  const deptCode = decoded.department_code as DepartmentCode | undefined;

  const scope = getLayerScope(role, deptCode);

  return NextResponse.json({
    ...scope,
    role,
    dept: deptCode ?? null,
  });
}
