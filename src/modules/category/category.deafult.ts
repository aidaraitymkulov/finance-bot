import { CategoryType } from "./category-type.enum";

export const DEFAULT_CATEGORIES: Array<{
  type: CategoryType;
  code: string;
  displayName: string;
  order: number;
}> = [
  { type: CategoryType.INCOME, code: "work", displayName: "Work", order: 1 },
  { type: CategoryType.INCOME, code: "gifts", displayName: "Gifts", order: 2 },
  { type: CategoryType.INCOME, code: "other_income", displayName: "Other", order: 3 },
  { type: CategoryType.EXPENSE, code: "food", displayName: "Food", order: 1 },
  { type: CategoryType.EXPENSE, code: "transport", displayName: "Transport", order: 2 },
  { type: CategoryType.EXPENSE, code: "clothes", displayName: "Clothes", order: 3 },
  { type: CategoryType.EXPENSE, code: "cinema", displayName: "Cinema", order: 4 },
  { type: CategoryType.EXPENSE, code: "purchases", displayName: "Purchases", order: 5 },
  { type: CategoryType.EXPENSE, code: "transfers", displayName: "Transfers", order: 6 },
  { type: CategoryType.EXPENSE, code: "other_expense", displayName: "Other", order: 7 },
];
