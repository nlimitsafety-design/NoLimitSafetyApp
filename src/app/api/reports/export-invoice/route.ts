import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { calculateHours } from '@/lib/utils';
import { calculateToeslagen, calculateShiftCostWithToeslagen, type ToeslagRule } from '@/lib/toeslagen';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import InvoiceDocument from '@/components/invoice/InvoiceDocument';

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
    if (employeeId) {
      where.shiftUsers = { some: { userId: employeeId } };
    }

    const [shifts, toeslagRules, functies] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          shiftUsers: {
            include: {
              user: { select: { id: true, name: true, email: true, hourlyRate: true } },
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

    // Build functie tarief lookup
    const functieTarief = new Map<string, number>();
    for (const f of functies) {
      if (f.hourlyRate > 0) functieTarief.set(f.name, f.hourlyRate);
    }

    // Group by employee
    const employeeMap = new Map<string, {
      employeeName: string;
      hourlyRate: number;
      totalShifts: number;
      totalHours: number;
      totalBaseAmount: number;
      totalSurchargeAmount: number;
      totalAmount: number;
    }>();

    for (const shift of shifts) {
      const hours = calculateHours(shift.startTime, shift.endTime);
      const toeslagResult = calculateToeslagen(shift.date, shift.startTime, shift.endTime, rules);

      for (const su of shift.shiftUsers) {
        if (employeeId && su.userId !== employeeId) continue;

        const effectiveRate = functieTarief.get(shift.type) || su.user.hourlyRate;

        if (!employeeMap.has(su.userId)) {
          employeeMap.set(su.userId, {
            employeeName: su.user.name,
            hourlyRate: effectiveRate,
            totalShifts: 0,
            totalHours: 0,
            totalBaseAmount: 0,
            totalSurchargeAmount: 0,
            totalAmount: 0,
          });
        }

        const emp = employeeMap.get(su.userId)!;
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
      }
    }

    const employees = Array.from(employeeMap.values())
      .map((emp) => ({
        ...emp,
        totalBaseAmount: Math.round(emp.totalBaseAmount * 100) / 100,
        totalSurchargeAmount: Math.round(emp.totalSurchargeAmount * 100) / 100,
        totalAmount: Math.round(emp.totalAmount * 100) / 100,
        totalHours: Math.round(emp.totalHours * 100) / 100,
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    const subtotal = employees.reduce((sum, e) => sum + e.totalAmount, 0);
    const surchargeAmount = employees.reduce((sum, e) => sum + e.totalSurchargeAmount, 0);
    const btw = Math.round(subtotal * 0.21 * 100) / 100;
    const total = Math.round((subtotal + btw) * 100) / 100;

    const periodStart = start
      ? format(new Date(start), 'd MMMM yyyy', { locale: nl })
      : 'Begin';
    const periodEnd = end
      ? format(new Date(end), 'd MMMM yyyy', { locale: nl })
      : 'Eind';

    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoiceDocument, {
        periodStart,
        periodEnd,
        employees,
        totals: {
          shifts: employees.reduce((s, e) => s + e.totalShifts, 0),
          hours: employees.reduce((s, e) => s + e.totalHours, 0),
          baseAmount: employees.reduce((s, e) => s + e.totalBaseAmount, 0),
          surchargeAmount,
          subtotal,
          btw,
          total,
        },
      }) as any
    );

    const fileName = `NoLimitSafety_Factuur_${start || 'all'}_${end || 'all'}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('Invoice PDF export error:', err);
    return NextResponse.json({ error: 'Factuur genereren mislukt' }, { status: 500 });
  }
}
