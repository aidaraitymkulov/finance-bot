import { buildCustomRange } from "../../common/utils/data-range.util";

export const parseAmount = (input: string): number | null => {
  const normalized = input.replace(/\s+/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * 100) / 100;
};

export const parseCustomDateRange = (
  input: string,
): { start: Date; end: Date; days: number } | null => {
  const parts = input.split(/\s+-\s+|\s+/).filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  const start = parseDate(parts[0]);
  const end = parseDate(parts[1]);
  if (!start || !end || end < start) {
    return null;
  }

  return buildCustomRange(start, end);
};

const parseDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};
