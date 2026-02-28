import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/server-auth';
import { hasTimeOverlap } from '@/lib/utils';

/**
 * GET /api/shift-requests?shiftId=...
 * Admin: get all requests for a shift (with user info)
 */
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;
  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get('shiftId');

  try {
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      // Admin view: all requests for a specific shift
      if (!shiftId) {
        return NextResponse.json({ error: 'shiftId is verplicht' }, { status: 400 });
      }

      const requests = await prisma.shiftRequest.findMany({
        where: { shiftId },
        include: {
          user: {
            select: { id: true, name: true, email: true, hourlyRate: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // For each requester, check availability and conflicts
      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        select: { date: true, startTime: true, endTime: true },
      });

      if (!shift) {
        return NextResponse.json({ error: 'Dienst niet gevonden' }, { status: 404 });
      }

      const dateStr = shift.date.toISOString().split('T')[0];

      const enriched = await Promise.all(
        requests.map(async (req) => {
          // Check availability using new AvailabilityException model
          const unavailableException = await prisma.availabilityException.findFirst({
            where: {
              userId: req.userId,
              date: shift.date,
              type: 'UNAVAILABLE',
            },
          });

          // Check overlapping shifts
          const userShifts = await prisma.shift.findMany({
            where: {
              date: shift.date,
              status: { not: 'OPEN' },
              shiftUsers: { some: { userId: req.userId } },
            },
            select: { startTime: true, endTime: true, location: true },
          });

          const conflicts = userShifts.filter((s) =>
            hasTimeOverlap(s.startTime, s.endTime, shift.startTime, shift.endTime)
          );

          return {
            ...req,
            availabilityStatus: unavailableException ? 'NIET_BESCHIKBAAR' : 'BESCHIKBAAR',
            conflicts: conflicts.map((c) => `${c.startTime}-${c.endTime} @ ${c.location}`),
          };
        })
      );

      return NextResponse.json(enriched);
    } else {
      // Employee view: own requests
      const requests = await prisma.shiftRequest.findMany({
        where: { userId: user.id },
        include: {
          shift: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              location: true,
              type: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(requests);
    }
  } catch (err) {
    console.error('Shift requests GET error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}

/**
 * POST /api/shift-requests
 * Employee requests an open shift
 * Body: { shiftId: string }
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const user = session!.user as any;

  try {
    const { shiftId } = await req.json();

    if (!shiftId) {
      return NextResponse.json({ error: 'shiftId is verplicht' }, { status: 400 });
    }

    // Fetch the shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { shiftRequests: { where: { userId: user.id } } },
    });

    if (!shift) {
      return NextResponse.json({ error: 'Dienst niet gevonden' }, { status: 404 });
    }

    if (shift.status !== 'OPEN') {
      return NextResponse.json({ error: 'Deze dienst is niet open voor aanvragen' }, { status: 400 });
    }

    // Already requested?
    if (shift.shiftRequests.length > 0) {
      return NextResponse.json({ error: 'Je hebt deze dienst al aangevraagd' }, { status: 400 });
    }

    // Check availability — is user marked UNAVAILABLE for this date? (new model)
    const unavailableException = await prisma.availabilityException.findFirst({
      where: {
        userId: user.id,
        date: shift.date,
        type: 'UNAVAILABLE',
      },
    });

    if (unavailableException) {
      return NextResponse.json(
        { error: 'Je bent niet beschikbaar op deze datum (uitzondering)' },
        { status: 400 }
      );
    }

    // Check overlapping shifts (assigned shifts)
    const existingShifts = await prisma.shift.findMany({
      where: {
        date: shift.date,
        status: { notIn: ['OPEN', 'CONCEPT'] },
        shiftUsers: { some: { userId: user.id } },
      },
      select: { startTime: true, endTime: true },
    });

    const hasConflict = existingShifts.some((s) =>
      hasTimeOverlap(s.startTime, s.endTime, shift.startTime, shift.endTime)
    );

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Je hebt al een overlappende dienst op dit tijdstip' },
        { status: 400 }
      );
    }

    // Check overlapping PENDING requests
    const pendingRequests = await prisma.shiftRequest.findMany({
      where: {
        userId: user.id,
        status: 'PENDING',
        shift: {
          date: shift.date,
        },
      },
      include: { shift: { select: { startTime: true, endTime: true } } },
    });

    const pendingConflict = pendingRequests.some((r) =>
      hasTimeOverlap(r.shift.startTime, r.shift.endTime, shift.startTime, shift.endTime)
    );

    if (pendingConflict) {
      return NextResponse.json(
        { error: 'Je hebt al een openstaande aanvraag voor een overlappende dienst' },
        { status: 400 }
      );
    }

    // Create the request
    const request = await prisma.shiftRequest.create({
      data: {
        shiftId,
        userId: user.id,
        status: 'PENDING',
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    console.error('Shift request POST error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
