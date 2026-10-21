import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegrafModule } from "nestjs-telegraf";
import { TelegramService } from "./telegram.service";
import { TelegramStateModule } from "./state/telegram-state.module";
import { BotPauseService } from "./state/bot-pause.service";
import { createAccessMiddleware } from "./middlewares/access.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";
import { CoreUpdate } from "./updates/core.update";
import { FinanceUpdate } from "./updates/finance.update";
import { UserModule } from "../user/user.module";
import { CategoryModule } from "../category/category.module";
import { OperationModule } from "../operation/operation.module";
import { ReportModule } from "../report/report.module";
import { OperationFlow } from "./flows/operation.flow";
import { StatsFlow } from "./flows/stats.flow";
import { RatingFlow } from "./flows/rating.flow";
import { LastFlow } from "./flows/last.flow";
import { HelpFlow } from "./flows/help.flow";
import { CategoryManageFlow } from "./flows/category-manage.flow";
import { ExcelFlow } from "./flows/excel.flow";

@Module({
  imports: [
    UserModule,
    CategoryModule,
    OperationModule,
    ReportModule,
    TelegramStateModule,
    TelegrafModule.forRootAsync({
      imports: [TelegramStateModule],
      inject: [ConfigService, BotPauseService],
      useFactory: (configService: ConfigService, botPauseService: BotPauseService) => {
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

        new Logger(TelegramModule.name).log(
          `Allowed Telegram user ID: ${telegram?.allowedUserId ?? "not set"}`,
        );

        return {
          token: botToken,
          middlewares: [
            errorMiddleware,
            createAccessMiddleware(telegram?.allowedUserId, botPauseService),
          ],
        };
      },
    }),
  ],
  providers: [
    CoreUpdate,
    FinanceUpdate,
    TelegramService,
    OperationFlow,
    StatsFlow,
    RatingFlow,
    LastFlow,
    HelpFlow,
    CategoryManageFlow,
    ExcelFlow,
  ],
})
export class TelegramModule {}
