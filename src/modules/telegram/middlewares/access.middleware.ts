import type { MiddlewareFn } from "telegraf";
import { BotPauseService } from "../state/bot-pause.service";
import { buildPausedKeyboard } from "../keyboards/paused.keyboard";
import type { BotContext } from "../telegram.helpers";

const answerCallbackIfNeeded = async (ctx: BotContext, text: string) => {
  if (!ctx.callbackQuery) {
    return;
  }

  try {
    await ctx.answerCbQuery(text);
  } catch {
    // ignore callback answer errors
  }
};

const isStartCommand = (ctx: BotContext) =>
  Boolean(ctx.message && "text" in ctx.message && ctx.message.text.startsWith("/start"));

/**
 * Runs before every handler: only the allowed Telegram user may talk to the bot,
 * and a paused chat only reacts to /start.
 */
export const createAccessMiddleware =
  (allowedUserId: number | undefined, botPauseService: BotPauseService): MiddlewareFn<BotContext> =>
  async (ctx, next) => {
    const fromId = ctx.from?.id;
    const isInteractive = Boolean(ctx.callbackQuery || (ctx.message && "text" in ctx.message));

    if (!fromId || !isInteractive) {
      return;
    }

    if (allowedUserId && fromId !== allowedUserId) {
      await answerCallbackIfNeeded(ctx, "Доступ запрещен.");
      await ctx.reply("Доступ запрещен.");
      return;
    }

    if (!isStartCommand(ctx) && botPauseService.isPaused(String(fromId))) {
      await answerCallbackIfNeeded(ctx, "Бот отключен. Нажмите /start.");
      await ctx.reply("Бот отключен. Нажмите /start на кнопке ниже.", {
        reply_markup: buildPausedKeyboard().reply_markup,
      });
      return;
    }

    await next();
  };
