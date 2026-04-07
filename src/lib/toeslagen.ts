import { getDay } from 'date-fns';

/**
 * Toeslag (surcharge) calculation engine.
 *
 * Handles the complexity of:
 * - Time-based surcharges (avond, nacht) that can span midnight
 * - Day-based surcharges (zaterdag, zondag)
 * - Overlapping shifts (e.g. Friday evening into Saturday)
 * - Stacking: a Saturday night shift gets both weekend AND night surcharge
 */

export interface ToeslagRule {
  id: string;
  name: string;
  type: 'TIME_BASED' | 'DAY_BASED';
  startTime: string | null; // HH:mm
  endTime: string | null;   // HH:mm (can be < startTime for overnight ranges)
  days: string | null;      // comma-separated ISO weekdays: "6,7"
  percentage: number;       // e.g. 130 = 130% pay
  active: boolean;
  sortOrder: number;
}

export interface ToeslagBreakdown {
  ruleName: string;
  ruleId: string;
  percentage: number;
  hours: number;            // hours that fall under this surcharge
  extraPercentage: number;  // percentage - 100 (the "extra" part)
}

export interface ShiftToeslagResult {
  baseHours: number;        // total shift hours
  breakdowns: ToeslagBreakdown[];
  totalSurchargeHours: number; // sum of all extra hours (weighted)
}

/**
 * Calculate surcharge breakdowns for a single shift.
 *
 * @param shiftDate - The date of the shift (Date or ISO string)
 * @param startTime - Shift start time "HH:mm"
 * @param endTime   - Shift end time "HH:mm" (can be next day if < startTime)
 * @param rules     - Active toeslag rules
 */
export function calculateToeslagen(
  shiftDate: Date | string,
  startTime: string,
  endTime: string,
  rules: ToeslagRule[],
): ShiftToeslagResult {
  const date = typeof shiftDate === 'string' ? new Date(shiftDate) : shiftDate;

  // Convert shift times to absolute minutes from midnight of shift date
  const shiftStartMin = timeToMin(startTime);
  let shiftEndMin = timeToMin(endTime);
  if (shiftEndMin <= shiftStartMin) shiftEndMin += 24 * 60; // overnight

  const baseHours = (shiftEndMin - shiftStartMin) / 60;
  const breakdowns: ToeslagBreakdown[] = [];

  const activeRules = rules.filter((r) => r.active);

  for (const rule of activeRules) {
    let overlappingMinutes = 0;

    if (rule.type === 'TIME_BASED' && rule.startTime && rule.endTime) {
      overlappingMinutes = calcTimeBasedOverlap(
        shiftStartMin,
        shiftEndMin,
        rule.startTime,
        rule.endTime,
      );
    } else if (rule.type === 'DAY_BASED' && rule.days) {
      overlappingMinutes = calcDayBasedOverlap(
        date,
        shiftStartMin,
        shiftEndMin,
        rule.days,
      );
    }

    if (overlappingMinutes > 0) {
      const hours = Math.round((overlappingMinutes / 60) * 100) / 100;
      breakdowns.push({
        ruleName: rule.name,
        ruleId: rule.id,
        percentage: rule.percentage,
        hours,
        extraPercentage: rule.percentage - 100,
      });
    }
  }

  // Sort by sortOrder (from rule) implicitly — rules are already sorted
  const totalSurchargeHours = breakdowns.reduce(
    (sum, b) => sum + b.hours * (b.extraPercentage / 100),
    0,
  );

  return {
    baseHours,
    breakdowns,
    totalSurchargeHours: Math.round(totalSurchargeHours * 100) / 100,
  };
}

/**
 * Calculate overlapping minutes between a shift and a time-based rule.
 * Both shift and rule can span midnight.
 *
 * Example: shift 22:00-06:00, rule "nacht" 00:00-06:00
 *   → shift is min 1320-1800, rule covers 1440-1800 (next day midnight to 6am)
 *   → also rule covers 0-360 (same day midnight to 6am) but shift starts at 1320
 *   → overlap = 360 minutes (6 hours)
 */
