import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationEntity } from "./operation.entity";
import { CreateOperationDto } from "./dto/create-operation.dto";
import { UserEntity } from "../user/user.entity";

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
