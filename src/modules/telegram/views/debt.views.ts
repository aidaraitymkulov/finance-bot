import { Markup } from "telegraf";
import type { DebtEntryEntity } from "../../debt/debt-entry.entity";
import type { PersonBalance } from "../../debt/debt.service";
import { DebtKind } from "../../debt/debt-kind.enum";
import { personRef } from "../../debt/debt.util";
import { toLocalDateString } from "../../../common/utils/local-date.util";
import { formatShortDate } from "./task.views";
import type { MessageView } from "./habit.views";

const amountFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
export const formatDebtAmount = (value: number) => amountFormat.format(value);

const BUTTON_NAME_LENGTH = 28;
const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  [DebtKind.LEND]: "Дал в долг",
  [DebtKind.BORROW]: "Взял в долг",
  [DebtKind.REPAID_TO_ME]: "Вернул мне",
  [DebtKind.REPAID_BY_ME]: "Я вернул",
  [DebtKind.SPLIT]: "Заплатил за него",
};

/** "должен тебе 1 500" / "ты должен 800" */
export const formatBalance = (balance: number) =>
  balance > 0
    ? `должен тебе ${formatDebtAmount(balance)}`
    : `ты должен ${formatDebtAmount(-balance)}`;

export const buildBalancesView = (balances: PersonBalance[]): MessageView => {
  if (balances.length === 0) {
    return { text: "🤝 Долгов нет. Все в расчёте." };
  }

  const owedToMe = balances.filter((item) => item.balance > 0);
  const owedByMe = balances.filter((item) => item.balance < 0);
  const sum = (items: PersonBalance[]) =>
    items.reduce((total, item) => total + Math.abs(item.balance), 0);

  const lines = balances.map((item) => `👤 ${item.person} — ${formatBalance(item.balance)}`);
  const totals = [
    owedToMe.length > 0 ? `Тебе должны: ${formatDebtAmount(sum(owedToMe))}` : null,
    owedByMe.length > 0 ? `Ты должен: ${formatDebtAmount(sum(owedByMe))}` : null,
  ].filter((line): line is string => line !== null);

  return {
    text: ["🤝 Долги", "", ...lines, "", ...totals].join("\n"),
    reply_markup: Markup.inlineKeyboard(
      balances.map((item) => [
        Markup.button.callback(
          `👤 ${truncate(item.person, BUTTON_NAME_LENGTH)}`,
          `debt_card:${personRef(item.personKey)}`,
        ),
      ]),
    ).reply_markup,
  };
};

export const buildPersonCardView = (
  person: PersonBalance,
  history: DebtEntryEntity[],
): MessageView => {
  const lines = history.map((entry) => {
    const comment = entry.comment?.trim();
    return (
      `${formatShortDate(toLocalDateString(entry.createdAt))} • ${DEBT_KIND_LABELS[entry.kind]} • ` +
      `${formatDebtAmount(entry.amount)}${comment ? ` • ${comment}` : ""}`
    );
  });

  return {
    text: [`👤 ${person.person} — ${formatBalance(person.balance)}`, "", ...lines].join("\n"),
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("✅ Закрыть полностью", `debt_close:${personRef(person.personKey)}`)],
      [Markup.button.callback("⬅️ Все долги", "debt_list")],
    ]).reply_markup,
  };
};

/** One button per person; `prefix` is the callback prefix, the person id follows. */
export const buildPeopleKeyboard = (
  people: { person: string; personKey: string }[],
  prefix: string,
) =>
  Markup.inlineKeyboard(
    people.map((item) => [
      Markup.button.callback(
        `👤 ${truncate(item.person, BUTTON_NAME_LENGTH)}`,
        `${prefix}:${personRef(item.personKey)}`,
      ),
    ]),
  );
