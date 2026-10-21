import { Injectable } from "@nestjs/common";
import { TaskService } from "../../task/task.service";
import { UserService } from "../../user/user.service";
import { UserEntity } from "../../user/user.entity";
import { addDays, toLocalDateString, todayLocalDate } from "../../../common/utils/local-date.util";
import { DialogStateService } from "../state/dialog-state.service";
import { TaskDialogState } from "../state/dialog-state.types";
import { TelegramService } from "../telegram.service";
import { parseDate } from "../telegram.parsers";
import {
  buildTaskDatePickerKeyboard,
  buildTaskListView,
  formatDayLabel,
  resolveTaskDateKey,
  TaskListMode,
} from "../views/task.views";
import { editMessageSafe, getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

const TITLE_ERRORS: Record<string, string> = {
  empty_title: "Текст задачи не может быть пустым.",
  title_too_long: "Слишком длинная задача (максимум 256 символов). Попробуйте короче.",
};

@Injectable()
export class TaskFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async showMenu(ctx: BotContext) {
    await replyWithMarkup(
      ctx,
      "Раздел «Задачи». Выберите действие:",
      this.telegramService.getTasksMenuKeyboard().reply_markup,
    );
  }

  async startAdd(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, { flow: "task", step: "task_title" });
    await replyWithMarkup(
      ctx,
      "Что нужно сделать?\nНапример: Оплатить интернет",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: TaskDialogState) {
    if (state.step === "task_title") {
      const error = TaskService.validateTitle(text);
      if (error) {
        await ctx.reply(TITLE_ERRORS[error]);
        return;
      }

      this.dialogStateService.set(userId, { flow: "task", step: "task_date", title: text.trim() });
      await replyWithMarkup(
        ctx,
        "На какой день?",
        buildTaskDatePickerKeyboard(todayLocalDate()).reply_markup,
      );
      return;
    }

    if (state.step === "task_date") {
      await ctx.reply("Выберите дату кнопкой выше.");
      return;
    }

    const date = parseDate(text);
    if (!date) {
      await ctx.reply(
        `Неверный формат. Пример: ${toLocalDateString(new Date()).split("-").reverse().join(".")}`,
      );
      return;
    }

    await this.createTask(ctx, userId, state.title, toLocalDateString(date));
  }

  async handleDateSelected(ctx: BotContext, userId: string, key: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "task" || state.step !== "task_date") {
      await ctx.answerCbQuery("Сначала введите текст задачи.");
      return;
    }

    if (key === "custom") {
      this.dialogStateService.set(userId, {
        flow: "task",
        step: "task_custom_date",
        title: state.title,
      });
      await ctx.answerCbQuery();
      await ctx.reply("Введите дату в формате дд.мм.гггг");
      return;
    }

    const date = resolveTaskDateKey(key, todayLocalDate());
    if (!date) {
      await ctx.answerCbQuery("Не удалось определить дату.");
      return;
    }

    await ctx.answerCbQuery();
    await this.createTask(ctx, userId, state.title, date);
  }

  async sendList(ctx: BotContext, mode: TaskListMode) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const view = await this.buildListView(user, mode);
    await ctx.reply(view.text, { reply_markup: view.reply_markup });
  }

  async handleDone(ctx: BotContext, taskId: string, mode: TaskListMode) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const done = await this.taskService.markDone(user, taskId);
    await ctx.answerCbQuery(done ? "Готово ✅" : "Задача уже закрыта.");
    await this.refreshList(ctx, user, mode);
  }

  async handleDelete(ctx: BotContext, taskId: string, mode: TaskListMode) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const deleted = await this.taskService.delete(user, taskId);
    await ctx.answerCbQuery(deleted ? "Задача удалена." : "Задача не найдена.");
    await this.refreshList(ctx, user, mode);
  }

  private async createTask(ctx: BotContext, userId: string, title: string, dueDate: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const result = await this.taskService.create(user, title, dueDate);
    if (!result.created) {
      await ctx.reply(TITLE_ERRORS[result.reason ?? "empty_title"]);
      return;
    }

    this.dialogStateService.clear(userId);
    const overdueNote =
      dueDate < todayLocalDate() ? " (дата уже прошла — задача в просроченных)" : "";
    await ctx.reply(`Задача добавлена на ${formatDayLabel(dueDate)}${overdueNote}:\n${title}`);
    await this.showMenu(ctx);
  }

  private async refreshList(ctx: BotContext, user: UserEntity, mode: TaskListMode) {
    const view = await this.buildListView(user, mode);
    await editMessageSafe(ctx, view.text, view.reply_markup);
  }

  private async buildListView(user: UserEntity, mode: TaskListMode) {
    const today = todayLocalDate();
    const until = mode === "today" ? today : addDays(today, 6);
    const tasks = await this.taskService.getOpenUntil(user, until);
    return buildTaskListView(tasks, today, mode);
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
