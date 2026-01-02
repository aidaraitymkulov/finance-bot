import { Module } from "@nestjs/common";
import { CategoryEntity } from "./category.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoryService } from "./category.service";

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity])],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
