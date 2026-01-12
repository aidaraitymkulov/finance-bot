import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoryService } from "./category.service";
import { CategoryEntity } from "./category.entity";
import { OperationEntity } from "../operation/operation.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, OperationEntity])],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
