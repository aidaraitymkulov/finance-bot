import { Markup } from "telegraf";
export const DEBTS_MENU_BUTTONS = {
  list: "📋 Кому сколько",
  lend: "➕ Дал в долг",
  borrow: "➖ Взял в долг",
  repaidToMe: "✅ Мне вернули",
  repaidByMe: "✅ Я вернул",
  toFinance: "⬅️ К финансам",
} as const;

export const buildDebtsMenuKeyboard = () =>
  Markup.keyboard([
    [DEBTS_MENU_BUTTONS.list],
    [DEBTS_MENU_BUTTONS.lend, DEBTS_MENU_BUTTONS.borrow],
    [DEBTS_MENU_BUTTONS.repaidToMe, DEBTS_MENU_BUTTONS.repaidByMe],
    [DEBTS_MENU_BUTTONS.toFinance],
  ]).resize();
