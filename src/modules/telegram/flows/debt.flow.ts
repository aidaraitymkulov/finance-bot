import { Injectable } from "@nestjs/common";
import { DebtService } from "../../debt/debt.service";
import type { PersonBalance } from "../../debt/debt.service";
import { DebtKind } from "../../debt/debt-kind.enum";
import { normalizePerson, personRef, validatePerson } from "../../debt/debt.util";
import type { PersonError } from "../../debt/debt.util";
import { UserService } from "../../user/user.service";
import { UserEntity } from "../../user/user.entity";
import { DialogStateService } from "../state/dialog-state.service";
import { DebtDialogState } from "../state/dialog-state.types";
import { TelegramService } from "../telegram.service";
import { parseAmount } from "../telegram.parsers";
import {
  buildBalancesView,
  buildPeopleKeyboard,
  buildPersonCardView,
  DEBT_KIND_LABELS,
  formatBalance,
  formatDebtAmount,
} from "../views/debt.views";
import { editMessageSafe, getTelegramUser, replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

export const PERSON_ERRORS: Record<PersonError, string> = {
  empty_person: "Имя не может быть пустым.",
  person_too_long: "Слишком длинное имя (максимум 64 символа). Попробуйте короче.",
};

const PERSON_PROMPTS: Record<Exclude<DebtKind, DebtKind.SPLIT>, string> = {
  [DebtKind.LEND]: "Кому ты дал в долг?",
  [DebtKind.BORROW]: "У кого ты взял в долг?",
  [DebtKind.REPAID_TO_ME]: "Кто вернул тебе долг?",
  [DebtKind.REPAID_BY_ME]: "Кому ты вернул долг?",
};

const NO_DEBTORS: Partial<Record<DebtKind, string>> = {
  [DebtKind.REPAID_TO_ME]: "Никто сейчас не должен тебе.",
  [DebtKind.REPAID_BY_ME]: "Ты сейчас никому не должен.",
};

const isRepayment = (kind: DebtKind) =>
  kind === DebtKind.REPAID_TO_ME || kind === DebtKind.REPAID_BY_ME;

@Injectable()
export class DebtFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly debtService: DebtService,
    private readonly userService: UserService,
    private readonly telegramService: TelegramService,
  ) {}

  async showMenu(ctx: BotContext) {
    await replyWithMarkup(
      ctx,
      "Раздел «Долги». Выберите действие:",
      this.telegramService.getDebtsMenuKeyboard().reply_markup,
    );
  }

  async sendBalances(ctx: BotContext) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const view = buildBalancesView(await this.debtService.getBalances(user));
    await ctx.reply(view.text, { reply_markup: view.reply_markup });
  }

  async start(ctx: BotContext, userId: string, kind: Exclude<DebtKind, DebtKind.SPLIT>) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const candidates = await this.getCandidates(user, kind);
    if (isRepayment(kind) && candidates.length === 0) {
      await ctx.reply(NO_DEBTORS[kind] ?? "Нет подходящих долгов.");
      return;
    }

    this.dialogStateService.set(userId, { flow: "debt", step: "debt_person", kind });
    const hint = isRepayment(kind) ? "Выбери из списка." : "Введи имя или выбери из списка.";
    await replyWithMarkup(
      ctx,
      `${PERSON_PROMPTS[kind]} ${candidates.length > 0 ? hint : "Введи имя."}`,
      this.telegramService.getCancelKeyboard().reply_markup,
    );
    if (candidates.length > 0) {
      await replyWithMarkup(
        ctx,
        "Недавние:",
        buildPeopleKeyboard(candidates, "debt_who").reply_markup,
      );
    }
  }

  async handleText(ctx: BotContext, userId: string, text: string, state: DebtDialogState) {
    switch (state.step) {
      case "debt_person": {
        if (isRepayment(state.kind)) {
          await ctx.reply("Выберите человека кнопкой выше.");
          return;
        }
        const error = validatePerson(text);
        if (error) {
          await ctx.reply(PERSON_ERRORS[error]);
          return;
        }
        await this.askAmount(ctx, userId, state.kind, normalizePerson(text).person);
        return;
      }

      case "debt_amount": {
        const amount = parseAmount(text);
        if (amount === null) {
          await ctx.reply("Введите сумму числом. Пример: 1250 или 1250.50");
          return;
        }
        this.dialogStateService.set(userId, {
          flow: "debt",
          step: "debt_comment",
          kind: state.kind,
          person: state.person,
          amount,
        });
        await ctx.reply("Введите комментарий или '-' без комментария.");
        return;
      }

      case "debt_comment": {
        const user = await this.resolveUser(ctx);
        if (!user) {
          return;
        }
        const result = await this.debtService.addEntry(user, {
          person: state.person,
          kind: state.kind,
          amount: state.amount,
          comment: text === "-" ? null : text,
        });
        if (!result.added) {
          await ctx.reply(
            result.reason === "invalid_amount" ? "Неверная сумма." : PERSON_ERRORS[result.reason],
          );
          this.dialogStateService.clear(userId);
          return;
        }

        this.dialogStateService.clear(userId);
        const balance = await this.debtService.getBalance(user, result.entry.personKey);
        await ctx.reply(
          [
            `✅ Записано: ${DEBT_KIND_LABELS[state.kind]} — ${state.person}, ${formatDebtAmount(state.amount)}.`,
            `👤 ${state.person}: ${balance === 0 ? "в расчёте" : formatBalance(balance)}.`,
            "В статистику доходов и расходов это не попадает.",
          ].join("\n"),
        );
        await this.showMenu(ctx);
        return;
      }
    }
  }

  async handlePersonPicked(ctx: BotContext, userId: string, ref: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "debt" || state.step !== "debt_person") {
      await ctx.answerCbQuery("Сначала выберите действие в разделе «Долги».");
      return;
    }

    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const candidates = await this.getCandidates(user, state.kind);
    const picked = candidates.find((item) => personRef(item.personKey) === ref);
    if (!picked) {
      await ctx.answerCbQuery("Человек не найден.");
      return;
    }

    await ctx.answerCbQuery();
    await this.askAmount(ctx, userId, state.kind, picked.person);
  }

  async handleCard(ctx: BotContext, ref: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const person = await this.debtService.findBalanceByRef(user, ref);
    if (!person) {
      await ctx.answerCbQuery("Долг уже закрыт.");
      await this.renderList(ctx, user);
      return;
    }

    await ctx.answerCbQuery();
    const history = await this.debtService.getHistory(user, person.personKey);
    const view = buildPersonCardView(person, history);
    await editMessageSafe(ctx, view.text, view.reply_markup);
  }

  async handleList(ctx: BotContext) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }
    await ctx.answerCbQuery();
    await this.renderList(ctx, user);
  }

  /** Records a repayment of the whole remaining balance of the person. */
  async handleClose(ctx: BotContext, ref: string) {
    const user = await this.resolveUser(ctx);
    if (!user) {
      return;
    }

    const person = await this.debtService.findBalanceByRef(user, ref);
    if (!person) {
      await ctx.answerCbQuery("Долг уже закрыт.");
      await this.renderList(ctx, user);
      return;
    }

    await this.debtService.addEntry(user, {
      person: person.person,
      kind: person.balance > 0 ? DebtKind.REPAID_TO_ME : DebtKind.REPAID_BY_ME,
      amount: Math.abs(person.balance),
      comment: "Закрыто полностью",
    });
    await ctx.answerCbQuery("Долг закрыт ✅");
    await this.renderList(ctx, user);
  }

  private async askAmount(ctx: BotContext, userId: string, kind: DebtKind, person: string) {
    this.dialogStateService.set(userId, { flow: "debt", step: "debt_amount", kind, person });
    await ctx.reply(`${person}: введите сумму.`);
  }

  /** Repayments are offered to people with a matching balance, loans to recent people. */
  private async getCandidates(
    user: UserEntity,
    kind: DebtKind,
  ): Promise<{ person: string; personKey: string }[]> {
    if (!isRepayment(kind)) {
      return this.debtService.getRecentPeople(user);
    }
    const balances: PersonBalance[] = await this.debtService.getBalances(user);
    return balances.filter((item) =>
      kind === DebtKind.REPAID_TO_ME ? item.balance > 0 : item.balance < 0,
    );
  }

  private async renderList(ctx: BotContext, user: UserEntity) {
    const view = buildBalancesView(await this.debtService.getBalances(user));
    await editMessageSafe(ctx, view.text, view.reply_markup);
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
