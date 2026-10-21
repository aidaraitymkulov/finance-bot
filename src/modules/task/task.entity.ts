import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserEntity } from "../user/user.entity";

@Entity({ name: "tasks" })
export class TaskEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;

  @Column({ type: "varchar", length: 256 })
  title: string;

  /** Local date "YYYY-MM-DD" in the app time zone. */
  @Column({ type: "date" })
  dueDate: string;

  @Column({ type: "boolean", default: false })
  isDone: boolean;

  @Column({ type: "timestamptz", nullable: true })
  doneAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
