import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationEntity } from "./operation.entity";
import { CreateOperationDto } from "./dto/create-operation.dto";

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
}
