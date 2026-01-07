import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OperationEntity } from "../operation/operation.entity";
import { ReportService } from "./report.service";

@Module({
  imports: [TypeOrmModule.forFeature([OperationEntity])],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
