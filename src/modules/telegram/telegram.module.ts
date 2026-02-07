import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegrafModule } from "nestjs-telegraf";
import { TelegramService } from "./telegram.service";
import { TelegramUpdate } from "./telegram.update";
import { DialogStateService } from "./state/dialog-state.service";
import { UserModule } from "../user/user.module";
import { CategoryModule } from "../category/category.module";
import { OperationModule } from "../operation/operation.module";
import { ReportModule } from "../report/report.module";
import { OperationFlow } from "./flows/operation.flow";
import { StatsFlow } from "./flows/stats.flow";
import { RatingFlow } from "./flows/rating.flow";
import { LastFlow } from "./flows/last.flow";
import { HelpFlow } from "./flows/help.flow";

@Module({
  imports: [
    UserModule,
    CategoryModule,
    OperationModule,
    ReportModule,
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
  providers: [
    DialogStateService,
    TelegramUpdate,
    TelegramService,
    OperationFlow,
    StatsFlow,
    RatingFlow,
    LastFlow,
    HelpFlow,
  ],
})
export class TelegramModule {}
