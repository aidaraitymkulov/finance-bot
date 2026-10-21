import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserEntity } from "../user/user.entity";

@Entity({ name: "habits" })
export class HabitEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;

  @Column({ type: "varchar", length: 128 })
  title: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "int" })
  order: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
