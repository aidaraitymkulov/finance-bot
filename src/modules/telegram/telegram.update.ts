import { ConfigService } from "@nestjs/config";
import { Action, Command, Ctx, On, Start, Update } from "nestjs-telegraf";
import type {
  InlineKeyboardMarkup,
  Message,
  ReplyKeyboardMarkup,
  Update as TgUpdate,
} from "@telegraf/types";
import { Context, Markup } from "telegraf";
import { CategoryService } from "../category/category.service";
import { CategoryType } from "../category/category-type.enum";
import { OperationService } from "../operation/operation.service";
import { UserService } from "../user/user.service";
import { buildExpenseCategoriesKeyboard } from "./keyboards/expense-categories.keyboard";
import { buildIncomeCategoriesKeyboard } from "./keyboards/income-categories.keyboard";
import { buildPeriodSelectKeyboard } from "./keyboards/period-select.keyboard";
import { DialogStateService } from "./state/dialog-state.service";
import { DialogState } from "./state/dialog-state.types";
import { TelegramUser } from "./types/telegram-user";
import { TelegramService } from "./telegram.service";
import { MAIN_MENU_BUTTONS } from "./keyboards/main-menu.keyboard";
import { ReportService } from "../report/report.service";
import { PeriodType } from "../../common/types/period.type";
import {
  buildCurrentMonthRange,
  buildCustomRange,
  buildLast7DaysRange,
  buildTodayRange,
} from "../../common/utils/data-range.util";
import { UserEntity } from "../user/user.entity";

type BotContext = Context<TgUpdate>;
const LAST_PAGE_SIZE = 10;

const isTextMessage = (message?: Message): message is Message.TextMessage =>
  Boolean(message && "text" in message);

const getCallbackData = (ctx: BotContext): string | null => {
  const query = ctx.callbackQuery;
  if (!query || !("data" in query)) {
    return null;
  }
  return query.data ?? null;
};

@Update()
export class TelegramUpdate {
  private readonly allowedUserId?: number;
  private readonly configService: ConfigService;
  private readonly telegramService: TelegramService;
  private readonly dialogStateService: DialogStateService;
  private readonly categoryService: CategoryService;
  private readonly operationService: OperationService;
  private readonly reportService: ReportService;
  private readonly userService: UserService;

