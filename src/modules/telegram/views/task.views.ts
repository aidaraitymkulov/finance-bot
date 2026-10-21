import { Markup } from "telegraf";
import type { TaskEntity } from "../../task/task.entity";
import { addDays, getWeekday, nextWeekday } from "../../../common/utils/local-date.util";
import type { MessageView } from "./habit.views";

// Shared by TaskFlow and the 09:00 morning digest.

export type TaskListMode = "today" | "week";

const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const BUTTON_TITLE_LENGTH = 28;

/** "2026-10-23" -> "23.10" */
const formatShortDate = (date: string) => {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
};

/** "2026-10-23" -> "Пт, 23.10" */
export const formatDayLabel = (date: string) =>
  `${WEEKDAY_SHORT[getWeekday(date)]}, ${formatShortDate(date)}`;

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

const buildTaskButtons = (tasks: TaskEntity[], mode: TaskListMode) =>
  Markup.inlineKeyboard(
    tasks.map((task) => [
      Markup.button.callback(
        `✅ ${truncate(task.title, BUTTON_TITLE_LENGTH)}`,
        `task_done:${task.id}:${mode}`,
      ),
      Markup.button.callback("🗑", `task_del:${task.id}:${mode}`),
    ]),
  ).reply_markup;

/** `tasks` are open tasks due up to the end of the shown range (see TaskService.getOpenUntil). */
export const buildTaskListView = (
  tasks: TaskEntity[],
  today: string,
  mode: TaskListMode,
  intro?: string,
): MessageView => {
  const overdue = tasks.filter((task) => task.dueDate < today);
  const lines: string[] = intro ? [intro, ""] : [];

  if (mode === "today") {
    lines.push(`📅 Задачи на сегодня, ${formatDayLabel(today)}:`);
  } else {
    lines.push("🗓 Задачи на неделю:");
  }

  if (tasks.length === 0) {
    lines.push("", mode === "today" ? "Задач нет 🎉" : "На ближайшую неделю задач нет.");
    return { text: lines.join("\n") };
  }

  if (overdue.length > 0) {
    lines.push("", "⚠️ Просрочено:");
    lines.push(...overdue.map((task) => `• ${task.title} (${formatShortDate(task.dueDate)})`));
  }

  const days = mode === "today" ? 1 : 7;
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(today, offset);
    const dayTasks = tasks.filter((task) => task.dueDate === date);
    if (dayTasks.length === 0) {
      continue;
    }

    lines.push("");
    if (mode === "week") {
      lines.push(offset === 0 ? `Сегодня, ${formatShortDate(date)}:` : `${formatDayLabel(date)}:`);
    }
    lines.push(...dayTasks.map((task) => `• ${task.title}`));
  }

  return { text: lines.join("\n"), reply_markup: buildTaskButtons(tasks, mode) };
};

/** Picker after the task title: today, tomorrow, the nearest weekday, or a typed date. */
export const buildTaskDatePickerKeyboard = (today: string) => {
  const weekdayButton = (weekday: number) => {
    const date = nextWeekday(today, weekday);
    return Markup.button.callback(
      `${WEEKDAY_SHORT[weekday]} ${formatShortDate(date)}`,
      `task_date:wd${weekday}`,
    );
  };

  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Сегодня", "task_date:today"),
      Markup.button.callback("Завтра", "task_date:tomorrow"),
    ],
    [1, 2, 3, 4].map(weekdayButton),
    [5, 6, 0].map(weekdayButton),
    [Markup.button.callback("📆 Другая дата", "task_date:custom")],
  ]);
};

/** Resolves a `task_date:<key>` picker value to a local date, or null for unknown keys. */
export const resolveTaskDateKey = (key: string, today: string): string | null => {
  if (key === "today") {
    return today;
  }
  if (key === "tomorrow") {
    return addDays(today, 1);
  }
  const match = /^wd([0-6])$/.exec(key);
  return match ? nextWeekday(today, Number(match[1])) : null;
};
