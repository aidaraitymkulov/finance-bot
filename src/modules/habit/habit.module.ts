import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HabitEntity } from "./habit.entity";
import { HabitCheckinEntity } from "./habit-checkin.entity";
import { HabitService } from "./habit.service";

@Module({
  imports: [TypeOrmModule.forFeature([HabitEntity, HabitCheckinEntity])],
  providers: [HabitService],
  exports: [HabitService],
})
export class HabitModule {}
