import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { shiftSchema } from '@/lib/validations';

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
    await prisma.shift.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Kon dienst niet verwijderen' }, { status: 500 });
  }
}
