import { ConfigService } from "@nestjs/config";
import { Action, Command, Ctx, On, Start, Update } from "nestjs-telegraf";
import type {
  InlineKeyboardMarkup,
  Message,
  ReplyKeyboardMarkup,
  Update as TgUpdate,
} from "@telegraf/types";
import { Context } from "telegraf";
import { CategoryService } from "../category/category.service";
import { CategoryType } from "../category/category-type.enum";
import { OperationService } from "../operation/operation.service";
import { UserService } from "../user/user.service";
import { buildExpenseCategoriesKeyboard } from "./keyboards/expense-categories.keyboard";
import { buildIncomeCategoriesKeyboard } from "./keyboards/income-categories.keyboard";
import { DialogStateService } from "./state/dialog-state.service";
import { TelegramUser } from "./types/telegram-user";
import { TelegramService } from "./telegram.service";
import { MAIN_MENU_BUTTONS } from "./keyboards/main-menu.keyboard";

type BotContext = Context<TgUpdate>;

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
  private readonly userService: UserService;

  constructor(
    configService: ConfigService,
    telegramService: TelegramService,
    dialogStateService: DialogStateService,
    categoryService: CategoryService,
    operationService: OperationService,
    userService: UserService,
  ) {
    this.configService = configService;
    this.telegramService = telegramService;
    this.dialogStateService = dialogStateService;
    this.categoryService = categoryService;
    this.operationService = operationService;
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

    this.dialogStateService.set(userId, { step: "amount", type: CategoryType.INCOME });
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

    this.dialogStateService.set(userId, { step: "amount", type: CategoryType.EXPENSE });
    await ctx.reply("Введите сумму расхода.");
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

    if (!state) {
      await this.handleMenuText(ctx, text);
      return;
    }

    if (state.step === "amount") {
      const amount = this.parseAmount(text);
      if (!amount) {
        await ctx.reply("Введите сумму числом. Пример: 1250 или 1250.50");
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
    if (!state || state.step !== "category") {
      await ctx.answerCbQuery("Сначала введите сумму.");
      return;
    }

    const data = getCallbackData(ctx);
    const categoryCode = data?.split(":")[1];
    if (!categoryCode) {
      await ctx.answerCbQuery("Не удалось определить категорию.");
      return;
    }

    this.dialogStateService.update(userId, { categoryCode, step: "comment" });
    await ctx.answerCbQuery();
    await ctx.reply("Введите комментарий или '-' без комментария.");
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
        await ctx.reply("Команда /stats пока не реализована.");
        break;
      case MAIN_MENU_BUTTONS.rating:
        await ctx.reply("Команда /rating пока не реализована.");
        break;
      case MAIN_MENU_BUTTONS.last:
        await ctx.reply("Команда /last пока не реализована.");
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
}
