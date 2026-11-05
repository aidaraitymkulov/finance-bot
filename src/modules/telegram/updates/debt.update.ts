import { Action, Command, Ctx, Update } from "nestjs-telegraf";
import { DebtFlow } from "../flows/debt.flow";
import { BotContext, handleCallbackParams } from "../telegram.helpers";

@Update()
export class DebtUpdate {
  constructor(private readonly debtFlow: DebtFlow) {}

  @Command("debts")
  async onDebts(@Ctx() ctx: BotContext) {
    await this.debtFlow.showMenu(ctx);
    await this.debtFlow.sendBalances(ctx);
  }

  @Action(/^debt_who:([0-9a-f]{10})$/)
  async onDebtPerson(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить человека.", (userId, [ref]) =>
      this.debtFlow.handlePersonPicked(ctx, userId, ref),
    );
  }

  @Action(/^debt_card:([0-9a-f]{10})$/)
  async onDebtCard(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить человека.", (_userId, [ref]) =>
      this.debtFlow.handleCard(ctx, ref),
    );
  }

  @Action(/^debt_close:([0-9a-f]{10})$/)
  async onDebtClose(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить человека.", (_userId, [ref]) =>
      this.debtFlow.handleClose(ctx, ref),
    );
  }

  @Action("debt_list")
  async onDebtList(@Ctx() ctx: BotContext) {
    await this.debtFlow.handleList(ctx);
  }
}
