import { Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import { CategoryService } from "../../category/category.service";
import { CategoryType } from "../../category/category-type.enum";
import { ReportService } from "../../report/report.service";
import { UserService } from "../../user/user.service";
import { buildExpenseCategoriesKeyboard } from "../keyboards/expense-categories.keyboard";
import { buildIncomeCategoriesKeyboard } from "../keyboards/income-categories.keyboard";
import { buildPeriodSelectKeyboard } from "../keyboards/period-select.keyboard";
import { TelegramService } from "../telegram.service";
import { DialogStateService } from "../state/dialog-state.service";
import { StatsDialogState } from "../state/dialog-state.types";
import { PeriodType } from "../../../common/types/period.type";
import {
  buildCurrentMonthRange,
  buildLast7DaysRange,
  buildTodayRange,
} from "../../../common/utils/data-range.util";
import {
  formatCategoryStatsMessage,
  formatSummaryMessage,
} from "../telegram.formatter";
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import { parseCustomDateRange } from "../telegram.parsers";
import type { BotContext } from "../telegram.helpers";

const STATS_CATEGORY_PREFIX = "stats_category";

@Injectable()
export class StatsFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly categoryService: CategoryService,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async start(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, { flow: "stats", step: "stats_mode" });
    await replyWithMarkup(
      ctx,
      "Режим статистики запущен. Для выхода используйте ❌ Отмена.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
    await replyWithMarkup(ctx, "Что показать?", this.buildStatsModeKeyboard().reply_markup);
  }

  async handleCustomPeriodText(
    ctx: BotContext,
    userId: string,
    text: string,
    step: StatsDialogState["step"],
  ) {
    if (step !== "stats_custom_period" && step !== "stats_category_custom_period") {
      await ctx.reply("Сначала выберите вариант через кнопки.");
      return;
    }

    const range = parseCustomDateRange(text);
    if (!range) {
      await ctx.reply("Неверный формат. Пример: 01.01.2025 31.01.2025");
      return;
    }

    if (step === "stats_custom_period") {
      await this.sendSummary(ctx, userId, range.start, range.end, range.days);
      return;
    }

    await this.sendCategoryStats(ctx, userId, range.start, range.end, range.days);
  }

  async handleModeSelected(ctx: BotContext, userId: string, mode: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "stats") {
      await ctx.answerCbQuery("Сначала выберите статистику.");
      return;
    }

    if (mode === "summary") {
      this.dialogStateService.set(userId, { flow: "stats", step: "stats_period" });
      await ctx.answerCbQuery();
      await replyWithMarkup(
        ctx,
        "Выберите период для статистики:",
        buildPeriodSelectKeyboard("stats").reply_markup,
      );
      return;
    }

    if (mode === "category") {
      this.dialogStateService.set(userId, { flow: "stats", step: "stats_category_type" });
      await ctx.answerCbQuery();
      await replyWithMarkup(
        ctx,
        "Выберите тип операций:",
        this.buildStatsTypeKeyboard().reply_markup,
      );
      return;
    }

    await ctx.answerCbQuery("Не удалось определить режим.");
  }

  async handleTypeSelected(ctx: BotContext, userId: string, type: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "stats" || state.step !== "stats_category_type") {
      await ctx.answerCbQuery("Сначала выберите тип операций.");
      return;
    }

    const categoryType = type === "income" ? CategoryType.INCOME : CategoryType.EXPENSE;
    this.dialogStateService.set(userId, {
      flow: "stats",
      step: "stats_category_select",
      type: categoryType,
    });

    const categories = await this.categoryService.getCategoriesByType(categoryType);
    const keyboard =
      categoryType === CategoryType.INCOME
        ? buildIncomeCategoriesKeyboard(categories, STATS_CATEGORY_PREFIX)
        : buildExpenseCategoriesKeyboard(categories, STATS_CATEGORY_PREFIX);

    await ctx.answerCbQuery();
    await replyWithMarkup(ctx, "Выберите категорию:", keyboard.reply_markup);
  }

  async handleCategorySelected(ctx: BotContext, userId: string, categoryCode: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "stats" || state.step !== "stats_category_select") {
      await ctx.answerCbQuery("Сначала выберите категорию.");
      return;
    }

    if (!state.type) {
      await ctx.answerCbQuery("Не удалось определить тип операции.");
      this.dialogStateService.clear(userId);
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "stats",
      step: "stats_category_period",
      type: state.type,
      categoryCode,
    });

    await ctx.answerCbQuery();
    await replyWithMarkup(
      ctx,
      "Выберите период для статистики:",
      buildPeriodSelectKeyboard("stats_category").reply_markup,
    );
  }

  async handlePeriodSelected(ctx: BotContext, userId: string, periodType: PeriodType) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "stats") {
      await ctx.answerCbQuery("Сначала выберите статистику.");
      return;
    }

    if (periodType === "custom") {
      this.dialogStateService.set(userId, { flow: "stats", step: "stats_custom_period" });
      await ctx.answerCbQuery();
      await ctx.reply("Введите период в формате дд.мм.гггг дд.мм.гггг\nПример: 01.01.2025 31.01.2025");
      return;
    }

    await ctx.answerCbQuery();
    await this.sendSummaryForPeriod(ctx, userId, periodType);
  }

  async handleCategoryPeriodSelected(ctx: BotContext, userId: string, periodType: PeriodType) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "stats") {
      await ctx.answerCbQuery("Сначала выберите статистику.");
      return;
    }

    if (periodType === "custom") {
      if (state.step !== "stats_category_period") {
        await ctx.answerCbQuery("Сначала выберите категорию.");
        return;
      }

      this.dialogStateService.set(userId, {
        flow: "stats",
        step: "stats_category_custom_period",
        type: state.type,
        categoryCode: state.categoryCode,
      });
      await ctx.answerCbQuery();
      await ctx.reply("Введите период в формате дд.мм.гггг дд.мм.гггг\nПример: 01.01.2025 31.01.2025");
      return;
    }

    await ctx.answerCbQuery();
    await this.sendCategoryStatsForPeriod(ctx, userId, periodType);
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

  private async sendCategoryStatsForPeriod(ctx: BotContext, userId: string, period: PeriodType) {
    switch (period) {
      case "today": {
        const range = buildTodayRange();
        await this.sendCategoryStats(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "last7": {
        const range = buildLast7DaysRange();
        await this.sendCategoryStats(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "month": {
        const range = buildCurrentMonthRange();
        await this.sendCategoryStats(ctx, userId, range.start, range.end, range.days);
        return;
      }
      default:
        await ctx.reply("Не удалось определить период.");
    }
  }

  private async sendSummary(ctx: BotContext, userId: string, start: Date, end: Date, days: number) {
    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    const summary = await this.reportService.getSummary(user, { start, end, days });

    this.dialogStateService.clear(userId);
    await ctx.reply(formatSummaryMessage(start, end, summary));
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }

  private async sendCategoryStats(
    ctx: BotContext,
    userId: string,
    start: Date,
    end: Date,
    days: number,
  ) {
    const state = this.dialogStateService.get(userId);
    if (
      !state ||
      state.flow !== "stats" ||
      (state.step !== "stats_category_period" && state.step !== "stats_category_custom_period")
    ) {
      await ctx.reply("Сначала выберите категорию.");
      return;
    }

    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const category = await this.categoryService.getByCode(state.type, state.categoryCode);
    if (!category) {
      await ctx.reply("Категория не найдена.");
      this.dialogStateService.clear(userId);
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    const stats = await this.reportService.getCategoryStats(user, category.id, {
      start,
      end,
      days,
    });

    this.dialogStateService.clear(userId);
    await ctx.reply(formatCategoryStatsMessage(start, end, category.displayName, stats));
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }

  private buildStatsModeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("📊 Сводка", "stats_mode:summary")],
      [Markup.button.callback("🧩 По категории", "stats_mode:category")],
    ]);
  }

  private buildStatsTypeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("💰 Доход", "stats_type:income")],
      [Markup.button.callback("💸 Расход", "stats_type:expense")],
    ]);
  }
}
