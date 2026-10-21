import { Injectable } from "@nestjs/common";
import { HabitService } from "../../habit/habit.service";
import { HabitCheckinStatus } from "../../habit/habit-checkin-status.enum";
import { UserService } from "../../user/user.service";
import { UserEntity } from "../../user/user.entity";
import { todayLocalDate } from "../../../common/utils/local-date.util";
import { DialogStateService } from "../state/dialog-state.service";
import { HabitDialogState } from "../state/dialog-state.types";
import { TelegramService } from "../telegram.service";
import {
  buildHabitCheckedText,
  buildHabitListView,
  buildHabitPollView,
} from "../views/habit.views";
import { getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

@Injectable()
export class HabitFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly habitService: HabitService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async showMenu(ctx: BotContext) {
    await replyWithMarkup(
      ctx,
      "Раздел «Привычки». Выберите действие:",
      this.telegramService.getHabitsMenuKeyboard().reply_markup,
    );
  }

  async startAdd(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, { flow: "habit", step: "habit_add_title" });
    await replyWithMarkup(
      ctx,
      "Введите название привычки.\nНапример: Английский 30 минут",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: HabitDialogState) {
    if (state.step !== "habit_add_title") {
      return;
    }

    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const result = await this.habitService.create(user, text);
    if (!result.created || !result.habit) {
      await ctx.reply(
        result.reason === "title_too_long"
          ? "Слишком длинное название (максимум 128 символов). Попробуйте короче."
          : "Название не может быть пустым.",
      );
      return;
    }

    this.dialogStateService.clear(userId);
    await ctx.reply(`Привычка «${result.habit.title}» добавлена. Напомню о ней вечером в 22:00.`);
    await this.showMenu(ctx);
  }

  async sendList(ctx: BotContext) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const view = buildHabitListView(
      await this.habitService.getActiveWithStats(user, todayLocalDate()),
    );
    await ctx.reply(view.text, { reply_markup: view.reply_markup });
  }

  /** Same poll the 22:00 reminder sends, on demand. */
  async sendCheckPoll(ctx: BotContext) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const today = todayLocalDate();
    const [active, unchecked] = await Promise.all([
      this.habitService.getActive(user),
      this.habitService.getUnchecked(user, today),
    ]);

    if (active.length === 0) {
      await ctx.reply("Привычек пока нет. Нажмите «➕ Новая привычка».");
      return;
    }
    if (unchecked.length === 0) {
      await ctx.reply("Все привычки на сегодня уже отмечены 👍");
      return;
    }

    for (const item of unchecked) {
      const view = buildHabitPollView(item);
      await ctx.reply(view.text, { reply_markup: view.reply_markup });
    }
  }

  async handleCheck(ctx: BotContext, habitId: string, action: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const status = action === "done" ? HabitCheckinStatus.DONE : HabitCheckinStatus.SKIPPED;
    const result = await this.habitService.checkIn(user, habitId, todayLocalDate(), status);
    if (!result) {
      await ctx.answerCbQuery("Привычка не найдена.");
      return;
    }

    await ctx.answerCbQuery(status === HabitCheckinStatus.DONE ? "Отлично! 💪" : "Записал.");
    await ctx.editMessageText(buildHabitCheckedText(result));
  }

  async handleDelete(ctx: BotContext, habitId: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const archived = await this.habitService.archive(user, habitId);
    await ctx.answerCbQuery(archived ? "Привычка удалена." : "Привычка не найдена.");

    const view = buildHabitListView(
      await this.habitService.getActiveWithStats(user, todayLocalDate()),
    );
    await ctx.editMessageText(view.text, { reply_markup: view.reply_markup });
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
