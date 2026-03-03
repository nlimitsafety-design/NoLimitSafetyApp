import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

// GET /api/conversations/[id] — get messages for a conversation
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const userId = (session!.user as any).id;

  // Check user is a member
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: params.id,
        userId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const before = url.searchParams.get('before'); // cursor for pagination

  const messages = await prisma.message.findMany({
    where: {
      conversationId: params.id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Mark as read
  await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: params.id,
        userId,
      },
    },
    data: { lastReadAt: new Date() },
  });

  // Get conversation info
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  return NextResponse.json({
    conversation: {
      id: conversation!.id,
      name: conversation!.name,
      isGroup: conversation!.isGroup,
      members: conversation!.members.map((m) => m.user),
    },
    messages: messages.reverse(), // oldest first
    hasMore: messages.length === limit,
  });
}

// POST /api/conversations/[id] — send a message
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const userId = (session!.user as any).id;

  // Check membership
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: params.id,
        userId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
  }

  const { content } = await req.json();
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Bericht mag niet leeg zijn' }, { status: 400 });
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      conversationId: params.id,
      senderId: userId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: params.id },
    data: { updatedAt: new Date() },
  });

  // Update sender's lastReadAt
  await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: params.id,
        userId,
      },
    },
    data: { lastReadAt: new Date() },
  });

  // Send push notifications to other members (fire-and-forget-safe since we await)
  try {
    const { sendPushNotifications } = await import('@/lib/push');
    const otherMembers = await prisma.conversationMember.findMany({
      where: { conversationId: params.id, userId: { not: userId } },
      select: { userId: true },
    });
    const otherUserIds = otherMembers.map((m) => m.userId);
    if (otherUserIds.length > 0) {
      const senderName = (session!.user as any).name || 'Iemand';
      await sendPushNotifications(otherUserIds, {
        title: `Nieuw bericht van ${senderName}`,
        body: content.trim().length > 80 ? content.trim().substring(0, 80) + '...' : content.trim(),
        url: `/berichten?conversation=${params.id}`,
        tag: `msg-${params.id}`,
      });
    }
  } catch {}

  return NextResponse.json(message, { status: 201 });
}
