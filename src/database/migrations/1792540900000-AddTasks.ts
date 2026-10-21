import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTasks1792540900000 implements MigrationInterface {
  name = "AddTasks1792540900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "tasks" (' +
        '"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ' +
        '"title" character varying(256) NOT NULL, ' +
        '"dueDate" date NOT NULL, ' +
        '"isDone" boolean NOT NULL DEFAULT false, ' +
        '"doneAt" TIMESTAMPTZ, ' +
        '"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"userId" integer NOT NULL, ' +
        'CONSTRAINT "PK_tasks" PRIMARY KEY ("id")' +
        ")",
    );
    await queryRunner.query('CREATE INDEX "IDX_tasks_user_due" ON "tasks" ("userId", "dueDate")');
    await queryRunner.query(
      'ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_user" ' +
        'FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_user"');
    await queryRunner.query('DROP INDEX "public"."IDX_tasks_user_due"');
    await queryRunner.query('DROP TABLE "tasks"');
  }
}
