import { ConfigService } from "@nestjs/config";
import { Ctx, Start, Update } from "nestjs-telegraf";
import { Context } from "telegraf";
import { TelegramService } from "./telegram.service";

@Update()
export class TelegramUpdate {
  private readonly allowedUserId?: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramService,
  ) {
    const telegram = this.configService.get<{ allowedUserId?: number }>(
      "telegram",
    );
    this.allowedUserId = telegram?.allowedUserId;
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const isAllowed = await this.ensureAllowed(ctx);
    if (!isAllowed) {
      return;
    }

    await ctx.reply(this.telegramService.getStartMessage());
  }

  private async ensureAllowed(ctx: Context) {
    if (!this.allowedUserId) {
      return true;
    }

    const fromId = ctx.from?.id;
    if (fromId === this.allowedUserId) {
      return true;
    }

    await ctx.reply("Доступ запрещен.");
    return false;
  }
}
