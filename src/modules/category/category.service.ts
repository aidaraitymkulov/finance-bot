import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CategoryEntity } from "./category.entity";
import { Repository } from "typeorm";
import { DEFAULT_CATEGORIES } from "./category.deafult";
import { CategoryType } from "./category-type.enum";
import { OperationEntity } from "../operation/operation.entity";

@Injectable()
export class CategoryService implements OnModuleInit {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(OperationEntity)
    private readonly operationRepository: Repository<OperationEntity>,
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

  async createCategory(
    type: CategoryType,
    displayName: string,
  ): Promise<{ created: boolean; category?: CategoryEntity; reason?: string }> {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      return { created: false, reason: "empty_name" };
    }

    if (normalizedName.length > 64) {
      return { created: false, reason: "name_too_long" };
    }

    const existingByName = await this.findByDisplayName(type, normalizedName);
    if (existingByName) {
      return { created: false, reason: "exists" };
    }

    const code = await this.buildUniqueCode(type, normalizedName);
    const order = await this.getNextOrder(type);

    const category = this.categoryRepository.create({
      type,
      code,
      displayName: normalizedName,
      order,
    });

    const saved = await this.categoryRepository.save(category);
    return { created: true, category: saved };
  }

  async deleteCategory(
    type: CategoryType,
    code: string,
  ): Promise<{ deleted: boolean; reason?: string }> {
    const category = await this.getByCode(type, code);
    if (!category) {
      return { deleted: false, reason: "not_found" };
    }

    const usageCount = await this.operationRepository.count({
      where: { category: { id: category.id } },
    });

    if (usageCount > 0) {
      return { deleted: false, reason: "has_operations" };
    }

    await this.categoryRepository.delete({ id: category.id });
    return { deleted: true };
  }

  async renameCategory(
    type: CategoryType,
    code: string,
    displayName: string,
  ): Promise<{ renamed: boolean; category?: CategoryEntity; reason?: string }> {
    const category = await this.getByCode(type, code);
    if (!category) {
      return { renamed: false, reason: "not_found" };
    }

    const normalizedName = displayName.trim();
    if (!normalizedName) {
      return { renamed: false, reason: "empty_name" };
    }

    if (normalizedName.length > 64) {
      return { renamed: false, reason: "name_too_long" };
    }

    if (category.displayName.toLowerCase() === normalizedName.toLowerCase()) {
      return { renamed: false, reason: "same_name" };
    }

    const existingByName = await this.findByDisplayName(type, normalizedName);
    if (existingByName && existingByName.id !== category.id) {
      return { renamed: false, reason: "exists" };
    }

    category.displayName = normalizedName;
    const saved = await this.categoryRepository.save(category);
    return { renamed: true, category: saved };
  }

  private async findByDisplayName(
    type: CategoryType,
    displayName: string,
  ): Promise<CategoryEntity | null> {
    return this.categoryRepository
      .createQueryBuilder("category")
      .where("category.type = :type", { type })
      .andWhere("LOWER(category.displayName) = LOWER(:displayName)", { displayName })
      .getOne();
  }

  private normalizeCode(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return slug || "cat";
  }

  private async buildUniqueCode(type: CategoryType, displayName: string): Promise<string> {
    const base = this.normalizeCode(displayName);
    let candidate = base;
    let index = 2;

    while (await this.getByCode(type, candidate)) {
      candidate = `${base}_${index}`;
      index += 1;
    }

    return candidate;
  }

  private async getNextOrder(type: CategoryType): Promise<number> {
    const raw = await this.categoryRepository
      .createQueryBuilder("category")
      .select("MAX(category.order)", "max")
      .where("category.type = :type", { type })
      .getRawOne<{ max: string | null }>();

    const max = raw?.max ? Number(raw.max) : 0;
    return max + 1;
  }
}
