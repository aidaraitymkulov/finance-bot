import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriptions1792541100000 implements MigrationInterface {
  name = "AddSubscriptions1792541100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "subscriptions" (' +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"name" character varying(128) NOT NULL, ' +
        '"amount" numeric(12,2) NOT NULL, ' +
        '"period" character varying(16) NOT NULL, ' +
        '"billingDay" smallint NOT NULL, ' +
        '"nextPaymentDate" date NOT NULL, ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"userId" integer NOT NULL, ' +
        'CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")' +
        ")",
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_subscriptions_user_next" ON "subscriptions" ("userId", "nextPaymentDate")',
    );
    await queryRunner.query(
      'ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_user" ' +
        'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_user"');
    await queryRunner.query('DROP INDEX "public"."IDX_subscriptions_user_next"');
    await queryRunner.query('DROP TABLE "subscriptions"');
  }
}
