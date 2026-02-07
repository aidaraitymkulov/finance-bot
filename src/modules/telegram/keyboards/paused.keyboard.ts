import { Markup } from "telegraf";

export const buildPausedKeyboard = () => Markup.keyboard([["/start"]]).resize();
