import { addDays } from "../../common/utils/local-date.util";

export interface StreakResult {
  current: number;
  best: number;
}

/**
 * `doneDates` are local dates ("YYYY-MM-DD") with a DONE check-in.
 * The current streak counts consecutive done days back from today; if today is not done yet,
 * it counts from yesterday so the streak is not lost before the evening check-in.
 * A skipped or missing day breaks the streak.
 */
export const calcStreak = (doneDates: string[], today: string): StreakResult => {
  const done = new Set(doneDates);

  let current = 0;
  let cursor = done.has(today) ? today : addDays(today, -1);
  while (done.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...done].sort()) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best: Math.max(best, current) };
};
