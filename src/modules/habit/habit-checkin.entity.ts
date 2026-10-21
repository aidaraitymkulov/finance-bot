import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { HabitEntity } from "./habit.entity";
import { HabitCheckinStatus } from "./habit-checkin-status.enum";

@Entity({ name: "habit_checkins" })
@Index(["habit", "date"], { unique: true })
export class HabitCheckinEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => HabitEntity, { nullable: false, onDelete: "CASCADE" })
  habit: HabitEntity;

  /** Local date "YYYY-MM-DD" in the app time zone. */
  @Column({ type: "date" })
  date: string;

  @Column({ type: "enum", enum: HabitCheckinStatus })
  status: HabitCheckinStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