function calcTimeBasedOverlap(
  shiftStartMin: number,
  shiftEndMin: number,       // can be > 1440 for overnight shifts
  ruleStart: string,
  ruleEnd: string,
): number {
  const rStart = timeToMin(ruleStart);
  const rEnd = timeToMin(ruleEnd);

  // Generate rule windows that could overlap with the shift
  // Shift spans [shiftStartMin, shiftEndMin) where shiftEndMin can be up to ~2880
  const ruleWindows: [number, number][] = [];

  if (rStart < rEnd) {
    // Normal range e.g. 20:00-23:59
    // Could appear on day 0 and day 1
    ruleWindows.push([rStart, rEnd]);
    ruleWindows.push([rStart + 1440, rEnd + 1440]);
  } else {
    // Overnight range e.g. 22:00-06:00 → [22:00, 30:00)
    // Day 0: [rStart, rEnd + 1440)
    ruleWindows.push([rStart, rEnd + 1440]);
    // Day -1 carry-over: [rStart - 1440, rEnd) — only if shift starts early
    if (rEnd > 0) {
      ruleWindows.push([rStart - 1440, rEnd]);
    }
  }

  let totalOverlap = 0;
  for (const [wStart, wEnd] of ruleWindows) {
    const overlapStart = Math.max(shiftStartMin, wStart);
    const overlapEnd = Math.min(shiftEndMin, wEnd);
    if (overlapEnd > overlapStart) {
      totalOverlap += overlapEnd - overlapStart;
    }
  }

  return totalOverlap;
}

/**
 * Calculate overlapping minutes between a shift and a day-based rule.
 * Handles shifts that span midnight into the next day.
 *
 * Example: shift on Friday (day 5) from 22:00-06:00 with "Zaterdag" rule (day 6)
 *   → 22:00-00:00 is Friday (no match), 00:00-06:00 is Saturday (match = 360 min)
 */
function calcDayBasedOverlap(
  shiftDate: Date,
  shiftStartMin: number,
  shiftEndMin: number, // can be > 1440
  daysStr: string,
): number {
  const targetDays = new Set(daysStr.split(',').map(Number)); // ISO weekdays

  // Get ISO weekday of shift date (1=Mon, 7=Sun)
  const jsDay = getDay(shiftDate); // 0=Sun, 1=Mon...6=Sat
  const isoDay = jsDay === 0 ? 7 : jsDay;

  let totalOverlap = 0;

  // Day 1: shift date itself (minutes 0–1440)
  if (targetDays.has(isoDay)) {
    const dayStart = Math.max(shiftStartMin, 0);
    const dayEnd = Math.min(shiftEndMin, 1440);
    if (dayEnd > dayStart) {
      totalOverlap += dayEnd - dayStart;
    }
  }

  // Day 2: next day (minutes 1440–2880) — only relevant for overnight shifts
  if (shiftEndMin > 1440) {
    const nextIsoDay = isoDay === 7 ? 1 : isoDay + 1;
    if (targetDays.has(nextIsoDay)) {
      const dayStart = Math.max(shiftStartMin, 1440);
      const dayEnd = shiftEndMin;
      if (dayEnd > dayStart) {
        totalOverlap += dayEnd - dayStart;
      }
    }
  }

  return totalOverlap;
}

function timeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Calculate the total cost for a shift with surcharges.
 *
 * @param baseHours - Total shift hours
 * @param hourlyRate - Employee's base hourly rate
 * @param breakdowns - Surcharge breakdowns from calculateToeslagen
 * @returns Object with base amount, surcharge amounts, and total
 */
export function calculateShiftCostWithToeslagen(
  baseHours: number,
  hourlyRate: number,
  breakdowns: ToeslagBreakdown[],
): {
  baseAmount: number;
  surchargeAmount: number;
  totalAmount: number;
  details: { ruleName: string; hours: number; extraRate: number; amount: number }[];
} {
  const baseAmount = Math.round(baseHours * hourlyRate * 100) / 100;

  const details = breakdowns.map((b) => {
    const extraRate = hourlyRate * (b.extraPercentage / 100);
    const amount = Math.round(b.hours * extraRate * 100) / 100;
    return {
      ruleName: b.ruleName,
      hours: b.hours,
      extraRate: Math.round(extraRate * 100) / 100,
      amount,
    };
  });

  const surchargeAmount = details.reduce((sum, d) => sum + d.amount, 0);
  const totalAmount = Math.round((baseAmount + surchargeAmount) * 100) / 100;

  return { baseAmount, surchargeAmount, totalAmount, details };
}
