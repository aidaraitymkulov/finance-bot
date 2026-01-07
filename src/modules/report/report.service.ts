import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationEntity } from "../operation/operation.entity";
import { CategoryType } from "../category/category-type.enum";
import { PeriodRange } from "../../common/types/period.type";
import { UserEntity } from "../user/user.entity";

export interface SummaryReport {
  income: number;
  expense: number;
  balance: number;
  avgIncomePerDay: number;
  avgExpensePerDay: number;
  days: number;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(OperationEntity)
    private readonly operationRepository: Repository<OperationEntity>,
  ) {}

  async getSummary(user: UserEntity, range: PeriodRange): Promise<SummaryReport> {
    const raw = await this.operationRepository
      .createQueryBuilder("operation")
      .select(
        "SUM(CASE WHEN operation.type = :incomeType THEN operation.amount ELSE 0 END)",
        "income",
      )
      .addSelect(
        "SUM(CASE WHEN operation.type = :expenseType THEN operation.amount ELSE 0 END)",
        "expense",
      )
      .where("operation.userId = :userId", { userId: user.id })
      .andWhere("operation.createdAt BETWEEN :start AND :end", {
        start: range.start,
        end: range.end,
      })
      .setParameters({
        incomeType: CategoryType.INCOME,
        expenseType: CategoryType.EXPENSE,
      })
      .getRawOne<{ income: string | null; expense: string | null }>();

    const income = raw?.income ? Number(raw.income) : 0;
    const expense = raw?.expense ? Number(raw.expense) : 0;
    const balance = income - expense;
    const days = range.days || 1;

    return {
      income,
      expense,
      balance,
      avgIncomePerDay: income / days,
      avgExpensePerDay: expense / days,
      days,
    };
  }
}
