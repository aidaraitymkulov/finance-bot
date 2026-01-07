import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserEntity } from "../user/user.entity";
import { CategoryEntity } from "../category/category.entity";
import { CategoryType } from "../category/category-type.enum";

@Entity({ name: "operations" })
export class OperationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;

  @ManyToOne(() => CategoryEntity, { nullable: false })
  category: CategoryEntity;

  @Column({ type: "enum", enum: CategoryType })
  type: CategoryType;

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

  @Column({ type: "varchar", length: 256, nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
