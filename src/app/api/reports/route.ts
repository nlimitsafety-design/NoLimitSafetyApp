import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { calculateHours } from '@/lib/utils';
import { calculateToeslagen, calculateShiftCostWithToeslagen, type ToeslagRule } from '@/lib/toeslagen';

export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN', 'MANAGER']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const employeeId = searchParams.get('employeeId');
  const location = searchParams.get('location');
  const status = searchParams.get('status');

  try {
    const where: any = {};

    if (start && end) {
      const startDate = new Date(start + 'T00:00:00.000Z');
      const endDate = new Date(end + 'T23:59:59.999Z');
      if (startDate > endDate) {
        return NextResponse.json({ error: 'Startdatum moet voor einddatum liggen' }, { status: 400 });
      }
      where.date = { gte: startDate, lte: endDate };
    } else if (start || end) {
      return NextResponse.json({ error: 'Zowel start als end zijn verplicht' }, { status: 400 });
    }

    if (location) where.location = location;
    if (status) where.status = status;

    // If filtering by employee, only get shifts with that employee
    if (employeeId) {
      where.shiftUsers = { some: { userId: employeeId } };
    }

    // Fetch shifts, active surcharge rules, and functies in parallel
    const [shifts, toeslagRules, functies] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          shiftUsers: {
            include: {
              user: {
                select: { id: true, name: true, email: true, hourlyRate: true },
              },
            },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.toeslag.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.functie.findMany({
        select: { name: true, hourlyRate: true },
      }),
    ]);

    // Build functie tarief lookup (shift.type matches functie.name)
    const functieTarief = new Map<string, number>();
    for (const f of functies) {
      if (f.hourlyRate > 0) functieTarief.set(f.name, f.hourlyRate);
    }

    const rules: ToeslagRule[] = toeslagRules.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as 'TIME_BASED' | 'DAY_BASED',
      startTime: t.startTime,
      endTime: t.endTime,
      days: t.days,
      percentage: t.percentage,
      active: t.active,
      sortOrder: t.sortOrder,
    }));

    // Group by employee
    const employeeMap = new Map<string, {
      employeeId: string;
      employeeName: string;
      employeeEmail: string;
      hourlyRate: number;
      totalShifts: number;
      totalHours: number;
      totalAmount: number;
      totalBaseAmount: number;
      totalSurchargeAmount: number;
      shifts: any[];
    }>();

    for (const shift of shifts) {
      const hours = calculateHours(shift.startTime, shift.endTime);

      // Calculate surcharges for this shift
      const toeslagResult = calculateToeslagen(shift.date, shift.startTime, shift.endTime, rules);

      for (const su of shift.shiftUsers) {
        if (employeeId && su.userId !== employeeId) continue;

        // Resolve effective hourly rate: functie tarief > user tarief
        const effectiveRate = functieTarief.get(shift.type) || su.user.hourlyRate;

        if (!employeeMap.has(su.userId)) {
          employeeMap.set(su.userId, {
            employeeId: su.userId,
            employeeName: su.user.name,
            employeeEmail: su.user.email,
            hourlyRate: effectiveRate,
            totalShifts: 0,
            totalHours: 0,
            totalAmount: 0,
            totalBaseAmount: 0,
            totalSurchargeAmount: 0,
            shifts: [],
          });
        }

        const emp = employeeMap.get(su.userId)!;

        // Calculate cost with surcharges
        const costResult = calculateShiftCostWithToeslagen(
          hours,
          effectiveRate,
          toeslagResult.breakdowns,
        );

        emp.totalShifts += 1;
        emp.totalHours += hours;
        emp.totalBaseAmount += costResult.baseAmount;
        emp.totalSurchargeAmount += costResult.surchargeAmount;
        emp.totalAmount += costResult.totalAmount;
        emp.shifts.push({
          id: shift.id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          location: shift.location,
          type: shift.type,
          status: shift.status,
          hours,
          amount: costResult.totalAmount,
          baseAmount: costResult.baseAmount,
          surchargeAmount: costResult.surchargeAmount,
          surchargeDetails: costResult.details,
        });
      }
    }

    const result = Array.from(employeeMap.values())
      .map((emp) => ({
        ...emp,
        totalBaseAmount: Math.round(emp.totalBaseAmount * 100) / 100,
        totalSurchargeAmount: Math.round(emp.totalSurchargeAmount * 100) / 100,
        totalAmount: Math.round(emp.totalAmount * 100) / 100,
        totalHours: Math.round(emp.totalHours * 100) / 100,
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
