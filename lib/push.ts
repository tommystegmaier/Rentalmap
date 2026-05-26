import webpush from 'web-push';
import { createServiceRoleClient } from '@/lib/supabase/server';

let configured = false;

function configure() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:noreply@it-rents.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  badgeCount?: number;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!configure()) return { sent: 0, error: 'vapid_not_configured' };

  const supabase = createServiceRoleClient();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  for (const sub of subs as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number };
      // 404/410 = browser unsubscribed; clean up.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
  return { sent };
}

export async function sendPushToLandlord(propertyId: string, payload: PushPayload) {
  const supabase = createServiceRoleClient();
  const { data: prop } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (!prop?.owner_id) return { sent: 0 };
  return sendPushToUser(prop.owner_id, payload);
}
