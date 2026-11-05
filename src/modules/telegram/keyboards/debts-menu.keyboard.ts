import { Markup } from "telegraf";
import { MAIN_MENU_BUTTONS } from "./main-menu.keyboard";

export const DEBTS_MENU_BUTTONS = {
  list: "📋 Кому сколько",
  lend: "➕ Дал в долг",
  borrow: "➖ Взял в долг",
  repaidToMe: "✅ Мне вернули",
  repaidByMe: "✅ Я вернул",
} as const;

export const buildDebtsMenuKeyboard = () =>
  Markup.keyboard([
    [DEBTS_MENU_BUTTONS.list],
    [DEBTS_MENU_BUTTONS.lend, DEBTS_MENU_BUTTONS.borrow],
    [DEBTS_MENU_BUTTONS.repaidToMe, DEBTS_MENU_BUTTONS.repaidByMe],
    [MAIN_MENU_BUTTONS.back],
  ]).resize();
