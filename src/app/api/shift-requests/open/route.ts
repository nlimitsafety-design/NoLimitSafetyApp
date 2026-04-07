import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';

/**
 * GET /api/shift-requests/open
 * Returns all OPEN shifts for employees, enriched with their own request status
 */
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;

  try {
    const shifts = await prisma.shift.findMany({
      where: {
        status: 'OPEN',
        date: { gte: new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z') },
      },
      include: {
        shiftRequests: {
          where: { userId: user.id },
          select: { id: true, status: true },
        },
        _count: {
          select: { shiftRequests: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const result = shifts.map((shift) => ({
      id: shift.id,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      type: shift.type,
      note: shift.note,
      totalRequests: shift._count.shiftRequests,
      myRequest: shift.shiftRequests[0] || null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('Open shifts GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
