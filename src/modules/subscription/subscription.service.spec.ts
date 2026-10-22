import { SubscriptionService } from "./subscription.service";
import type { SubscriptionEntity } from "./subscription.entity";
import type { UserEntity } from "../user/user.entity";
import type { CategoryService } from "../category/category.service";
import type { OperationService } from "../operation/operation.service";

const user = { id: 1 } as unknown as UserEntity;
const category = { id: "cat-1" };

const buildSubscription = (overrides: Partial<SubscriptionEntity> = {}) =>
  ({
    id: "sub-1",
    name: "Хостинг",
    amount: 990,
    period: "monthly",
    billingDay: 31,
    nextPaymentDate: "2026-01-31",
    ...overrides,
  }) as SubscriptionEntity;

const setup = (options: { subscription?: SubscriptionEntity | null; affected?: number } = {}) => {
  const repository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest
      .fn()
      .mockResolvedValue(
        options.subscription === undefined ? buildSubscription() : options.subscription,
      ),
    update: jest.fn().mockResolvedValue({ affected: options.affected ?? 1 }),
  };
  const operationService = { createOperation: jest.fn().mockResolvedValue({}) };
  const categoryService = { getByCode: jest.fn().mockResolvedValue(category) };

  const service = new SubscriptionService(
    repository as never,
    operationService as unknown as OperationService,
    categoryService as unknown as CategoryService,
  );
  return { service, repository, operationService, categoryService };
};

describe("SubscriptionService.markPaid", () => {
  it("records an expense and moves the date one period forward", async () => {
    const { service, repository, operationService } = setup();

    const result = await service.markPaid(user, "sub-1", "2026-01-31");

    expect(result.paid).toBe(true);
    expect(repository.update).toHaveBeenCalledWith(
      { id: "sub-1", nextPaymentDate: "2026-01-31" },
      { nextPaymentDate: "2026-02-28" },
    );
    expect(operationService.createOperation).toHaveBeenCalledWith({
      user,
      category,
      type: "EXPENSE",
      amount: 990,
      comment: "Хостинг",
    });
  });

  it("does not create a second expense when the date was already moved", async () => {
    const { service, operationService } = setup({ affected: 0 });

    const result = await service.markPaid(user, "sub-1", "2026-01-31");

    expect(result).toEqual({ paid: false, reason: "already_paid" });
    expect(operationService.createOperation).not.toHaveBeenCalled();
  });

  it("restores the date and rethrows when the expense cannot be saved", async () => {
    const { service, repository, operationService } = setup();
    operationService.createOperation.mockRejectedValue(new Error("db down"));

    await expect(service.markPaid(user, "sub-1", "2026-01-31")).rejects.toThrow("db down");
    expect(repository.update).toHaveBeenLastCalledWith(
      { id: "sub-1" },
      { nextPaymentDate: "2026-01-31" },
    );
  });

  it("reports an unknown subscription without touching anything", async () => {
    const { service, repository, operationService } = setup({ subscription: null });

    const result = await service.markPaid(user, "sub-1", "2026-01-31");

    expect(result).toEqual({ paid: false, reason: "not_found" });
    expect(repository.update).not.toHaveBeenCalled();
    expect(operationService.createOperation).not.toHaveBeenCalled();
  });

  it("reports a missing category without moving the date", async () => {
    const { service, repository, categoryService } = setup();
    categoryService.getByCode.mockResolvedValue(null);

    const result = await service.markPaid(user, "sub-1", "2026-01-31");

    expect(result).toEqual({ paid: false, reason: "no_category" });
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe("SubscriptionService.markPaid after the charge date", () => {
  it("still records a charge that is days or months old", async () => {
    const { service, repository, operationService } = setup({
      subscription: buildSubscription({ nextPaymentDate: "2025-11-30", billingDay: 30 }),
    });

    const result = await service.markPaid(user, "sub-1", "2025-11-30");

    expect(result.paid).toBe(true);
    expect(repository.update).toHaveBeenCalledWith(
      { id: "sub-1", nextPaymentDate: "2025-11-30" },
      { nextPaymentDate: "2025-12-30" },
    );
    expect(operationService.createOperation).toHaveBeenCalledTimes(1);
  });
});

describe("SubscriptionService.skip", () => {
  it("moves the date one period forward without recording an expense", async () => {
    const { service, repository, operationService } = setup();

    const result = await service.skip(user, "sub-1", "2026-01-31");

    expect(result).toEqual({ skipped: true });
    expect(repository.update).toHaveBeenCalledWith(
      { id: "sub-1", nextPaymentDate: "2026-01-31" },
      { nextPaymentDate: "2026-02-28" },
    );
    expect(operationService.createOperation).not.toHaveBeenCalled();
  });

  it("is a no-op when the charge was already paid or skipped", async () => {
    const { service } = setup({ affected: 0 });

    expect(await service.skip(user, "sub-1", "2026-01-31")).toEqual({
      skipped: false,
      reason: "already_paid",
    });
  });

  it("reports an unknown subscription", async () => {
    const { service, repository } = setup({ subscription: null });

    expect(await service.skip(user, "sub-1", "2026-01-31")).toEqual({
      skipped: false,
      reason: "not_found",
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe("SubscriptionService.getDueForReminder", () => {
  it("keeps unpaid past charges and charges 3, 1 and 0 days away", async () => {
    const { service, repository } = setup();
    const dates = [
      "2026-08-15",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];
    repository.find.mockResolvedValue(
      dates.map((date) => buildSubscription({ id: date, nextPaymentDate: date })),
    );

    const due = await service.getDueForReminder(user, "2026-10-22");

    expect(due.map((item) => item.nextPaymentDate)).toEqual([
      "2026-08-15",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-25",
    ]);
  });
});
