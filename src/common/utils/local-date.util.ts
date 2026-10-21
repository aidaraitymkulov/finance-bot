// Local dates are "YYYY-MM-DD" strings in the app time zone (see common/constants/time-zone.ts),
// matching how Postgres `date` columns are returned by TypeORM.

const pad = (value: number) => String(value).padStart(2, "0");

export const toLocalDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const fromLocalDateString = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const todayLocalDate = (): string => toLocalDateString(new Date());

export const addDays = (value: string, days: number): string => {
  const date = fromLocalDateString(value);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
};

/** 0 = Sunday ... 6 = Saturday, same as Date#getDay. */
export const getWeekday = (value: string): number => fromLocalDateString(value).getDay();

/** Nearest date on or after `from` that falls on `weekday` (0 = Sunday ... 6 = Saturday). */
export const nextWeekday = (from: string, weekday: number): string => {
  const diff = (weekday - getWeekday(from) + 7) % 7;
  return addDays(from, diff);
};
