import { Markup } from "telegraf";
import { CategoryEntity } from "../../category/category.entity";

const isOtherCategory = (category: CategoryEntity) =>
  category.code === "other_income" || /другое/i.test(category.displayName);

export const buildIncomeCategoriesKeyboard = (
  categories: CategoryEntity[],
  prefix = "category",
) => {
  const regularCategories = categories.filter((category) => !isOtherCategory(category));
  const otherCategories = categories.filter((category) => isOtherCategory(category));

  const regularButtons = regularCategories.map((category) =>
    Markup.button.callback(category.displayName, `${prefix}:${category.code}`),
  );
  const regularRows = Markup.inlineKeyboard(regularButtons, { columns: 2 }).reply_markup
    .inline_keyboard;
  const otherRows = otherCategories.map((category) => [
    Markup.button.callback(category.displayName, `${prefix}:${category.code}`),
  ]);

  return Markup.inlineKeyboard([...regularRows, ...otherRows]);
};
