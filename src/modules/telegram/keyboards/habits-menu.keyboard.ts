import { Markup } from "telegraf";
import { MAIN_MENU_BUTTONS } from "./main-menu.keyboard";

export const HABITS_MENU_BUTTONS = {
  add: "➕ Новая привычка",
  list: "📋 Мои привычки",
  check: "✔️ Отметить сегодня",
} as const;

export const buildHabitsMenuKeyboard = () =>
  Markup.keyboard([
    [HABITS_MENU_BUTTONS.check],
    [HABITS_MENU_BUTTONS.add, HABITS_MENU_BUTTONS.list],
    [MAIN_MENU_BUTTONS.back],
  ]).resize();
