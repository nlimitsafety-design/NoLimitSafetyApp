import { calculateHours, calculateAmount, formatCurrency, hasTimeOverlap, timeToMinutes, getWeekDays, cn } from '@/lib/utils';

describe('calculateHours', () => {
  it('calculates hours between two times correctly', () => {
    expect(calculateHours('08:00', '17:00')).toBe(9);
    expect(calculateHours('06:00', '14:00')).toBe(8);
    expect(calculateHours('22:00', '22:00')).toBe(0);
    expect(calculateHours('09:00', '12:30')).toBe(3.5);
    expect(calculateHours('14:00', '22:00')).toBe(8);
  });

  it('returns 0 for invalid ranges', () => {
    expect(calculateHours('17:00', '08:00')).toBe(0);
  });
});

describe('calculateAmount', () => {
  it('multiplies hours by rate correctly', () => {
    expect(calculateAmount(8, 28.5)).toBe(228);
    expect(calculateAmount(4.5, 32)).toBe(144);
    expect(calculateAmount(0, 25)).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('formats amounts as EUR', () => {
    const result = formatCurrency(228);
    expect(result).toContain('228');
    // Dutch locale uses € symbol
    expect(result).toMatch(/€|EUR/);
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});

describe('hasTimeOverlap', () => {
  it('detects overlapping time ranges', () => {
    expect(hasTimeOverlap('08:00', '12:00', '10:00', '14:00')).toBe(true);
    expect(hasTimeOverlap('08:00', '17:00', '09:00', '10:00')).toBe(true);
    expect(hasTimeOverlap('14:00', '22:00', '06:00', '15:00')).toBe(true);
  });

  it('returns false for non-overlapping ranges', () => {
    expect(hasTimeOverlap('08:00', '12:00', '12:00', '16:00')).toBe(false);
    expect(hasTimeOverlap('06:00', '14:00', '14:00', '22:00')).toBe(false);
    expect(hasTimeOverlap('06:00', '10:00', '14:00', '18:00')).toBe(false);
  });

  it('handles edge cases', () => {
    // Identical ranges overlap
    expect(hasTimeOverlap('08:00', '12:00', '08:00', '12:00')).toBe(true);
    // Adjacent ranges don't overlap
    expect(hasTimeOverlap('08:00', '12:00', '12:00', '16:00')).toBe(false);
  });
});

describe('timeToMinutes', () => {
  it('converts HH:mm to minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('06:00')).toBe(360);
    expect(timeToMinutes('12:30')).toBe(750);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('getWeekDays', () => {
  it('returns 7 days starting from Monday', () => {
    const days = getWeekDays(new Date('2026-03-02')); // Monday
    expect(days.length).toBe(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
  });
});

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('px-4', undefined, 'py-2')).toBe('px-4 py-2');
  });
});
