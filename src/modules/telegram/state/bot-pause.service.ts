import { Injectable, OnModuleInit } from "@nestjs/common";
import { UserService } from "../../user/user.service";
import { TelegramUser } from "../types/telegram-user";

/**
 * `/disable` pause, persisted in `users.isPaused`. Paused IDs are cached in memory so the
 * access middleware can check them synchronously on every update; writes go to the DB first.
 */
@Injectable()
export class BotPauseService implements OnModuleInit {
  private readonly pausedUsers = new Set<string>();

  constructor(private readonly userService: UserService) {}

  async onModuleInit() {
    for (const telegramId of await this.userService.findPausedTelegramIds()) {
      this.pausedUsers.add(telegramId);
    }
  }

  isPaused(userId: string): boolean {
    return this.pausedUsers.has(userId);
  }

  async pause(user: TelegramUser): Promise<void> {
    await this.userService.setPaused(user, true);
    this.pausedUsers.add(user.id);
  }

  async resume(user: TelegramUser): Promise<void> {
    if (!this.pausedUsers.has(user.id)) {
      return;
    }
    await this.userService.setPaused(user, false);
    this.pausedUsers.delete(user.id);
  }
}
