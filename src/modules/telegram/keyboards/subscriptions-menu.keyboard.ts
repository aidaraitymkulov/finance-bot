import { Markup } from "telegraf";
import { MAIN_MENU_BUTTONS } from "./main-menu.keyboard";

export const SUBSCRIPTIONS_MENU_BUTTONS = {
  add: "➕ Новая подписка",
  list: "📋 Мои подписки",
} as const;

export const buildSubscriptionsMenuKeyboard = () =>
  Markup.keyboard([
    [SUBSCRIPTIONS_MENU_BUTTONS.list],
    [SUBSCRIPTIONS_MENU_BUTTONS.add],
    [MAIN_MENU_BUTTONS.back],
  ]).resize();
