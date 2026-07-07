import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import {
  listMobileAccessRequests, getMobileAccessRequestById,
  reviewMobileAccessRequest, type MobileAccessStatus,
} from '@/lib/mobile-access-store';
import { upsertEmployeeCredentialUser } from '@/lib/user-store';
import { getPushSubsByEmployee, savePushSub } from '@/lib/push-store';
import { sendPushToMany } from '@/lib/push-sender';

const REVIEWER_ROLES = ['dept_manager', 'section_manager', 'admin', 'founder', 'owner', 'superadmin'];

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'user.review');
  if (auth instanceof NextResponse) return auth;

  const status = (req.nextUrl.searchParams.get('status') || '') as MobileAccessStatus | '';
  const validStatus = ['pending','approved','rejected'].includes(status) ? status as MobileAccessStatus : undefined;

  const rows = listMobileAccessRequests({ tenantId: auth.tenantId, status: validStatus });
  return NextResponse.json({ ok: true, requests: rows });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req, 'user.review');
  if (auth instanceof NextResponse) return auth;

  if (!REVIEWER_ROLES.includes(auth.role)) {
    return NextResponse.json({ detail: 'غير مصرح' }, { status: 403 });
  }

  const body   = await req.json().catch(() => ({}));
  const reqId  = String(body.request_id || '').trim();
  const action = String(body.action     || '').trim().toLowerCase() as 'approve' | 'reject';
  const reason = String(body.reason     || '').trim() || undefined;

  if (!reqId) return NextResponse.json({ detail: 'request_id مطلوب' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ detail: 'action يجب أن يكون approve أو reject' }, { status: 400 });
  }

  const record = getMobileAccessRequestById(reqId);
  if (!record || record.tenant_id !== auth.tenantId) {
    return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
  }
  if (record.status !== 'pending') {
    return NextResponse.json({ detail: 'الطلب تمت مراجعته مسبقاً' }, { status: 409 });
  }

  const reviewed = reviewMobileAccessRequest({
    id: reqId, action, reject_reason: reason,
    reviewed_by: auth.email || auth.role,
  });
  if (!reviewed) return NextResponse.json({ detail: 'فشل التحديث' }, { status: 500 });

  if (action === 'approve') {
    const assignedRole = String(body.mobile_role || '').trim() || 'employee';
    const validRoles = ['employee', 'supervisor', 'section_manager', 'dept_manager', 'corrosion_field'];
    upsertEmployeeCredentialUser({
      tenant_id: record.tenant_id, tenant_code: record.tenant_code,
      employee_no: record.employee_no, full_name: record.full_name || '',
      department_code: record.department_code,
      secret_hash: record.secret_hash, secret_salt: record.secret_salt,
      mobile_role: validRoles.includes(assignedRole) ? assignedRole : 'employee',
    });
  }

  // إشعار الموظف
  try {
    const subs = getPushSubsByEmployee(auth.tenantId, record.employee_no);
    if (subs.length) {
      await sendPushToMany(auth.tenantId, subs, action === 'approve'
        ? { title: '✅ تم تفعيل حسابك', body: 'يمكنك الدخول الآن بنفس كلمة المرور', urgency: 'high' }
        : { title: '❌ طلب التسجيل مرفوض', body: reason || 'تم رفض طلبك من قبل المسؤول', urgency: 'normal' }
      );
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({ ok: true, status: reviewed.status });
}
