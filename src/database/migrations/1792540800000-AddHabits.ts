import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHabits1792540800000 implements MigrationInterface {
  name = "AddHabits1792540800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."habit_checkins_status_enum" AS ENUM('DONE', 'SKIPPED')`,
    );
    await queryRunner.query(
      'CREATE TABLE "habits" (' +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"title" character varying(128) NOT NULL, ' +
        '"isActive" boolean NOT NULL DEFAULT true, ' +
        '"order" integer NOT NULL, ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"userId" integer NOT NULL, ' +
        'CONSTRAINT "PK_habits" PRIMARY KEY ("id")' +
        ")",
    );
    await queryRunner.query(
      'CREATE TABLE "habit_checkins" (' +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"date" date NOT NULL, ' +
        '"status" "public"."habit_checkins_status_enum" NOT NULL, ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"habitId" uuid NOT NULL, ' +
        'CONSTRAINT "PK_habit_checkins" PRIMARY KEY ("id"), ' +
        'CONSTRAINT "UQ_habit_checkins_habit_date" UNIQUE ("habitId", "date")' +
        ")",
    );
    await queryRunner.query(
      'ALTER TABLE "habits" ADD CONSTRAINT "FK_habits_user" ' +
        'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "habit_checkins" ADD CONSTRAINT "FK_habit_checkins_habit" ' +
        'FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "habit_checkins" DROP CONSTRAINT "FK_habit_checkins_habit"',
    );
    await queryRunner.query('ALTER TABLE "habits" DROP CONSTRAINT "FK_habits_user"');
    await queryRunner.query('DROP TABLE "habit_checkins"');
    await queryRunner.query('DROP TABLE "habits"');
    await queryRunner.query('DROP TYPE "public"."habit_checkins_status_enum"');
  }
}
