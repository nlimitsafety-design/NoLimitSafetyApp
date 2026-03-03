import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

// GET /api/conversations — list all conversations for the current user
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;
  const userId = (session!.user as any).id;

  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  });

  // Build response with unread counts
  const conversations = await Promise.all(
    memberships.map(async (m) => {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: m.conversationId,
          createdAt: { gt: m.lastReadAt },
          senderId: { not: userId },
        },
      });

      const otherMembers = m.conversation.members
        .filter((cm) => cm.userId !== userId)
        .map((cm) => cm.user);

      const lastMessage = m.conversation.messages[0] || null;

      return {
        id: m.conversation.id,
        name: m.conversation.name || otherMembers.map((u) => u.name).join(', '),
        isGroup: m.conversation.isGroup,
        members: m.conversation.members.map((cm) => cm.user),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.name,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        updatedAt: m.conversation.updatedAt,
      };
    }),
  );

  // Sort by last activity
  conversations.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.updatedAt;
    const bTime = b.lastMessage?.createdAt || b.updatedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return NextResponse.json(conversations);
}

// POST /api/conversations — create or find a conversation
export async function POST(req: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;
  const userId = (session!.user as any).id;

  const { memberIds, name, isGroup } = await req.json();

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: 'memberIds is vereist' }, { status: 400 });
  }

  // Ensure current user is included
  const allMemberIds = Array.from(new Set([userId, ...memberIds]));

  // For 1-on-1 chats, check if one already exists
  if (!isGroup && allMemberIds.length === 2) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: allMemberIds },
          },
        },
      },
      include: {
        members: true,
      },
    });

    // Verify it has exactly these 2 members
    if (existing && existing.members.length === 2) {
      return NextResponse.json({ id: existing.id, existing: true });
    }
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      name: isGroup ? name || 'Groepsgesprek' : null,
      isGroup: isGroup || false,
      members: {
        create: allMemberIds.map((id: string) => ({
          userId: id,
        })),
      },
    },
  });

  return NextResponse.json({ id: conversation.id, existing: false }, { status: 201 });
}
