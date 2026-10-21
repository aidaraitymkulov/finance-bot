import { addPeriod, daysUntil, nextPaymentOnOrAfter } from "./next-payment.util";

describe("addPeriod", () => {
  it("adds a month keeping the day", () => {
    expect(addPeriod("2026-10-15", "monthly", 15)).toBe("2026-11-15");
  });

  it("rolls over the year boundary", () => {
    expect(addPeriod("2026-12-20", "monthly", 20)).toBe("2027-01-20");
  });

  it("clamps to the end of a short month and returns to the billing day afterwards", () => {
    expect(addPeriod("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    expect(addPeriod("2026-02-28", "monthly", 31)).toBe("2026-03-31");
  });

  it("uses Feb 29 in leap years", () => {
    expect(addPeriod("2028-01-31", "monthly", 31)).toBe("2028-02-29");
  });

  it("adds a year", () => {
    expect(addPeriod("2026-10-15", "yearly", 15)).toBe("2027-10-15");
  });

  it("moves a Feb 29 yearly subscription to Feb 28 and back to Feb 29", () => {
    expect(addPeriod("2028-02-29", "yearly", 29)).toBe("2029-02-28");
    expect(addPeriod("2031-02-28", "yearly", 29)).toBe("2032-02-29");
  });
});

describe("nextPaymentOnOrAfter", () => {
  it("keeps a future date as is", () => {
    expect(nextPaymentOnOrAfter("2026-10-25", "monthly", 25, "2026-10-21")).toBe("2026-10-25");
  });

  it("keeps today's date", () => {
    expect(nextPaymentOnOrAfter("2026-10-21", "monthly", 21, "2026-10-21")).toBe("2026-10-21");
  });

  it("steps a past date forward by whole periods", () => {
    expect(nextPaymentOnOrAfter("2026-06-10", "monthly", 10, "2026-10-21")).toBe("2026-11-10");
    expect(nextPaymentOnOrAfter("2024-03-05", "yearly", 5, "2026-10-21")).toBe("2027-03-05");
  });
});

describe("daysUntil", () => {
  it("counts days between local dates", () => {
    expect(daysUntil("2026-10-24", "2026-10-21")).toBe(3);
    expect(daysUntil("2026-10-21", "2026-10-21")).toBe(0);
    expect(daysUntil("2026-10-20", "2026-10-21")).toBe(-1);
  });
});
