import { parsePeriodInput } from "./period-input.parser";

// Tuesday 10 November 2026, midday.
const NOW = new Date(2026, 10, 10, 12, 0, 0);

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const period = (text: string) => {
  const range = parsePeriodInput(text, NOW);
  return range ? [ymd(range.start), ymd(range.end), range.days] : null;
};

describe("parsePeriodInput", () => {
  it("parses a single month in any form and case", () => {
    expect(period("октябрь")).toEqual(["2026-10-01", "2026-10-31", 31]);
    expect(period("Октября")).toEqual(["2026-10-01", "2026-10-31", 31]);
    expect(period("окт")).toEqual(["2026-10-01", "2026-10-31", 31]);
    expect(period("февраль")).toEqual(["2026-02-01", "2026-02-28", 28]);
  });

  it("ends the current month today", () => {
    expect(period("ноябрь")).toEqual(["2026-11-01", "2026-11-10", 10]);
  });

  it("takes the latest non-future year when none is given", () => {
    expect(period("декабрь")).toEqual(["2025-12-01", "2025-12-31", 31]);
  });

  it("parses month ranges with a dash, spaces or words", () => {
    expect(period("октябрь-ноябрь")).toEqual(["2026-10-01", "2026-11-10", 41]);
    expect(period("октябрь - ноябрь")).toEqual(["2026-10-01", "2026-11-10", 41]);
    expect(period("окт ноя")).toEqual(["2026-10-01", "2026-11-10", 41]);
    expect(period("с октября по ноябрь")).toEqual(["2026-10-01", "2026-11-10", 41]);
    expect(period("за октябрь")).toEqual(["2026-10-01", "2026-10-31", 31]);
  });

  it("wraps a range across the new year", () => {
    expect(period("ноябрь-февраль")).toEqual(["2025-11-01", "2026-02-28", 120]);
  });

  it("uses explicit years", () => {
    expect(period("октябрь 2025")).toEqual(["2025-10-01", "2025-10-31", 31]);
    expect(period("октябрь 2025 - февраль 2026")).toEqual(["2025-10-01", "2026-02-28", 151]);
    expect(period("октябрь 2025 - февраль")).toEqual(["2025-10-01", "2026-02-28", 151]);
  });

  it("parses keywords", () => {
    expect(period("сегодня")).toEqual(["2026-11-10", "2026-11-10", 1]);
    expect(period("вчера")).toEqual(["2026-11-09", "2026-11-09", 1]);
    expect(period("неделя")).toEqual(["2026-11-04", "2026-11-10", 7]);
    expect(period("месяц")).toEqual(["2026-11-01", "2026-11-10", 10]);
    expect(period("прошлый месяц")).toEqual(["2026-10-01", "2026-10-31", 31]);
  });

  it("parses two dates", () => {
    expect(period("01.10.2026 15.10.2026")).toEqual(["2026-10-01", "2026-10-15", 15]);
  });

  it("returns null for anything that is not entirely a period", () => {
    expect(period("привет")).toBeNull();
    expect(period("500 кофе")).toBeNull();
    expect(period("маркет")).toBeNull();
    expect(period("октябрь кофе")).toBeNull();
    expect(period("2025 октябрь")).toBeNull();
    expect(period("январь февраль март")).toBeNull();
  });
});
