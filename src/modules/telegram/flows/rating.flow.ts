import { Injectable } from "@nestjs/common";
import { ReportService } from "../../report/report.service";
import { UserService } from "../../user/user.service";
import { buildPeriodSelectKeyboard } from "../keyboards/period-select.keyboard";
import { TelegramService } from "../telegram.service";
import { DialogStateService } from "../state/dialog-state.service";
import { PeriodType } from "../../../common/types/period.type";
import {
  buildCurrentMonthRange,
  buildLast7DaysRange,
  buildTodayRange,
} from "../../../common/utils/data-range.util";
import { formatRatingMessage } from "../telegram.formatter";
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import { parseCustomDateRange } from "../telegram.parsers";
import type { BotContext } from "../telegram.helpers";

@Injectable()
export class RatingFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly reportService: ReportService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async start(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, { flow: "rating", step: "rating_period" });
    await replyWithMarkup(
      ctx,
      "Режим рейтинга запущен. Для выхода используйте ❌ Отмена.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
    await replyWithMarkup(
      ctx,
      "Выберите период для рейтинга расходов:",
      buildPeriodSelectKeyboard("rating").reply_markup,
    );
  }

  async handleCustomPeriodText(ctx: BotContext, userId: string, text: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "rating" || state.step !== "rating_custom_period") {
      await ctx.reply("Сначала выберите период.");
      return;
    }

    const range = parseCustomDateRange(text);
    if (!range) {
      await ctx.reply("Неверный формат. Пример: 2025-01-01 2025-01-31");
      return;
    }

    await this.sendRating(ctx, userId, range.start, range.end, range.days);
  }

  async handlePeriodSelected(ctx: BotContext, userId: string, periodType: PeriodType) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "rating") {
      await ctx.answerCbQuery("Сначала выберите рейтинг расходов.");
      return;
    }

    if (periodType === "custom") {
      this.dialogStateService.set(userId, { flow: "rating", step: "rating_custom_period" });
      await ctx.answerCbQuery();
      await ctx.reply("Введите период в формате YYYY-MM-DD YYYY-MM-DD.");
      return;
    }

    await ctx.answerCbQuery();
    await this.sendRatingForPeriod(ctx, userId, periodType);
  }

  private async sendRatingForPeriod(ctx: BotContext, userId: string, period: PeriodType) {
    switch (period) {
      case "today": {
        const range = buildTodayRange();
        await this.sendRating(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "last7": {
        const range = buildLast7DaysRange();
        await this.sendRating(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "month": {
        const range = buildCurrentMonthRange();
        await this.sendRating(ctx, userId, range.start, range.end, range.days);
        return;
      }
      default:
        await ctx.reply("Не удалось определить период.");
    }
  }

  private async sendRating(ctx: BotContext, userId: string, start: Date, end: Date, days: number) {
    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
    const rating = await this.reportService.getExpenseRating(user, { start, end, days });

    if (rating.length === 0) {
      this.dialogStateService.clear(userId);
      await ctx.reply("Расходов за период нет.");
      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
      return;
    }

    this.dialogStateService.clear(userId);
    await ctx.reply(formatRatingMessage(start, end, rating));
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }
}
