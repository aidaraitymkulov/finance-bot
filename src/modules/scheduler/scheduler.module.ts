import { Module } from "@nestjs/common";
import { UserModule } from "../user/user.module";
import { TaskModule } from "../task/task.module";
import { HabitModule } from "../habit/habit.module";
import { TelegramStateModule } from "../telegram/state/telegram-state.module";
import { NotificationService } from "./notification.service";

@Module({
  imports: [UserModule, TaskModule, HabitModule, TelegramStateModule],
  providers: [NotificationService],
})
export class SchedulerModule {}
