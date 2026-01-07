import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegrafModule } from "nestjs-telegraf";
import { TelegramService } from "./telegram.service";
import { TelegramUpdate } from "./telegram.update";

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const normalizeEnvString = (value?: string) =>
          value ? value.trim().replace(/^['"]|['"]$/g, "") : undefined;

        const telegram = configService.get<{
          botToken: string;
          allowedUserId?: number;
        }>("telegram");

        const botToken = telegram?.botToken ?? normalizeEnvString(process.env.TELEGRAM_BOT_TOKEN);

        if (!botToken) {
          throw new Error("Telegram bot token is missing");
        }

        return {
          token: botToken,
        };
      },
    }),
  ],
  providers: [TelegramUpdate, TelegramService],
})
export class TelegramModule {}
