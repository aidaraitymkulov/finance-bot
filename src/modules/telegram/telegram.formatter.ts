import { CategoryType } from "../category/category-type.enum";
import { CategoryStats, ExpenseRatingItem, SummaryReport } from "../report/report.service";

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateTime = (date: Date): string => {
  const base = formatDate(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${base} ${hours}:${minutes}`;
};

export const formatSummaryMessage = (start: Date, end: Date, summary: SummaryReport) =>
  [
    `Период: ${formatDate(start)} — ${formatDate(end)}`,
    `Доход: ${summary.income.toFixed(2)}`,
    `Расход: ${summary.expense.toFixed(2)}`,
    `Баланс: ${summary.balance.toFixed(2)}`,
    `Средний доход в день: ${summary.avgIncomePerDay.toFixed(2)}`,
    `Средний расход в день: ${summary.avgExpensePerDay.toFixed(2)}`,
  ].join("\n");

export const formatCategoryStatsMessage = (
  start: Date,
  end: Date,
  categoryName: string,
  stats: CategoryStats,
) =>
  [
    `Период: ${formatDate(start)} — ${formatDate(end)}`,
    `Категория: ${categoryName}`,
    `Сумма: ${stats.total.toFixed(2)}`,
    `Количество операций: ${stats.count}`,
    `Среднее в день: ${stats.avgPerDay.toFixed(2)}`,
  ].join("\n");

export const formatRatingMessage = (start: Date, end: Date, rating: ExpenseRatingItem[]) => {
  const lines = rating.map((item, index) => {
    const position = String(index + 1).padStart(2, "0");
    return `${position}. ${item.category} — ${item.total.toFixed(2)}`;
  });

  return [`Период: ${formatDate(start)} — ${formatDate(end)}`, "Рейтинг расходов:", ...lines].join(
    "\n",
  );
};

export const formatOperationTypeLabel = (type: CategoryType) =>
  type === CategoryType.INCOME ? "Доход" : "Расход";
