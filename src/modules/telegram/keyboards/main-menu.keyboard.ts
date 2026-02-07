import { Markup } from "telegraf";

export const MAIN_MENU_BUTTONS = {
  income: "💰 Доход",
  expense: "💸 Расход",
  stats: "📊 Статистика",
  rating: "🏆 Рейтинг",
  last: "🧾 Последние",
  cancel: "❌ Отмена",
  help: "❓ Помощь",
} as const;

export const buildMainMenuKeyboard = () =>
  Markup.keyboard([
    [MAIN_MENU_BUTTONS.income, MAIN_MENU_BUTTONS.expense],
    [MAIN_MENU_BUTTONS.stats, MAIN_MENU_BUTTONS.rating],
    [MAIN_MENU_BUTTONS.last, MAIN_MENU_BUTTONS.cancel],
    [MAIN_MENU_BUTTONS.help],
  ]).resize();
