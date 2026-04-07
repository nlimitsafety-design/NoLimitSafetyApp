import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-auth';
import { copyWeekSchema } from '@/lib/validations';
import { addDays } from 'date-fns';

/**
 * POST /api/availability-exceptions/copy-week
 * Kopieert uitzonderingen van bron-week naar doel-week.
 * Strategie: SKIP — bestaande exceptions op doel-datum blijven intact.
 * 
 * body: { fromWeekStartDate: "YYYY-MM-DD", toWeekStartDate: "YYYY-MM-DD" }
 * returns: { createdCount, skippedDates }
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;
  const body = await req.json();
  const parsed = copyWeekSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validatiefout', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { fromWeekStartDate, toWeekStartDate } = parsed.data;
  const fromStart = new Date(fromWeekStartDate + 'T00:00:00.000Z');
  const toStart = new Date(toWeekStartDate + 'T00:00:00.000Z');
  const fromEnd = addDays(fromStart, 6);

  try {
    // Fetch all exceptions for the source week
    const sourceExceptions = await prisma.availabilityException.findMany({
      where: {
        userId: user.id,
        date: {
          gte: fromStart,
          lte: new Date(fromEnd.toISOString().split('T')[0] + 'T23:59:59.999Z'),
        },
      },
    });

    if (sourceExceptions.length === 0) {
      return NextResponse.json({
        createdCount: 0,
        skippedDates: [],
        message: 'Geen uitzonderingen gevonden in de bronweek',
      });
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      let createdCount = 0;
      const skippedDates: string[] = [];

      for (const exc of sourceExceptions) {
        const excDate = new Date(exc.date);
        const dayOffset = Math.round((excDate.getTime() - fromStart.getTime()) / (1000 * 60 * 60 * 24));
        const targetDate = addDays(toStart, dayOffset);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // SKIP strategy: check if target date already has exceptions for this user
        const existingOnTarget = await tx.availabilityException.findFirst({
          where: {
            userId: user.id,
            date: new Date(targetDateStr + 'T00:00:00.000Z'),
          },
        });

        if (existingOnTarget) {
          if (!skippedDates.includes(targetDateStr)) {
            skippedDates.push(targetDateStr);
          }
          continue;
        }

        await tx.availabilityException.create({
          data: {
            userId: user.id,
            date: new Date(targetDateStr + 'T00:00:00.000Z'),
            type: exc.type,
            startTime: exc.startTime,
            endTime: exc.endTime,
            note: exc.note ? `Gekopieerd: ${exc.note}` : 'Gekopieerd van vorige week',
          },
        });

        createdCount++;
      }

      return { createdCount, skippedDates };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Copy week error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
