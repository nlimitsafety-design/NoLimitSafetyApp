import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { calculateHours, calculateAmount } from '@/lib/utils';
import { calculateToeslagen, calculateShiftCostWithToeslagen, type ToeslagRule } from '@/lib/toeslagen';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import ExcelJS from 'exceljs';

/**
 * GET /api/reports/export-excel?start=...&end=...&employeeId=&location=&status=&includeHours=true
 *
 * Produces a **styled, facturatie-proof** XLSX with a single "Diensten detail" sheet.
 *
 * ─── Why "#####" used to happen ───
 *   1) Column widths were too narrow for formatted dates / currency.
 *   2) Dates & currency were written as plain strings instead of typed cells
 *      with a numFmt, so Excel couldn't auto-size them.
 *   3) The old `xlsx` (SheetJS CE) library has NO cell-styling support, so
 *      column widths were the only lever – and they were guessed too small.
 *
 * ─── How this version prevents it ───
 *   • Uses ExcelJS with explicit column widths wide enough for every realistic
 *     value (dates, times, €-amounts up to 7 digits).
 *   • Dates are real Date cells with numFmt "dd-mm-yyyy".
 *   • Times are strings (HH:mm) – always fit in 10-char columns.
 *   • Amounts are *numbers* with numFmt "€ #,##0.00" (NL Excel renders this
 *     as "€ 1.907,00" when the user's regional setting is nl-NL).
 *   • ExcelJS supports full cell styling: bold, fills, borders, freeze panes,
 *     autofilter, etc.
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
    /* ── Query ────────────────────────────────────────── */
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

    /* ── Formatting helpers ───────────────────────────── */
    const startLabel = start
      ? format(new Date(start), 'd MMMM yyyy', { locale: nl })
      : 'Begin';
    const endLabel = end
      ? format(new Date(end), 'd MMMM yyyy', { locale: nl })
      : 'Eind';
    const exportDate = format(new Date(), 'd MMMM yyyy HH:mm', { locale: nl });

    /* ── Workbook ─────────────────────────────────────── */
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SecureStaff';
    wb.created = new Date();

    const ws = wb.addWorksheet('Diensten detail', {
      views: [{ state: 'frozen', ySplit: 2 }], // freeze rows 1-2
    });

    /* ── Column definitions ───────────────────────────── */
    interface ColDef {
      header: string;
      key: string;
      width: number;
      style?: Partial<ExcelJS.Column['style']>;
    }
    const cols: ColDef[] = [
      { header: 'Datum', key: 'datum', width: 16, style: { numFmt: 'dd-mm-yyyy' } },
      { header: 'Start', key: 'start', width: 10 },
      { header: 'Eind', key: 'eind', width: 10 },
    ];
    if (includeHours) {
      cols.push({ header: 'Uren', key: 'uren', width: 10, style: { numFmt: '0.00' } });
    }
    cols.push(
      { header: 'Locatie', key: 'locatie', width: 28 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Medewerker(s)', key: 'medewerker', width: 32 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Opmerking', key: 'opmerking', width: 36, style: { alignment: { wrapText: true, vertical: 'top' } as any } },
      { header: 'Basisbedrag', key: 'basisbedrag', width: 18, style: { numFmt: '€ #,##0.00' } },
      { header: 'Toeslag', key: 'toeslag', width: 18, style: { numFmt: '€ #,##0.00' } },
      { header: 'Totaal', key: 'bedrag', width: 18, style: { numFmt: '€ #,##0.00' } },
    );

    ws.columns = cols.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
      style: c.style ?? {},
    }));

    const colCount = cols.length;

    /* ── Row 1: Title (merged) ────────────────────────── */
    ws.spliceRows(1, 0, []); // push header row down to row 2
    const titleCell = ws.getCell('A1');
    titleCell.value = `Facturatie detail (periode: ${startLabel} t/m ${endLabel})`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle' };
    ws.mergeCells(1, 1, 1, colCount);
    ws.getRow(1).height = 30;

    /* ── Row 2: Header row styling ────────────────────── */
    const headerRow = ws.getRow(2);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF334155' } },
      };
    });
    headerRow.height = 24;

    // Autofilter on header row
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: colCount },
    };

    /* ── Data rows ────────────────────────────────────── */
    let grandHours = 0;
    let grandBaseAmount = 0;
    let grandSurchargeAmount = 0;
    let grandAmount = 0;
    let dataRowCount = 0;

    const datumColIdx = cols.findIndex((c) => c.key === 'datum') + 1;
    const basisbedragColIdx = cols.findIndex((c) => c.key === 'basisbedrag') + 1;
    const toeslagColIdx = cols.findIndex((c) => c.key === 'toeslag') + 1;
    const bedragColIdx = cols.findIndex((c) => c.key === 'bedrag') + 1;
    const urenColIdx = includeHours ? cols.findIndex((c) => c.key === 'uren') + 1 : -1;
    const opmerkingColIdx = cols.findIndex((c) => c.key === 'opmerking') + 1;

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

      const rowData: Record<string, any> = {
        datum: new Date(shift.date), // real Date → numFmt dd-mm-yyyy
        start: shift.startTime,
        eind: shift.endTime,
        locatie: shift.location,
        type: translateType(shift.type),
        medewerker: names,
        status: translateStatus(shift.status),
        opmerking: (shift.note || '').replace(/[\r\n]+/g, ' '),
        basisbedrag: roundedBaseAmount,
        toeslag: roundedSurchargeAmount,
        bedrag: roundedTotalAmount,
      };
      if (includeHours) {
        rowData.uren = roundedHours;
      }

      const row = ws.addRow(rowData);
      dataRowCount++;

      // Zebra striping (light blue on even data rows)
      if (dataRowCount % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F5FF' },
          };
        });
      }

      // Ensure typed cells keep their numFmt
      row.getCell(datumColIdx).numFmt = 'dd-mm-yyyy';
      row.getCell(basisbedragColIdx).numFmt = '€ #,##0.00';
      row.getCell(toeslagColIdx).numFmt = '€ #,##0.00';
      row.getCell(bedragColIdx).numFmt = '€ #,##0.00';
      if (includeHours && urenColIdx > 0) {
        row.getCell(urenColIdx).numFmt = '0.00';
      }

      grandHours += roundedHours;
      grandBaseAmount += roundedBaseAmount;
      grandSurchargeAmount += roundedSurchargeAmount;
      grandAmount += roundedTotalAmount;
    }

    /* ── Totals row ───────────────────────────────────── */
    const basisbedragColLetter = columnLetter(basisbedragColIdx);
    const toeslagColLetter = columnLetter(toeslagColIdx);
    const bedragColLetter = columnLetter(bedragColIdx);
    const dataStartRow = 3;
    const dataEndRow = 2 + dataRowCount;

    const totalsData: Record<string, any> = {
      datum: 'TOTAAL',
      basisbedrag: dataRowCount > 0
        ? { formula: `SUM(${basisbedragColLetter}${dataStartRow}:${basisbedragColLetter}${dataEndRow})` }
        : 0,
      toeslag: dataRowCount > 0
        ? { formula: `SUM(${toeslagColLetter}${dataStartRow}:${toeslagColLetter}${dataEndRow})` }
        : 0,
      bedrag: dataRowCount > 0
        ? { formula: `SUM(${bedragColLetter}${dataStartRow}:${bedragColLetter}${dataEndRow})` }
        : 0,
    };

    if (includeHours && urenColIdx > 0) {
      const urenColLetter = columnLetter(urenColIdx);
      totalsData.uren = dataRowCount > 0
        ? { formula: `SUM(${urenColLetter}${dataStartRow}:${urenColLetter}${dataEndRow})` }
        : 0;
    }

    const totalsRow = ws.addRow(totalsData);
    totalsRow.font = { bold: true, size: 11 };
    totalsRow.getCell(basisbedragColIdx).numFmt = '€ #,##0.00';
    totalsRow.getCell(toeslagColIdx).numFmt = '€ #,##0.00';
    totalsRow.getCell(bedragColIdx).numFmt = '€ #,##0.00';

    if (includeHours && urenColIdx > 0) {
      totalsRow.getCell(urenColIdx).numFmt = '0.00';
    }

    // Thick top border on totals row
    totalsRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1E3A5F' } },
      };
    });

    /* ── Footer: export date ──────────────────────────── */
    ws.addRow([]);
    const footerRow = ws.addRow([`Exportdatum: ${exportDate}`]);
    footerRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } };

    /* ── Generate buffer ──────────────────────────────── */
    const buffer = await wb.xlsx.writeBuffer();

    const fileName = `SecureStaff_Facturatie_${start || 'all'}_${end || 'all'}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('Excel export error:', err);
    return NextResponse.json({ error: 'Export mislukt' }, { status: 500 });
  }
}

/* ── Helpers ───────────────────────────────────────────── */

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

/** Convert 1-based column index to Excel letter (1→A, 2→B, … 27→AA) */
function columnLetter(col: number): string {
  let letter = '';
  let c = col;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}
