import { Injectable, Logger } from "@nestjs/common";
import { Markup } from "telegraf";
import { DebtService } from "../../debt/debt.service";
import { normalizePerson, personRef, validatePerson } from "../../debt/debt.util";
import { UserEntity } from "../../user/user.entity";
import { CategoryEntity } from "../../category/category.entity";
import { CategoryKeywordService } from "../../category/category-keyword.service";
import { CategoryService } from "../../category/category.service";
import { CategoryType } from "../../category/category-type.enum";
import { OperationService } from "../../operation/operation.service";
import { UserService } from "../../user/user.service";
import { TelegramService } from "../telegram.service";
import { DialogStateService } from "../state/dialog-state.service";
import { OperationDialogState } from "../state/dialog-state.types";
import { PERSON_ERRORS } from "./debt.flow";
import { buildPeopleKeyboard, formatBalance, formatDebtAmount } from "../views/debt.views";
import { buildExpenseCategoriesKeyboard } from "../keyboards/expense-categories.keyboard";
import { buildIncomeCategoriesKeyboard } from "../keyboards/income-categories.keyboard";
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import { parseAmount } from "../telegram.parsers";
import { parseQuickInput } from "../quick-input.parser";
import { formatOperationTypeLabel } from "../telegram.formatter";
import type { BotContext } from "../telegram.helpers";

const SPLIT_ERRORS = {
  ...PERSON_ERRORS,
  not_found: "Операция не найдена.",
  too_much: "Сумма за другого должна быть меньше суммы расхода.",
  invalid_amount: "Неверная сумма.",
} as const;

