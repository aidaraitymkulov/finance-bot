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
