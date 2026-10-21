import { calcStreak } from "./streak.util";

describe("calcStreak", () => {
  const today = "2026-10-21";

  it("returns zeros without check-ins", () => {
    expect(calcStreak([], today)).toEqual({ current: 0, best: 0 });
  });

  it("counts consecutive days ending today", () => {
    expect(calcStreak(["2026-10-19", "2026-10-20", "2026-10-21"], today)).toEqual({
      current: 3,
      best: 3,
    });
  });

  it("keeps yesterday's streak while today is not checked yet", () => {
    expect(calcStreak(["2026-10-19", "2026-10-20"], today).current).toBe(2);
  });

  it("breaks on a missing (or skipped) day", () => {
    expect(calcStreak(["2026-10-17", "2026-10-18", "2026-10-21"], today)).toEqual({
      current: 1,
      best: 2,
    });
  });

  it("is zero when the last done day is before yesterday", () => {
    expect(calcStreak(["2026-10-18"], today).current).toBe(0);
  });

  it("tracks the best streak across month boundaries", () => {
    const dates = ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-20"];
    expect(calcStreak(dates, today)).toEqual({ current: 1, best: 4 });
  });
});
