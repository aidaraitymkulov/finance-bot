import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: string;
  @Index({ unique: true })
  @Column({ type: "varchar", length: 64 })
  telegramId: string;
  @Column({ type: "varchar", length: 64 })
  userName: string;
  @Column({ type: "varchar", length: 64 })
  firstName: string;
  @Column({ type: "varchar", length: 64 })
  lastName: string;
  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
