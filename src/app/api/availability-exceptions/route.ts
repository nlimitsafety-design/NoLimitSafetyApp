import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { availabilityExceptionSchema } from '@/lib/validations';
import { timeToMinutes } from '@/lib/utils';

/**
 * GET /api/availability-exceptions?start=&end=
 * Employee: eigen uitzonderingen
 * Admin: optioneel ?userId= filter
 */
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const userId = user.role === 'ADMIN' ? (searchParams.get('userId') || user.id) : user.id;

    const where: any = { userId };
    if (start && end) {
      where.date = {
        gte: new Date(start + 'T00:00:00.000Z'),
        lte: new Date(end + 'T23:59:59.999Z'),
      };
    }

    const items = await prisma.availabilityException.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error('GET availability-exceptions error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/availability-exceptions
 * Maak een nieuwe uitzondering aan
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const body = await req.json();
    const parsed = availabilityExceptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validatiefout', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { date, type, startTime, endTime, note } = parsed.data;

    // For AVAILABLE type, startTime and endTime are required
    if (type === 'AVAILABLE' && (!startTime || !endTime)) {
      return NextResponse.json(
        { error: 'Start- en eindtijd zijn verplicht voor beschikbaar' },
        { status: 400 }
      );
    }

    // Validate start < end for AVAILABLE
    if (type === 'AVAILABLE' && startTime && endTime) {
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        return NextResponse.json({ error: 'Starttijd moet voor eindtijd liggen' }, { status: 400 });
      }
    }

    const excDate = new Date(date + 'T00:00:00.000Z');

    const item = await prisma.availabilityException.create({
      data: {
        userId: user.id,
        date: excDate,
        type,
        startTime: startTime || null,
        endTime: endTime || null,
        note: note || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST availability-exceptions error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * PUT /api/availability-exceptions
 * Update een uitzondering (body bevat id)
 */
export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const body = await req.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });
    }

    const parsed = availabilityExceptionSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validatiefout', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.availabilityException.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { date, type, startTime, endTime, note } = parsed.data;

    if (type === 'AVAILABLE' && (!startTime || !endTime)) {
      return NextResponse.json(
        { error: 'Start- en eindtijd zijn verplicht voor beschikbaar' },
        { status: 400 }
      );
    }

    if (type === 'AVAILABLE' && startTime && endTime) {
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        return NextResponse.json({ error: 'Starttijd moet voor eindtijd liggen' }, { status: 400 });
      }
    }

    const updated = await prisma.availabilityException.update({
      where: { id },
      data: {
        date: new Date(date + 'T00:00:00.000Z'),
        type,
        startTime: startTime || null,
        endTime: endTime || null,
        note: note || null,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT availability-exceptions error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * DELETE /api/availability-exceptions?id=xxx
 */
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
    const existing = await prisma.availabilityException.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    await prisma.availabilityException.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE availability-exceptions error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
