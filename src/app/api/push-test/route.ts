import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();

// GET — diagnostic info: check subscriptions, VAPID config, attempt test push
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;
  const user = session!.user;

  const diagnostics: any = {
    userId: user.id,
    userName: user.name,
    vapidPublicKeySet: !!VAPID_PUBLIC_KEY,
    vapidPublicKeyLength: VAPID_PUBLIC_KEY.length,
    vapidPrivateKeySet: !!VAPID_PRIVATE_KEY,
    vapidPrivateKeyLength: VAPID_PRIVATE_KEY.length,
    vapidPublicKeyPreview: VAPID_PUBLIC_KEY.substring(0, 10) + '...',
  };

  // Check subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
  });

  diagnostics.subscriptionCount = subscriptions.length;
  diagnostics.subscriptions = subscriptions.map((s) => ({
    id: s.id,
    endpointPreview: s.endpoint.substring(0, 60) + '...',
    p256dhLength: s.p256dh.length,
    authLength: s.auth.length,
    createdAt: s.createdAt,
  }));

  // Try sending a test push to this user
  if (subscriptions.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails('mailto:admin@securityapp.nl', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } catch (e: any) {
      diagnostics.vapidConfigError = e.message;
      return NextResponse.json(diagnostics);
    }

    const testPayload = JSON.stringify({
      title: 'Test Push Notification',
      body: 'Als je dit ziet, werken push notificaties! 🎉',
      url: '/notifications',
      tag: 'test-' + Date.now(),
    });

    const results: any[] = [];
    for (const sub of subscriptions) {
      try {
        const result = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          testPayload,
        );
        results.push({
          endpoint: sub.endpoint.substring(0, 60) + '...',
          status: result.statusCode,
          success: true,
        });
      } catch (err: any) {
        results.push({
          endpoint: sub.endpoint.substring(0, 60) + '...',
          status: err?.statusCode,
          success: false,
          error: err?.message || String(err),
          body: err?.body,
        });
      }
    }
    diagnostics.pushResults = results;
  } else {
    diagnostics.pushResults = 'No subscriptions or VAPID keys not configured';
  }

  // Also count ALL subscriptions in DB
  const totalSubs = await prisma.pushSubscription.count();
  diagnostics.totalSubscriptionsInDB = totalSubs;

  return NextResponse.json(diagnostics);
}
