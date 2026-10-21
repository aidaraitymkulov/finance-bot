import { Action, Command, Ctx, Update } from "nestjs-telegraf";
import { HabitFlow } from "../flows/habit.flow";
import { BotContext, handleCallbackParams } from "../telegram.helpers";

@Update()
export class HabitUpdate {
  constructor(private readonly habitFlow: HabitFlow) {}

  @Command("habits")
  async onHabits(@Ctx() ctx: BotContext) {
    await this.habitFlow.showMenu(ctx);
    await this.habitFlow.sendList(ctx);
  }

  @Action(/^habit_check:([^:]+):(done|skip)$/)
  async onHabitCheck(@Ctx() ctx: BotContext) {
    await handleCallbackParams(
      ctx,
      "Не удалось определить привычку.",
      (_userId, [habitId, action]) => this.habitFlow.handleCheck(ctx, habitId, action),
      2,
    );
  }

  @Action(/^habit_del:(.+)$/)
  async onHabitDelete(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить привычку.", (_userId, [habitId]) =>
      this.habitFlow.handleDelete(ctx, habitId),
    );
  }
}
