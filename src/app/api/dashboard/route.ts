import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { startOfWeek, endOfWeek } from 'date-fns';
import { calculateHours } from '@/lib/utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const user = session.user as any;
  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  try {
    // Get total active employees (admin/manager only)
    let totalEmployees = 0;
    if (isAdmin || isManager) {
      totalEmployees = await prisma.user.count({ where: { active: true } });
    }

    // Get shifts for the week
    const allShifts = await prisma.shift.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
      },
      include: {
        shiftUsers: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Filter for non-admin users
    const visibleShifts = isAdmin || isManager
      ? allShifts
      : allShifts.filter(s => s.shiftUsers.some(su => su.userId === user.id));

    // Active shifts (not AFGEROND)
    const activeShifts = visibleShifts.filter(s => s.status !== 'AFGEROND').length;

    // Hours this week
    const hoursThisWeek = visibleShifts.reduce((sum, s) => {
      if (!isAdmin && !isManager) {
        if (!s.shiftUsers.some(su => su.userId === user.id)) return sum;
      }
      return sum + calculateHours(s.startTime, s.endTime);
    }, 0);

    // Pending shifts (concept status)
    const pendingShifts = allShifts.filter(s => s.status === 'CONCEPT').length;

    // Upcoming shifts (next 5)
    const upcomingShifts = await prisma.shift.findMany({
      where: {
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        ...((!isAdmin && !isManager) && {
          shiftUsers: { some: { userId: user.id } },
        }),
      },
      include: {
        shiftUsers: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 5,
    });

    // Recent availability (using new AvailabilityException model)
    const recentAvailability = await prisma.availabilityException.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        ...((!isAdmin && !isManager) && { userId: user.id }),
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { date: 'asc' },
      take: 8,
    });

    // For admin: full week availability grid (all employees x 7 days)
    let weekAvailabilityGrid: any = null;
    if (isAdmin || isManager) {
      const allEmployees = await prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const allExceptions = await prisma.availabilityException.findMany({
        where: { date: { gte: weekStart, lte: weekEnd } },
        select: { userId: true, date: true, type: true, startTime: true, endTime: true },
      });

      // Build lookup: userId -> dateStr -> exception
      const lookup: Record<string, Record<string, any>> = {};
      for (const exc of allExceptions) {
        const uid = exc.userId;
        const ds = exc.date.toISOString().split('T')[0];
        if (!lookup[uid]) lookup[uid] = {};
        lookup[uid][ds] = exc;
      }

      // Build week days array (Mon-Sun)
      const days: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days.push(d.toISOString().split('T')[0]);
      }

      weekAvailabilityGrid = {
        days,
        employees: allEmployees.map((emp) => ({
          id: emp.id,
          name: emp.name,
          days: days.map((ds) => lookup[emp.id]?.[ds] || null),
        })),
      };
    }

    return NextResponse.json({
      totalEmployees,
      activeShifts,
      hoursThisWeek,
      pendingShifts,
      upcomingShifts,
      recentAvailability,
      weekAvailabilityGrid,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
