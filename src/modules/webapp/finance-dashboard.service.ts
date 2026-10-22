import { BadRequestException, Injectable } from "@nestjs/common";
import {
  buildCurrentMonthRange,
  buildLast7DaysRange,
  buildMonthRange,
  buildTodayRange,
} from "../../common/utils/data-range.util";
import { toLocalDateString } from "../../common/utils/local-date.util";
import type { PeriodRange } from "../../common/types/period.type";
import {
  DailyTotals,
  ExpenseRatingItem,
  RecentOperation,
  ReportService,
  SummaryReport,
} from "../report/report.service";
import { UserEntity } from "../user/user.entity";

export type DashboardPeriod = "today" | "last7" | "month";

export interface FinanceDashboard {
  period: DashboardPeriod;
  /** "YYYY-MM" for the month period. */
  month: string | null;
  from: string;
  to: string;
  summary: SummaryReport;
  expenseByCategory: ExpenseRatingItem[];
  incomeByCategory: ExpenseRatingItem[];
  daily: DailyTotals[];
  recent: RecentOperation[];
}

const RECENT_LIMIT = 20;
const PERIODS: DashboardPeriod[] = ["today", "last7", "month"];

@Injectable()
export class FinanceDashboardService {
  constructor(private readonly reportService: ReportService) {}

  async getDashboard(
    user: UserEntity,
    periodParam: string | undefined,
    monthParam: string | undefined,
  ): Promise<FinanceDashboard> {
    const period = (periodParam ?? "month") as DashboardPeriod;
    if (!PERIODS.includes(period)) {
      throw new BadRequestException("period must be today, last7 or month");
    }

    const { range, month } = this.resolveRange(period, monthParam);
    const [summary, expenseByCategory, incomeByCategory, daily, recent] = await Promise.all([
      this.reportService.getSummary(user, range),
      this.reportService.getExpenseRating(user, range),
      this.reportService.getIncomeRating(user, range),
      this.reportService.getDailyTotals(user, range),
      this.reportService.getRecentOperations(user, range, RECENT_LIMIT),
    ]);

    return {
      period,
      month,
      from: toLocalDateString(range.start),
      to: toLocalDateString(range.end),
      summary,
      expenseByCategory,
      incomeByCategory,
      daily,
      recent,
    };
  }

  private resolveRange(
    period: DashboardPeriod,
    monthParam: string | undefined,
  ): { range: PeriodRange; month: string | null } {
    if (period === "today") {
      return { range: buildTodayRange(), month: null };
    }
    if (period === "last7") {
      return { range: buildLast7DaysRange(), month: null };
    }
    if (!monthParam) {
      const range = buildCurrentMonthRange();
      return { range, month: toLocalDateString(range.start).slice(0, 7) };
    }

    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthParam);
    const current = toLocalDateString(new Date()).slice(0, 7);
    if (!match || monthParam > current) {
      throw new BadRequestException("month must be YYYY-MM and not in the future");
    }
    return {
      range: buildMonthRange(Number(match[1]), Number(match[2]) - 1),
      month: monthParam,
    };
  }
}
