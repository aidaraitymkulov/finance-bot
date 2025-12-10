import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Configuration } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { validate } from './config/validation';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
      load: [Configuration],
      validate,
    }),
    DatabaseModule,
  ]
})
export class AppModule {}
