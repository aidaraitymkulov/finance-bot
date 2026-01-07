import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Configuration } from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { validate } from "./config/validation";
import { UserModule } from "./modules/user/user.module";
import { CategoryModule } from "./modules/category/category.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { ReportModule } from "./modules/report/report.module";

const envFilePaths = [`.env.${process.env.NODE_ENV ?? "development"}`, ".env.development", ".env"];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths,
      load: [Configuration],
      validate,
    }),
    DatabaseModule,
    UserModule,
    CategoryModule,
    ReportModule,
    TelegramModule,
  ],
})
export class AppModule {}
