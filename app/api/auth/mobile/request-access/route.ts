import { NextRequest, NextResponse } from 'next/server';
import { getTenantByCode } from '@/lib/tenant-store';
import {
  createMobileAccessRequest,
  getLatestMobileAccessRequest,
  isMobileAccessRequestExpired,
} from '@/lib/mobile-access-store';
import { hashPassword } from '@/lib/user-store';
import { getPushSubsByRoles, getAllPushSubs } from '@/lib/push-store';
import { sendPushToMany } from '@/lib/push-sender';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tenantCode   = String(body.tenant_code   || '').trim().toUpperCase();
  const employeeNo   = String(body.employee_no   || '').trim().toUpperCase();
  const fullName     = String(body.full_name     || '').trim();
  const secret       = String(body.secret        || '').trim();
  const deptCode     = String(body.department_code || '').trim().toUpperCase();
  const phoneNumber  = String(body.phone_number  || '').trim();
  const deviceId     = String(body.device_id     || '').trim();

  if (!tenantCode || !employeeNo || !secret) {
    return NextResponse.json({ detail: 'tenant_code و employee_no و secret مطلوبة' }, { status: 400 });
  }
  if (secret.length < 4) {
    return NextResponse.json({ detail: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }, { status: 400 });
  }

  const tenant = getTenantByCode(tenantCode);
  if (!tenant) {
    return NextResponse.json({ detail: 'كود المؤسسة غير صحيح' }, { status: 401 });
  }

  const latest = getLatestMobileAccessRequest(tenant.id, employeeNo);
  if (latest?.status === 'pending' && !isMobileAccessRequestExpired(latest)) {
    if (Date.now() - latest.requested_at < 60_000) {
      return NextResponse.json({ detail: 'تم إرسال طلب قبل قليل. الرجاء الانتظار.' }, { status: 429 });
    }
  }
  if (latest?.status === 'approved') {
    return NextResponse.json({
      ok: true, status: 'approved',
      message: 'هذا الرقم الوظيفي مفعّل مسبقاً. يمكنك تسجيل الدخول مباشرة.',
    });
  }

  const { hash, salt } = hashPassword(secret);
  const record = createMobileAccessRequest({
    tenant_id: tenant.id, tenant_code: tenant.code,
    organization_name: tenant.name, employee_no: employeeNo,
    full_name: fullName || employeeNo, department_code: deptCode || undefined,
    phone_number: phoneNumber || undefined, device_id: deviceId || undefined,
    secret_hash: hash, secret_salt: salt,
    requested_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    requested_user_agent: req.headers.get('user-agent') || undefined,
  });

  // إشعار المديرين
  try {
    const managerRoles = ['dept_manager', 'section_manager', 'admin', 'founder', 'owner'];
    let subs = getPushSubsByRoles(tenant.id, managerRoles);
    if (!subs.length) subs = getAllPushSubs(tenant.id);
    if (subs.length) {
      void sendPushToMany(tenant.id, subs, {
        title: '📋 طلب تسجيل جديد',
        body: `${fullName || employeeNo} يطلب الدخول للتطبيق — وافق أو ارفض`,
        url: '/m?tab=access-requests',
        urgency: 'high',
      });
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({
    ok: true, status: record.status, request_id: record.id,
    status_token: record.status_token, expires_at: record.expires_at,
    message: 'تم إرسال الطلب إلى مسؤول المؤسسة للمراجعة.',
  });
}
