import { Logger } from "@nestjs/common";
import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../telegram.helpers";

const logger = new Logger("TelegramError");

/** Keeps one failing handler from crashing polling for everyone. */
export const errorMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    logger.error(
      `Failed to handle update ${ctx.update.update_id}`,
      error instanceof Error ? error.stack : String(error),
    );
    try {
      await ctx.reply("Что-то пошло не так. Попробуйте ещё раз.");
    } catch {
      // ignore reply errors
    }
  }
};
