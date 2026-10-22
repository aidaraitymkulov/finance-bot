import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { UserEntity } from "../user/user.entity";
import { WebAppAuthGuard, WebAppUser } from "./auth/webapp-auth.guard";
import { FinanceDashboard, FinanceDashboardService } from "./finance-dashboard.service";

@Controller("api/finance")
@UseGuards(WebAppAuthGuard)
export class FinanceController {
  constructor(private readonly financeDashboardService: FinanceDashboardService) {}

  /** GET /api/finance/dashboard?period=today|last7|month[&month=YYYY-MM] */
  @Get("dashboard")
  getDashboard(
    @WebAppUser() user: UserEntity,
    @Query("period") period?: string,
    @Query("month") month?: string,
  ): Promise<FinanceDashboard> {
    return this.financeDashboardService.getDashboard(user, period, month);
  }
}
