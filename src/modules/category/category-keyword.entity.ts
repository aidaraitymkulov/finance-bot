import {
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "../user/user.entity";
import { CategoryEntity } from "./category.entity";

/** "Word from a comment -> category the user last put it in"; drives quick input. */
@Entity({ name: "category_keywords" })
@Index("UQ_category_keywords_user_word", ["user", "word"], { unique: true })
export class CategoryKeywordEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;

  /** Normalized with `normalizeWord`. */
  @Column({ type: "varchar", length: 64 })
  word: string;

  @ManyToOne(() => CategoryEntity, { nullable: false, onDelete: "CASCADE" })
  category: CategoryEntity;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
