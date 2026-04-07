import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

/**
 * GET /api/notifications
 * Get current user's notifications (newest first, last 50 by default)
 * ?unreadOnly=true — only unread
 * ?limit=20 — limit results
 */
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as any).id;
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const where: any = { userId };
    if (unreadOnly) where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    // Also get unread count
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * PUT /api/notifications
 * Mark notifications as read
 * Body: { ids: string[] } — mark specific notifications
 * Body: { all: true } — mark all as read
 */
export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = (session!.user as any).id;

  try {
    const body = await req.json();

    if (body.all === true) {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: body.ids }, userId },
        data: { read: true },
      });
    } else {
      return NextResponse.json({ error: 'Geef ids[] of all: true mee' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Notifications PUT error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
