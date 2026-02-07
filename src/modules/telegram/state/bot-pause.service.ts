import { Injectable } from "@nestjs/common";

@Injectable()
export class BotPauseService {
  private readonly pausedUsers = new Set<string>();

  isPaused(userId: string): boolean {
    return this.pausedUsers.has(userId);
  }

  pause(userId: string): void {
    this.pausedUsers.add(userId);
  }

  resume(userId: string): void {
    this.pausedUsers.delete(userId);
  }
}
