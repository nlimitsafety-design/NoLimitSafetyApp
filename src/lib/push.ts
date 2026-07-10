import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = 'mailto:admin@securityapp.nl';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  shiftId?: string;
}

async function sendWebPush(userIds: string[], payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subscriptions.length === 0) return;

  const payloadStr = JSON.stringify(payload);
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error('Web push error:', err?.statusCode, err?.message);
        }
      }
    }),
  );

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: { in: expiredEndpoints } } })
      .catch(() => {});
  }
}

/**
 * Send push notifications to a list of user IDs via web push.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendPushNotifications(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;
  try {
    await sendWebPush(userIds, payload);
  } catch (err) {
    console.error('Failed to send push notifications:', err);
  }
}
