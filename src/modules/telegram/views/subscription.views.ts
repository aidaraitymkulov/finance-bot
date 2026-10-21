import { Markup } from "telegraf";
import type { SubscriptionEntity } from "../../subscription/subscription.entity";
import { daysUntil, SubscriptionPeriod } from "../../subscription/next-payment.util";
import type { MessageView } from "./habit.views";
import { pluralizeRu } from "./plural";
import { formatDayLabel, formatShortDate } from "./task.views";

// Shared by SubscriptionFlow and the 09:00 payment reminders.

const PERIOD_SHORT: Record<SubscriptionPeriod, string> = { monthly: "мес", yearly: "год" };
const BUTTON_NAME_LENGTH = 28;

const amountFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const formatAmount = (value: number) => amountFormat.format(value);

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

/** 0 -> "сегодня", 1 -> "завтра", 4 -> "через 4 дня" */
const formatDaysLeft = (days: number) => {
  if (days === 0) {
    return "сегодня";
  }
  if (days === 1) {
    return "завтра";
  }
  return `через ${days} ${pluralizeRu(days, ["день", "дня", "дней"])}`;
};

const formatLine = (item: SubscriptionEntity, today: string) =>
  `• ${item.name} — ${formatAmount(item.amount)} / ${PERIOD_SHORT[item.period]} — ` +
  `${formatShortDate(item.nextPaymentDate)} (${formatDaysLeft(daysUntil(item.nextPaymentDate, today))})`;

/** Yearly subscriptions count as 1/12 of their price. */
const monthlyTotal = (items: SubscriptionEntity[]) =>
  items.reduce((sum, item) => sum + (item.period === "yearly" ? item.amount / 12 : item.amount), 0);

export const buildPeriodKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback("Месяц", "sub_period:monthly"),
      Markup.button.callback("Год", "sub_period:yearly"),
    ],
  ]);

/** `items` are expected soonest-first (see SubscriptionService.getAll). */
export const buildSubscriptionListView = (
  items: SubscriptionEntity[],
  today: string,
): MessageView => {
  if (items.length === 0) {
    return { text: "Подписок пока нет. Нажмите «➕ Новая подписка»." };
  }

  const lines = [
    "🔔 Подписки и платежи:",
    "",
    ...items.map((item) => formatLine(item, today)),
    "",
    `В месяц ≈ ${formatAmount(monthlyTotal(items))}`,
  ];

  const reply_markup = Markup.inlineKeyboard(
    items.map((item) => [
      Markup.button.callback(`🗑 ${truncate(item.name, BUTTON_NAME_LENGTH)}`, `sub_del:${item.id}`),
    ]),
  ).reply_markup;

  return { text: lines.join("\n"), reply_markup };
};

/** `items` are the subscriptions that fall on a reminder day (see SubscriptionService.getDueForReminder). */
export const buildSubscriptionReminderView = (
  items: SubscriptionEntity[],
  today: string,
): MessageView => {
  const lines = ["🔔 Скоро списания:", ""];
  for (const item of items) {
    const days = daysUntil(item.nextPaymentDate, today);
    const icon = days === 0 ? "💳" : "•";
    lines.push(
      `${icon} ${item.name} — ${formatAmount(item.amount)} — ${formatDaysLeft(days)} ` +
        `(${formatDayLabel(item.nextPaymentDate)})`,
    );
  }

  const reply_markup = Markup.inlineKeyboard(
    items.map((item) => [
      Markup.button.callback(
        `✅ Оплачено: ${truncate(item.name, BUTTON_NAME_LENGTH)}`,
        `sub_paid:${item.id}:${item.nextPaymentDate.replaceAll("-", "")}`,
      ),
    ]),
  ).reply_markup;

  return { text: lines.join("\n"), reply_markup };
};
