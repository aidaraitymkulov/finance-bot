import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoryKeywords1792541300000 implements MigrationInterface {
  name = "AddCategoryKeywords1792541300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "category_keywords" (' +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"word" character varying(64) NOT NULL, ' +
        '"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"userId" integer NOT NULL, ' +
        '"categoryId" uuid NOT NULL, ' +
        'CONSTRAINT "PK_category_keywords" PRIMARY KEY ("id")' +
        ")",
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_category_keywords_user_word" ON "category_keywords" ("userId", "word")',
    );
    await queryRunner.query(
      'ALTER TABLE "category_keywords" ADD CONSTRAINT "FK_category_keywords_user" ' +
        'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "category_keywords" ADD CONSTRAINT "FK_category_keywords_category" ' +
        'FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "category_keywords" DROP CONSTRAINT "FK_category_keywords_category"',
    );
    await queryRunner.query(
      'ALTER TABLE "category_keywords" DROP CONSTRAINT "FK_category_keywords_user"',
    );
    await queryRunner.query('DROP INDEX "public"."UQ_category_keywords_user_word"');
    await queryRunner.query('DROP TABLE "category_keywords"');
  }
}
