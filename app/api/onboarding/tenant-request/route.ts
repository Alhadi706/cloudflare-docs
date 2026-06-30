import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db-pg';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      organization_name,
      organization_type,
      contact_full_name,
      contact_email,
      contact_phone,
      notes,
    } = body as Record<string, string | undefined>;

    // Validate required fields
    if (!organization_name?.trim()) {
      return NextResponse.json({ detail: 'اسم المؤسسة مطلوب' }, { status: 400 });
    }
    if (!contact_full_name?.trim()) {
      return NextResponse.json({ detail: 'اسم جهة التواصل مطلوب' }, { status: 400 });
    }
    if (!contact_email?.trim()) {
      return NextResponse.json({ detail: 'بريد التواصل مطلوب' }, { status: 400 });
    }
    if (!contact_phone?.trim()) {
      return NextResponse.json({ detail: 'رقم الهاتف مطلوب' }, { status: 400 });
    }

    // Sanitize email format
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(contact_email.trim())) {
      return NextResponse.json({ detail: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 });
    }

    const request_id = randomUUID();
    const requested_at = Date.now();

    await pgPool.query(
      `INSERT INTO auth_tenant_requests
        (id, organization_name, organization_type, contact_full_name, contact_email, contact_phone, requested_departments, notes, status, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)`,
      [
        request_id,
        organization_name.trim(),
        organization_type?.trim() || null,
        contact_full_name.trim(),
        contact_email.trim().toLowerCase(),
        contact_phone.trim(),
        JSON.stringify([]),
        notes?.trim() || null,
        requested_at,
      ]
    );

    return NextResponse.json({ request_id, status: 'pending' }, { status: 201 });
  } catch (err) {
    console.error('[tenant-request] error:', err);
    return NextResponse.json({ detail: 'حدث خطأ داخلي' }, { status: 500 });
  }
}
