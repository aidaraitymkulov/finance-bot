import { DataSource } from "typeorm";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { UserEntity } from "../modules/user/user.entity";
import { CategoryEntity } from "../modules/category/category.entity";
import { OperationEntity } from "../modules/operation/operation.entity";

const parseBoolean = (value?: string) => value === "true";
const nodeEnv = process.env.NODE_ENV ?? "development";
const envFilePaths = [`.env.${nodeEnv}`, ".env.development", ".env"];

for (const envFilePath of envFilePaths) {
  dotenvConfig({
    path: resolve(process.cwd(), envFilePath),
    override: false,
  });
}

export default new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [UserEntity, CategoryEntity, OperationEntity],
  migrations: [__dirname + "/migrations/*{.js,.ts}"],
  synchronize: parseBoolean(process.env.DB_SYNCHRONIZE),
  logging: false,
});
