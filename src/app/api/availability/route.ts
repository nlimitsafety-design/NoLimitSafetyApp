import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { availabilitySchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const userIdFilter = searchParams.get('userId');

  try {
    const where: any = {};

    if (start && end) {
      where.date = {
        gte: new Date(start + 'T00:00:00.000Z'),
        lte: new Date(end + 'T23:59:59.999Z'),
      };
    }

    // Non-admin users can only see their own
    if (user.role === 'EMPLOYEE') {
      where.userId = user.id;
    } else if (userIdFilter) {
      where.userId = userIdFilter;
    }

    const availability = await prisma.availability.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(availability);
  } catch {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;

  try {
    const body = await req.json();
    const parsed = availabilitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { date, startTime, endTime, status, note } = parsed.data;
    const dateObj = new Date(date + 'T00:00:00.000Z');

    // Validate time order
    if (startTime >= endTime) {
      return NextResponse.json({ error: 'Eindtijd moet na starttijd liggen' }, { status: 400 });
    }

    // Upsert: update if exists for same user, date, and time
    const existing = await prisma.availability.findFirst({
      where: {
        userId: user.id,
        date: dateObj,
        startTime,
        endTime,
      },
    });

    let result;
    if (existing) {
      result = await prisma.availability.update({
        where: { id: existing.id },
        data: { status, note: note || null },
      });
    } else {
      result = await prisma.availability.create({
        data: {
          userId: user.id,
          date: dateObj,
          startTime,
          endTime,
          status,
          note: note || null,
        },
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('Create availability error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });
    }

    const parsed = availabilitySchema.safeParse(updates);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { date, startTime, endTime, status, note } = parsed.data;

    if (startTime >= endTime) {
      return NextResponse.json({ error: 'Eindtijd moet na starttijd liggen' }, { status: 400 });
    }

    // Verify ownership (only ADMIN can edit others, EMPLOYEE/MANAGER can only edit own)
    const existing = await prisma.availability.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const result = await prisma.availability.update({
      where: { id },
      data: {
        date: new Date(date + 'T00:00:00.000Z'),
        startTime,
        endTime,
        status,
        note: note || null,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Update availability error:', err);
    return NextResponse.json({ error: 'Fout bij bijwerken' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });
  }

  try {
    // Verify ownership (only ADMIN can delete others, EMPLOYEE/MANAGER can only delete own)
    const item = await prisma.availability.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (item.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    await prisma.availability.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fout bij verwijderen' }, { status: 500 });
  }
}
