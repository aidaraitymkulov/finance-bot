import { BadRequestException } from "@nestjs/common";
import { FinanceDashboardService } from "./finance-dashboard.service";
import type { ReportService } from "../report/report.service";
import type { UserEntity } from "../user/user.entity";
import type { PeriodRange } from "../../common/types/period.type";

const user = { id: 1 } as unknown as UserEntity;

const setup = () => {
  const reportService = {
    getSummary: jest.fn<Promise<object>, [UserEntity, PeriodRange]>().mockResolvedValue({}),
    getExpenseRating: jest.fn().mockResolvedValue([]),
    getIncomeRating: jest.fn().mockResolvedValue([]),
    getDailyTotals: jest.fn().mockResolvedValue([]),
    getRecentOperations: jest.fn().mockResolvedValue([]),
  };
  const service = new FinanceDashboardService(reportService as unknown as ReportService);
  const rangeOf = () => reportService.getSummary.mock.calls[0][1];
  return { service, rangeOf };
};

describe("FinanceDashboardService", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 22, 15, 0));
  });
  afterEach(() => jest.useRealTimers());

  it("defaults to the current month up to today", async () => {
    const { service, rangeOf } = setup();

    const result = await service.getDashboard(user, undefined, undefined);

    expect(result).toMatchObject({
      period: "month",
      month: "2026-10",
      from: "2026-10-01",
      to: "2026-10-22",
    });
    expect(rangeOf().days).toBe(22);
  });

  it("covers a whole past month", async () => {
    const { service, rangeOf } = setup();

    const result = await service.getDashboard(user, "month", "2026-02");

    expect(result).toMatchObject({ month: "2026-02", from: "2026-02-01", to: "2026-02-28" });
    expect(rangeOf().days).toBe(28);
  });

  it("supports the last 7 days", async () => {
    const { service } = setup();

    const result = await service.getDashboard(user, "last7", undefined);

    expect(result).toMatchObject({
      period: "last7",
      month: null,
      from: "2026-10-16",
      to: "2026-10-22",
    });
  });

  it.each([
    ["year", undefined],
    ["month", "2026-13"],
    ["month", "26-10"],
    ["month", "2026-11"],
  ])("rejects period=%s month=%s", async (period, month) => {
    const { service } = setup();

    await expect(service.getDashboard(user, period, month)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
