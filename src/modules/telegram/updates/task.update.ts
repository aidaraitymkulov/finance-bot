import { Action, Command, Ctx, Update } from "nestjs-telegraf";
import { TaskFlow } from "../flows/task.flow";
import { TaskListMode } from "../views/task.views";
import { BotContext, handleCallbackParams } from "../telegram.helpers";

@Update()
export class TaskUpdate {
  constructor(private readonly taskFlow: TaskFlow) {}

  @Command("tasks")
  async onTasks(@Ctx() ctx: BotContext) {
    await this.taskFlow.showMenu(ctx);
    await this.taskFlow.sendList(ctx, "week");
  }

  @Command("today")
  async onToday(@Ctx() ctx: BotContext) {
    await this.taskFlow.sendList(ctx, "today");
  }

  @Action(/^task_date:(today|tomorrow|wd[0-6]|custom)$/)
  async onTaskDate(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить дату.", (userId, [key]) =>
      this.taskFlow.handleDateSelected(ctx, userId, key),
    );
  }

  @Action(/^task_done:([0-9a-f-]{36}):(today|week)$/)
  async onTaskDone(@Ctx() ctx: BotContext) {
    await handleCallbackParams(
      ctx,
      "Не удалось определить задачу.",
      (_userId, [taskId, mode]) => this.taskFlow.handleDone(ctx, taskId, mode as TaskListMode),
      2,
    );
  }

  @Action(/^task_del:([0-9a-f-]{36}):(today|week)$/)
  async onTaskDelete(@Ctx() ctx: BotContext) {
    await handleCallbackParams(
      ctx,
      "Не удалось определить задачу.",
      (_userId, [taskId, mode]) => this.taskFlow.handleDelete(ctx, taskId, mode as TaskListMode),
      2,
    );
  }
}
