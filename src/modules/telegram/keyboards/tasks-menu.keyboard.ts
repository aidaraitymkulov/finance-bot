import { Markup } from "telegraf";
import { MAIN_MENU_BUTTONS } from "./main-menu.keyboard";

export const TASKS_MENU_BUTTONS = {
  add: "➕ Новая задача",
  today: "📅 Сегодня",
  week: "🗓 Неделя",
} as const;

export const buildTasksMenuKeyboard = () =>
  Markup.keyboard([
    [TASKS_MENU_BUTTONS.today, TASKS_MENU_BUTTONS.week],
    [TASKS_MENU_BUTTONS.add],
    [MAIN_MENU_BUTTONS.back],
  ]).resize();
