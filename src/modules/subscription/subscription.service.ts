import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, LessThan, Repository } from "typeorm";
import { SubscriptionEntity } from "./subscription.entity";
import { UserEntity } from "../user/user.entity";
import { addDays, fromLocalDateString } from "../../common/utils/local-date.util";
import {
  addPeriod,
  daysUntil,
  nextPaymentOnOrAfter,
  SubscriptionPeriod,
} from "./next-payment.util";
import { CategoryService } from "../category/category.service";
import { CategoryType } from "../category/category-type.enum";
import { SUBSCRIPTIONS_CATEGORY_CODE } from "../category/category.deafult";
import { OperationService } from "../operation/operation.service";

const MAX_NAME_LENGTH = 128;
// numeric(12,2) holds up to 10 integer digits.
const MAX_AMOUNT = 9_999_999_999;

/** How many days before the charge a reminder is sent (0 = on the charge day). */
export const REMINDER_DAYS_BEFORE = [3, 1, 0];

export type SubscriptionCreateError = "empty_name" | "name_too_long" | "invalid_amount";

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    private readonly operationService: OperationService,
    private readonly categoryService: CategoryService,
  ) {}

  async create(
    user: UserEntity,
    name: string,
    amount: number,
    period: SubscriptionPeriod,
    paymentDate: string,
    today: string,
  ): Promise<{ created: boolean; subscription?: SubscriptionEntity; reason?: string }> {
    const reason =
      SubscriptionService.validateName(name) ?? SubscriptionService.validateAmount(amount);
    if (reason) {
      return { created: false, reason };
    }

    const billingDay = fromLocalDateString(paymentDate).getDate();
    const subscription = this.subscriptionRepository.create({
      user,
      name: name.trim(),
      amount,
      period,
      billingDay,
      nextPaymentDate: nextPaymentOnOrAfter(paymentDate, period, billingDay, today),
    });
    return { created: true, subscription: await this.subscriptionRepository.save(subscription) };
  }

  static validateName(name: string): "empty_name" | "name_too_long" | null {
    const normalized = name.trim();
    if (!normalized) {
      return "empty_name";
    }
    if (normalized.length > MAX_NAME_LENGTH) {
      return "name_too_long";
    }
    return null;
  }

  static validateAmount(amount: number): "invalid_amount" | null {
    return Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT ? null : "invalid_amount";
  }

  /** All subscriptions of the user, soonest charge first. Past charge dates are moved forward. */
  async getAll(user: UserEntity, today: string): Promise<SubscriptionEntity[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { user: { id: user.id } },
      order: { nextPaymentDate: "ASC", createdAt: "ASC" },
    });

    const stale = subscriptions.filter((item) => item.nextPaymentDate < today);
    if (stale.length === 0) {
      return subscriptions;
    }

    SubscriptionService.rollForward(stale, today);
    await this.subscriptionRepository.save(stale);
    return subscriptions.sort(
      (a, b) =>
        a.nextPaymentDate.localeCompare(b.nextPaymentDate) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  /** Subscriptions that are `REMINDER_DAYS_BEFORE` days away from their charge date. */
  async getDueForReminder(user: UserEntity, today: string): Promise<SubscriptionEntity[]> {
    const upcoming = await this.subscriptionRepository.find({
      where: {
        user: { id: user.id },
        nextPaymentDate: Between(today, addDays(today, Math.max(...REMINDER_DAYS_BEFORE))),
      },
      order: { nextPaymentDate: "ASC", createdAt: "ASC" },
    });
    return upcoming.filter((item) =>
      REMINDER_DAYS_BEFORE.includes(daysUntil(item.nextPaymentDate, today)),
    );
  }

  /** Moves every subscription whose charge date has passed to its next billing date. */
  async advanceOverdue(today: string): Promise<number> {
    const stale = await this.subscriptionRepository.find({
      where: { nextPaymentDate: LessThan(today) },
    });
    SubscriptionService.rollForward(stale, today);
    await this.subscriptionRepository.save(stale);
    return stale.length;
  }

  /**
   * Records the charge due on `expectedDate` as an expense and moves the subscription to the next
   * period. `expectedDate` makes a repeated tap (or an old reminder) a no-op instead of a duplicate.
   */
  async markPaid(
    user: UserEntity,
    subscriptionId: string,
    expectedDate: string,
  ): Promise<{
    paid: boolean;
    subscription?: SubscriptionEntity;
    reason?: "not_found" | "already_paid" | "no_category";
  }> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, user: { id: user.id } },
    });
    if (!subscription) {
      return { paid: false, reason: "not_found" };
    }

    const category = await this.categoryService.getByCode(
      CategoryType.EXPENSE,
      SUBSCRIPTIONS_CATEGORY_CODE,
    );
    if (!category) {
      return { paid: false, reason: "no_category" };
    }

    // Conditional update: only one of several concurrent taps can move the date.
    const moved = await this.subscriptionRepository.update(
      { id: subscription.id, nextPaymentDate: expectedDate },
      { nextPaymentDate: addPeriod(expectedDate, subscription.period, subscription.billingDay) },
    );
    if (!moved.affected) {
      return { paid: false, reason: "already_paid" };
    }

    try {
      await this.operationService.createOperation({
        user,
        category,
        type: CategoryType.EXPENSE,
        amount: subscription.amount,
        comment: subscription.name,
      });
    } catch (error) {
      await this.subscriptionRepository.update(
        { id: subscription.id },
        { nextPaymentDate: expectedDate },
      );
      throw error;
    }

    return { paid: true, subscription };
  }

  async delete(user: UserEntity, subscriptionId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, user: { id: user.id } },
    });
    if (!subscription) {
      return false;
    }
    await this.subscriptionRepository.remove(subscription);
    return true;
  }

  private static rollForward(subscriptions: SubscriptionEntity[], today: string) {
    for (const item of subscriptions) {
      item.nextPaymentDate = nextPaymentOnOrAfter(
        item.nextPaymentDate,
        item.period,
        item.billingDay,
        today,
      );
    }
  }
}
