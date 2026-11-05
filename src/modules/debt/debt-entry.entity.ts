import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "../user/user.entity";
import { OperationEntity } from "../operation/operation.entity";
import { DebtKind } from "./debt-kind.enum";

@Entity({ name: "debt_entries" })
@Index("IDX_debt_entries_user_person", ["user", "personKey"])
export class DebtEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;

  /** The name as the user typed it. */
  @Column({ type: "varchar", length: 64 })
  person: string;

  /** Lower-cased `person`; entries of one person are grouped by it. */
  @Column({ type: "varchar", length: 64 })
  personKey: string;

  @Column({ type: "enum", enum: DebtKind, enumName: "debt_entries_kind_enum" })
  kind: DebtKind;

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

  /** Set for `SPLIT`: the purchase part of which was paid for the person. */
  @ManyToOne(() => OperationEntity, { nullable: true, onDelete: "SET NULL" })
  operation: OperationEntity | null;

  @Column({ type: "varchar", length: 256, nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
