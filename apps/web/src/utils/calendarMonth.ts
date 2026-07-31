export interface CalendarMonthMeta {
  year: number;
  month: number;
  days: number;
  offset: number;
}

export function getCalendarMonthMeta(value: string): CalendarMonthMeta {
  const [year, month] = value.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 12);
  return {
    year,
    month,
    days: new Date(year, month, 0, 12).getDate(),
    offset: start.getDay(),
  };
}

export function shiftCalendarMonth(value: string, delta: number): string {
  const [year, month] = value.split('-').map(Number);
  const absoluteMonth = year * 12 + month - 1 + delta;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonth = ((absoluteMonth % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
}
