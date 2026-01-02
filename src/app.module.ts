import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Configuration } from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { validate } from "./config/validation";
import { UserModule } from "./modules/user/user.module";
import { CategoryModule } from "./modules/category/category.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
      load: [Configuration],
      validate,
    }),
    DatabaseModule,
    UserModule,
    CategoryModule,
  ],
})
export class AppModule {}
