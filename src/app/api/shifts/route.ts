import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/server-auth';
import { shiftSchema } from '@/lib/validations';
import { notifyShiftAssigned, notifyNewOpenShift } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    const where: any = {};

    if (start && end) {
      where.date = {
        gte: new Date(start + 'T00:00:00.000Z'),
        lte: new Date(end + 'T23:59:59.999Z'),
      };
    }

    const isAdmin = user.role === 'ADMIN';
    const isManager = user.role === 'MANAGER';

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        shiftUsers: {
          include: {
            user: {
              select: { id: true, name: true, email: true, hourlyRate: isAdmin || isManager },
            },
          },
        },
        ...(isAdmin || isManager
          ? {
              _count: { select: { shiftRequests: { where: { status: 'PENDING' } } } },
            }
          : {}),
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(shifts);
  } catch (error) {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = shiftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { date, startTime, endTime, location, type, note, status, employeeIds } = parsed.data;

    // Validate time order
    if (startTime >= endTime) {
      return NextResponse.json({ error: 'Eindtijd moet na starttijd liggen' }, { status: 400 });
    }

    const shift = await prisma.shift.create({
      data: {
        date: new Date(date + 'T00:00:00.000Z'),
        startTime,
        endTime,
        location,
        type,
        note: note || null,
        status,
        ...(employeeIds.length > 0
          ? { shiftUsers: { create: employeeIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: {
        shiftUsers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    // Fire-and-forget: send notifications
    if (employeeIds.length > 0) {
      notifyShiftAssigned(employeeIds, {
        id: shift.id,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        location: shift.location,
      });
    }

    if (status === 'OPEN') {
      // Notify all active employees about the new open shift
      prisma.user.findMany({ where: { active: true, role: 'EMPLOYEE' }, select: { id: true } })
        .then((users) => {
          const ids = users.map((u) => u.id);
          notifyNewOpenShift(ids, {
            id: shift.id,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            location: shift.location,
          });
        })
        .catch(console.error);
    }

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
