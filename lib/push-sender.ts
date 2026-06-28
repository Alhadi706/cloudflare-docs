/**
 * Web Push sender utility.
 * Uses the `web-push` npm package with VAPID keys from environment.
 */
import webpush from 'web-push';
import { removePushSub, type PushSubRecord } from './push-store';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@d-me.ly';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  urgency?: 'critical' | 'high' | 'normal';
  url?: string;
  icon?: string;
}

/**
 * Send a push notification to a single subscription.
 * Removes expired/invalid subscriptions automatically.
 * Returns true on success.
 */
export async function sendPushToSub(
  tenantId: string,
  sub: PushSubRecord,
  payload: PushPayload,
): Promise<boolean> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;

  const subscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      urgency: payload.urgency === 'critical' || payload.urgency === 'high' ? 'high' : 'normal',
      TTL: 60 * 60 * 24, // 24 hours
    });
    return true;
  } catch (err: any) {
    // 410 Gone / 404 = subscription expired → clean up
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      removePushSub(tenantId, sub.endpoint);
    }
    return false;
  }
}

/**
 * Send to multiple subscriptions in parallel. Non-blocking (fire-and-forget safe).
 */
export async function sendPushToMany(
  tenantId: string,
  subs: PushSubRecord[],
  payload: PushPayload,
): Promise<void> {
  if (!subs.length || !VAPID_PUBLIC || !VAPID_PRIVATE) return;
  await Promise.allSettled(subs.map(s => sendPushToSub(tenantId, s, payload)));
}
