import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIsPaused1792541000000 implements MigrationInterface {
  name = "AddUserIsPaused1792541000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN "isPaused" boolean NOT NULL DEFAULT false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "isPaused"');
  }
}
