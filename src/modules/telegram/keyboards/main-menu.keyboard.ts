import { Markup } from "telegraf";

export const MAIN_MENU_BUTTONS = {
  finance: "💰 Финансы",
  help: "❓ Помощь",
  disable: "⏸ Отключить",
  cancel: "❌ Отмена",
  back: "⬅️ Назад",
} as const;

export const buildMainMenuKeyboard = () =>
  Markup.keyboard([
    [MAIN_MENU_BUTTONS.finance],
    [MAIN_MENU_BUTTONS.help, MAIN_MENU_BUTTONS.disable],
  ]).resize();
