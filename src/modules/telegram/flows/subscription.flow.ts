import { Injectable } from "@nestjs/common";
import { SubscriptionService } from "../../subscription/subscription.service";
import type { SubscriptionPeriod } from "../../subscription/next-payment.util";
import { UserService } from "../../user/user.service";
import { UserEntity } from "../../user/user.entity";
import { toLocalDateString, todayLocalDate } from "../../../common/utils/local-date.util";
import { DialogStateService } from "../state/dialog-state.service";
import { SubscriptionDialogState } from "../state/dialog-state.types";
import { TelegramService } from "../telegram.service";
import { parseAmount, parseDate } from "../telegram.parsers";
import { formatDayLabel } from "../views/task.views";
import { buildPeriodKeyboard, buildSubscriptionListView } from "../views/subscription.views";
import { editMessageSafe, getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

const CREATE_ERRORS: Record<string, string> = {
  empty_name: "Название не может быть пустым.",
  name_too_long: "Слишком длинное название (максимум 128 символов). Попробуйте короче.",
  invalid_amount: "Неверная сумма. Введите положительное число, например 990 или 1250,50",
};

const PAYMENT_ERRORS = {
  not_found: "Подписка не найдена.",
  already_paid: "Это списание уже отмечено.",
  no_category: "Категория «🔔 Подписки» не найдена. Перезапустите бота.",
} as const;

@Injectable()
export class SubscriptionFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly subscriptionService: SubscriptionService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async showMenu(ctx: BotContext) {
    await replyWithMarkup(
      ctx,
      "Раздел «Подписки». Выберите действие:",
      this.telegramService.getSubscriptionsMenuKeyboard().reply_markup,
    );
  }

  async startAdd(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, { flow: "subscription", step: "sub_name" });
    await replyWithMarkup(
      ctx,
      "Название подписки или платежа?\nНапример: Хостинг",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: SubscriptionDialogState) {
    switch (state.step) {
      case "sub_name": {
        const error = SubscriptionService.validateName(text);
        if (error) {
          await ctx.reply(CREATE_ERRORS[error]);
          return;
        }
        this.dialogStateService.set(userId, {
          flow: "subscription",
          step: "sub_amount",
          name: text.trim(),
        });
        await ctx.reply("Сумма списания?\nНапример: 990");
        return;
      }

      case "sub_amount": {
        const amount = parseAmount(text);
        if (amount === null || SubscriptionService.validateAmount(amount)) {
          await ctx.reply(CREATE_ERRORS.invalid_amount);
          return;
        }
        this.dialogStateService.set(userId, {
          flow: "subscription",
          step: "sub_period",
          name: state.name,
          amount,
        });
        await replyWithMarkup(ctx, "Как часто списывается?", buildPeriodKeyboard().reply_markup);
        return;
      }

      case "sub_period":
        await ctx.reply("Выберите период кнопкой выше.");
        return;

      case "sub_date": {
        const date = parseDate(text);
        if (!date) {
          await ctx.reply(
            `Неверный формат. Пример: ${toLocalDateString(new Date()).split("-").reverse().join(".")}`,
          );
          return;
        }
        await this.createSubscription(ctx, userId, state, toLocalDateString(date));
        return;
      }
    }
  }

  async handlePeriodSelected(ctx: BotContext, userId: string, period: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "subscription" || state.step !== "sub_period") {
      await ctx.answerCbQuery("Сначала введите название и сумму.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "subscription",
      step: "sub_date",
      name: state.name,
      amount: state.amount,
      period: period as SubscriptionPeriod,
    });
    await ctx.answerCbQuery();
    await ctx.reply("Дата ближайшего списания в формате дд.мм.гггг");
  }

  async sendList(ctx: BotContext) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const view = await this.buildListView(user);
    await ctx.reply(view.text, { reply_markup: view.reply_markup });
  }

  /**
   * "✅ Оплачено" (records the expense) or "⏭ Пропустить" (no expense): both move the subscription
   * to the next period. Under a reminder the pressed row is removed; the list is re-rendered.
   */
  async handlePayment(
    ctx: BotContext,
    action: "paid" | "skip",
    subscriptionId: string,
    dateKey: string,
    source: string | undefined,
  ) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const expectedDate = `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
    const result =
      action === "paid"
        ? await this.subscriptionService.markPaid(user, subscriptionId, expectedDate)
        : await this.subscriptionService.skip(user, subscriptionId, expectedDate);
    const done = "paid" in result ? result.paid : result.skipped;

    if (done) {
      await ctx.answerCbQuery(
        action === "paid" ? "Записано в расходы ✅" : "Списание пропущено ⏭",
      );
    } else {
      await ctx.answerCbQuery(PAYMENT_ERRORS[result.reason ?? "not_found"]);
      if (result.reason === "no_category") {
        return;
      }
    }

    if (source === "list") {
      const view = await this.buildListView(user);
      await editMessageSafe(ctx, view.text, view.reply_markup);
    } else {
      await this.removePressedRow(ctx);
    }
  }

  async handleDelete(ctx: BotContext, subscriptionId: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const deleted = await this.subscriptionService.delete(user, subscriptionId);
    await ctx.answerCbQuery(deleted ? "Подписка удалена." : "Подписка не найдена.");

    const view = await this.buildListView(user);
    await editMessageSafe(ctx, view.text, view.reply_markup);
  }

  private async createSubscription(
    ctx: BotContext,
    userId: string,
    state: Extract<SubscriptionDialogState, { step: "sub_date" }>,
    paymentDate: string,
  ) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const result = await this.subscriptionService.create(
      user,
      state.name,
      state.amount,
      state.period,
      paymentDate,
      todayLocalDate(),
    );
    if (!result.created || !result.subscription) {
      await ctx.reply(CREATE_ERRORS[result.reason ?? "empty_name"]);
      return;
    }

    this.dialogStateService.clear(userId);
    await ctx.reply(
      `Подписка «${result.subscription.name}» добавлена. ` +
        `Ближайшее списание: ${formatDayLabel(result.subscription.nextPaymentDate)}.\n` +
        "Напомню за 3 дня, за 1 день и в день списания в 09:00. " +
        "Пока не отметите «✅ Оплачено» или «⏭ Пропустить», буду напоминать каждое утро.",
    );
    await this.showMenu(ctx);
  }

  /** Removes the row of the button that was just pressed, keeping other subscriptions' rows. */
  private async removePressedRow(ctx: BotContext) {
    const query = ctx.callbackQuery;
    const message = query?.message;
    if (!query || !("data" in query) || !message || !("text" in message)) {
      return;
    }

    const inline_keyboard = (message.reply_markup?.inline_keyboard ?? []).filter(
      (row) =>
        !row.some((button) => "callback_data" in button && button.callback_data === query.data),
    );
    await editMessageSafe(ctx, message.text, { inline_keyboard });
  }

  private async buildListView(user: UserEntity) {
    const today = todayLocalDate();
    return buildSubscriptionListView(await this.subscriptionService.getAll(user), today);
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
