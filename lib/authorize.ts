/**
 * lib/authorize.ts — Authorization helper for API route handlers
 *
 * Usage (single line in each route):
 *
 *   const auth = authorize(req, 'workorder.create');
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.tenantId, auth.role, auth.email are guaranteed from JWT
 *
 * The function:
 *   1. Reads tenant context from middleware-injected verified headers (P1)
 *   2. Checks that the caller's role grants the required permission (P2)
 *   3. Returns a typed context object or a 401/403 NextResponse
 *
 * EVOLUTION PATH:
 *   P4 (Data Scope): add optional third argument:
 *     authorize(req, 'workorder.view', { scope: 'department' })
 *   This will gate access further by department_code match.
 *   The interface stays backward-compatible — existing calls need no change.
 */

import { NextResponse } from 'next/server';
import type { Permission } from './permissions';
import { hasPermission } from './permissions';

// ── Authorized context returned on success ───────────────────────────────────

export interface AuthorizedContext {
  tenantId:       string;
  tenantCode:     string | null;
  email:          string;
  role:           string;
  departmentCode: string | null;
}

// ── authorize() ──────────────────────────────────────────────────────────────

// ── AuthorizeOptions ─────────────────────────────────────────────────────────

export interface AuthorizeOptions {
  /**
   * If set, the caller's department_code must be one of these values
   * (platform admins/founders are always exempt).
   */
  requiredDepts?: string[];
}

/**
 * Checks both authentication (via P1 middleware headers) and authorisation
 * (via the permission layer).
 *
 * @param req        The incoming Request / NextRequest
 * @param permission The permission required to proceed
 * @param options    Optional extra constraints (e.g. requiredDepts)
 * @returns          AuthorizedContext on success, or a NextResponse on failure
 */
export function authorize(
  req: Request,
  permission: Permission,
  options?: AuthorizeOptions,
): AuthorizedContext | NextResponse {
  // ── Step 1: Read middleware-verified tenant context (set by P1) ────────────
  const tenantId       = (req.headers.get('x-verified-tenant-id')   ?? '').trim();
  const tenantCode     = (req.headers.get('x-verified-tenant-code') ?? '').trim() || null;
  const email          = (req.headers.get('x-verified-email')       ?? '').trim();
  const role           = (req.headers.get('x-verified-role')        ?? '').trim();
  const departmentCode = (req.headers.get('x-verified-dept-code')   ?? '').trim() || null;

  if (!tenantId || !role) {
    // Middleware should have blocked this — belt-and-suspenders
    return NextResponse.json(
      { detail: 'غير مصرح — يرجى تسجيل الدخول', code: 'unauthorized' },
      { status: 401 }
    );
  }

  // ── Step 2: Check role-level permission (with optional dept-domain gating) ──
  if (!hasPermission(role, permission, departmentCode)) {
    return NextResponse.json(
      {
        detail:     `لا تملك صلاحية: ${permission}`,
        code:       'forbidden',
        permission,
        role,
        departmentCode,
      },
      { status: 403 }
    );
  }

  // ── Step 3: Explicit dept restriction (optional, per-route) ─────────────────
  const isPlatformAdmin = role === 'founder' || role === 'admin';
  if (!isPlatformAdmin && options?.requiredDepts?.length) {
    if (!departmentCode || !options.requiredDepts.includes(departmentCode)) {
      return NextResponse.json(
        {
          detail:     'هذه العملية مقيدة بإداراتٍ محددة',
          code:       'dept_forbidden',
          permission,
          role,
          departmentCode,
          requiredDepts: options.requiredDepts,
        },
        { status: 403 }
      );
    }
  }

  return { tenantId, tenantCode, email, role, departmentCode };
}

/**
 * Convenience: check that the caller's role is exactly `founder`.
 * Used for platform-level operations that must never be delegated.
 */
export function requireFounder(req: Request): AuthorizedContext | NextResponse {
  const role = (req.headers.get('x-verified-role') ?? '').trim();
  if (role !== 'founder') {
    return NextResponse.json(
      { detail: 'هذه العملية للمؤسس فقط', code: 'founder_only' },
      { status: 403 }
    );
  }
  // founder has '*' — re-use authorize with any permission to get the context
  return authorize(req, 'tenant.approve');
}
