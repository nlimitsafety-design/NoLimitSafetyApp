import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { shiftSchema } from '@/lib/validations';
import { notifyShiftAssigned, notifyShiftRemoved, notifyShiftUpdated, notifyShiftDeleted, notifyNewOpenShift } from '@/lib/notifications';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = shiftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { date, startTime, endTime, location, type, note, status, employeeIds } = parsed.data;

    if (startTime >= endTime) {
      return NextResponse.json({ error: 'Eindtijd moet na starttijd liggen' }, { status: 400 });
    }

    // Get old assignments before update (for notification diff)
    const oldAssignments = await prisma.shiftUser.findMany({
      where: { shiftId: params.id },
      select: { userId: true },
    });
    const oldUserIds = new Set(oldAssignments.map((a) => a.userId));
    const newUserIds = new Set(employeeIds);

    // Update shift and reassign employees
    const shift = await prisma.$transaction(async (tx) => {
      // Remove old assignments
      await tx.shiftUser.deleteMany({ where: { shiftId: params.id } });

      // If switching to OPEN, also clear pending requests
      if (status === 'OPEN') {
        await tx.shiftRequest.deleteMany({ where: { shiftId: params.id } });
      }

      // Update shift
      return tx.shift.update({
        where: { id: params.id },
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
    });

    // Fire-and-forget: send notifications
    const removedIds = Array.from(oldUserIds).filter((id) => !newUserIds.has(id));
    const addedIds = Array.from(newUserIds).filter((id) => !oldUserIds.has(id));
    const keptIds = Array.from(newUserIds).filter((id) => oldUserIds.has(id));

    const shiftInfo = {
      id: shift.id,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
    };

    // Await notifications so push completes before Vercel terminates
    if (removedIds.length > 0) await notifyShiftRemoved(removedIds, shiftInfo);
    if (addedIds.length > 0) await notifyShiftAssigned(addedIds, shiftInfo);
    if (keptIds.length > 0) await notifyShiftUpdated(keptIds, shiftInfo);

    if (status === 'OPEN') {
      const allEmployees = await prisma.user.findMany({ where: { active: true, role: 'EMPLOYEE' }, select: { id: true } });
      const ids = allEmployees.map((u) => u.id);
      await notifyNewOpenShift(ids, shiftInfo);
    }

    return NextResponse.json(shift);
  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  try {
    // Get shift info + assigned users before deleting (for notifications)
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: { shiftUsers: { select: { userId: true } } },
    });

    // Manually delete related records first (Turso may not enforce cascades)
    await prisma.shiftRequest.deleteMany({ where: { shiftId: params.id } });
    await prisma.shiftUser.deleteMany({ where: { shiftId: params.id } });
    await prisma.shift.delete({ where: { id: params.id } });

    // Notify assigned users about deletion (awaited for push)
    if (shift && shift.shiftUsers.length > 0) {
      await notifyShiftDeleted(
        shift.shiftUsers.map((su) => su.userId),
        { date: shift.date, startTime: shift.startTime, endTime: shift.endTime, location: shift.location },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete shift error:', err);
    return NextResponse.json({ error: 'Kon dienst niet verwijderen', details: err?.message }, { status: 500 });
  }
}
