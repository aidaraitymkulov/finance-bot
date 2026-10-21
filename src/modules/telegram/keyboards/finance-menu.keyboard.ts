import { Markup } from "telegraf";
import { MAIN_MENU_BUTTONS } from "./main-menu.keyboard";

export const FINANCE_MENU_BUTTONS = {
  income: "💰 Доход",
  expense: "💸 Расход",
  stats: "📊 Статистика",
  rating: "🏆 Рейтинг",
  categories: "🗂 Категории",
  last: "🧾 Последние",
  excel: "📥 Отчёт",
} as const;

export const buildFinanceMenuKeyboard = () =>
  Markup.keyboard([
    [FINANCE_MENU_BUTTONS.income, FINANCE_MENU_BUTTONS.expense],
    [FINANCE_MENU_BUTTONS.stats, FINANCE_MENU_BUTTONS.rating],
    [FINANCE_MENU_BUTTONS.categories, FINANCE_MENU_BUTTONS.last],
    [FINANCE_MENU_BUTTONS.excel, MAIN_MENU_BUTTONS.back],
  ]).resize();
