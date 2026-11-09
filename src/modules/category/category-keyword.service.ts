import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CategoryEntity } from "./category.entity";
import { CategoryKeywordEntity } from "./category-keyword.entity";
import { CategoryType } from "./category-type.enum";
import { extractKeywords } from "./category-keyword.util";
import { UserEntity } from "../user/user.entity";

@Injectable()
export class CategoryKeywordService {
  constructor(
    @InjectRepository(CategoryKeywordEntity)
    private readonly keywordRepository: Repository<CategoryKeywordEntity>,
  ) {}

  /** The category of the most recently used known word of the comment, or null. */
  async findCategory(
    user: UserEntity,
    type: CategoryType,
    comment: string | null,
  ): Promise<CategoryEntity | null> {
    const words = extractKeywords(comment);
    if (words.length === 0) {
      return null;
    }

    const found = await this.keywordRepository
      .createQueryBuilder("keyword")
      .innerJoinAndSelect("keyword.category", "category")
      .where("keyword.userId = :userId", { userId: user.id })
      .andWhere("keyword.word IN (:...words)", { words })
      .andWhere("category.type = :type", { type })
      .orderBy("keyword.updatedAt", "DESC")
      .getOne();
    return found?.category ?? null;
  }

  /** Points every significant word of the comment at the category (the last choice wins). */
  async remember(user: UserEntity, category: CategoryEntity, comment: string | null) {
    const words = extractKeywords(comment);
    if (words.length === 0) {
      return;
    }

    await this.keywordRepository
      .createQueryBuilder()
      .insert()
      .into(CategoryKeywordEntity)
      .values(words.map((word) => ({ user: { id: user.id }, word, category: { id: category.id } })))
      .orUpdate(["categoryId", "updatedAt"], ["userId", "word"])
      .execute();
  }
}
