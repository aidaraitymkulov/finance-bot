import { Injectable } from "@nestjs/common";
import { CategoryService } from "../../category/category.service";
import { CategoryType } from "../../category/category-type.enum";
import { OperationService } from "../../operation/operation.service";
import { UserService } from "../../user/user.service";
import { TelegramService } from "../telegram.service";
import { DialogStateService } from "../state/dialog-state.service";
import { OperationDialogState } from "../state/dialog-state.types";
import { buildExpenseCategoriesKeyboard } from "../keyboards/expense-categories.keyboard";
import { buildIncomeCategoriesKeyboard } from "../keyboards/income-categories.keyboard";
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import { parseAmount } from "../telegram.parsers";
import { formatOperationTypeLabel } from "../telegram.formatter";
import type { BotContext } from "../telegram.helpers";

@Injectable()
export class OperationFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly categoryService: CategoryService,
    private readonly operationService: OperationService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async start(ctx: BotContext, type: CategoryType) {
    const userId = ctx.from?.id ? String(ctx.from.id) : null;
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "operation",
      step: "amount",
      type,
    });
    await ctx.reply(type === CategoryType.INCOME ? "Введите сумму дохода." : "Введите сумму расхода.");
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: OperationDialogState) {
    if (state.step === "amount") {
      const amount = parseAmount(text);
      if (!amount) {
        await ctx.reply("Введите сумму числом. Пример: 1250 или 1250.50");
        return;
      }

      if (!state.type) {
        await ctx.reply("Не удалось определить тип операции.");
        this.dialogStateService.clear(userId);
        return;
      }

      this.dialogStateService.set(userId, {
        flow: "operation",
        step: "category",
        type: state.type,
        amount,
      });
      const categories = await this.categoryService.getCategoriesByType(state.type);
      const keyboard =
        state.type === CategoryType.INCOME
          ? buildIncomeCategoriesKeyboard(categories)
          : buildExpenseCategoriesKeyboard(categories);
      await replyWithMarkup(ctx, "Выберите категорию:", keyboard.reply_markup);
      return;
    }

    if (state.step === "comment") {
      const comment = text === "-" ? null : text;
      if (!state.categoryCode || state.amount === undefined) {
        await ctx.reply("Сначала выберите категорию.");
        return;
      }

      if (!state.type) {
        await ctx.reply("Не удалось определить тип операции.");
        this.dialogStateService.clear(userId);
        return;
      }

      const category = await this.categoryService.getByCode(state.type, state.categoryCode);
      if (!category) {
        await ctx.reply("Категория не найдена. Попробуйте снова.");
        this.dialogStateService.clear(userId);
        return;
      }

      const telegramUser = getTelegramUser(ctx);
      if (!telegramUser) {
        await ctx.reply("Не удалось определить пользователя.");
        return;
      }

      const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
      await this.operationService.createOperation({
        user,
        category,
        type: state.type,
        amount: state.amount,
        comment,
      });

      this.dialogStateService.clear(userId);
      const typeLabel = formatOperationTypeLabel(state.type);
      await ctx.reply(`${typeLabel} сохранен: ${state.amount.toFixed(2)} — ${category.displayName}`);
      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
    }
  }

  async handleCategorySelected(ctx: BotContext, userId: string, categoryCode: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "operation" || state.step !== "category") {
      await ctx.answerCbQuery("Сначала введите сумму.");
      return;
    }

    if (!state.type) {
      await ctx.answerCbQuery("Не удалось определить тип операции.");
      this.dialogStateService.clear(userId);
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "operation",
      step: "comment",
      type: state.type,
      amount: state.amount,
      categoryCode,
    });
    await ctx.answerCbQuery();
    await ctx.reply("Введите комментарий или '-' без комментария.");
  }
}
