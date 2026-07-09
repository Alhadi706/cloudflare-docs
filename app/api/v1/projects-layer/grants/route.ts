/**
 * /api/v1/projects-layer/grants
 * ════════════════════════════════════════════════════════════════════════
 * Projects-layer access control — PROJ dept managers grant/revoke
 * visibility of the projects GIS layer to other departments.
 *
 * Storage: server-side in-memory Map (per-tenant, per process lifetime).
 *          Falls back gracefully — resets on server restart.
 *          Designed for backend-persistence upgrade later.
 *
 * GET  → returns current grants list for this tenant
 * POST → { action: 'grant'|'revoke', dept_code: string } (PROJ manager only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-tokens';
import { extractTenantId } from '@/lib/backendProxy';
import { atLeast } from '@/lib/rbac';
import type { UserRole } from '@/lib/user-store';

// ── In-memory grants store: tenantId → Set of dept_codes ─────────────────────
// Default grants: departments that CAN see the projects layer by default.
// PROJ always has access (not stored, enforced in logic).
const DEFAULT_GRANTS = new Set(['FIN', 'GIS', 'ADMIN']);

const grantStore = new Map<string, Set<string>>();

function getGrants(tenantId: string): Set<string> {
  if (!grantStore.has(tenantId)) {
    // Initialize with defaults on first access
    grantStore.set(tenantId, new Set(DEFAULT_GRANTS));
  }
  return grantStore.get(tenantId)!;
}

// ── All configurable departments ─────────────────────────────────────────────
export const ALL_DEPARTMENTS: { code: string; name: string; nameEn: string }[] = [
  { code: 'ADMIN', name: 'الشؤون الإدارية', nameEn: 'Admin Affairs' },
  { code: 'FIN',   name: 'المالية',          nameEn: 'Finance' },
  { code: 'HR',    name: 'الموارد البشرية',  nameEn: 'Human Resources' },
  { code: 'MAINT', name: 'الصيانة والهندسة', nameEn: 'Maintenance' },
  { code: 'GIS',   name: 'نظم المعلومات الجغرافية', nameEn: 'GIS' },
  { code: 'ASSET', name: 'إدارة الأصول',     nameEn: 'Assets' },
  { code: 'CORR',  name: 'مكافحة التآكل',    nameEn: 'Corrosion' },
  { code: 'PROC',  name: 'المشتريات',         nameEn: 'Procurement' },
  { code: 'CTRL',  name: 'التحكم والمتابعة',  nameEn: 'Control' },
  { code: 'FLEET', name: 'الأسطول',           nameEn: 'Fleet' },
  { code: 'ENG',   name: 'الهندسة',           nameEn: 'Engineering' },
];

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 401 });
  }

  const auth    = req.headers.get('authorization') ?? '';
  const token   = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const decoded = token ? verifyAuthToken(token) : null;
  if (!decoded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const grants = getGrants(tenantId);

  const list = ALL_DEPARTMENTS.map((dept) => ({
    ...dept,
    has_access: grants.has(dept.code),
    // PROJ always has access (it's their own layer)
    is_owner: false,
  }));

  return NextResponse.json({
    owner_dept: 'PROJ',
    grants: list,
    total_granted: grants.size,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 401 });
  }

  const auth    = req.headers.get('authorization') ?? '';
  const token   = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const decoded = token ? verifyAuthToken(token) : null;
  if (!decoded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const role    = decoded.role as UserRole;
  const deptCode = decoded.department_code as string | undefined;

  // Only PROJ dept managers (or admin/founder) can manage grants
  const isProjectsManager = deptCode === 'PROJ' && atLeast(role, 'dept_manager');
  const isAdmin = atLeast(role, 'admin');

  if (!isProjectsManager && !isAdmin) {
    return NextResponse.json(
      { error: 'forbidden', message: 'يتطلب صلاحيات مدير إدارة المشاريع' },
      { status: 403 }
    );
  }

  let body: { action: string; dept_code: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { action, dept_code } = body;
  if (!action || !dept_code) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  // PROJ cannot revoke its own access
  if (dept_code === 'PROJ') {
    return NextResponse.json({ error: 'cannot_modify_owner' }, { status: 400 });
  }

  const grants = getGrants(tenantId);

  if (action === 'grant') {
    grants.add(dept_code);
  } else if (action === 'revoke') {
    grants.delete(dept_code);
  } else {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const list = ALL_DEPARTMENTS.map((dept) => ({
    ...dept,
    has_access: grants.has(dept.code),
    is_owner: false,
  }));

  return NextResponse.json({ success: true, action, dept_code, grants: list });
}

// ── Helper: check if dept has access (used by map layers route) ───────────────
export function deptHasProjectsLayerAccess(tenantId: string, deptCode: string): boolean {
  if (!tenantId) return false;
  if (deptCode === 'PROJ') return true; // always
  const grants = getGrants(tenantId);
  return grants.has(deptCode);
}
