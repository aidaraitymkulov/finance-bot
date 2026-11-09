import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoryService } from "./category.service";
import { CategoryEntity } from "./category.entity";
import { CategoryKeywordEntity } from "./category-keyword.entity";
import { CategoryKeywordService } from "./category-keyword.service";
import { OperationEntity } from "../operation/operation.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, CategoryKeywordEntity, OperationEntity])],
  providers: [CategoryService, CategoryKeywordService],
  exports: [CategoryService, CategoryKeywordService],
})
export class CategoryModule {}
