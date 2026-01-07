import { Markup } from "telegraf";
import { CategoryEntity } from "../../category/category.entity";

export const buildIncomeCategoriesKeyboard = (categories: CategoryEntity[]) =>
  Markup.inlineKeyboard(
    categories.map((category) =>
      Markup.button.callback(category.displayName, `category:${category.code}`),
    ),
    { columns: 2 },
  );
