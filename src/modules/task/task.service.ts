import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, Repository } from "typeorm";
import { TaskEntity } from "./task.entity";
import { UserEntity } from "../user/user.entity";

const MAX_TITLE_LENGTH = 256;

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  async create(
    user: UserEntity,
    title: string,
    dueDate: string,
  ): Promise<{ created: boolean; task?: TaskEntity; reason?: string }> {
    const reason = TaskService.validateTitle(title);
    if (reason) {
      return { created: false, reason };
    }

    const task = this.taskRepository.create({ user, title: title.trim(), dueDate });
    return { created: true, task: await this.taskRepository.save(task) };
  }

  static validateTitle(title: string): "empty_title" | "title_too_long" | null {
    const normalized = title.trim();
    if (!normalized) {
      return "empty_title";
    }
    if (normalized.length > MAX_TITLE_LENGTH) {
      return "title_too_long";
    }
    return null;
  }

  /**
   * Open tasks due on or before `until`. Overdue tasks are not moved anywhere: they simply keep
   * showing up until done, which is how they "carry over" to today.
   */
  getOpenUntil(user: UserEntity, until: string): Promise<TaskEntity[]> {
    return this.taskRepository.find({
      where: { user: { id: user.id }, isDone: false, dueDate: LessThanOrEqual(until) },
      order: { dueDate: "ASC", createdAt: "ASC" },
    });
  }

  async markDone(user: UserEntity, taskId: string): Promise<boolean> {
    const task = await this.findOwned(user, taskId);
    if (!task || task.isDone) {
      return false;
    }
    task.isDone = true;
    task.doneAt = new Date();
    await this.taskRepository.save(task);
    return true;
  }

  async delete(user: UserEntity, taskId: string): Promise<boolean> {
    const task = await this.findOwned(user, taskId);
    if (!task) {
      return false;
    }
    await this.taskRepository.remove(task);
    return true;
  }

  private findOwned(user: UserEntity, taskId: string): Promise<TaskEntity | null> {
    return this.taskRepository.findOne({ where: { id: taskId, user: { id: user.id } } });
  }
}
