import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { recurringAvailabilitySchema } from '@/lib/validations';
import { timeToMinutes } from '@/lib/utils';

/**
 * GET /api/recurring-availability
 * Employee: eigen vaste beschikbaarheid
 * Admin: optioneel ?userId= filter
 */
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const { searchParams } = new URL(req.url);
    const userId = user.role === 'ADMIN' ? (searchParams.get('userId') || user.id) : user.id;

    const items = await prisma.recurringAvailability.findMany({
      where: { userId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error('GET recurring-availability error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/recurring-availability
 * Maak een nieuwe vaste beschikbaarheid aan
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const body = await req.json();
    const parsed = recurringAvailabilitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validatiefout', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { weekday, startTime, endTime, validFrom, validTo, note } = parsed.data;

    // Validate start < end
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return NextResponse.json({ error: 'Starttijd moet voor eindtijd liggen' }, { status: 400 });
    }

    // Check overlap with existing recurring entries for same user + weekday + overlapping validity period
    const existing = await prisma.recurringAvailability.findMany({
      where: {
        userId: user.id,
        weekday,
      },
    });

    const fromDate = new Date(validFrom + 'T00:00:00.000Z');
    const toDate = validTo ? new Date(validTo + 'T00:00:00.000Z') : null;

    for (const rec of existing) {
      // Check validity period overlap
      const recFrom = new Date(rec.validFrom);
      const recTo = rec.validTo ? new Date(rec.validTo) : null;

      const periodsOverlap =
        (!recTo || fromDate <= recTo) && (!toDate || recFrom <= toDate);

      if (periodsOverlap) {
        // Check time overlap
        const sStart = timeToMinutes(startTime);
        const sEnd = timeToMinutes(endTime);
        const eStart = timeToMinutes(rec.startTime);
        const eEnd = timeToMinutes(rec.endTime);

        if (sStart < eEnd && eStart < sEnd) {
          return NextResponse.json(
            { error: `Overlapt met bestaand tijdslot ${rec.startTime}–${rec.endTime} op deze dag` },
            { status: 400 }
          );
        }
      }
    }

    const item = await prisma.recurringAvailability.create({
      data: {
        userId: user.id,
        weekday,
        startTime,
        endTime,
        validFrom: fromDate,
        validTo: toDate,
        note: note || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST recurring-availability error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * PUT /api/recurring-availability
 * Update een bestaande vaste beschikbaarheid (body bevat id)
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

    const parsed = recurringAvailabilitySchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validatiefout', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.recurringAvailability.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    const { weekday, startTime, endTime, validFrom, validTo, note } = parsed.data;

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return NextResponse.json({ error: 'Starttijd moet voor eindtijd liggen' }, { status: 400 });
    }

    // Check overlap (exclude self)
    const others = await prisma.recurringAvailability.findMany({
      where: {
        userId: existing.userId,
        weekday,
        id: { not: id },
      },
    });

    const fromDate = new Date(validFrom + 'T00:00:00.000Z');
    const toDate = validTo ? new Date(validTo + 'T00:00:00.000Z') : null;

    for (const rec of others) {
      const recFrom = new Date(rec.validFrom);
      const recTo = rec.validTo ? new Date(rec.validTo) : null;
      const periodsOverlap = (!recTo || fromDate <= recTo) && (!toDate || recFrom <= toDate);

      if (periodsOverlap) {
        const sStart = timeToMinutes(startTime);
        const sEnd = timeToMinutes(endTime);
        const eStart = timeToMinutes(rec.startTime);
        const eEnd = timeToMinutes(rec.endTime);

        if (sStart < eEnd && eStart < sEnd) {
          return NextResponse.json(
            { error: `Overlapt met bestaand tijdslot ${rec.startTime}–${rec.endTime} op deze dag` },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.recurringAvailability.update({
      where: { id },
      data: {
        weekday,
        startTime,
        endTime,
        validFrom: fromDate,
        validTo: toDate,
        note: note || null,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT recurring-availability error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * DELETE /api/recurring-availability?id=xxx
 */
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });
    }

    const existing = await prisma.recurringAvailability.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    await prisma.recurringAvailability.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE recurring-availability error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
