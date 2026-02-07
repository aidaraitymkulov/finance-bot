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

const LAST_PAGE_SIZE = 10;

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
      this.telegramService.getMainMenuKeyboard().reply_markup,
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

    const lines = items.map((operation) => {
      const date = formatDateTime(operation.createdAt);
      const typeLabel = formatOperationTypeLabel(operation.type ?? CategoryType.EXPENSE);
      const baseLine = `${date} • ${typeLabel} • ${operation.category.displayName} • ${operation.amount.toFixed(
        2,
      )}`;
      const comment = operation.comment?.trim();
      return comment ? `${baseLine}\n💬 ${comment}` : baseLine;
    });

    const message = ["Последние операции:", ...lines].join("\n");

    if (hasMore) {
      const nextOffset = offset + items.length;
      await replyWithMarkup(ctx, message, this.buildLastMoreKeyboard(nextOffset).reply_markup);
      return;
    }

    await ctx.reply(message);
  }

  private buildLastMoreKeyboard(nextOffset: number) {
    return Markup.inlineKeyboard([
      Markup.button.callback("➕ Показать еще", `last_more:${nextOffset}`),
    ]);
  }
}
