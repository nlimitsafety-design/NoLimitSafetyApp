import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { calculateHours, calculateAmount } from '@/lib/utils';
import { calculateToeslagen, calculateShiftCostWithToeslagen, type ToeslagRule } from '@/lib/toeslagen';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

/**
 * GET /api/reports/export?start=...&end=...&employeeId=&location=&status=&includeHours=true
 *
 * Excel-friendly CSV (semicolon-separated, BOM, UTF-8).
 * Only "detail" export — matches the XLSX version.
 *
 * CSV cannot carry styling, so "#####" in Excel when opening a CSV is purely a
 * column-width issue on the user side. The XLSX export solves this structurally.
 * In CSV we keep values human-readable: dates as DD-MM-YYYY, amounts as plain
 * numbers (e.g. 1907.00) so Excel can auto-detect them.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireRole(['ADMIN', 'MANAGER']);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const employeeId = searchParams.get('employeeId');
  const location = searchParams.get('location');
  const status = searchParams.get('status');
  const includeHours = searchParams.get('includeHours') === 'true';

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

    const [shifts, toeslagRules] = await Promise.all([
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

    const startLabel = start ? format(new Date(start), 'd MMMM yyyy', { locale: nl }) : 'Begin';
    const endLabel = end ? format(new Date(end), 'd MMMM yyyy', { locale: nl }) : 'Eind';
    const exportDate = format(new Date(), 'd MMMM yyyy HH:mm', { locale: nl });

    const sep = ';'; // NL Excel default list separator
    const rows: string[] = [];

    /* ── Metadata header ──────────────────────────────── */
    rows.push(`Facturatie detail`);
    rows.push(`Periode${sep}${startLabel} t/m ${endLabel}`);
    rows.push(`Exportdatum${sep}${exportDate}`);
    if (location) rows.push(`Filter locatie${sep}${location}`);
    if (status) rows.push(`Filter status${sep}${translateStatus(status)}`);
    rows.push('');

    /* ── Column headers ───────────────────────────────── */
    const headers = ['Datum', 'Start', 'Eind'];
    if (includeHours) headers.push('Uren');
    headers.push('Locatie', 'Type', 'Medewerker(s)', 'Status', 'Opmerking', 'Basisbedrag', 'Toeslag', 'Totaal');
    rows.push(headers.join(sep));

    /* ── Data rows ────────────────────────────────────── */
    let grandHours = 0;
    let grandBaseAmount = 0;
    let grandSurchargeAmount = 0;
    let grandAmount = 0;

    for (const shift of shifts) {
      const hours = calculateHours(shift.startTime, shift.endTime);
      const relevantUsers = employeeId
        ? shift.shiftUsers.filter((su: any) => su.userId === employeeId)
        : shift.shiftUsers;

      if (relevantUsers.length === 0) continue;

      const names = relevantUsers.map((su: any) => su.user.name).join(', ');

      // Calculate surcharges for this shift
      const toeslagResult = calculateToeslagen(shift.date, shift.startTime, shift.endTime, rules);

      let shiftBaseTotal = 0;
      let shiftSurchargeTotal = 0;
      for (const su of relevantUsers) {
        const costResult = calculateShiftCostWithToeslagen(
          hours,
          (su as any).user.hourlyRate,
          toeslagResult.breakdowns,
        );
        shiftBaseTotal += costResult.baseAmount;
        shiftSurchargeTotal += costResult.surchargeAmount;
      }

      const roundedBaseAmount = Math.round(shiftBaseTotal * 100) / 100;
      const roundedSurchargeAmount = Math.round(shiftSurchargeTotal * 100) / 100;
      const roundedTotalAmount = Math.round((shiftBaseTotal + shiftSurchargeTotal) * 100) / 100;
      const roundedHours = Math.round(hours * 100) / 100;

      const dateStr = format(new Date(shift.date), 'dd-MM-yyyy');

      const fields = [
        dateStr,
        shift.startTime,
        shift.endTime,
      ];
      if (includeHours) fields.push(roundedHours.toFixed(2));
      fields.push(
        csvQuote(shift.location, sep),
        translateType(shift.type),
        csvQuote(names, sep),
        translateStatus(shift.status),
        csvQuote((shift.note || '').replace(/[\r\n]+/g, ' '), sep),
        roundedBaseAmount.toFixed(2),
        roundedSurchargeAmount.toFixed(2),
        roundedTotalAmount.toFixed(2),
      );

      rows.push(fields.join(sep));

      grandHours += roundedHours;
      grandBaseAmount += roundedBaseAmount;
      grandSurchargeAmount += roundedSurchargeAmount;
      grandAmount += roundedTotalAmount;
    }

    /* ── Totals row ───────────────────────────────────── */
    rows.push('');
    const totalFields = ['TOTAAL', '', ''];
    if (includeHours) totalFields.push(grandHours.toFixed(2));
    totalFields.push('', '', '', '', '', grandBaseAmount.toFixed(2), grandSurchargeAmount.toFixed(2), grandAmount.toFixed(2));
    rows.push(totalFields.join(sep));

    rows.push('');
    rows.push(`Gegenereerd door SecureStaff Planning & Beheer`);

    /* ── Response ─────────────────────────────────────── */
    const csv = '\uFEFF' + rows.join('\r\n'); // BOM for Excel UTF-8 detection
    const fileName = `SecureStaff_Facturatie_${start || 'all'}_${end || 'all'}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('CSV export error:', err);
    return NextResponse.json({ error: 'Export mislukt' }, { status: 500 });
  }
}

/* ── Helpers ───────────────────────────────────────────── */

/** Quote a CSV field if it contains the separator, quotes, or whitespace */
function csvQuote(value: string, sep: string): string {
  // Sanitize against CSV formula injection
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = "'" + safe;
  }
  if (safe.includes(sep) || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function translateType(type: string): string {
  return type;
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    CONCEPT: 'Concept',
    OPEN: 'Open',
    TOEGEWEZEN: 'Toegewezen',
    BEVESTIGD: 'Bevestigd',
    AFGEROND: 'Afgerond',
  };
  return map[status] || status;
}
