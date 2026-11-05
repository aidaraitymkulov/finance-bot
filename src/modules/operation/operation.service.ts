import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationEntity } from "./operation.entity";
import { CreateOperationDto } from "./dto/create-operation.dto";
import { UserEntity } from "../user/user.entity";
import { CategoryEntity } from "../category/category.entity";

@Injectable()
export class OperationService {
  constructor(
    @InjectRepository(OperationEntity)
    private readonly operationRepository: Repository<OperationEntity>,
  ) {}

  async createOperation(dto: CreateOperationDto): Promise<OperationEntity> {
    const entity = this.operationRepository.create(dto);
    return this.operationRepository.save(entity);
  }

  findOwned(user: UserEntity, operationId: string): Promise<OperationEntity | null> {
    return this.operationRepository.findOne({
      where: { id: operationId, user: { id: user.id } },
      relations: { category: true },
    });
  }

  /**
   * Changes the amount (for a split expense this is the user's own share), the comment or the
   * category. Returns null when the operation is not the user's.
   */
  async update(
    user: UserEntity,
    operationId: string,
    patch: { amount?: number; comment?: string | null; category?: CategoryEntity },
  ): Promise<OperationEntity | null> {
    const operation = await this.findOwned(user, operationId);
    if (!operation) {
      return null;
    }
    Object.assign(operation, patch);
    return this.operationRepository.save(operation);
  }

  async getLastOperationsPage(
    user: UserEntity,
    limit = 10,
    offset = 0,
  ): Promise<{ items: OperationEntity[]; hasMore: boolean }> {
    const items = await this.operationRepository.find({
      where: { user: { id: user.id } },
      relations: { category: true },
      order: { createdAt: "DESC" },
      take: limit + 1,
      skip: offset,
    });

    return {
      items: items.slice(0, limit),
      hasMore: items.length > limit,
    };
  }
}
