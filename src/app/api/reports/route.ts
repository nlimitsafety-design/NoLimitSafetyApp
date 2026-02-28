import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { calculateHours, calculateAmount } from '@/lib/utils';

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
      where.date = {
        gte: new Date(start + 'T00:00:00.000Z'),
        lte: new Date(end + 'T23:59:59.999Z'),
      };
    }

    if (location) where.location = location;
    if (status) where.status = status;

    // If filtering by employee, only get shifts with that employee
    if (employeeId) {
      where.shiftUsers = { some: { userId: employeeId } };
    }

    const shifts = await prisma.shift.findMany({
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
    });

    // Group by employee
    const employeeMap = new Map<string, {
      employeeId: string;
      employeeName: string;
      employeeEmail: string;
      hourlyRate: number;
      totalShifts: number;
      totalHours: number;
      totalAmount: number;
      shifts: any[];
    }>();

    for (const shift of shifts) {
      const hours = calculateHours(shift.startTime, shift.endTime);

      for (const su of shift.shiftUsers) {
        if (employeeId && su.userId !== employeeId) continue;

        if (!employeeMap.has(su.userId)) {
          employeeMap.set(su.userId, {
            employeeId: su.userId,
            employeeName: su.user.name,
            employeeEmail: su.user.email,
            hourlyRate: su.user.hourlyRate,
            totalShifts: 0,
            totalHours: 0,
            totalAmount: 0,
            shifts: [],
          });
        }

        const emp = employeeMap.get(su.userId)!;
        const amount = calculateAmount(hours, su.user.hourlyRate);
        emp.totalShifts += 1;
        emp.totalHours += hours;
        emp.totalAmount += amount;
        emp.shifts.push({
          id: shift.id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          location: shift.location,
          type: shift.type,
          status: shift.status,
          hours,
          amount,
        });
      }
    }

    const result = Array.from(employeeMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
