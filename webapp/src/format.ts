const amountFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export const formatAmount = (value: number) => amountFormat.format(value);
export const formatCompact = (value: number) => compactFormat.format(value);

/** "YYYY-MM-DD" -> local Date (no UTC shift). */
export const parseLocalDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "2026-10" -> "Октябрь 2026" */
export const formatMonth = (month: string) =>
  capitalize(monthFormat.format(parseLocalDate(`${month}-01`)).replace(" г.", ""));

/** "2026-10-23" -> "пт, 23 окт." */
export const formatDay = (date: string) => dayFormat.format(parseLocalDate(date));

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

const pad = (value: number) => String(value).padStart(2, "0");

export const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const shiftMonth = (month: string, delta: number) => {
  const date = parseLocalDate(`${month}-01`);
  date.setMonth(date.getMonth() + delta);
  return toMonthKey(date);
};

/** 1 -> "день", 3 -> "дня", 5 -> "дней" */
export const pluralizeRu = (count: number, forms: [string, string, string]) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
};
