import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { CategoryType } from "./category-type.enum";

@Entity({ name: "categories" })
@Index(["type", "code"], { unique: true })
export class CategoryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;
  @Column({ type: "enum", enum: CategoryType })
  type: CategoryType;
  @Column({ type: "varchar", length: 64 })
  code: string;
  @Column({ type: "varchar", length: 64 })
  displayName: string;
  @Column({ type: "int" })
  order: number;
  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
