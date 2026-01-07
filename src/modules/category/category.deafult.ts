import { CategoryType } from "./category-type.enum";

export const DEFAULT_CATEGORIES: Array<{
  type: CategoryType;
  code: string;
  displayName: string;
  order: number;
}> = [
  { type: CategoryType.INCOME, code: "work", displayName: "Работа", order: 1 },
  { type: CategoryType.INCOME, code: "gifts", displayName: "Подарки", order: 2 },
  { type: CategoryType.INCOME, code: "other_income", displayName: "Другое", order: 3 },
  { type: CategoryType.EXPENSE, code: "food", displayName: "Еда", order: 1 },
  { type: CategoryType.EXPENSE, code: "transport", displayName: "Проезд", order: 2 },
  { type: CategoryType.EXPENSE, code: "clothes", displayName: "Одежда", order: 3 },
  { type: CategoryType.EXPENSE, code: "cinema", displayName: "Кино", order: 4 },
  { type: CategoryType.EXPENSE, code: "purchases", displayName: "Покупки", order: 5 },
  { type: CategoryType.EXPENSE, code: "transfers", displayName: "Переводы", order: 6 },
  { type: CategoryType.EXPENSE, code: "other_expense", displayName: "Другое", order: 7 },
];
