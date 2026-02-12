import { Markup } from "telegraf";

export const MAIN_MENU_BUTTONS = {
  income: "💰 Доход",
  expense: "💸 Расход",
  stats: "📊 Статистика",
  rating: "🏆 Рейтинг",
  categories: "🗂 Категории",
  last: "🧾 Последние",
  excel: "📥 Отчёт",
  disable: "⏸ Отключить",
  cancel: "❌ Отмена",
  help: "❓ Помощь",
} as const;

export const buildMainMenuKeyboard = () =>
  Markup.keyboard([
    [MAIN_MENU_BUTTONS.income, MAIN_MENU_BUTTONS.expense],
    [MAIN_MENU_BUTTONS.stats, MAIN_MENU_BUTTONS.rating],
    [MAIN_MENU_BUTTONS.categories, MAIN_MENU_BUTTONS.last],
    [MAIN_MENU_BUTTONS.excel, MAIN_MENU_BUTTONS.help],
    [MAIN_MENU_BUTTONS.disable],
  ]).resize();
