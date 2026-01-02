import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "./user.entity";
import { Repository } from "typeorm";
import { TelegramUser } from "../telegram/types/telegram-user";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepository: Repository<UserEntity>,
  ) {}

  async getByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { telegramId: telegramId },
    });
  }

  async findOrCreateByTelegramUser(payload: TelegramUser): Promise<UserEntity> {
    const telegramId = payload.id;
    const userName = payload.userName;
    const firstName = payload.firstName;
    const lastName = payload.lastName;

    const existing = await this.userRepository.findOne({ where: { telegramId } });

    if (!existing) {
      const created = this.userRepository.create({ telegramId, userName, firstName, lastName });
      return this.userRepository.save(created);
    }

    let changed = false;

    if (existing.userName !== userName) {
      existing.userName = userName;
      changed = true;
    }
    if (existing.firstName !== firstName) {
      existing.firstName = firstName;
      changed = true;
    }
    if (existing.lastName !== lastName) {
      existing.lastName = lastName;
      changed = true;
    }

    return changed ? this.userRepository.save(existing) : existing;
  }
}
