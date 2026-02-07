import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { Action, Command, Ctx, On, Start, Update } from "nestjs-telegraf";
import { CategoryType } from "../category/category-type.enum";
import { PeriodType } from "../../common/types/period.type";
import { MAIN_MENU_BUTTONS } from "./keyboards/main-menu.keyboard";
import { DialogStateService } from "./state/dialog-state.service";
import { BotPauseService } from "./state/bot-pause.service";
import { HelpFlow } from "./flows/help.flow";
import { LastFlow } from "./flows/last.flow";
import { OperationFlow } from "./flows/operation.flow";
import { RatingFlow } from "./flows/rating.flow";
import { StatsFlow } from "./flows/stats.flow";
import { CategoryManageFlow } from "./flows/category-manage.flow";
import { TelegramService } from "./telegram.service";
import {
  BotContext,
  getCallbackData,
  getUserId,
  isTextMessage,
  replyWithMarkup,
} from "./telegram.helpers";

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);
  private readonly allowedUserId?: number;
  private readonly configService: ConfigService;
  private readonly telegramService: TelegramService;
  private readonly dialogStateService: DialogStateService;
  private readonly botPauseService: BotPauseService;
  private readonly operationFlow: OperationFlow;
  private readonly statsFlow: StatsFlow;
  private readonly ratingFlow: RatingFlow;
  private readonly lastFlow: LastFlow;
  private readonly helpFlow: HelpFlow;
  private readonly categoryManageFlow: CategoryManageFlow;

  constructor(
    configService: ConfigService,
    telegramService: TelegramService,
    dialogStateService: DialogStateService,
    botPauseService: BotPauseService,
    operationFlow: OperationFlow,
    statsFlow: StatsFlow,
    ratingFlow: RatingFlow,
    lastFlow: LastFlow,
    helpFlow: HelpFlow,
    categoryManageFlow: CategoryManageFlow,
  ) {
    this.configService = configService;
    this.telegramService = telegramService;
    this.dialogStateService = dialogStateService;
    this.botPauseService = botPauseService;
    this.operationFlow = operationFlow;
    this.statsFlow = statsFlow;
    this.ratingFlow = ratingFlow;
    this.lastFlow = lastFlow;
    this.helpFlow = helpFlow;
    this.categoryManageFlow = categoryManageFlow;

    const telegram = this.configService.get<{ allowedUserId?: number }>("telegram");
    this.allowedUserId = telegram?.allowedUserId;
    this.logger.log(`Allowed Telegram user ID: ${this.allowedUserId ?? "not set"}`);
  }

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx, true);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (userId) {
      this.botPauseService.resume(userId);
      this.dialogStateService.clear(userId);
    }

    await ctx.reply(this.telegramService.getStartMessage());
    await replyWithMarkup(
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

    await this.operationFlow.start(ctx, CategoryType.INCOME);
  }

  @Command("expense")
  async onExpense(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    await this.operationFlow.start(ctx, CategoryType.EXPENSE);
  }

  @Command("stats")
  async onStats(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    await this.statsFlow.start(ctx, userId);
  }

  @Command("rating")
  async onRating(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    await this.ratingFlow.start(ctx, userId);
  }

  @Command("help")
  async onHelp(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    await this.helpFlow.sendHelp(ctx);
  }

  @Command("categories")
  async onCategories(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    await this.categoryManageFlow.start(ctx, userId);
  }

  @Command("last")
  async onLast(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    await this.lastFlow.start(ctx);
  }

  @Command("cancel")
  async onCancel(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    await this.cancelDialog(ctx, userId);
  }

  @Command("disable")
  async onDisable(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    this.dialogStateService.clear(userId);
    this.botPauseService.pause(userId);

    try {
      await ctx.deleteMessage();
    } catch {
      // ignore if Telegram does not allow deleting this message
    }

    await ctx.reply(
      "Бот отключен для этого чата. Нажмите /start на кнопке ниже для возобновления.",
      {
        reply_markup: this.telegramService.getPausedKeyboard().reply_markup,
      },
    );
  }

  @Command("clear")
  async onClear(@Ctx() ctx: BotContext) {
    await this.onDisable(ctx);
  }

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
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
      await this.statsFlow.handleCustomPeriodText(ctx, userId, text, state.step);
      return;
    }

    if (state.flow === "rating") {
      await this.ratingFlow.handleCustomPeriodText(ctx, userId, text);
      return;
    }

    if (state.flow === "category_manage") {
      if (state.step === "category_manage_add_name") {
        await this.categoryManageFlow.handleAddNameText(ctx, userId, text);
        return;
      }
      if (state.step === "category_manage_edit_name") {
        await this.categoryManageFlow.handleEditNameText(ctx, userId, text);
        return;
      }

      await ctx.reply("Выберите действие через кнопки.");
      return;
    }

    await this.operationFlow.handleText(ctx, userId, text, state);
  }

  @Action(/^stats_mode:(.+)$/)
  async onStatsModeSelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const mode = data?.split(":")[1];
    if (!mode) {
      await ctx.answerCbQuery("Не удалось определить режим.");
      return;
    }

    await this.statsFlow.handleModeSelected(ctx, userId, mode);
  }

  @Action(/^stats_type:(.+)$/)
  async onStatsTypeSelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const type = data?.split(":")[1];
    if (!type) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    await this.statsFlow.handleTypeSelected(ctx, userId, type);
  }

  @Action(/^stats_category:(.+)$/)
  async onStatsCategorySelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const categoryCode = data?.split(":")[1];
    if (!categoryCode) {
      await ctx.answerCbQuery("Не удалось определить категорию.");
      return;
    }

    await this.statsFlow.handleCategorySelected(ctx, userId, categoryCode);
  }

  @Action(/^stats_period:(.+)$/)
  async onStatsPeriodSelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const periodType = data?.split(":")[1] as PeriodType | undefined;
    if (!periodType) {
      await ctx.answerCbQuery("Не удалось определить период.");
      return;
    }

    await this.statsFlow.handlePeriodSelected(ctx, userId, periodType);
  }

  @Action(/^stats_category_period:(.+)$/)
  async onStatsCategoryPeriodSelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const periodType = data?.split(":")[1] as PeriodType | undefined;
    if (!periodType) {
      await ctx.answerCbQuery("Не удалось определить период.");
      return;
    }

    await this.statsFlow.handleCategoryPeriodSelected(ctx, userId, periodType);
  }

  @Action(/^category_manage:(add|edit|delete|view)$/)
  async onCategoryManageAction(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const action = data?.split(":")[1];
    if (!action) {
      await ctx.answerCbQuery("Не удалось определить действие.");
      return;
    }

    await this.categoryManageFlow.handleActionSelected(ctx, userId, action);
  }

  @Action(/^category_manage_add_type:(.+)$/)
  async onCategoryManageAddType(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const type = data?.split(":")[1];
    if (!type) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    await this.categoryManageFlow.handleAddTypeSelected(ctx, userId, type);
  }

  @Action(/^category_manage_delete_type:(.+)$/)
  async onCategoryManageDeleteType(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const type = data?.split(":")[1];
    if (!type) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    await this.categoryManageFlow.handleDeleteTypeSelected(ctx, userId, type);
  }

  @Action(/^category_manage_edit_type:(.+)$/)
  async onCategoryManageEditType(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const type = data?.split(":")[1];
    if (!type) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    await this.categoryManageFlow.handleEditTypeSelected(ctx, userId, type);
  }

  @Action(/^category_manage_delete:(.+)$/)
  async onCategoryManageDelete(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const categoryCode = data?.split(":")[1];
    if (!categoryCode) {
      await ctx.answerCbQuery("Не удалось определить категорию.");
      return;
    }

    await this.categoryManageFlow.handleDeleteSelected(ctx, userId, categoryCode);
  }

  @Action(/^category_manage_edit:(.+)$/)
  async onCategoryManageEdit(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const categoryCode = data?.split(":")[1];
    if (!categoryCode) {
      await ctx.answerCbQuery("Не удалось определить категорию.");
      return;
    }

    await this.categoryManageFlow.handleEditSelected(ctx, userId, categoryCode);
  }

  @Action(/^rating_period:(.+)$/)
  async onRatingPeriodSelected(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    const data = getCallbackData(ctx);
    const periodType = data?.split(":")[1] as PeriodType | undefined;
    if (!periodType) {
      await ctx.answerCbQuery("Не удалось определить период.");
      return;
    }

    await this.ratingFlow.handlePeriodSelected(ctx, userId, periodType);
  }

  @Action(/^last_more:(\d+)$/)
  async onLastMore(@Ctx() ctx: BotContext) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    const data = getCallbackData(ctx);
    const offsetRaw = data?.split(":")[1];
    const offset = offsetRaw ? Number(offsetRaw) : NaN;
    if (!Number.isFinite(offset) || offset < 0) {
      await ctx.answerCbQuery("Не удалось определить страницу.");
      return;
    }

    await this.lastFlow.handleMore(ctx, offset);
  }

  private async ensureAllowed(ctx: BotContext, ignorePause = false) {
    const userId = getUserId(ctx);

    if (!this.allowedUserId) {
      if (!ignorePause && userId && this.botPauseService.isPaused(userId)) {
        await ctx.reply("Бот отключен. Нажмите /start на кнопке ниже.", {
          reply_markup: this.telegramService.getPausedKeyboard().reply_markup,
        });
        return false;
      }
      return true;
    }

    const fromId = ctx.from?.id;
    if (fromId !== this.allowedUserId) {
      await ctx.reply("Доступ запрещен.");
      return false;
    }

    if (!ignorePause && userId && this.botPauseService.isPaused(userId)) {
      await ctx.reply("Бот отключен. Нажмите /start на кнопке ниже.", {
        reply_markup: this.telegramService.getPausedKeyboard().reply_markup,
      });
      return false;
    }

    return true;
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
        await this.onRating(ctx);
        break;
      case MAIN_MENU_BUTTONS.categories:
        await this.onCategories(ctx);
        break;
      case MAIN_MENU_BUTTONS.last:
        await this.onLast(ctx);
        break;
      case MAIN_MENU_BUTTONS.help:
        await this.onHelp(ctx);
        break;
      case MAIN_MENU_BUTTONS.disable:
        await this.onDisable(ctx);
        break;
      case MAIN_MENU_BUTTONS.cancel:
        await this.cancelDialog(ctx, getUserId(ctx) ?? "");
        break;
      default:
        await ctx.reply("Не понял команду. Используйте меню кнопок.");
        await replyWithMarkup(
          ctx,
          "Выберите действие:",
          this.telegramService.getMainMenuKeyboard().reply_markup,
        );
    }
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

    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }
}
