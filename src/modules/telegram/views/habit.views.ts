import { Markup } from "telegraf";
import type { InlineKeyboardMarkup } from "@telegraf/types";
import { HabitCheckinStatus } from "../../habit/habit-checkin-status.enum";
import type { HabitWithStats } from "../../habit/habit.service";
import { pluralizeRu } from "./plural";

// Shared by HabitFlow and the 22:00 scheduler, so both send identical messages.

export interface MessageView {
  text: string;
  reply_markup?: InlineKeyboardMarkup;
}

const formatDays = (count: number) => `${count} ${pluralizeRu(count, ["день", "дня", "дней"])}`;

const formatStreak = ({ streak }: HabitWithStats) =>
  streak.current > 0 ? `🔥 ${formatDays(streak.current)}` : "серии пока нет";

export const buildHabitPollView = (item: HabitWithStats): MessageView => ({
  text: `🔥 ${item.habit.title}\nСерия: ${formatStreak(item)}`,
  reply_markup: Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Сделал", `habit_check:${item.habit.id}:done`),
      Markup.button.callback("⏭ Пропустил", `habit_check:${item.habit.id}:skip`),
    ],
  ]).reply_markup,
});

export const buildHabitCheckedText = (item: HabitWithStats): string =>
  item.todayStatus === HabitCheckinStatus.DONE
    ? `✅ ${item.habit.title} — серия ${formatDays(item.streak.current)}`
    : `⏭ ${item.habit.title} — пропущено сегодня`;

const formatTodayMark = (status: HabitCheckinStatus | null) => {
  if (status === HabitCheckinStatus.DONE) {
    return "✅";
  }
  if (status === HabitCheckinStatus.SKIPPED) {
    return "⏭";
  }
  return "▫️";
};

export const buildHabitListView = (items: HabitWithStats[]): MessageView => {
  if (items.length === 0) {
    return { text: "Привычек пока нет. Нажмите «➕ Новая привычка»." };
  }

  const lines = items.map((item, index) => {
    const best = item.streak.best > 0 ? ` (рекорд ${formatDays(item.streak.best)})` : "";
    return `${index + 1}. ${formatTodayMark(item.todayStatus)} ${item.habit.title} — ${formatStreak(item)}${best}`;
  });

  return {
    text: ["📋 Мои привычки:", "", ...lines, "", "▫️ — ещё не отмечено сегодня"].join("\n"),
    reply_markup: Markup.inlineKeyboard(
      items.map((item) => [
        Markup.button.callback(`🗑 ${item.habit.title}`, `habit_del:${item.habit.id}`),
      ]),
    ).reply_markup,
  };
};
