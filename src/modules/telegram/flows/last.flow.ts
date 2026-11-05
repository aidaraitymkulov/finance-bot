import { Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import { OperationService } from "../../operation/operation.service";
import { UserService } from "../../user/user.service";
import { CategoryType } from "../../category/category-type.enum";
import { formatDateTime, formatOperationTypeLabel } from "../telegram.formatter";
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import { TelegramService } from "../telegram.service";
import type { BotContext } from "../telegram.helpers";
import { UserEntity } from "../../user/user.entity";
import { OperationEntity } from "../../operation/operation.entity";

const LAST_PAGE_SIZE = 10;
const EDIT_BUTTONS_PER_ROW = 5;

@Injectable()
export class LastFlow {
  constructor(
    private readonly operationService: OperationService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async start(ctx: BotContext) {
    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    await this.sendLastOperations(ctx, user, 0);

    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getFinanceMenuKeyboard().reply_markup,
    );
  }

  async handleMore(ctx: BotContext, offset: number) {
    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    await ctx.answerCbQuery();
    await this.sendLastOperations(ctx, user, offset);
  }

  private async sendLastOperations(ctx: BotContext, user: UserEntity, offset: number) {
    const { items, hasMore } = await this.operationService.getLastOperationsPage(
      user,
      LAST_PAGE_SIZE,
      offset,
    );

    if (items.length === 0) {
      if (offset === 0) {
        await ctx.reply("Операций пока нет.");
      } else {
        await ctx.reply("Больше операций нет.");
      }
      return;
    }

    const lines = items.map((operation, index) => {
      const date = formatDateTime(operation.createdAt);
      const typeLabel = formatOperationTypeLabel(operation.type ?? CategoryType.EXPENSE);
      const baseLine = `${date} • ${typeLabel} • ${operation.category.displayName} • ${operation.amount.toFixed(
        2,
      )}`;
      const shared =
        operation.sharedAmount !== null
          ? ` (ещё ${operation.sharedAmount.toFixed(2)} за другого)`
          : "";
      const comment = operation.comment?.trim();
      const line = `${index + 1}. ${baseLine}${shared}`;
      return comment ? `${line}\n💬 ${comment}` : line;
    });

    const message = ["Последние операции:", ...lines].join("\n");

    await replyWithMarkup(
      ctx,
      message,
      this.buildKeyboard(items, hasMore ? offset + items.length : null).reply_markup,
    );
  }

  /** "✏️ N" buttons (N = the line number above, 5 per row) and, when needed, "show more". */
  private buildKeyboard(items: OperationEntity[], nextOffset: number | null) {
    const editButtons = items.map((operation, index) =>
      Markup.button.callback(`✏️ ${index + 1}`, `op_edit:${operation.id}`),
    );
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    for (let i = 0; i < editButtons.length; i += EDIT_BUTTONS_PER_ROW) {
      rows.push(editButtons.slice(i, i + EDIT_BUTTONS_PER_ROW));
    }
    if (nextOffset !== null) {
      rows.push([Markup.button.callback("➕ Показать еще", `last_more:${nextOffset}`)]);
    }
    return Markup.inlineKeyboard(rows);
  }
}
