import { addDays, getWeekday, nextWeekday, toLocalDateString } from "./local-date.util";

describe("local-date.util", () => {
  it("formats a Date as a local YYYY-MM-DD string", () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("returns the weekday (0 = Sunday)", () => {
    expect(getWeekday("2026-10-21")).toBe(3); // Wednesday
  });

  it("finds the nearest given weekday, counting today", () => {
    expect(nextWeekday("2026-10-21", 3)).toBe("2026-10-21"); // Wed -> same day
    expect(nextWeekday("2026-10-21", 1)).toBe("2026-10-26"); // Wed -> next Monday
    expect(nextWeekday("2026-10-30", 0)).toBe("2026-11-01"); // Fri -> Sunday, next month
  });
});
