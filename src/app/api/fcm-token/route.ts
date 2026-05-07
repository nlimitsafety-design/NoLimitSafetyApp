import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

export async function POST(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const userId = (session!.user as any).id;

  try {
    const { token, platform } = await req.json();
    if (!token || typeof token !== 'string' || token.length < 20 || token.length > 4096) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    const plat = platform === 'ios' ? 'ios' : 'android';

    await prisma.fcmToken.upsert({
      where: { token },
      update: { userId, platform: plat },
      create: { userId, token, platform: plat },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('FCM token save error:', err);
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const userId = (session!.user as any).id;

  try {
    const { token } = await req.json().catch(() => ({}));
    if (token) {
      await prisma.fcmToken.deleteMany({ where: { userId, token } });
    } else {
      await prisma.fcmToken.deleteMany({ where: { userId } });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('FCM token delete error:', err);
    return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
  }
}
