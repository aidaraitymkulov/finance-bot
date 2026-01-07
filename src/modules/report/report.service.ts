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

export interface ExpenseRatingItem {
  category: string;
  total: number;
}

export interface CategoryStats {
  total: number;
  count: number;
  avgPerDay: number;
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

  async getExpenseRating(user: UserEntity, range: PeriodRange): Promise<ExpenseRatingItem[]> {
    const rows = await this.operationRepository
      .createQueryBuilder("operation")
      .leftJoin("operation.category", "category")
      .select("category.displayName", "category")
      .addSelect("SUM(operation.amount)", "total")
      .where("operation.userId = :userId", { userId: user.id })
      .andWhere("operation.type = :expenseType", { expenseType: CategoryType.EXPENSE })
      .andWhere("operation.createdAt BETWEEN :start AND :end", {
        start: range.start,
        end: range.end,
      })
      .groupBy("category.displayName")
      .orderBy("total", "DESC")
      .getRawMany<{ category: string | null; total: string | null }>();

    return rows.map((row) => ({
      category: row.category ?? "Без категории",
      total: row.total ? Number(row.total) : 0,
    }));
  }

  async getCategoryStats(
    user: UserEntity,
    categoryId: string,
    range: PeriodRange,
  ): Promise<CategoryStats> {
    const row = await this.operationRepository
      .createQueryBuilder("operation")
      .select("SUM(operation.amount)", "total")
      .addSelect("COUNT(operation.id)", "count")
      .where("operation.userId = :userId", { userId: user.id })
      .andWhere("operation.categoryId = :categoryId", { categoryId })
      .andWhere("operation.createdAt BETWEEN :start AND :end", {
        start: range.start,
        end: range.end,
      })
      .getRawOne<{ total: string | null; count: string | null }>();

    const total = row?.total ? Number(row.total) : 0;
    const count = row?.count ? Number(row.count) : 0;
    const days = range.days || 1;

    return {
      total,
      count,
      avgPerDay: total / days,
    };
  }
}
