/**
 * Email Service — branded Arabic email delivery.
 * Priority 1: Resend.com API (set RESEND_API_KEY)
 * Priority 2: SMTP / Nodemailer (set SMTP_HOST + SMTP_USER + SMTP_PASS)
 * Fallback: console log with explicit warning — never returns fake success.
 */

interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
  text?:   string;
}

export interface EmailResult {
  sent:    boolean;
  method:  'resend' | 'smtp' | 'console';
  warning?: string;
  missing_config?: string[];
}

// ── Provider detection ─────────────────────────────────────────
function hasResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function hasSMTP(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function missingConfigVars(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.SMTP_HOST)      missing.push('SMTP_HOST');
  if (!process.env.SMTP_USER)      missing.push('SMTP_USER');
  if (!process.env.SMTP_PASS)      missing.push('SMTP_PASS');
  return missing;
}

// ── Resend.com (no npm package needed — plain HTTP) ─────────────
async function sendViaResend(payload: EmailPayload): Promise<void> {
  const from = process.env.RESEND_FROM || 'noreply@d-me.ly';
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({
      from,
      to:      [payload.to],
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}

// ── SMTP via Nodemailer ─────────────────────────────────────────
async function sendViaSMTP(payload: EmailPayload): Promise<void> {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    host:   process.env.SMTP_HOST!,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
  await transporter.sendMail({
    from:    `"منصة السيادة الرقمية" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to:      payload.to,
    subject: payload.subject,
    html:    payload.html,
    text:    payload.text,
  });
}

// ── Main send function ─────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  // Try Resend first (simpler, no SMTP setup)
  if (hasResend()) {
    try {
      await sendViaResend(payload);
      return { sent: true, method: 'resend' };
    } catch (e) {
      console.error('[email-service] Resend failed:', e);
      // Fall through to SMTP
    }
  }

  // Try SMTP (Nodemailer)
  if (hasSMTP()) {
    try {
      await sendViaSMTP(payload);
      return { sent: true, method: 'smtp' };
    } catch (e) {
      console.error('[email-service] SMTP failed:', e);
      // Fall through to console warning
    }
  }

  // No provider configured — explicit warning, never fake success
  const missing = missingConfigVars();
  console.warn('\n╔═══════════════════════════════════════════════════════╗');
  console.warn('║  EMAIL-SERVICE ⚠️  NO EMAIL PROVIDER CONFIGURED       ║');
  console.warn('╠═══════════════════════════════════════════════════════╣');
  console.warn('║  Option A — Resend.com (recommended):                 ║');
  console.warn('║    RESEND_API_KEY=re_xxxx...                          ║');
  console.warn('║    RESEND_FROM=noreply@yourdomain.com                 ║');
  console.warn('║  Option B — SMTP (Gmail/any):                         ║');
  console.warn('║    SMTP_HOST=smtp.gmail.com                           ║');
  console.warn('║    SMTP_PORT=587                                      ║');
  console.warn('║    SMTP_USER=you@gmail.com                            ║');
  console.warn('║    SMTP_PASS=your-app-password                        ║');
  console.warn('╠═══════════════════════════════════════════════════════╣');
  console.warn(`║  To:      ${payload.to.slice(0,45).padEnd(45)}║`);
  console.warn(`║  Subject: ${payload.subject.slice(0,45).padEnd(45)}║`);
  console.warn('║  ✗ Email was NOT delivered.                           ║');
  console.warn('╚═══════════════════════════════════════════════════════╝\n');

  const warning = [
    'لم يُرسَل البريد الفعلي — لم يُهيَّأ أي مزوّد بريد إلكتروني.',
    'الخيار أ: أضف RESEND_API_KEY إلى .env.local (موصى به — resend.com).',
    'الخيار ب: أضف SMTP_HOST + SMTP_USER + SMTP_PASS إلى .env.local.',
  ].join(' ');

  return { sent: false, method: 'console', warning, missing_config: missing };
}

// ── Email Templates ──────────────────────────────────────────────

function baseWrapper(content: string): string {
  return `
    <div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#020c1e;color:#e2e8f0;padding:0;margin:0">
      <div style="max-width:540px;margin:0 auto;padding:40px 24px">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:36px">
          <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:22px">🌐</div>
          <div>
            <div style="color:#94a3b8;font-size:11px;margin-bottom:2px">منصة</div>
            <div style="color:white;font-weight:700;font-size:16px">Digital Sovereignty Force</div>
          </div>
        </div>
        ${content}
        <!-- Footer -->
        <div style="margin-top:36px;padding-top:18px;border-top:1px solid #1e293b;color:#334155;font-size:11px;text-align:center">
          <p style="margin:0">منصة السيادة الرقمية — Digital Sovereignty Force</p>
          <p style="margin:6px 0 0">هذا البريد أُرسل تلقائياً، لا تردّ عليه مباشرة.</p>
        </div>
      </div>
    </div>
  `;
}

export interface VerificationEmailOpts {
  full_name:       string;
  otp:             string;
  activationLink:  string;
}

export function buildVerificationEmail(opts: VerificationEmailOpts): { subject: string; html: string; text: string } {
  return {
    subject: 'تفعيل حسابك في منصة السيادة الرقمية',
    html: baseWrapper(`
      <h2 style="color:white;margin:0 0 8px;font-size:22px">مرحباً ${opts.full_name}،</h2>
      <p style="color:#94a3b8;margin:0 0 28px;font-size:14px;line-height:1.7">
        شكراً لتسجيلك في منصة السيادة الرقمية. لإتمام إنشاء حسابك، يرجى التفعيل باستخدام أحد الخيارين التاليين.
      </p>
      <!-- OTP -->
      <div style="background:#0f2039;border:1px solid #1e3a5f;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px">
        <div style="color:#64748b;font-size:12px;margin-bottom:10px">رمز التفعيل الخاص بك</div>
        <div style="font-size:44px;font-weight:700;letter-spacing:0.5em;color:#38bdf8;font-family:'Courier New',monospace">${opts.otp}</div>
        <div style="color:#475569;font-size:12px;margin-top:10px">⏱ صالح لمدة 30 دقيقة</div>
      </div>
      <!-- Divider -->
      <div style="text-align:center;color:#334155;font-size:12px;margin:18px 0">— أو انقر على الرابط مباشرة —</div>
      <!-- Button -->
      <div style="text-align:center;margin-bottom:20px">
        <a href="${opts.activationLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#06b6d4);color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:14px">
          تفعيل الحساب ←
        </a>
      </div>
      <p style="color:#475569;font-size:10px;text-align:center;word-break:break-all;margin-bottom:24px">${opts.activationLink}</p>
      <!-- Warning -->
      <div style="background:#1a0a00;border:1px solid #7c2d12;border-radius:8px;padding:12px 16px">
        <p style="color:#fb923c;font-size:12px;margin:0">
          ⚠️ إذا لم تقم بهذا الطلب، تجاهل هذه الرسالة بأمان. لا تشارك الرمز أو الرابط مع أي شخص.
        </p>
      </div>
    `),
    text: `مرحباً ${opts.full_name}،\n\nرمز تفعيل حسابك: ${opts.otp}\n\nأو افتح الرابط:\n${opts.activationLink}\n\nصالح لمدة 30 دقيقة.`,
  };
}

export interface LoginEmailOpts { otp: string; email: string; }

export function buildLoginEmail(opts: LoginEmailOpts): { subject: string; html: string; text: string } {
  return {
    subject: 'رمز الدخول إلى منصة السيادة الرقمية',
    html: baseWrapper(`
      <h2 style="color:white;margin:0 0 8px;font-size:22px">رمز الدخول الخاص بك</h2>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">أدخل هذا الرمز للدخول إلى منصة السيادة الرقمية.</p>
      <div style="background:#0f2039;border:1px solid #1e3a5f;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px">
        <div style="font-size:44px;font-weight:700;letter-spacing:0.5em;color:#38bdf8;font-family:'Courier New',monospace">${opts.otp}</div>
        <div style="color:#475569;font-size:12px;margin-top:10px">⏱ صالح لمدة 10 دقائق</div>
      </div>
      <p style="color:#475569;font-size:12px;margin:0">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة تماماً.</p>
    `),
    text: `رمز الدخول: ${opts.otp}\nصالح لمدة 10 دقائق.`,
  };
}

export interface PasswordResetEmailOpts {
  name: string;
  otp: string;
}

export function buildPasswordResetEmail(opts: PasswordResetEmailOpts): { subject: string; html: string; text: string } {
  return {
    subject: 'رمز إعادة تعيين كلمة المرور',
    html: baseWrapper(`
      <h2 style="color:white;margin:0 0 8px;font-size:22px">مرحباً ${opts.name}،</h2>
      <p style="color:#94a3b8;margin:0 0 24px;font-size:14px;line-height:1.7">
        استخدم الرمز التالي لإعادة تعيين كلمة المرور الخاصة بحسابك.
      </p>
      <div style="background:#0f2039;border:1px solid #1e3a5f;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px">
        <div style="color:#64748b;font-size:12px;margin-bottom:10px">رمز إعادة التعيين</div>
        <div style="font-size:44px;font-weight:700;letter-spacing:0.5em;color:#38bdf8;font-family:'Courier New',monospace">${opts.otp}</div>
        <div style="color:#475569;font-size:12px;margin-top:10px">⏱ صالح لمدة 15 دقيقة</div>
      </div>
      <div style="background:#1a0a00;border:1px solid #7c2d12;border-radius:8px;padding:12px 16px">
        <p style="color:#fb923c;font-size:12px;margin:0">
          ⚠️ إذا لم تطلب إعادة التعيين، تجاهل الرسالة ولا تشارك الرمز مع أي شخص.
        </p>
      </div>
    `),
    text: `مرحباً ${opts.name}،\n\nرمز إعادة تعيين كلمة المرور: ${opts.otp}\nصالح لمدة 15 دقيقة.\n\nإذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.`,
  };
}
