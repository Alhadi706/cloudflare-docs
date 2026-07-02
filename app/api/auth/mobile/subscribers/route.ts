import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import { getAllPushSubs } from '@/lib/push-store';
import { listMobileAccessRequests } from '@/lib/mobile-access-store';

/**
 * GET /api/auth/mobile/subscribers
 * Returns list of employees who have active Web Push subscriptions.
 * Used by admin notification form to populate the employee picker.
 */
export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.create');
  if (auth instanceof NextResponse) return auth;

  const allSubs = getAllPushSubs(auth.tenantId);

  // Unique employees with at least one push sub
  const empMap = new Map<string, { push_count: number; role: string; last_seen: string }>();
  for (const sub of allSubs) {
    const existing = empMap.get(sub.employee_no);
    if (!existing) {
      empMap.set(sub.employee_no, { push_count: 1, role: sub.role, last_seen: sub.saved_at });
    } else {
      existing.push_count++;
      if (sub.saved_at > existing.last_seen) existing.last_seen = sub.saved_at;
    }
  }

  // Enrich with full names from mobile access requests (approved only)
  const accessReqs = listMobileAccessRequests({ tenantId: auth.tenantId, status: 'approved' });
  const nameMap = new Map(accessReqs.map(r => [r.employee_no, r.full_name || r.employee_no]));

  const subscribers = Array.from(empMap.entries()).map(([emp, info]) => ({
    employee_no: emp,
    full_name:   nameMap.get(emp) || emp,
    role:        info.role,
    push_count:  info.push_count,
    last_seen:   info.last_seen,
  }));

  return NextResponse.json({
    ok: true,
    subscribers,
    total: subscribers.length,
    has_push_enabled: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
}