  constructor(
    configService: ConfigService,
    telegramService: TelegramService,
    dialogStateService: DialogStateService,
    categoryService: CategoryService,
    operationService: OperationService,
    reportService: ReportService,
    userService: UserService,
  ) {
    this.configService = configService;
    this.telegramService = telegramService;
    this.dialogStateService = dialogStateService;
    this.categoryService = categoryService;
    this.operationService = operationService;
    this.reportService = reportService;
    this.userService = userService;

    const telegram = this.configService.get<{ allowedUserId?: number }>("telegram");
    this.allowedUserId = telegram?.allowedUserId;
  }

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    await ctx.reply(this.telegramService.getStartMessage());
    await this.replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }

  @Command("income")
  async onIncome(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "operation",
      step: "amount",
      type: CategoryType.INCOME,
    });
    await ctx.reply("Введите сумму дохода.");
  }

  @Command("expense")
  async onExpense(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "operation",
      step: "amount",
      type: CategoryType.EXPENSE,
    });
    await ctx.reply("Введите сумму расхода.");
  }

  @Command("stats")
  async onStats(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    this.dialogStateService.set(userId, { flow: "stats", step: "stats_period" });
    await this.replyWithMarkup(
      ctx,
      "Выберите период для статистики:",
      buildPeriodSelectKeyboard().reply_markup,
    );
  }

  @Command("last")
  async onLast(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const telegramUser = this.getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    await this.sendLastOperations(ctx, user, 0);

    await this.replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }

  @Command("cancel")
  async onCancel(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    await this.cancelDialog(ctx, userId);
  }

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      return;
    }

    const state = this.dialogStateService.get(userId);
    if (!isTextMessage(ctx.message)) {
      return;
    }

    const text = ctx.message.text.trim();
    if (!text) {
      return;
    }

    if (text === MAIN_MENU_BUTTONS.cancel) {
      await this.cancelDialog(ctx, userId);
      return;
    }

    if (!state) {
      await this.handleMenuText(ctx, text);
      return;
    }

    if (state.flow === "stats") {
      await this.handleStatsText(ctx, userId, text, state.step);
      return;
    }

    if (state.step === "amount") {
      const amount = this.parseAmount(text);
      if (!amount) {
        await ctx.reply("Введите сумму числом. Пример: 1250 или 1250.50");
        return;
      }

      if (!state.type) {
        await ctx.reply("Не удалось определить тип операции.");
        this.dialogStateService.clear(userId);
        return;
      }

      this.dialogStateService.update(userId, { amount, step: "category" });
      const categories = await this.categoryService.getCategoriesByType(state.type);
      const keyboard =
        state.type === CategoryType.INCOME
          ? buildIncomeCategoriesKeyboard(categories)
          : buildExpenseCategoriesKeyboard(categories);
      await this.replyWithMarkup(ctx, "Выберите категорию:", keyboard.reply_markup);
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

      const telegramUser = this.getTelegramUser(ctx);
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
      const typeLabel = state.type === CategoryType.INCOME ? "Доход" : "Расход";
      await ctx.reply(
        `${typeLabel} сохранен: ${state.amount.toFixed(2)} — ${category.displayName}`,
      );
      await this.replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
    }
  }

  @Action(/category:(.+)/)
  async onCategorySelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      return;
    }

    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "operation" || state.step !== "category") {
      await ctx.answerCbQuery("Сначала введите сумму.");
      return;
    }

    const data = getCallbackData(ctx);
    const categoryCode = data?.split(":")[1];
    if (!categoryCode) {
      await ctx.answerCbQuery("Не удалось определить категорию.");
      return;
    }

    if (!state.type) {
      await ctx.answerCbQuery("Не удалось определить тип операции.");
      this.dialogStateService.clear(userId);
      return;
    }

    this.dialogStateService.update(userId, { categoryCode, step: "comment" });
    await ctx.answerCbQuery();
    await ctx.reply("Введите комментарий или '-' без комментария.");
  }

  @Action(/stats_period:(.+)/)
  async onStatsPeriodSelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = this.getUserId(ctx);
    if (!userId) {
      return;
    }

    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "stats") {
      await ctx.answerCbQuery("Сначала выберите статистику.");
      return;
    }

    const data = getCallbackData(ctx);
    const periodType = data?.split(":")[1] as PeriodType | undefined;
    if (!periodType) {
      await ctx.answerCbQuery("Не удалось определить период.");
      return;
    }

    if (periodType === "custom") {
      this.dialogStateService.update(userId, { step: "stats_custom_period" });
      await ctx.answerCbQuery();
      await ctx.reply("Введите период в формате YYYY-MM-DD YYYY-MM-DD.");
      return;
    }

    await ctx.answerCbQuery();
    await this.sendSummaryForPeriod(ctx, userId, periodType);
  }

  @Action(/last_more:(\d+)/)
  async onLastMore(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const telegramUser = this.getTelegramUser(ctx);
    if (!telegramUser) {
      return;
    }

    const data = getCallbackData(ctx);
    const offsetRaw = data?.split(":")[1];
    const offset = offsetRaw ? Number(offsetRaw) : NaN;
    if (!Number.isFinite(offset) || offset < 0) {
      await ctx.answerCbQuery("Не удалось определить страницу.");
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    await ctx.answerCbQuery();
    await this.sendLastOperations(ctx, user, offset);
  }

  private async ensureAllowed(ctx: BotContext) {
    if (!this.allowedUserId) {
      return true;
    }

    const fromId = ctx.from?.id;
    if (fromId === this.allowedUserId) {
      return true;
    }

    await ctx.reply("Доступ запрещен.");
    return false;
  }

  private parseAmount(input: string): number | null {
    const normalized = input.replace(/\s+/g, "").replace(",", ".");
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    return Math.round(amount * 100) / 100;
  }

  private getUserId(ctx: BotContext): string | null {
    return ctx.from?.id ? String(ctx.from.id) : null;
  }

  private getTelegramUser(ctx: BotContext): TelegramUser | null {
    const from = ctx.from;
    if (!from) {
      return null;
    }

    return {
      id: String(from.id),
      userName: from.username ?? "",
      firstName: from.first_name ?? "",
      lastName: from.last_name ?? "",
    };
  }

  private async handleMenuText(ctx: BotContext, text: string) {
    switch (text) {
      case MAIN_MENU_BUTTONS.income:
        await this.onIncome(ctx);
        break;
      case MAIN_MENU_BUTTONS.expense:
        await this.onExpense(ctx);
        break;
      case MAIN_MENU_BUTTONS.stats:
        await this.onStats(ctx);
        break;
      case MAIN_MENU_BUTTONS.rating:
        await ctx.reply("Команда /rating пока не реализована.");
        break;
      case MAIN_MENU_BUTTONS.last:
        await this.onLast(ctx);
        break;
      case MAIN_MENU_BUTTONS.cancel:
        await this.cancelDialog(ctx, this.getUserId(ctx) ?? "");
        break;
      default:
        await ctx.reply("Не понял команду. Используйте меню кнопок.");
        await this.replyWithMarkup(
          ctx,
          "Выберите действие:",
          this.telegramService.getMainMenuKeyboard().reply_markup,
        );
    }
  }

  private async replyWithMarkup(
    ctx: BotContext,
    text: string,
    replyMarkup: InlineKeyboardMarkup | ReplyKeyboardMarkup,
  ) {
    await ctx.reply(text, { reply_markup: replyMarkup });
  }

  private async handleStatsText(
    ctx: BotContext,
    userId: string,
    text: string,
    step: DialogState["step"],
  ) {
    if (step !== "stats_custom_period") {
      await ctx.reply("Сначала выберите период.");
      return;
    }

    const range = this.parseCustomDateRange(text);
    if (!range) {
      await ctx.reply("Неверный формат. Пример: 2025-01-01 2025-01-31");
      return;
    }

    await this.sendSummary(ctx, userId, range.start, range.end, range.days);
  }

  private async sendSummaryForPeriod(ctx: BotContext, userId: string, period: PeriodType) {
    switch (period) {
      case "today": {
        const range = buildTodayRange();
        await this.sendSummary(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "last7": {
        const range = buildLast7DaysRange();
        await this.sendSummary(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "month": {
        const range = buildCurrentMonthRange();
        await this.sendSummary(ctx, userId, range.start, range.end, range.days);
        return;
      }
      default:
        await ctx.reply("Не удалось определить период.");
    }
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
      const date = this.formatDateTime(operation.createdAt);
      const typeLabel = operation.type === CategoryType.INCOME ? "Доход" : "Расход";
      return `${date} • ${typeLabel} • ${operation.category.displayName} • ${operation.amount.toFixed(
        2,
      )}`;
    });

    const message = ["Последние операции:", ...lines].join("\n");

    if (hasMore) {
      const nextOffset = offset + items.length;
      await this.replyWithMarkup(ctx, message, this.buildLastMoreKeyboard(nextOffset).reply_markup);
      return;
    }

    await ctx.reply(message);
  }

  private buildLastMoreKeyboard(nextOffset: number) {
    return Markup.inlineKeyboard([
      Markup.button.callback("Показать еще", `last_more:${nextOffset}`),
    ]);
  }

  private async sendSummary(ctx: BotContext, userId: string, start: Date, end: Date, days: number) {
    const telegramUser = this.getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    const summary = await this.reportService.getSummary(user, { start, end, days });

    const message = [
      `Период: ${this.formatDate(start)} — ${this.formatDate(end)}`,
      `Доход: ${summary.income.toFixed(2)}`,
      `Расход: ${summary.expense.toFixed(2)}`,
      `Баланс: ${summary.balance.toFixed(2)}`,
      `Средний доход в день: ${summary.avgIncomePerDay.toFixed(2)}`,
      `Средний расход в день: ${summary.avgExpensePerDay.toFixed(2)}`,
    ].join("\n");

    this.dialogStateService.clear(userId);
    await ctx.reply(message);
    await this.replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }

  private parseCustomDateRange(input: string): { start: Date; end: Date; days: number } | null {
    const parts = input.split(/\s+-\s+|\s+/).filter(Boolean);
    if (parts.length !== 2) {
      return null;
    }

    const start = this.parseDate(parts[0]);
    const end = this.parseDate(parts[1]);
    if (!start || !end || end < start) {
      return null;
    }

    return buildCustomRange(start, end);
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatDateTime(date: Date): string {
    const base = this.formatDate(date);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${base} ${hours}:${minutes}`;
  }

  private async cancelDialog(ctx: BotContext, userId: string) {
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const state = this.dialogStateService.get(userId);
    if (state) {
      this.dialogStateService.clear(userId);
      await ctx.reply("Операция отменена.");
    } else {
      await ctx.reply("Активной операции нет.");
    }

    await this.replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }
}
