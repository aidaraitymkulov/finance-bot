import { PeriodRange } from "../types/period.type";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const countDaysInclusive = (start: Date, end: Date) =>
  Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

export const buildTodayRange = (): PeriodRange => {
  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);
  return { start, end, days: 1 };
};

export const buildLast7DaysRange = (): PeriodRange => {
  const now = new Date();
  const end = endOfDay(now);
  const start = startOfDay(new Date(now.getTime() - 6 * MS_PER_DAY));
  return { start, end, days: 7 };
};

export const buildCurrentMonthRange = (): PeriodRange => {
  const now = new Date();
  const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = endOfDay(now);
  return { start, end, days: countDaysInclusive(start, end) };
};

export const buildCustomRange = (startDate: Date, endDate: Date): PeriodRange => {
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);
  return { start, end, days: countDaysInclusive(start, end) };
};
