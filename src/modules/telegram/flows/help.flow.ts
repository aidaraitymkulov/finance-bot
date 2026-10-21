import { Injectable } from "@nestjs/common";
import { TelegramService } from "../telegram.service";
import { replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

@Injectable()
export class HelpFlow {
  constructor(private readonly telegramService: TelegramService) {}

  async sendHelp(ctx: BotContext) {
    const message = [
      "Доступные команды:",
      "",
      "✅ Задачи",
      "/today — задачи на сегодня (и просроченные)",
      "/tasks — задачи на неделю",
      "",
      "🔥 Привычки",
      "/habits — мои привычки и серии",
      "",
      "💰 Финансы",
      "/income — добавить доход",
      "/expense — добавить расход",
      "/stats — сводка или статистика по категории",
      "/rating — рейтинг расходов по категориям",
      "/categories — управление категориями",
      "/last — последние операции",
      "/excel — отчёт в Excel",
      "",
      "/disable — отключить бота до /start",
      "/cancel — отменить текущую операцию",
      "/help — эта справка",
      "",
      "Каждый день в 09:00 придёт план на день, в 22:00 — опрос по привычкам.",
    ].join("\n");

    await ctx.reply(message);
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getMainMenuKeyboard().reply_markup,
    );
  }
}
