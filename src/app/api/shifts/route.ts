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

    const { date, startTime, endTime, location, type, note, status, employeeIds, repeatUntil, repeatDays } = parsed.data;

    // Validate time order
    if (startTime >= endTime) {
      return NextResponse.json({ error: 'Eindtijd moet na starttijd liggen' }, { status: 400 });
    }

    // Build list of dates (single date or bulk repeat)
    const dates: string[] = [date];
    if (repeatUntil && repeatDays && repeatDays.length > 0) {
      const startDateObj = new Date(date + 'T00:00:00.000Z');
      const endDateObj = new Date(repeatUntil + 'T00:00:00.000Z');
      const cursor = new Date(startDateObj);
      cursor.setUTCDate(cursor.getUTCDate() + 1); // skip the first date, already added
      while (cursor <= endDateObj) {
        const dayOfWeek = cursor.getUTCDay(); // 0=Sun, 1=Mon, ...
        if (repeatDays.includes(dayOfWeek)) {
          dates.push(cursor.toISOString().split('T')[0]);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const createdShifts = [];
    const allAssignedEmployeeIds: string[] = [];

    for (const d of dates) {
      const shift = await prisma.shift.create({
        data: {
          date: new Date(d + 'T00:00:00.000Z'),
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
      createdShifts.push(shift);
    }

    // Send notifications once for all created shifts
    if (employeeIds.length > 0) {
      for (const shift of createdShifts) {
        await notifyShiftAssigned(employeeIds, {
          id: shift.id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          location: shift.location,
        });
      }
    }

    if (status === 'OPEN') {
      const allEmployees = await prisma.user.findMany({ where: { active: true, role: 'EMPLOYEE' }, select: { id: true } });
      const ids = allEmployees.map((u) => u.id);
      for (const shift of createdShifts) {
        await notifyNewOpenShift(ids, {
          id: shift.id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          location: shift.location,
        });
      }
    }

    return NextResponse.json(createdShifts.length === 1 ? createdShifts[0] : createdShifts, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
