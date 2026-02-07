import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<{
          host: string;
          port: number;
          user: string;
          password: string;
          name: string;
          synchronize?: boolean;
        }>("database");

        if (!db) {
          throw new Error("Database configuration is missing");
        }

        return {
          type: "postgres" as const,
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.password,
          database: db.name,
          autoLoadEntities: true,
          synchronize: db.synchronize ?? false,
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
