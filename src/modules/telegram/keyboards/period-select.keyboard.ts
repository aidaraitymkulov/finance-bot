import { Markup } from "telegraf";

export const PERIOD_BUTTONS = {
  today: { label: "Сегодня", data: "stats_period:today" },
  last7: { label: "Последние 7 дней", data: "stats_period:last7" },
  month: { label: "Текущий месяц", data: "stats_period:month" },
  custom: { label: "Произвольный период", data: "stats_period:custom" },
} as const;

export const buildPeriodSelectKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback(PERIOD_BUTTONS.today.label, PERIOD_BUTTONS.today.data)],
    [Markup.button.callback(PERIOD_BUTTONS.last7.label, PERIOD_BUTTONS.last7.data)],
    [Markup.button.callback(PERIOD_BUTTONS.month.label, PERIOD_BUTTONS.month.data)],
    [Markup.button.callback(PERIOD_BUTTONS.custom.label, PERIOD_BUTTONS.custom.data)],
  ]);
