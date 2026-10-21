import type {
  InlineKeyboardMarkup,
  Message,
  ReplyKeyboardMarkup,
  Update as TgUpdate,
} from "@telegraf/types";
import { Context } from "telegraf";
import { TelegramUser } from "./types/telegram-user";

export type BotContext = Context<TgUpdate>;

export const isTextMessage = (message?: Message): message is Message.TextMessage =>
  Boolean(message && "text" in message);

export const getCallbackData = (ctx: BotContext): string | null => {
  const query = ctx.callbackQuery;
  if (!query || !("data" in query)) {
    return null;
  }
  return query.data ?? null;
};

/** "habit_check:<id>:done" -> ["<id>", "done"] (the prefix is dropped). */
export const getCallbackParts = (ctx: BotContext): string[] =>
  getCallbackData(ctx)?.split(":").slice(1) ?? [];

/**
 * Shared shape of inline-button handlers: resolve the user, check that the callback carries
 * `expectedParams` values after the prefix, otherwise answer with `errorText`.
 */
export const handleCallbackParams = async (
  ctx: BotContext,
  errorText: string,
  handler: (userId: string, params: string[]) => Promise<unknown>,
  expectedParams = 1,
) => {
  const userId = getUserId(ctx);
  if (!userId) {
    return;
  }

  const params = getCallbackParts(ctx);
  if (params.length < expectedParams || params.slice(0, expectedParams).some((part) => !part)) {
    await ctx.answerCbQuery(errorText);
    return;
  }

  await handler(userId, params);
};

export const replyWithMarkup = (
  ctx: BotContext,
  text: string,
  replyMarkup: InlineKeyboardMarkup | ReplyKeyboardMarkup,
) => ctx.reply(text, { reply_markup: replyMarkup });

export const getUserId = (ctx: BotContext): string | null =>
  ctx.from?.id ? String(ctx.from.id) : null;

/** Same as getUserId, but tells the user when it cannot be determined. */
export const requireUserId = async (ctx: BotContext): Promise<string | null> => {
  const userId = getUserId(ctx);
  if (!userId) {
    await ctx.reply("Не удалось определить пользователя.");
  }
  return userId;
};

export const getTelegramUser = (ctx: BotContext): TelegramUser | null => {
  const from = ctx.from;
  if (!from) {
    return null;
  }

  return {
    id: String(from.id),
    userName: from.username ?? "",
    firstName: from.first_name ?? "",
    lastName: from.last_name ?? "",
  };
};
