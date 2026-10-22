import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, Repository } from "typeorm";
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

  /**
   * All subscriptions of the user, soonest charge first (unpaid past charges come first).
   * Dates are never moved automatically: only `markPaid` / `skip` move a subscription forward.
   */
  getAll(user: UserEntity): Promise<SubscriptionEntity[]> {
    return this.subscriptionRepository.find({
      where: { user: { id: user.id } },
      order: { nextPaymentDate: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * Subscriptions for the 09:00 reminder: charges `REMINDER_DAYS_BEFORE` days away, plus every
   * unpaid past charge (reminded daily until the user taps "Оплачено" or "Пропустить").
   */
  async getDueForReminder(user: UserEntity, today: string): Promise<SubscriptionEntity[]> {
    const upcoming = await this.subscriptionRepository.find({
      where: {
        user: { id: user.id },
        nextPaymentDate: LessThanOrEqual(addDays(today, Math.max(...REMINDER_DAYS_BEFORE))),
      },
      order: { nextPaymentDate: "ASC", createdAt: "ASC" },
    });
    return upcoming.filter((item) => {
      const days = daysUntil(item.nextPaymentDate, today);
      return days < 0 || REMINDER_DAYS_BEFORE.includes(days);
    });
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
    const subscription = await this.findOwned(user, subscriptionId);
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

    if (!(await this.advance(subscription, expectedDate))) {
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

  /** Moves the charge due on `expectedDate` to the next period without recording an expense. */
  async skip(
    user: UserEntity,
    subscriptionId: string,
    expectedDate: string,
  ): Promise<{ skipped: boolean; reason?: "not_found" | "already_paid" }> {
    const subscription = await this.findOwned(user, subscriptionId);
    if (!subscription) {
      return { skipped: false, reason: "not_found" };
    }
    if (!(await this.advance(subscription, expectedDate))) {
      return { skipped: false, reason: "already_paid" };
    }
    return { skipped: true };
  }

  async delete(user: UserEntity, subscriptionId: string): Promise<boolean> {
    const subscription = await this.findOwned(user, subscriptionId);
    if (!subscription) {
      return false;
    }
    await this.subscriptionRepository.remove(subscription);
    return true;
  }

  private findOwned(user: UserEntity, subscriptionId: string) {
    return this.subscriptionRepository.findOne({
      where: { id: subscriptionId, user: { id: user.id } },
    });
  }

  /**
   * Conditional update: moves the date one period forward only if it still equals `expectedDate`,
   * so only one of several taps (or concurrent taps) on the same charge succeeds.
   */
  private async advance(subscription: SubscriptionEntity, expectedDate: string) {
    const moved = await this.subscriptionRepository.update(
      { id: subscription.id, nextPaymentDate: expectedDate },
      { nextPaymentDate: addPeriod(expectedDate, subscription.period, subscription.billingDay) },
    );
    return Boolean(moved.affected);
  }
}
