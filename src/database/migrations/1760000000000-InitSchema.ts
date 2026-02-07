import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1760000000000 implements MigrationInterface {
  name = "InitSchema1760000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      "CREATE TYPE \"public\".\"categories_type_enum\" AS ENUM('INCOME', 'EXPENSE')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"operations_type_enum\" AS ENUM('INCOME', 'EXPENSE')",
    );
    await queryRunner.query(
      "CREATE TABLE \"users\" (" +
        '"id" SERIAL NOT NULL, ' +
        '"telegramId" character varying(64) NOT NULL, ' +
        '"userName" character varying(64) NOT NULL, ' +
        '"firstName" character varying(64) NOT NULL, ' +
        '"lastName" character varying(64) NOT NULL, ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        'CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"), ' +
        'CONSTRAINT "UQ_users_telegram_id" UNIQUE ("telegramId")' +
        ")",
    );
    await queryRunner.query(
      "CREATE TABLE \"categories\" (" +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"type" \"public\".\"categories_type_enum\" NOT NULL, ' +
        '"code" character varying(64) NOT NULL, ' +
        '"displayName" character varying(64) NOT NULL, ' +
        '"order" integer NOT NULL, ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        'CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"), ' +
        'CONSTRAINT "UQ_categories_type_code" UNIQUE ("type", "code")' +
        ")",
    );
    await queryRunner.query(
      "CREATE TABLE \"operations\" (" +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"type" \"public\".\"operations_type_enum\" NOT NULL, ' +
        '"amount" numeric(12,2) NOT NULL, ' +
        '"comment" character varying(256), ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"userId" integer NOT NULL, ' +
        '"categoryId" uuid NOT NULL, ' +
        'CONSTRAINT "PK_972e1f4b7eabf8d5f27a67c3f20" PRIMARY KEY ("id")' +
        ")",
    );
    await queryRunner.query(
      'ALTER TABLE "operations" ADD CONSTRAINT "FK_operations_user" ' +
        'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "operations" ADD CONSTRAINT "FK_operations_category" ' +
        'FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "operations" DROP CONSTRAINT "FK_operations_category"');
    await queryRunner.query('ALTER TABLE "operations" DROP CONSTRAINT "FK_operations_user"');
    await queryRunner.query('DROP TABLE "operations"');
    await queryRunner.query('DROP TABLE "categories"');
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "public"."operations_type_enum"');
    await queryRunner.query('DROP TYPE "public"."categories_type_enum"');
  }
}
