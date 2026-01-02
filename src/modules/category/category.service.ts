import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CategoryEntity } from "./category.entity";
import { Repository } from "typeorm";
import { DEFAULT_CATEGORIES } from "./category.deafult";
import { CategoryType } from "./category-type.enum";

@Injectable()
export class CategoryService implements OnModuleInit {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  async ensureDefaults(): Promise<void> {
    for (const def of DEFAULT_CATEGORIES) {
      const exists = await this.categoryRepository.findOne({
        where: { type: def.type, code: def.code },
      });
      if (!exists) {
        const entity = this.categoryRepository.create(def);
        await this.categoryRepository.save(entity);
      }
    }
    this.logger.log("Default categories ensured");
  }

  async getCategoriesByType(type: CategoryType): Promise<CategoryEntity[]> {
    return this.categoryRepository.find({
      where: { type },
      order: { order: "ASC" },
    });
  }

  async getByCode(type: CategoryType, code: string): Promise<CategoryEntity | null> {
    return this.categoryRepository.findOne({ where: { type, code } });
  }
}
