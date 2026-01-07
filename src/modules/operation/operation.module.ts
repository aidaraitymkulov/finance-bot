import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OperationEntity } from "./operation.entity";
import { OperationService } from "./operation.service";

@Module({
  imports: [TypeOrmModule.forFeature([OperationEntity])],
  providers: [OperationService],
  exports: [OperationService],
})
export class OperationModule {}
