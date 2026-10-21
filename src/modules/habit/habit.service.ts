import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HabitEntity } from "./habit.entity";
import { HabitCheckinEntity } from "./habit-checkin.entity";
import { HabitCheckinStatus } from "./habit-checkin-status.enum";
import { calcStreak, StreakResult } from "./streak.util";
import { UserEntity } from "../user/user.entity";

const MAX_TITLE_LENGTH = 128;

export interface HabitWithStats {
  habit: HabitEntity;
  streak: StreakResult;
  todayStatus: HabitCheckinStatus | null;
}

@Injectable()
export class HabitService {
  constructor(
    @InjectRepository(HabitEntity)
    private readonly habitRepository: Repository<HabitEntity>,
    @InjectRepository(HabitCheckinEntity)
    private readonly checkinRepository: Repository<HabitCheckinEntity>,
  ) {}

  async create(
    user: UserEntity,
    title: string,
  ): Promise<{ created: boolean; habit?: HabitEntity; reason?: string }> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return { created: false, reason: "empty_title" };
    }
    if (normalizedTitle.length > MAX_TITLE_LENGTH) {
      return { created: false, reason: "title_too_long" };
    }

    const count = await this.habitRepository.count({ where: { user: { id: user.id } } });
    const habit = this.habitRepository.create({ user, title: normalizedTitle, order: count + 1 });
    return { created: true, habit: await this.habitRepository.save(habit) };
  }

  getActive(user: UserEntity): Promise<HabitEntity[]> {
    return this.habitRepository.find({
      where: { user: { id: user.id }, isActive: true },
      order: { order: "ASC", createdAt: "ASC" },
    });
  }

  async getActiveWithStats(user: UserEntity, today: string): Promise<HabitWithStats[]> {
    const habits = await this.getActive(user);
    return this.withStats(habits, today);
  }

  /** Active habits that have no check-in (done or skipped) on `date`. */
  async getUnchecked(user: UserEntity, date: string): Promise<HabitWithStats[]> {
    const habits = await this.getActiveWithStats(user, date);
    return habits.filter((item) => item.todayStatus === null);
  }

  async archive(user: UserEntity, habitId: string): Promise<boolean> {
    const habit = await this.findOwned(user, habitId);
    if (!habit) {
      return false;
    }
    habit.isActive = false;
    await this.habitRepository.save(habit);
    return true;
  }

  /** Records (or overwrites) the check-in for `date` and returns the habit with fresh stats. */
  async checkIn(
    user: UserEntity,
    habitId: string,
    date: string,
    status: HabitCheckinStatus,
  ): Promise<HabitWithStats | null> {
    const habit = await this.findOwned(user, habitId);
    if (!habit || !habit.isActive) {
      return null;
    }

    const existing = await this.checkinRepository.findOne({
      where: { habit: { id: habit.id }, date },
    });
    if (existing) {
      existing.status = status;
      await this.checkinRepository.save(existing);
    } else {
      await this.checkinRepository.save(this.checkinRepository.create({ habit, date, status }));
    }

    const [stats] = await this.withStats([habit], date);
    return stats;
  }

  private findOwned(user: UserEntity, habitId: string): Promise<HabitEntity | null> {
    return this.habitRepository.findOne({ where: { id: habitId, user: { id: user.id } } });
  }

  private async withStats(habits: HabitEntity[], today: string): Promise<HabitWithStats[]> {
    if (habits.length === 0) {
      return [];
    }

    const rows = await this.checkinRepository
      .createQueryBuilder("checkin")
      .select('checkin."habitId"', "habitId")
      // Raw pg results turn `date` into a JS Date; keep it as a local "YYYY-MM-DD" string.
      .addSelect(`to_char(checkin.date, 'YYYY-MM-DD')`, "date")
      .addSelect("checkin.status", "status")
      .where('checkin."habitId" IN (:...ids)', { ids: habits.map((habit) => habit.id) })
      .getRawMany<{ habitId: string; date: string; status: HabitCheckinStatus }>();

    return habits.map((habit) => {
      const own = rows.filter((row) => row.habitId === habit.id);
      const doneDates = own
        .filter((row) => row.status === HabitCheckinStatus.DONE)
        .map((row) => row.date);
      const todayRow = own.find((row) => row.date === today);
      return {
        habit,
        streak: calcStreak(doneDates, today),
        todayStatus: todayRow?.status ?? null,
      };
    });
  }
}
