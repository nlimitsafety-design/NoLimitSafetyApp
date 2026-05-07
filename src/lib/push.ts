import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import type { App } from 'firebase-admin/app';

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

// Lazy-init Firebase Admin so the web build doesn't require the SDK at load time.
let firebaseApp: App | null = null;
let firebaseInitTried = false;
async function getFirebaseApp(): Promise<App | null> {
  if (firebaseApp) return firebaseApp;
  if (firebaseInitTried) return null;
  firebaseInitTried = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    if (getApps().length > 0) {
      firebaseApp = getApps()[0]!;
      return firebaseApp;
    }
    const credentials = JSON.parse(raw);
    firebaseApp = initializeApp({ credential: cert(credentials) });
    return firebaseApp;
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
    return null;
  }
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

async function sendFcm(userIds: string[], payload: PushPayload) {
  const app = await getFirebaseApp();
  if (!app) return;

  const tokens = await prisma.fcmToken.findMany({ where: { userId: { in: userIds } } });
  if (tokens.length === 0) return;

  const { getMessaging } = await import('firebase-admin/messaging');
  const messaging = getMessaging(app);

  const data: Record<string, string> = { title: payload.title, body: payload.body };
  if (payload.url) data.url = payload.url;
  if (payload.tag) data.tag = payload.tag;
  if (payload.shiftId) data.shiftId = payload.shiftId;

  const expiredTokens: string[] = [];

  await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        await messaging.send({
          token: t.token,
          notification: { title: payload.title, body: payload.body },
          data,
          android: { priority: 'high', notification: { tag: payload.tag, sound: 'default' } },
        });
      } catch (err: any) {
        const code: string | undefined = err?.errorInfo?.code || err?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          expiredTokens.push(t.token);
        } else {
          console.error('FCM send error:', code, err?.message);
        }
      }
    }),
  );

  if (expiredTokens.length > 0) {
    await prisma.fcmToken.deleteMany({ where: { token: { in: expiredTokens } } }).catch(() => {});
  }
}

/**
 * Send push notifications to a list of user IDs via both web push and FCM.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendPushNotifications(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;
  try {
    await Promise.allSettled([sendWebPush(userIds, payload), sendFcm(userIds, payload)]);
  } catch (err) {
    console.error('Failed to send push notifications:', err);
  }
}
