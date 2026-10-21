import { Action, Command, Ctx, Update } from "nestjs-telegraf";
import { SubscriptionFlow } from "../flows/subscription.flow";
import { BotContext, handleCallbackParams } from "../telegram.helpers";

@Update()
export class SubscriptionUpdate {
  constructor(private readonly subscriptionFlow: SubscriptionFlow) {}

  @Command("subs")
  async onSubs(@Ctx() ctx: BotContext) {
    await this.subscriptionFlow.showMenu(ctx);
    await this.subscriptionFlow.sendList(ctx);
  }

  @Action(/^sub_period:(monthly|yearly)$/)
  async onSubPeriod(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить период.", (userId, [period]) =>
      this.subscriptionFlow.handlePeriodSelected(ctx, userId, period),
    );
  }

  @Action(/^sub_paid:([0-9a-f-]{36}):(\d{8})$/)
  async onSubPaid(@Ctx() ctx: BotContext) {
    await handleCallbackParams(
      ctx,
      "Не удалось определить подписку.",
      (_userId, [id, dateKey]) => this.subscriptionFlow.handlePaid(ctx, id, dateKey),
      2,
    );
  }

  @Action(/^sub_del:([0-9a-f-]{36})$/)
  async onSubDelete(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить подписку.", (_userId, [id]) =>
      this.subscriptionFlow.handleDelete(ctx, id),
    );
  }
}
