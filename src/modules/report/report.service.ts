import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { OperationEntity } from "../operation/operation.entity";
import { CategoryType } from "../category/category-type.enum";
import { PeriodRange } from "../../common/types/period.type";
import { UserEntity } from "../user/user.entity";
import { APP_TIME_ZONE } from "../../common/constants/time-zone";
import { addDays, toLocalDateString } from "../../common/utils/local-date.util";

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

export interface DailyTotals {
  /** Local date "YYYY-MM-DD". */
  date: string;
  income: number;
  expense: number;
}

export interface RecentOperation {
  id: string;
  createdAt: Date;
  type: CategoryType;
  category: string;
  amount: number;
  comment: string | null;
}

export interface OperationForExport {
  date: Date;
  category: string;
  amount: number;
  comment: string | null;
  type: CategoryType;
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
    return this.getRatingByType(user, range, CategoryType.EXPENSE);
  }

  async getIncomeRating(user: UserEntity, range: PeriodRange): Promise<ExpenseRatingItem[]> {
    return this.getRatingByType(user, range, CategoryType.INCOME);
  }

  private async getRatingByType(
    user: UserEntity,
    range: PeriodRange,
    type: CategoryType,
  ): Promise<ExpenseRatingItem[]> {
    const rows = await this.operationRepository
      .createQueryBuilder("operation")
      .leftJoin("operation.category", "category")
      .select("category.displayName", "category")
      .addSelect("SUM(operation.amount)", "total")
      .where("operation.userId = :userId", { userId: user.id })
      .andWhere("operation.type = :type", { type })
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

  /** Income/expense per local day of the range, including days without operations. */
  async getDailyTotals(user: UserEntity, range: PeriodRange): Promise<DailyTotals[]> {
    const rows = await this.operationRepository
      .createQueryBuilder("operation")
      .select("to_char(operation.createdAt AT TIME ZONE :tz, 'YYYY-MM-DD')", "date")
      .addSelect(
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
        tz: APP_TIME_ZONE,
        incomeType: CategoryType.INCOME,
        expenseType: CategoryType.EXPENSE,
      })
      .groupBy("date")
      .getRawMany<{ date: string; income: string | null; expense: string | null }>();

    const byDate = new Map(rows.map((row) => [row.date, row]));
    const result: DailyTotals[] = [];
    const last = toLocalDateString(range.end);
    for (let date = toLocalDateString(range.start); date <= last; date = addDays(date, 1)) {
      const row = byDate.get(date);
      result.push({
        date,
        income: row?.income ? Number(row.income) : 0,
        expense: row?.expense ? Number(row.expense) : 0,
      });
    }
    return result;
  }

  /** Newest operations of the range first. */
  async getRecentOperations(
    user: UserEntity,
    range: PeriodRange,
    limit: number,
  ): Promise<RecentOperation[]> {
    const operations = await this.operationRepository.find({
      where: { user: { id: user.id }, createdAt: Between(range.start, range.end) },
      relations: { category: true },
      order: { createdAt: "DESC" },
      take: limit,
    });

    return operations.map((op) => ({
      id: op.id,
      createdAt: op.createdAt,
      type: op.type,
      category: op.category.displayName,
      amount: op.amount,
      comment: op.comment,
    }));
  }

  async getOperationsForExport(
    user: UserEntity,
    range: PeriodRange,
  ): Promise<OperationForExport[]> {
    const operations = await this.operationRepository.find({
      where: {
        user: { id: user.id },
      },
      relations: {
        category: true,
      },
      order: {
        createdAt: "ASC",
      },
    });

    return operations
      .filter((op) => op.createdAt >= range.start && op.createdAt <= range.end)
      .map((op) => ({
        date: op.createdAt,
        category: op.category.displayName,
        amount: op.amount,
        comment: op.comment,
        type: op.type,
      }));
  }
}
