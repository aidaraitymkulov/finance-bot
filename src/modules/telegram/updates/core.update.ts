import { Command, Ctx, Next, On, Start, Update } from "nestjs-telegraf";
import { CategoryType } from "../../category/category-type.enum";
import { MAIN_MENU_BUTTONS } from "../keyboards/main-menu.keyboard";
import { FINANCE_MENU_BUTTONS } from "../keyboards/finance-menu.keyboard";
import { HABITS_MENU_BUTTONS } from "../keyboards/habits-menu.keyboard";
import { DialogStateService } from "../state/dialog-state.service";
import { BotPauseService } from "../state/bot-pause.service";
import { HelpFlow } from "../flows/help.flow";
import { LastFlow } from "../flows/last.flow";
import { OperationFlow } from "../flows/operation.flow";
import { RatingFlow } from "../flows/rating.flow";
import { StatsFlow } from "../flows/stats.flow";
import { CategoryManageFlow } from "../flows/category-manage.flow";
import { ExcelFlow } from "../flows/excel.flow";
import { HabitFlow } from "../flows/habit.flow";
import { TelegramService } from "../telegram.service";
import {
  BotContext,
  getUserId,
  isTextMessage,
  replyWithMarkup,
  requireUserId,
} from "../telegram.helpers";

/**
 * Bot-wide commands and the single text router. Telegraf hands a text message to the first
 * matching handler, so there must be exactly one `@On("text")` in the app — it lives here.
 */
@Update()
export class CoreUpdate {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly dialogStateService: DialogStateService,
    private readonly botPauseService: BotPauseService,
    private readonly operationFlow: OperationFlow,
    private readonly statsFlow: StatsFlow,
    private readonly ratingFlow: RatingFlow,
    private readonly lastFlow: LastFlow,
    private readonly helpFlow: HelpFlow,
    private readonly categoryManageFlow: CategoryManageFlow,
    private readonly excelFlow: ExcelFlow,
    private readonly habitFlow: HabitFlow,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    const userId = getUserId(ctx);
    if (userId) {
      this.botPauseService.resume(userId);
      this.dialogStateService.clear(userId);
    }

    await ctx.reply(this.telegramService.getStartMessage());
    await this.showMainMenu(ctx);
  }

  @Command("help")
  async onHelp(@Ctx() ctx: BotContext) {
    await this.helpFlow.sendHelp(ctx);
  }

  @Command("cancel")
  async onCancel(@Ctx() ctx: BotContext) {
    const userId = await requireUserId(ctx);
    if (userId) {
      await this.cancelDialog(ctx, userId);
    }
  }

  @Command("disable")
  async onDisable(@Ctx() ctx: BotContext) {
    const userId = await requireUserId(ctx);
    if (!userId) {
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
  async onText(@Ctx() ctx: BotContext, @Next() next: () => Promise<void>) {
    if (!isTextMessage(ctx.message)) {
      return;
    }

    const text = ctx.message.text.trim();
    if (!text) {
      return;
    }

    // Commands are registered by other @Update classes; let them handle it.
    if (text.startsWith("/")) {
      await next();
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      return;
    }

    if (text === MAIN_MENU_BUTTONS.cancel) {
      await this.cancelDialog(ctx, userId);
      return;
    }

    if (text === MAIN_MENU_BUTTONS.back) {
      this.dialogStateService.clear(userId);
      await this.showMainMenu(ctx);
      return;
    }

    const state = this.dialogStateService.get(userId);
    if (!state) {
      await this.handleMenuText(ctx, userId, text);
      return;
    }

    switch (state.flow) {
      case "stats":
        await this.statsFlow.handleCustomPeriodText(ctx, userId, text, state.step);
        return;
      case "rating":
        await this.ratingFlow.handleCustomPeriodText(ctx, userId, text);
        return;
      case "excel":
        await this.excelFlow.handleCustomPeriodText(ctx, userId, text);
        return;
      case "category_manage":
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
      case "operation":
        await this.operationFlow.handleText(ctx, userId, text, state);
        return;
      case "habit":
        await this.habitFlow.handleText(ctx, userId, text, state);
        return;
    }
  }

  private async handleMenuText(ctx: BotContext, userId: string, text: string) {
    switch (text) {
      case MAIN_MENU_BUTTONS.finance:
        await replyWithMarkup(
          ctx,
          "Раздел «Финансы». Выберите действие:",
          this.telegramService.getFinanceMenuKeyboard().reply_markup,
        );
        return;
      case MAIN_MENU_BUTTONS.habits:
        await this.habitFlow.showMenu(ctx);
        return;
      case MAIN_MENU_BUTTONS.help:
        await this.helpFlow.sendHelp(ctx);
        return;
      case MAIN_MENU_BUTTONS.disable:
        await this.onDisable(ctx);
        return;

      case FINANCE_MENU_BUTTONS.income:
        await this.operationFlow.start(ctx, CategoryType.INCOME);
        return;
      case FINANCE_MENU_BUTTONS.expense:
        await this.operationFlow.start(ctx, CategoryType.EXPENSE);
        return;
      case FINANCE_MENU_BUTTONS.stats:
        await this.statsFlow.start(ctx, userId);
        return;
      case FINANCE_MENU_BUTTONS.rating:
        await this.ratingFlow.start(ctx, userId);
        return;
      case FINANCE_MENU_BUTTONS.categories:
        await this.categoryManageFlow.start(ctx, userId);
        return;
      case FINANCE_MENU_BUTTONS.last:
        await this.lastFlow.start(ctx);
        return;
      case FINANCE_MENU_BUTTONS.excel:
        await this.excelFlow.start(ctx, userId);
        return;

      case HABITS_MENU_BUTTONS.add:
        await this.habitFlow.startAdd(ctx, userId);
        return;
      case HABITS_MENU_BUTTONS.list:
        await this.habitFlow.sendList(ctx);
        return;
      case HABITS_MENU_BUTTONS.check:
        await this.habitFlow.sendCheckPoll(ctx);
        return;

      default:
        await ctx.reply("Не понял команду. Используйте меню кнопок.");
        await this.showMainMenu(ctx);
    }
  }

  private async cancelDialog(ctx: BotContext, userId: string) {
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
      this.telegramService.getMenuKeyboardForFlow(state?.flow).reply_markup,
    );
  }

  private async showMainMenu(ctx: BotContext) {
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }
}
