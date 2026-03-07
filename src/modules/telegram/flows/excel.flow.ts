import { Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import { ReportService } from "../../report/report.service";
import { ExcelService } from "../../report/excel.service";
import { UserService } from "../../user/user.service";
import { buildPeriodSelectKeyboard } from "../keyboards/period-select.keyboard";
import { TelegramService } from "../telegram.service";
import { DialogStateService } from "../state/dialog-state.service";
import { PeriodType } from "../../../common/types/period.type";
import { ExcelReportType } from "../state/dialog-state.types";
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
    this.dialogStateService.set(userId, { flow: "excel", step: "excel_type" });
    await replyWithMarkup(
      ctx,
      "Генерация отчёта Excel запущена. Для выхода используйте ❌ Отмена.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
    await replyWithMarkup(ctx, "Что включить в отчёт?", this.buildExcelTypeKeyboard().reply_markup);
  }

  async handleTypeSelected(ctx: BotContext, userId: string, reportType: ExcelReportType) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "excel" || state.step !== "excel_type") {
      await ctx.answerCbQuery("Сначала выберите тип отчёта.");
      return;
    }

    this.dialogStateService.set(userId, { flow: "excel", step: "excel_period", reportType });
    await ctx.answerCbQuery();
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
      await ctx.reply("Неверный формат. Пример: 01.01.2025 31.01.2025");
      return;
    }

    await this.generateAndSendReport(ctx, userId, state.reportType, range.start, range.end, range.days);
  }

  async handlePeriodSelected(ctx: BotContext, userId: string, periodType: PeriodType) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "excel" || state.step !== "excel_period") {
      await ctx.answerCbQuery("Сначала выберите тип отчёта.");
      return;
    }

    if (periodType === "custom") {
      this.dialogStateService.set(userId, {
        flow: "excel",
        step: "excel_custom_period",
        reportType: state.reportType,
      });
      await ctx.answerCbQuery();
      await ctx.reply("Введите период в формате дд.мм.гггг дд.мм.гггг\nПример: 01.01.2025 31.01.2025");
      return;
    }

    await ctx.answerCbQuery();
    await this.generateReportForPeriod(ctx, userId, state.reportType, periodType);
  }

  private async generateReportForPeriod(
    ctx: BotContext,
    userId: string,
    reportType: ExcelReportType,
    period: PeriodType,
  ) {
    switch (period) {
      case "today": {
        const range = buildTodayRange();
        await this.generateAndSendReport(ctx, userId, reportType, range.start, range.end, range.days);
        return;
      }
      case "last7": {
        const range = buildLast7DaysRange();
        await this.generateAndSendReport(ctx, userId, reportType, range.start, range.end, range.days);
        return;
      }
      case "month": {
        const range = buildCurrentMonthRange();
        await this.generateAndSendReport(ctx, userId, reportType, range.start, range.end, range.days);
        return;
      }
      default:
        await ctx.reply("Не удалось определить период.");
    }
  }

  private async generateAndSendReport(
    ctx: BotContext,
    userId: string,
    reportType: ExcelReportType,
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
      const operations = await this.reportService.getOperationsForExport(user, { start, end, days });

      this.dialogStateService.clear(userId);

      const dateRange = `${formatDate(start)}_${formatDate(end)}`;

      if (reportType === "income" || reportType === "all") {
        const buffer = await this.excelService.generateIncomeReport(operations, start, end);
        await ctx.replyWithDocument(
          { source: buffer, filename: `доходы_${dateRange}.xlsx` },
          { caption: `Доходы за период ${formatDate(start)} — ${formatDate(end)}` },
        );
      }

      if (reportType === "expense" || reportType === "all") {
        const buffer = await this.excelService.generateExpenseReport(operations, start, end);
        await ctx.replyWithDocument(
          { source: buffer, filename: `расходы_${dateRange}.xlsx` },
          { caption: `Расходы за период ${formatDate(start)} — ${formatDate(end)}` },
        );
      }

      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
    } catch {
      this.dialogStateService.clear(userId);
      await ctx.reply("Произошла ошибка при генерации отчёта.");
      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getMainMenuKeyboard().reply_markup,
      );
    }
  }

  private buildExcelTypeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("💰 Только доходы", "excel_type:income")],
      [Markup.button.callback("💸 Только расходы", "excel_type:expense")],
      [Markup.button.callback("📊 Оба файла", "excel_type:all")],
    ]);
  }
}
