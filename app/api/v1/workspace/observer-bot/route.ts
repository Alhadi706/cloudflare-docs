/**
 * /api/v1/workspace/observer-bot
 * GET  → return current bot integration status
 * POST → connect/test/disconnect Telegram, or sync corrosion teams
 *
 * Bot config stored in .data/observer-bot/{tenant_id}.json
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'observer-bot');

// Tenant identity must come from middleware's verified JWT — never a client-supplied header.
function getTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function getBotFile(tenantId: string): string {
  return path.join(DATA_DIR, `${tenantId}.json`);
}

function readBotConfig(tenantId: string): any {
  try {
    const f = getBotFile(tenantId);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

function writeBotConfig(tenantId: string, config: any) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(getBotFile(tenantId), JSON.stringify(config, null, 2));
}

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const config = readBotConfig(tenantId);
  const integrations = config
    ? [{ bot_type: 'telegram', is_active: config.is_active === true, status: config.is_active ? 'active' : 'inactive', ...config }]
    : [];
  return NextResponse.json({ integrations });
}

export async function POST(req: NextRequest) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  }

  const { action, token, allow_shared } = body;

  if (action === 'connect_telegram') {
    if (!token) {
      return NextResponse.json({ error: 'Bot Token مطلوب' }, { status: 400 });
    }
    // Verify token with Telegram API
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
      if (!tgRes.ok) {
        return NextResponse.json({ error: 'Token غير صحيح أو منتهي الصلاحية' }, { status: 400 });
      }
      const tgData = await tgRes.json();
      const botInfo = tgData.result;
      const config = {
        bot_type: 'telegram',
        token,
        allow_shared: allow_shared === true,
        is_active: true,
        status: 'active',
        bot_username: botInfo?.username || '',
        bot_name: botInfo?.first_name || '',
        connected_at: new Date().toISOString(),
        tenant_id: tenantId,
      };
      writeBotConfig(tenantId, config);
      return NextResponse.json({ success: true, bot_username: botInfo?.username, message: `تم ربط البوت @${botInfo?.username} بنجاح` });
    } catch {
      return NextResponse.json({ error: 'تعذر التحقق من Token — تأكد من الاتصال بالإنترنت' }, { status: 503 });
    }
  }

  if (action === 'test_telegram') {
    const config = readBotConfig(tenantId);
    if (!config?.is_active || !config?.token) {
      return NextResponse.json({ error: 'لم يتم ربط Telegram بعد' }, { status: 400 });
    }
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${config.token}/getMe`, { signal: AbortSignal.timeout(8000) });
      if (tgRes.ok) {
        return NextResponse.json({ success: true, message: 'الاتصال يعمل بشكل طبيعي' });
      }
      return NextResponse.json({ error: 'لم يستجب البوت — قد يكون Token منتهياً' }, { status: 400 });
    } catch {
      return NextResponse.json({ error: 'تعذر الاتصال بـ Telegram' }, { status: 503 });
    }
  }

  if (action === 'disconnect_telegram') {
    const config = readBotConfig(tenantId);
    if (config) {
      writeBotConfig(tenantId, { ...config, is_active: false, status: 'inactive', disconnected_at: new Date().toISOString() });
    }
    return NextResponse.json({ success: true, message: 'تم فصل Telegram' });
  }

  if (action === 'sync_corrosion_team') {
    // Sync team data to mobile — already handled in field-teams POST
    // Return success so the UI can mark it as synced
    return NextResponse.json({ success: true, synced_at: new Date().toISOString() });
  }

  return NextResponse.json({ error: `إجراء غير معروف: ${action}` }, { status: 400 });
}
