import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OperationEntity } from "../operation/operation.entity";
import { ReportService } from "./report.service";
import { ExcelService } from "./excel.service";

@Module({
  imports: [TypeOrmModule.forFeature([OperationEntity])],
  providers: [ReportService, ExcelService],
  exports: [ReportService, ExcelService],
})
export class ReportModule {}