@Injectable()
export class OperationFlow {
  private readonly logger = new Logger(OperationFlow.name);

  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly categoryService: CategoryService,
    private readonly categoryKeywordService: CategoryKeywordService,
    private readonly operationService: OperationService,
    private readonly userService: UserService,
    private readonly debtService: DebtService,
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
    await replyWithMarkup(
      ctx,
      type === CategoryType.INCOME ? "Введите сумму дохода." : "Введите сумму расхода.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: OperationDialogState) {
    if (state.step === "split_amount") {
      const shared = parseAmount(text);
      if (shared === null || shared >= state.total) {
        await ctx.reply(
          `Введите сумму больше нуля и меньше ${formatDebtAmount(state.total)}. ` +
            "Если всё ушло на другого, используйте «Дал в долг» в разделе «Долги».",
        );
        return;
      }

      this.dialogStateService.set(userId, {
        flow: "operation",
        step: "split_person",
        operationId: state.operationId,
        shared,
      });
      const user = await this.resolveUser(ctx);
      if (!user) {
        return;
      }
      const recent = await this.debtService.getRecentPeople(user);
      await ctx.reply("За кого платили? Введите имя.");
      if (recent.length > 0) {
        await replyWithMarkup(
          ctx,
          "Недавние:",
          buildPeopleKeyboard(recent, "op_split_who").reply_markup,
        );
      }
      return;
    }

    if (state.step === "split_person") {
      await this.finishSplit(ctx, userId, state, text);
      return;
    }

    if (state.step === "quick_category") {
      // A new line while the buttons are open replaces the pending one.
      this.dialogStateService.clear(userId);
      if (!(await this.handleQuickInput(ctx, userId, text))) {
        await ctx.reply("Выберите категорию кнопкой выше или нажмите «Отмена».");
        this.dialogStateService.set(userId, state);
      }
      return;
    }

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
      const operation = await this.operationService.createOperation({
        user,
        category,
        type: state.type,
        amount: state.amount,
        comment,
      });

      this.dialogStateService.clear(userId);
      const typeLabel = formatOperationTypeLabel(state.type);
      const savedText = `${typeLabel} сохранен: ${state.amount.toFixed(2)} — ${category.displayName}`;
      if (state.type === CategoryType.EXPENSE) {
        await replyWithMarkup(
          ctx,
          savedText,
          Markup.inlineKeyboard([
            [Markup.button.callback("👥 Часть за другого", `op_split:${operation.id}`)],
          ]).reply_markup,
        );
      } else {
        await ctx.reply(savedText);
      }
      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getFinanceMenuKeyboard().reply_markup,
      );
    }
  }

  async handleCategorySelected(ctx: BotContext, userId: string, categoryCode: string) {
    const state = this.dialogStateService.get(userId);
    if (state?.flow === "operation" && state.step === "quick_category") {
      await this.finishQuickCategory(ctx, userId, state, categoryCode);
      return;
    }

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

  /**
   * One-line input ("500 кофе", "+50000 работа"). Returns false when the text is not an
   * operation (no amount at its edge), so the caller can handle it as unknown text.
   */
  async handleQuickInput(ctx: BotContext, userId: string, text: string): Promise<boolean> {
    const [expense, income] = await Promise.all([
      this.categoryService.getCategoriesByType(CategoryType.EXPENSE),
      this.categoryService.getCategoriesByType(CategoryType.INCOME),
    ]);
    const parsed = parseQuickInput(text, {
      [CategoryType.EXPENSE]: expense,
      [CategoryType.INCOME]: income,
    });
    if (!parsed) {
      return false;
    }
    if (!parsed.ok) {
      await ctx.reply("Сумма должна быть больше нуля и не больше 9 999 999 999.");
      return true;
    }

    const user = await this.resolveUser(ctx);
    if (!user) {
      return true;
    }

    const categories = parsed.type === CategoryType.INCOME ? income : expense;
    let category = categories.find((item) => item.code === parsed.categoryCode) ?? null;
    let fromKeywords = false;
    if (!category) {
      category = await this.categoryKeywordService.findCategory(user, parsed.type, parsed.comment);
      fromKeywords = category !== null;
    }

    if (!category) {
      this.dialogStateService.set(userId, {
        flow: "operation",
        step: "quick_category",
        type: parsed.type,
        amount: parsed.amount,
        comment: parsed.comment,
      });
      const keyboard =
        parsed.type === CategoryType.INCOME
          ? buildIncomeCategoriesKeyboard(categories)
          : buildExpenseCategoriesKeyboard(categories);
      const comment = parsed.comment ? ` · ${parsed.comment}` : "";
      await replyWithMarkup(
        ctx,
        `${formatOperationTypeLabel(parsed.type)} ${formatDebtAmount(parsed.amount)}${comment}\nВыберите категорию:`,
        keyboard.reply_markup,
      );
      return true;
    }

    await this.saveQuickOperation(ctx, user, {
      type: parsed.type,
      amount: parsed.amount,
      comment: parsed.comment,
      category,
      fromKeywords,
    });
    return true;
  }

  private async finishQuickCategory(
    ctx: BotContext,
    userId: string,
    state: Extract<OperationDialogState, { step: "quick_category" }>,
    categoryCode: string,
  ) {
    const category = await this.categoryService.getByCode(state.type, categoryCode);
    if (!category) {
      await ctx.answerCbQuery("Категория не найдена.");
      return;
    }

    // Claim the step before writing: a second tap on a button finds no dialog and is rejected.
    this.dialogStateService.clear(userId);
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    await ctx.answerCbQuery();
    await this.saveQuickOperation(ctx, user, {
      type: state.type,
      amount: state.amount,
      comment: state.comment,
      category,
      fromKeywords: false,
    });
  }

  private async saveQuickOperation(
    ctx: BotContext,
    user: UserEntity,
    data: {
      type: CategoryType;
      amount: number;
      comment: string | null;
      category: CategoryEntity;
      fromKeywords: boolean;
    },
  ) {
    const operation = await this.operationService.createOperation({
      user,
      category: data.category,
      type: data.type,
      amount: data.amount,
      comment: data.comment,
    });

    try {
      await this.categoryKeywordService.remember(user, data.category, data.comment);
    } catch (error) {
      // The operation is saved; a failed hint must not turn that into an error for the user.
      this.logger.warn(`Failed to remember category keywords: ${String(error)}`);
    }

    const id = operation.id;
    const rows = [
      [
        Markup.button.callback("✏️ Изменить", `op_edit:${id}`),
        Markup.button.callback("↩️ Отменить", `op_undo:${id}`),
      ],
      ...(data.fromKeywords
        ? [[Markup.button.callback("🏷 Не та категория?", `op_e_cat:${id}`)]]
        : []),
      ...(data.type === CategoryType.EXPENSE
        ? [[Markup.button.callback("👥 Часть за другого", `op_split:${id}`)]]
        : []),
    ];
    const lines = [
      `✅ ${formatOperationTypeLabel(data.type)}: ${formatDebtAmount(data.amount)} — ${data.category.displayName}`,
      data.comment ? `💬 ${data.comment}` : null,
    ].filter((line): line is string => line !== null);
    await replyWithMarkup(ctx, lines.join("\n"), Markup.inlineKeyboard(rows).reply_markup);
  }

  /** "👥 Часть за другого" under a saved expense: asks how much of it was for someone else. */
  async startSplit(ctx: BotContext, userId: string, operationId: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const operation = await this.operationService.findOwned(user, operationId);
    if (!operation || operation.type !== CategoryType.EXPENSE) {
      await ctx.answerCbQuery("Операция не найдена.");
      return;
    }
    this.dialogStateService.set(userId, {
      flow: "operation",
      step: "split_amount",
      operationId,
      total: operation.amount,
    });
    await ctx.answerCbQuery();
    await replyWithMarkup(
      ctx,
      `В расходе сейчас ${formatDebtAmount(operation.amount)}. Сколько из этого ушло на другого?`,
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async handleSplitPersonPicked(ctx: BotContext, userId: string, ref: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "operation" || state.step !== "split_person") {
      await ctx.answerCbQuery("Сначала нажмите «Часть за другого» под расходом.");
      return;
    }

    // Claim the step right away: a second tap on a person button then finds no dialog and is
    // rejected, so the same split cannot be written twice.
    this.dialogStateService.clear(userId);

    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }
    const recent = await this.debtService.getRecentPeople(user, 20);
    const picked = recent.find((item) => personRef(item.personKey) === ref);
    if (!picked) {
      this.dialogStateService.set(userId, state);
      await ctx.answerCbQuery("Человек не найден.");
      return;
    }

    await ctx.answerCbQuery();
    await this.finishSplit(ctx, userId, state, picked.person);
  }

  private async finishSplit(
    ctx: BotContext,
    userId: string,
    state: Extract<OperationDialogState, { step: "split_person" }>,
    person: string,
  ) {
    const personError = validatePerson(person);
    if (personError) {
      await ctx.reply(PERSON_ERRORS[personError]);
      return;
    }

    this.dialogStateService.clear(userId);

    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const result = await this.debtService.splitOperation(
      user,
      state.operationId,
      state.shared,
      person,
    );

    if (!result.split) {
      await ctx.reply(SPLIT_ERRORS[result.reason]);
    } else {
      const operation = await this.operationService.findOwned(user, state.operationId);
      const { person: personName, personKey } = normalizePerson(person);
      const balance = await this.debtService.getBalance(user, personKey);
      await replyWithMarkup(
        ctx,
        [
          `✅ В расходе осталась твоя доля: ${formatDebtAmount(operation?.amount ?? 0)}.`,
          `👤 ${personName}: ${formatBalance(balance)} (за него ${formatDebtAmount(result.amount)}).`,
        ].join("\n"),
        Markup.inlineKeyboard([
          [Markup.button.callback("👥 Ещё за кого-то", `op_split:${state.operationId}`)],
        ]).reply_markup,
      );
    }

    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getFinanceMenuKeyboard().reply_markup,
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
