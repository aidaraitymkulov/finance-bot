import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, SchedulerRegistry } from "@nestjs/schedule";
import { InjectBot } from "nestjs-telegraf";
import { Telegraf } from "telegraf";
import { APP_TIME_ZONE } from "../../common/constants/time-zone";
import { todayLocalDate } from "../../common/utils/local-date.util";
import { UserService } from "../user/user.service";
import { UserEntity } from "../user/user.entity";
import { TaskService } from "../task/task.service";
import { HabitService } from "../habit/habit.service";
import { SubscriptionService } from "../subscription/subscription.service";
import { BotPauseService } from "../telegram/state/bot-pause.service";
import { buildTaskListView } from "../telegram/views/task.views";
import { buildHabitPollView } from "../telegram/views/habit.views";
import { buildSubscriptionReminderView } from "../telegram/views/subscription.views";

const MORNING_DIGEST_JOB = "morning-digest";
const HABIT_POLL_JOB = "habit-poll";
const SUBSCRIPTION_REMINDER_JOB = "subscription-reminders";

@Injectable()
export class NotificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly userService: UserService,
    private readonly taskService: TaskService,
    private readonly habitService: HabitService,
    private readonly subscriptionService: SubscriptionService,
    private readonly botPauseService: BotPauseService,
  ) {}

  onApplicationBootstrap() {
    for (const name of [MORNING_DIGEST_JOB, HABIT_POLL_JOB, SUBSCRIPTION_REMINDER_JOB]) {
      const nextRun = this.schedulerRegistry.getCronJob(name).nextDate().toISO();
      this.logger.log(`Job "${name}" next run: ${nextRun}`);
    }
  }

  @Cron("0 9 * * *", { name: MORNING_DIGEST_JOB, timeZone: APP_TIME_ZONE })
  async sendMorningDigest() {
    const today = todayLocalDate();

    await this.forEachRecipient(async (user) => {
      const [tasks, habits] = await Promise.all([
        this.taskService.getOpenUntil(user, today),
        this.habitService.getActive(user),
      ]);

      const view = buildTaskListView(tasks, today, "today", "Доброе утро! ☀️");
      const habitsLine = habits.length > 0 ? `\n\n🔥 Привычек на сегодня: ${habits.length}` : "";
      await this.bot.telegram.sendMessage(user.telegramId, view.text + habitsLine, {
        reply_markup: view.reply_markup,
      });
    });
  }

  /** Reminds 3 days, 1 day and 0 days before a charge, and daily about unpaid past charges. */
  @Cron("0 9 * * *", { name: SUBSCRIPTION_REMINDER_JOB, timeZone: APP_TIME_ZONE })
  async sendSubscriptionReminders() {
    const today = todayLocalDate();

    await this.forEachRecipient(async (user) => {
      const due = await this.subscriptionService.getDueForReminder(user, today);
      if (due.length === 0) {
        return;
      }

      const view = buildSubscriptionReminderView(due, today);
      await this.bot.telegram.sendMessage(user.telegramId, view.text, {
        reply_markup: view.reply_markup,
      });
    });
  }

  @Cron("0 22 * * *", { name: HABIT_POLL_JOB, timeZone: APP_TIME_ZONE })
  async sendHabitPoll() {
    const today = todayLocalDate();

    await this.forEachRecipient(async (user) => {
      const unchecked = await this.habitService.getUnchecked(user, today);
      if (unchecked.length === 0) {
        return;
      }

      await this.bot.telegram.sendMessage(
        user.telegramId,
        "🌙 Как прошёл день? Отметьте привычки:",
      );
      for (const item of unchecked) {
        const view = buildHabitPollView(item);
        await this.bot.telegram.sendMessage(user.telegramId, view.text, {
          reply_markup: view.reply_markup,
        });
      }
    });
  }

  /** Allowed (if configured), non-paused users; one failing chat does not stop the rest. */
  private async forEachRecipient(send: (user: UserEntity) => Promise<void>) {
    const allowedUserId = this.configService.get<{ allowedUserId?: number }>(
      "telegram",
    )?.allowedUserId;
    const users = await this.userService.findAll();

    for (const user of users) {
      if (allowedUserId && user.telegramId !== String(allowedUserId)) {
        continue;
      }
      if (this.botPauseService.isPaused(user.telegramId)) {
        continue;
      }

      try {
        await send(user);
      } catch (error) {
        this.logger.warn(
          `Failed to notify user ${user.telegramId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
