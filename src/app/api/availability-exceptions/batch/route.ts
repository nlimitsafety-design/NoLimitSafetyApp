import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { timeToMinutes } from '@/lib/utils';

/**
 * POST /api/availability-exceptions/batch
 * Bulk-create exceptions for multiple dates (skip dates that already have one)
 * Body: { dates: string[], type: 'AVAILABLE'|'UNAVAILABLE', startTime?: string, endTime?: string, note?: string }
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const user = session!.user as any;
    const body = await req.json();
    const { dates, type, startTime, endTime, note } = body;

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'Geen datums opgegeven' }, { status: 400 });
    }

    if (!['AVAILABLE', 'UNAVAILABLE'].includes(type)) {
      return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 });
    }

    if (type === 'AVAILABLE') {
      if (!startTime || !endTime) {
        return NextResponse.json({ error: 'Start- en eindtijd zijn verplicht voor beschikbaar' }, { status: 400 });
      }
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return NextResponse.json({ error: 'Ongeldig tijdformaat (HH:mm)' }, { status: 400 });
      }
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        return NextResponse.json({ error: 'Starttijd moet voor eindtijd liggen' }, { status: 400 });
      }
    }

    // Find existing exceptions on these dates
    const parsedDates = dates.map((d: string) => new Date(d + 'T00:00:00.000Z'));
    const existing = await prisma.availabilityException.findMany({
      where: {
        userId: user.id,
        date: { in: parsedDates },
      },
      select: { date: true },
    });

    const existingDateStrings = new Set(
      existing.map((e) => e.date.toISOString().split('T')[0])
    );

    // Filter out dates that already have exceptions
    const newDates = dates.filter((d: string) => !existingDateStrings.has(d));

    if (newDates.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: dates.length,
        message: 'Alle datums hebben al een uitzondering',
      });
    }

    // Bulk create
    const data = newDates.map((d: string) => ({
      userId: user.id,
      date: new Date(d + 'T00:00:00.000Z'),
      type,
      startTime: type === 'AVAILABLE' ? startTime : null,
      endTime: type === 'AVAILABLE' ? endTime : null,
      note: note || null,
    }));

    // createMany may not work with all drivers, fall back to individual creates
    let createdCount = 0;
    for (const item of data) {
      try {
        await prisma.availabilityException.create({ data: item });
        createdCount++;
      } catch (e) {
        // Skip duplicates silently
        console.warn('Batch create skip:', e);
      }
    }

    return NextResponse.json({
      created: createdCount,
      skipped: dates.length - createdCount,
      message: `${createdCount} uitzondering(en) aangemaakt`,
    });
  } catch (err) {
    console.error('Batch create exceptions error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
