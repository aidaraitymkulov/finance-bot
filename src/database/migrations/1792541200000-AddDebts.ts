import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDebts1792541200000 implements MigrationInterface {
  name = "AddDebts1792541200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "operations" ADD COLUMN "sharedAmount" numeric(12,2)');
    await queryRunner.query(
      "CREATE TYPE \"public\".\"debt_entries_kind_enum\" AS ENUM('LEND', 'BORROW', 'REPAID_TO_ME', 'REPAID_BY_ME', 'SPLIT')",
    );
    await queryRunner.query(
      'CREATE TABLE "debt_entries" (' +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"person" character varying(64) NOT NULL, ' +
        '"personKey" character varying(64) NOT NULL, ' +
        '"kind" "public"."debt_entries_kind_enum" NOT NULL, ' +
        '"amount" numeric(12,2) NOT NULL, ' +
        '"comment" character varying(256), ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"userId" integer NOT NULL, ' +
        '"operationId" uuid, ' +
        'CONSTRAINT "PK_debt_entries" PRIMARY KEY ("id")' +
        ")",
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_debt_entries_user_person" ON "debt_entries" ("userId", "personKey")',
    );
    await queryRunner.query(
      'ALTER TABLE "debt_entries" ADD CONSTRAINT "FK_debt_entries_user" ' +
        'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "debt_entries" ADD CONSTRAINT "FK_debt_entries_operation" ' +
        'FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "debt_entries" DROP CONSTRAINT "FK_debt_entries_operation"',
    );
    await queryRunner.query('ALTER TABLE "debt_entries" DROP CONSTRAINT "FK_debt_entries_user"');
    await queryRunner.query('DROP INDEX "public"."IDX_debt_entries_user_person"');
    await queryRunner.query('DROP TABLE "debt_entries"');
    await queryRunner.query('DROP TYPE "public"."debt_entries_kind_enum"');
    await queryRunner.query('ALTER TABLE "operations" DROP COLUMN "sharedAmount"');
  }
}
