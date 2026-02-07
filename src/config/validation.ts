import { plainToInstance } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsString } from "class-validator";

enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

class EnvVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsBoolean()
  DB_SYNCHRONIZE: boolean;

  @IsString()
  TELEGRAM_BOT_TOKEN: string;

  @IsNumber()
  ALLOWED_TELEGRAM_USER_ID: number;
}

export const validate = (config: Record<string, unknown>) => {
  const validatedConfig = plainToInstance(EnvVariables, config, {
    enableImplicitConversion: true,
  });

  return validatedConfig;
};
