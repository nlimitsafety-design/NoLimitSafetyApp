import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { timeToMinutes, getISOWeekday } from '@/lib/utils';

export type EmployeeStatusType = 'INGEVULD' | 'NIET_INGEVULD' | 'NIET_BESCHIKBAAR';

export interface EmployeeStatusResult {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  status: EmployeeStatusType;
  reason: string;
}

/**
 * Centrale matching logica:
 * Prioriteit (sterk → zwak):
 * 1) Conflict met bestaande shift => altijd ROOD
 * 2) Uitzonderingen op datum => bepalen groen/rood
 * 3) Vaste beschikbaarheid => bepaalt groen
 * 4) Anders => GRIJS
 */
function getEmployeeAvailabilityStatus(
  empId: string,
  shiftStartMinutes: number,
  shiftEndMinutes: number,
  shiftDate: Date,
  conflicts: { userId: string; shift: { startTime: string; endTime: string; location: string } }[],
  exceptions: { userId: string; type: string; startTime: string | null; endTime: string | null }[],
  recurringItems: { userId: string; startTime: string; endTime: string; validFrom: Date; validTo: Date | null; weekday: number }[]
): { status: EmployeeStatusType; reason: string } {
  // 1) Check shift conflicts
  const empConflicts = conflicts.filter(c => c.userId === empId);
  for (const conflict of empConflicts) {
    const cStart = timeToMinutes(conflict.shift.startTime);
    const cEnd = timeToMinutes(conflict.shift.endTime);
    if (shiftStartMinutes < cEnd && cStart < shiftEndMinutes) {
      return {
        status: 'NIET_BESCHIKBAAR',
        reason: `Conflict met dienst ${conflict.shift.startTime}–${conflict.shift.endTime} (${conflict.shift.location})`,
      };
    }
  }

  // 2) Check exceptions for this date
  const empExceptions = exceptions.filter(e => e.userId === empId);
  if (empExceptions.length > 0) {
    // UNAVAILABLE exceptions
    const unavailable = empExceptions.find(e => e.type === 'UNAVAILABLE');
    if (unavailable) {
      return {
        status: 'NIET_BESCHIKBAAR',
        reason: unavailable.startTime && unavailable.endTime
          ? `Uitzondering: niet beschikbaar ${unavailable.startTime}–${unavailable.endTime}`
          : 'Uitzondering: niet beschikbaar (hele dag)',
      };
    }

    // AVAILABLE exceptions — need to fully cover the shift
    const availableExc = empExceptions.filter(e => e.type === 'AVAILABLE' && e.startTime && e.endTime);
    if (availableExc.length > 0) {
      const fullyCovering = availableExc.find(e => {
        const eStart = timeToMinutes(e.startTime!);
        const eEnd = timeToMinutes(e.endTime!);
        return eStart <= shiftStartMinutes && eEnd >= shiftEndMinutes;
      });

      if (fullyCovering) {
        return {
          status: 'INGEVULD',
          reason: `Uitzondering: beschikbaar ${fullyCovering.startTime}–${fullyCovering.endTime}`,
        };
      }

      // AVAILABLE exception exists but doesn't cover fully
      return {
        status: 'NIET_BESCHIKBAAR',
        reason: `Uitzondering dekt tijd niet (${availableExc[0].startTime}–${availableExc[0].endTime})`,
      };
    }
  }

  // 3) Check recurring availability for this weekday
  const isoWeekday = getISOWeekday(shiftDate);
  const empRecurring = recurringItems.filter(r => {
    if (r.userId !== empId) return false;
    if (r.weekday !== isoWeekday) return false;
    // Check validity period
    if (shiftDate < new Date(r.validFrom)) return false;
    if (r.validTo && shiftDate > new Date(r.validTo)) return false;
    return true;
  });

  if (empRecurring.length > 0) {
    const fullyCovering = empRecurring.find(r => {
      const rStart = timeToMinutes(r.startTime);
      const rEnd = timeToMinutes(r.endTime);
      return rStart <= shiftStartMinutes && rEnd >= shiftEndMinutes;
    });

    if (fullyCovering) {
      return {
        status: 'INGEVULD',
        reason: `Vaste beschikbaarheid: ${fullyCovering.startTime}–${fullyCovering.endTime}`,
      };
    }

    // Recurring entries exist but don't fully cover
    return {
      status: 'NIET_BESCHIKBAAR',
      reason: `Vaste beschikbaarheid dekt tijd niet (${empRecurring[0].startTime}–${empRecurring[0].endTime})`,
    };
  }

  // 4) No data at all → GRIJS
  return {
    status: 'NIET_INGEVULD',
    reason: 'Geen beschikbaarheid ingesteld',
  };
}

/**
 * GET /api/employee-status?date=YYYY-MM-DD&startTime=HH:mm&endTime=HH:mm&shiftId=optional
 * Returns availability status for all active employees for a given shift date/time
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const excludeShiftId = searchParams.get('shiftId');

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: 'date, startTime en endTime zijn verplicht' }, { status: 400 });
  }

  try {
    const shiftDate = new Date(date + 'T00:00:00.000Z');
    const shiftStartMinutes = timeToMinutes(startTime);
    const shiftEndMinutes = timeToMinutes(endTime);
    const isoWeekday = getISOWeekday(shiftDate);

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    // Get existing shift assignments on this date for conflict detection
    const existingShiftUsers = await prisma.shiftUser.findMany({
      where: {
        shift: {
          date: shiftDate,
          ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
        },
      },
      include: {
        shift: { select: { startTime: true, endTime: true, location: true } },
      },
    });

    // Get exceptions for this date for ALL employees
    const exceptions = await prisma.availabilityException.findMany({
      where: { date: shiftDate },
      select: { userId: true, type: true, startTime: true, endTime: true },
    });

    // Get recurring availability for this weekday for ALL employees
    const recurringItems = await prisma.recurringAvailability.findMany({
      where: {
        weekday: isoWeekday,
        validFrom: { lte: shiftDate },
        OR: [
          { validTo: null },
          { validTo: { gte: shiftDate } },
        ],
      },
      select: { userId: true, startTime: true, endTime: true, validFrom: true, validTo: true, weekday: true },
    });

    const results: EmployeeStatusResult[] = employees.map((emp) => {
      const { status, reason } = getEmployeeAvailabilityStatus(
        emp.id,
        shiftStartMinutes,
        shiftEndMinutes,
        shiftDate,
        existingShiftUsers,
        exceptions,
        recurringItems
      );

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeEmail: emp.email,
        status,
        reason,
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error('Employee status error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
