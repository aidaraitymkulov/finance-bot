import { buildCustomRange } from "../../common/utils/data-range.util";
import type { PeriodRange } from "../../common/types/period.type";
import { normalizeWord } from "../category/category-keyword.util";
import { parseCustomDateRange } from "./telegram.parsers";

const MONTH_PATTERNS = [
  /^(?:янв|январ(?:ь|я|ю|е|ем))$/,
  /^(?:фев|февр|феврал(?:ь|я|ю|е|ем))$/,
  /^(?:мар|март(?:а|у|е|ом)?)$/,
  /^(?:апр|апрел(?:ь|я|ю|е|ем))$/,
  /^(?:май|мая|маю|мае|маем)$/,
  /^(?:июн|июн(?:ь|я|ю|е|ем))$/,
  /^(?:июл|июл(?:ь|я|ю|е|ем))$/,
  /^(?:авг|август(?:а|у|е|ом)?)$/,
  /^(?:сен|сент|сентябр(?:ь|я|ю|е|ем))$/,
  /^(?:окт|октябр(?:ь|я|ю|е|ем))$/,
  /^(?:ноя|нояб|ноябр(?:ь|я|ю|е|ем))$/,
  /^(?:дек|декабр(?:ь|я|ю|е|ем))$/,
];

const SEPARATORS = new Set(["-", "по", "до"]);
const FILLERS = new Set(["за", "с", "в"]);

interface Endpoint {
  month: number;
  year: number | null;
}

const monthIndex = (word: string): number => MONTH_PATTERNS.findIndex((p) => p.test(word));

const monthStart = (year: number, month: number) => new Date(year, month, 1);

/** Last day of the month; the month that contains `now` ends today, like the "month" button. */
const monthEnd = (year: number, month: number, now: Date) =>
  year === now.getFullYear() && month === now.getMonth() ? now : new Date(year, month + 1, 0);

/** The latest year in which the month is not in the future. */
const latestYear = (month: number, now: Date) =>
  month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();

const parseEndpoints = (
  words: string[],
): { endpoints: Endpoint[]; hasSeparator: boolean } | null => {
  const endpoints: Endpoint[] = [];
  let hasSeparator = false;

  for (const word of words) {
    if (FILLERS.has(word)) {
      continue;
    }
    if (SEPARATORS.has(word)) {
      hasSeparator = true;
      continue;
    }

    const month = monthIndex(word);
    if (month >= 0) {
      endpoints.push({ month, year: null });
      continue;
    }

    const last = endpoints[endpoints.length - 1];
    if (/^\d{4}$/.test(word) && last && last.year === null) {
      last.year = Number(word);
      continue;
    }
    return null;
  }

  return endpoints.length >= 1 && endpoints.length <= 2 ? { endpoints, hasSeparator } : null;
};

const monthsRange = (endpoints: Endpoint[], now: Date): PeriodRange | null => {
  const [first, second] = endpoints;
  const last = second ?? first;

  let startYear: number;
  let endYear: number;
  if (!second) {
    startYear = endYear = first.year ?? latestYear(first.month, now);
  } else if (first.year !== null) {
    // "октябрь 2025 - февраль": the end continues from the start year.
    startYear = first.year;
    endYear = second.year ?? startYear + (second.month < first.month ? 1 : 0);
  } else {
    endYear = second.year ?? latestYear(second.month, now);
    startYear = endYear - (first.month > second.month ? 1 : 0);
  }

  const start = monthStart(startYear, first.month);
  const end = monthEnd(endYear, last.month, now);
  return end < start ? null : buildCustomRange(start, end);
};

const keywordRange = (text: string, now: Date): PeriodRange | null => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  switch (text) {
    case "сегодня":
      return buildCustomRange(now, now);
    case "вчера": {
      const yesterday = new Date(year, month, day - 1);
      return buildCustomRange(yesterday, yesterday);
    }
    case "неделя":
    case "неделю":
      return buildCustomRange(new Date(year, month, day - 6), now);
    case "месяц":
    case "этот месяц":
      return buildCustomRange(monthStart(year, month), now);
    case "прошлый месяц":
      return buildCustomRange(monthStart(year, month - 1), new Date(year, month, 0));
    default:
      return null;
  }
};

/**
 * Parses a period written in words: "октябрь", "октябрь-ноябрь", "окт 2025 - фев 2026",
 * "прошлый месяц", "вчера" or two dates "01.10.2025 15.10.2025". The whole text must be the
 * period; anything else returns null. A month without a year is its latest non-future occurrence.
 */
export const parsePeriodInput = (input: string, now = new Date()): PeriodRange | null => {
  const text = input.trim().toLowerCase().replace(/ё/g, "е");

  const dates = parseCustomDateRange(text);
  if (dates) {
    return dates;
  }

  const words = text
    .replace(/[–—]/g, "-")
    .replace(/-/g, " - ")
    .split(/\s+/)
    .map((word) => (word === "-" ? word : normalizeWord(word)))
    .filter(Boolean);
  const keyword = keywordRange(words.join(" "), now);
  if (keyword) {
    return keyword;
  }

  const parsed = parseEndpoints(words);
  return parsed ? monthsRange(parsed.endpoints, now) : null;
};
