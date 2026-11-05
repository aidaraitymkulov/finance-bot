import { Markup } from "telegraf";
import type { CategoryEntity } from "../../category/category.entity";
import type { DebtEntryEntity } from "../../debt/debt-entry.entity";
import type { OperationEntity } from "../../operation/operation.entity";
import { formatDateTime, formatOperationTypeLabel } from "../telegram.formatter";
import { formatDebtAmount } from "./debt.views";
import type { MessageView } from "./habit.views";

const CATEGORIES_PER_ROW = 2;

/** Card of one operation with the edit actions; `splits` are its "paid for others" debt entries. */
export const buildOperationCardView = (
  operation: OperationEntity,
  splits: DebtEntryEntity[],
): MessageView => {
  const comment = operation.comment?.trim();
  const hasSplits = splits.length > 0;
  const lines = [
    `🧾 ${formatOperationTypeLabel(operation.type)} • ${operation.category.displayName}`,
    `Сумма: ${formatDebtAmount(operation.amount)}${hasSplits ? " (твоя доля)" : ""}`,
    hasSplits
      ? `За других: ${splits.map((s) => `${s.person} — ${formatDebtAmount(s.amount)}`).join(", ")}`
      : null,
    `Дата: ${formatDateTime(operation.createdAt)}`,
    comment ? `💬 ${comment}` : null,
  ].filter((line): line is string => line !== null);

  const id = operation.id;
  const rows = [
    [
      Markup.button.callback("✏️ Сумма", `op_e_amount:${id}`),
      Markup.button.callback("🏷 Категория", `op_e_cat:${id}`),
    ],
    [Markup.button.callback("💬 Комментарий", `op_e_comment:${id}`)],
    ...(hasSplits ? [[Markup.button.callback("↩️ Отменить разбиение", `op_e_unsplit:${id}`)]] : []),
    [Markup.button.callback("🗑 Удалить", `op_e_del:${id}`)],
  ];
  return { text: lines.join("\n"), reply_markup: Markup.inlineKeyboard(rows).reply_markup };
};

export const buildDeleteConfirmView = (
  operation: OperationEntity,
  splits: DebtEntryEntity[],
): MessageView => {
  const lines = [
    `Удалить операцию «${operation.category.displayName} — ${formatDebtAmount(operation.amount)}»?`,
    splits.length > 0
      ? `Долги по ней тоже удалятся: ${splits
          .map((s) => `${s.person} ${formatDebtAmount(s.amount)}`)
          .join(", ")}.`
      : null,
  ].filter((line): line is string => line !== null);

  return {
    text: lines.join("\n"),
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.callback("🗑 Да, удалить", `op_e_del_yes:${operation.id}`),
        Markup.button.callback("⬅️ Отмена", `op_e_card:${operation.id}`),
      ],
    ]).reply_markup,
  };
};

export const buildCategoryPickKeyboard = (categories: CategoryEntity[]) => {
  const buttons = categories.map((category) =>
    Markup.button.callback(category.displayName, `op_e_set:${category.code}`),
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += CATEGORIES_PER_ROW) {
    rows.push(buttons.slice(i, i + CATEGORIES_PER_ROW));
  }
  return Markup.inlineKeyboard(rows);
};
