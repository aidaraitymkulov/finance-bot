import { Markup } from "telegraf";
import { MAIN_MENU_BUTTONS } from "./main-menu.keyboard";

export const buildCancelKeyboard = () =>
  Markup.keyboard([[MAIN_MENU_BUTTONS.cancel]]).resize();
