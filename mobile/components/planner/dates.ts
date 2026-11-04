// Calendar-day helpers for the planner. Everything works on "YYYY-MM-DD"
// keys in the device's local calendar so a day never shifts across timezones.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

export function keyOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

export function todayKey() {
  return keyOf(new Date());
}

export function addDays(key: string, days: number) {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return keyOf(d);
}

/** First day of the month `months` away from `key`'s month. */
export function addMonths(key: string, months: number) {
  const d = parseKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

export function mondayOf(key: string) {
  const day = parseKey(key).getDay();
  return addDays(key, day === 0 ? -6 : 1 - day);
}

/** Mondays of every week that has at least one day in the month ("YYYY-MM"). */
export function weeksOfMonth(month: string) {
  const weeks: string[] = [];
  for (let monday = mondayOf(`${month}-01`); monday.slice(0, 7) <= month; monday = addDays(monday, 7)) {
    weeks.push(monday);
  }
  return weeks;
}

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2 – 8 Nov" or "30 Nov – 6 Dec". */
export function weekRangeLabel(monday: string) {
  const start = parseKey(monday);
  const end = parseKey(addDays(monday, 6));
  const startMonth = start.getMonth() === end.getMonth() ? '' : ` ${SHORT_MONTHS[start.getMonth()]}`;
  return `${start.getDate()}${startMonth} – ${end.getDate()} ${SHORT_MONTHS[end.getMonth()]}`;
}

/** "Tue 3 Nov". */
export function dayLabel(key: string) {
  const d = parseKey(key);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/** Sums task counts over the days `match` accepts. */
export function sumTaskDays(taskDays: Record<string, { total: number; done: number }>, match: (day: string) => boolean) {
  let total = 0;
  let done = 0;
  for (const [day, c] of Object.entries(taskDays)) {
    if (!match(day)) continue;
    total += c.total;
    done += c.done;
  }
  return { total, done };
}
