import { Injectable } from "@nestjs/common";
import { ReportService } from "../../report/report.service";
import { ExcelService } from "../../report/excel.service";
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
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import { parseCustomDateRange } from "../telegram.parsers";
import type { BotContext } from "../telegram.helpers";
import { formatDate } from "../telegram.formatter";

@Injectable()
export class ExcelFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly reportService: ReportService,
    private readonly excelService: ExcelService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async start(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, { flow: "excel", step: "excel_period" });
    await replyWithMarkup(
      ctx,
      "Генерация отчёта Excel запущена. Для выхода используйте ❌ Отмена.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
    await replyWithMarkup(
      ctx,
      "Выберите период для отчёта:",
      buildPeriodSelectKeyboard("excel").reply_markup,
    );
  }

  async handleCustomPeriodText(ctx: BotContext, userId: string, text: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "excel" || state.step !== "excel_custom_period") {
      await ctx.reply("Сначала выберите период.");
      return;
    }

    const range = parseCustomDateRange(text);
    if (!range) {
      await ctx.reply("Неверный формат. Пример: 2025-01-01 2025-01-31");
      return;
    }

    await this.generateAndSendReport(ctx, userId, range.start, range.end, range.days);
  }

  async handlePeriodSelected(ctx: BotContext, userId: string, periodType: PeriodType) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "excel") {
      await ctx.answerCbQuery("Сначала выберите генерацию отчёта.");
      return;
    }

    if (periodType === "custom") {
      this.dialogStateService.set(userId, { flow: "excel", step: "excel_custom_period" });
      await ctx.answerCbQuery();
      await ctx.reply("Введите период в формате YYYY-MM-DD YYYY-MM-DD.");
      return;
    }

    await ctx.answerCbQuery();
    await this.generateReportForPeriod(ctx, userId, periodType);
  }

  private async generateReportForPeriod(ctx: BotContext, userId: string, period: PeriodType) {
    switch (period) {
      case "today": {
        const range = buildTodayRange();
        await this.generateAndSendReport(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "last7": {
        const range = buildLast7DaysRange();
        await this.generateAndSendReport(ctx, userId, range.start, range.end, range.days);
        return;
      }
      case "month": {
        const range = buildCurrentMonthRange();
        await this.generateAndSendReport(ctx, userId, range.start, range.end, range.days);
        return;
      }
      default:
        await ctx.reply("Не удалось определить период.");
    }
  }

  private async generateAndSendReport(
    ctx: BotContext,
    userId: string,
    start: Date,
    end: Date,
    days: number,
  ) {
    const telegramUser = getTelegramUser(ctx);
    if (!telegramUser) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    await ctx.reply("Генерация отчёта, пожалуйста подождите...");

    try {
      const user = await this.userService.findOrCreateByTelegramUser(telegramUser);
      const operations = await this.reportService.getOperationsForExport(user, {
        start,
        end,
        days,
      });
      const summary = await this.reportService.getSummary(user, { start, end, days });

      const buffer = await this.excelService.generateReport(operations, summary, start, end);

      this.dialogStateService.clear(userId);

      const filename = `отчёт_${formatDate(start)}_${formatDate(end)}.xlsx`;

      await ctx.replyWithDocument(
        {
          source: buffer,
          filename,
        },
        {
          caption: `Отчёт за период ${formatDate(start)} — ${formatDate(end)}`,
        },
      );

      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
    } catch (error) {
      this.dialogStateService.clear(userId);
      await ctx.reply("Произошла ошибка при генерации отчёта.");
      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
    }
  }
}
