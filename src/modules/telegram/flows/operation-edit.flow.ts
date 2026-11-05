import { Injectable } from "@nestjs/common";
import { CategoryService } from "../../category/category.service";
import { DebtService } from "../../debt/debt.service";
import { OperationService } from "../../operation/operation.service";
import { OperationEntity } from "../../operation/operation.entity";
import { UserService } from "../../user/user.service";
import { UserEntity } from "../../user/user.entity";
import { DialogStateService } from "../state/dialog-state.service";
import { OperationEditDialogState } from "../state/dialog-state.types";
import { TelegramService } from "../telegram.service";
import { parseAmount } from "../telegram.parsers";
import {
  buildCategoryPickKeyboard,
  buildDeleteConfirmView,
  buildOperationCardView,
} from "../views/operation-edit.views";
import { editMessageSafe, getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

const COMMENT_MAX_LENGTH = 256;

/** Edit / delete an operation from the "🧾 Последние" list. */
@Injectable()
export class OperationEditFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly operationService: OperationService,
    private readonly debtService: DebtService,
    private readonly categoryService: CategoryService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  /** "✏️ N" under /last: a new message with the card. */
  async open(ctx: BotContext, operationId: string) {
    const found = await this.load(ctx, operationId);
    if (!found) {
      return;
    }
    await ctx.answerCbQuery();
    await this.sendCard(ctx, found.user, found.operation);
  }

  /** Back to the card from the delete confirmation. */
  async showCard(ctx: BotContext, operationId: string) {
    const found = await this.load(ctx, operationId);
    if (!found) {
      return;
    }
    await ctx.answerCbQuery();
    await this.renderCard(ctx, found.user, found.operation);
  }

  async startAmount(ctx: BotContext, userId: string, operationId: string) {
    const found = await this.load(ctx, operationId);
    if (!found) {
      return;
    }
    this.dialogStateService.set(userId, {
      flow: "operation_edit",
      step: "edit_amount",
      operationId,
    });
    await ctx.answerCbQuery();
    const split =
      found.operation.sharedAmount !== null ? " (твоя доля, за других не меняется)" : "";
    await replyWithMarkup(
      ctx,
      `Введите новую сумму${split}.`,
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async startComment(ctx: BotContext, userId: string, operationId: string) {
    const found = await this.load(ctx, operationId);
    if (!found) {
      return;
    }
    this.dialogStateService.set(userId, {
      flow: "operation_edit",
      step: "edit_comment",
      operationId,
    });
    await ctx.answerCbQuery();
    await replyWithMarkup(
      ctx,
      "Введите новый комментарий или '-' чтобы убрать.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async startCategory(ctx: BotContext, userId: string, operationId: string) {
    const found = await this.load(ctx, operationId);
    if (!found) {
      return;
    }
    this.dialogStateService.set(userId, {
      flow: "operation_edit",
      step: "edit_category",
      operationId,
    });
    await ctx.answerCbQuery();
    const categories = await this.categoryService.getCategoriesByType(found.operation.type);
    await replyWithMarkup(
      ctx,
      "Выберите новую категорию:",
      buildCategoryPickKeyboard(categories).reply_markup,
    );
  }

  async handleCategorySet(ctx: BotContext, userId: string, categoryCode: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "operation_edit" || state.step !== "edit_category") {
      await ctx.answerCbQuery("Сначала нажмите «Категория» в карточке операции.");
      return;
    }

    const found = await this.load(ctx, state.operationId);
    if (!found) {
      this.dialogStateService.clear(userId);
      return;
    }
    const category = await this.categoryService.getByCode(found.operation.type, categoryCode);
    if (!category) {
      await ctx.answerCbQuery("Категория не найдена.");
      return;
    }

    this.dialogStateService.clear(userId);
    const updated = await this.operationService.update(found.user, state.operationId, {
      category,
    });
    await ctx.answerCbQuery("Категория изменена ✅");
    if (updated) {
      await this.sendCard(ctx, found.user, updated);
    }
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: OperationEditDialogState) {
    if (state.step === "edit_category") {
      await ctx.reply("Выберите категорию кнопкой выше.");
      return;
    }

    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    let patch: { amount: number } | { comment: string | null };
    if (state.step === "edit_amount") {
      const amount = parseAmount(text);
      if (amount === null) {
        await ctx.reply("Введите сумму числом. Пример: 1250 или 1250.50");
        return;
      }
      patch = { amount };
    } else {
      const comment = text === "-" ? null : text;
      if (comment !== null && comment.length > COMMENT_MAX_LENGTH) {
        await ctx.reply(`Слишком длинный комментарий (максимум ${COMMENT_MAX_LENGTH} символов).`);
        return;
      }
      patch = { comment };
    }

    this.dialogStateService.clear(userId);
    const updated = await this.operationService.update(user, state.operationId, patch);
    await replyWithMarkup(
      ctx,
      updated ? "✅ Сохранено." : "Операция не найдена.",
      this.telegramService.getFinanceMenuKeyboard().reply_markup,
    );
    if (updated) {
      await this.sendCard(ctx, user, updated);
    }
  }

  async confirmDelete(ctx: BotContext, operationId: string) {
    const found = await this.load(ctx, operationId);
    if (!found) {
      return;
    }
    await ctx.answerCbQuery();
    const splits = await this.debtService.getOperationSplits(found.user, operationId);
    const view = buildDeleteConfirmView(found.operation, splits);
    await editMessageSafe(ctx, view.text, view.reply_markup);
  }

  async delete(ctx: BotContext, operationId: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const result = await this.debtService.deleteOperation(user, operationId);
    await ctx.answerCbQuery(result.deleted ? "Удалено 🗑" : "Операция не найдена.");
    await editMessageSafe(
      ctx,
      result.deleted
        ? `🗑 Операция удалена${result.removedEntries > 0 ? " вместе с долгами по ней" : ""}.`
        : "Операция не найдена (возможно, уже удалена).",
    );
  }

  async cancelSplit(ctx: BotContext, operationId: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const result = await this.debtService.cancelSplit(user, operationId);
    if (!result.cancelled) {
      await ctx.answerCbQuery("Разбиения нет.");
    } else {
      await ctx.answerCbQuery("Разбиение отменено ↩️");
    }

    const operation = await this.operationService.findOwned(user, operationId);
    if (operation) {
      await this.renderCard(ctx, user, operation);
    }
  }

  private async load(ctx: BotContext, operationId: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return null;
    }
    const operation = await this.operationService.findOwned(user, operationId);
    if (!operation) {
      await ctx.answerCbQuery("Операция не найдена.");
      return null;
    }
    return { user, operation };
  }

  private async sendCard(ctx: BotContext, user: UserEntity, operation: OperationEntity) {
    const view = await this.cardView(user, operation);
    await ctx.reply(view.text, { reply_markup: view.reply_markup });
  }

  private async renderCard(ctx: BotContext, user: UserEntity, operation: OperationEntity) {
    const view = await this.cardView(user, operation);
    await editMessageSafe(ctx, view.text, view.reply_markup);
  }

  private async cardView(user: UserEntity, operation: OperationEntity) {
    return buildOperationCardView(
      operation,
      await this.debtService.getOperationSplits(user, operation.id),
    );
  }

  private async resolveUser(ctx: BotContext): Promise<UserEntity | null> {
    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return null;
    }
    return this.userService.findOrCreateByTelegramUser(telegramUser);
  }
}
