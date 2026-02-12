import { Markup } from "telegraf";

const PERIOD_OPTIONS = [
  { key: "today", label: "📅 Сегодня" },
  { key: "last7", label: "🗓️ Последние 7 дней" },
  { key: "month", label: "📆 Текущий месяц" },
  { key: "custom", label: "✏️ Произвольный период" },
] as const;

type PeriodPrefix = "stats" | "rating" | "stats_category" | "excel";

export const buildPeriodSelectKeyboard = (prefix: PeriodPrefix = "stats") =>
  Markup.inlineKeyboard(
    PERIOD_OPTIONS.map((option) => [
      Markup.button.callback(option.label, `${prefix}_period:${option.key}`),
    ]),
  );
