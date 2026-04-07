import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

// POST — subscribe to push notifications
export async function POST(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const user = session!.user;

  try {
    const { subscription } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Upsert: update if endpoint exists, otherwise create
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

// DELETE — unsubscribe from push notifications
export async function DELETE(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const user = session!.user;

  try {
    const { endpoint } = await req.json();
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint },
      });
    } else {
      // Delete all subscriptions for this user
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
