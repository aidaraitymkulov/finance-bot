import { Action, Ctx, Update } from "nestjs-telegraf";
import { OperationEditFlow } from "../flows/operation-edit.flow";
import { BotContext, handleCallbackParams } from "../telegram.helpers";

const ERROR = "Не удалось определить операцию.";

@Update()
export class OperationEditUpdate {
  constructor(private readonly editFlow: OperationEditFlow) {}

  @Action(/^op_edit:([0-9a-f-]{36})$/)
  async onOpen(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (_userId, [id]) => this.editFlow.open(ctx, id));
  }

  @Action(/^op_e_card:([0-9a-f-]{36})$/)
  async onCard(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (_userId, [id]) => this.editFlow.showCard(ctx, id));
  }

  @Action(/^op_undo:([0-9a-f-]{36})$/)
  async onUndo(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (_userId, [id]) => this.editFlow.undo(ctx, id));
  }

  @Action(/^op_e_amount:([0-9a-f-]{36})$/)
  async onAmount(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (userId, [id]) =>
      this.editFlow.startAmount(ctx, userId, id),
    );
  }

  @Action(/^op_e_comment:([0-9a-f-]{36})$/)
  async onComment(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (userId, [id]) =>
      this.editFlow.startComment(ctx, userId, id),
    );
  }

  @Action(/^op_e_cat:([0-9a-f-]{36})$/)
  async onCategory(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (userId, [id]) =>
      this.editFlow.startCategory(ctx, userId, id),
    );
  }

  @Action(/^op_e_set:(.+)$/)
  async onCategorySet(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить категорию.", (userId, [code]) =>
      this.editFlow.handleCategorySet(ctx, userId, code),
    );
  }

  @Action(/^op_e_unsplit:([0-9a-f-]{36})$/)
  async onUnsplit(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (_userId, [id]) => this.editFlow.cancelSplit(ctx, id));
  }

  @Action(/^op_e_del:([0-9a-f-]{36})$/)
  async onDelete(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (_userId, [id]) => this.editFlow.confirmDelete(ctx, id));
  }

  @Action(/^op_e_del_yes:([0-9a-f-]{36})$/)
  async onDeleteConfirmed(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, ERROR, (_userId, [id]) => this.editFlow.delete(ctx, id));
  }
}
