// Shared date helpers for goal/onboarding setup — used wherever we need
// "this month" and "Monday of this week" as canonical keys.

/** Returns the current month as "YYYY-MM". */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Returns today's date as "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

/**
 * Returns the Monday of `now`'s local week as UTC midnight of that calendar
 * day — the form a @db.Date column stores without shifting to the day before
 * (local midnight east of UTC would otherwise be saved as Sunday).
 */
export function mondayOfWeek(now: Date = new Date()): Date {
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  return new Date(localDateKey(monday) + 'T00:00:00Z');
}

/** Returns a date as "YYYY-MM-DD" using its local calendar day (no UTC shift). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Parses "YYYY-MM-DD" as that calendar day at local midnight. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Adds `days` to a "YYYY-MM-DD" key. */
export function addDaysKey(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}
