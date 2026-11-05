import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DebtEntryEntity } from "./debt-entry.entity";
import { DebtService } from "./debt.service";

@Module({
  imports: [TypeOrmModule.forFeature([DebtEntryEntity])],
  providers: [DebtService],
  exports: [DebtService],
})
export class DebtModule {}
