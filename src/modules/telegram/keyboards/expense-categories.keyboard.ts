import { Markup } from "telegraf";
import { CategoryEntity } from "../../category/category.entity";

export const buildExpenseCategoriesKeyboard = (
  categories: CategoryEntity[],
  prefix = "category",
) =>
  Markup.inlineKeyboard(
    categories.map((category) =>
      Markup.button.callback(category.displayName, `${prefix}:${category.code}`),
    ),
    { columns: 2 },
  );
