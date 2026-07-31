import { describe, expect, it } from 'vitest';

import { getCalendarMonthMeta, shiftCalendarMonth } from '../calendarMonth';

describe('calendarMonth', () => {
  it('moves exactly one month across year boundaries', () => {
    expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01');
  });

  it('calculates a stable month grid without UTC conversion', () => {
    expect(getCalendarMonthMeta('2026-08')).toEqual({
      year: 2026,
      month: 8,
      days: 31,
      offset: 6,
    });
  });
});
