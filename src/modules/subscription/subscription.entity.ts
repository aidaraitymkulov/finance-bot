import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserEntity } from "../user/user.entity";
import type { SubscriptionPeriod } from "./next-payment.util";

@Entity({ name: "subscriptions" })
export class SubscriptionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;

  @Column({ type: "varchar", length: 128 })
  name: string;

  @Column({
    type: "numeric",
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({ type: "varchar", length: 16 })
  period: SubscriptionPeriod;

  /** Day of month (1-31) the charge was set up on; see `addPeriod` in next-payment.util.ts. */
  @Column({ type: "smallint" })
  billingDay: number;

  /** Local date "YYYY-MM-DD" in the app time zone. Moved forward after each charge. */
  @Column({ type: "date" })
  nextPaymentDate: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
