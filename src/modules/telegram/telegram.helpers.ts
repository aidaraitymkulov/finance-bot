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

export const replyWithMarkup = (
  ctx: BotContext,
  text: string,
  replyMarkup: InlineKeyboardMarkup | ReplyKeyboardMarkup,
) => ctx.reply(text, { reply_markup: replyMarkup });

export const getUserId = (ctx: BotContext): string | null =>
  ctx.from?.id ? String(ctx.from.id) : null;

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
