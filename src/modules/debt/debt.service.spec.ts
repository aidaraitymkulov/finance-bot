import { DebtService } from "./debt.service";
import { DebtKind } from "./debt-kind.enum";
import { CategoryType } from "../category/category-type.enum";
import type { UserEntity } from "../user/user.entity";

const user = { id: 1 } as unknown as UserEntity;

const setupSplit = (options: { affected?: number; operation?: unknown } = {}) => {
  const entryRepo = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn().mockResolvedValue({}),
  };
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: options.affected ?? 1 }),
  };
  const manager = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    findOne: jest.fn().mockResolvedValue(options.operation ?? null),
    getRepository: jest.fn().mockReturnValue(entryRepo),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: unknown) => unknown) => callback(manager)),
  };
  const service = new DebtService({} as never, dataSource as never);
  return { service, entryRepo, queryBuilder, manager };
};

describe("DebtService.splitOperation", () => {
  it("shrinks the operation to the own share and records a SPLIT entry", async () => {
    const { service, entryRepo, queryBuilder } = setupSplit();

    const result = await service.splitOperation(user, "op-1", 1500, "  Айбек ");

    expect(result).toEqual({ split: true, amount: 1500 });
    expect(queryBuilder.setParameter).toHaveBeenCalledWith("shared", 1500);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('"amount" > :shared'),
      expect.objectContaining({ id: "op-1", userId: 1, type: CategoryType.EXPENSE }),
    );
    expect(entryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: DebtKind.SPLIT,
        amount: 1500,
        person: "Айбек",
        personKey: "айбек",
        operation: { id: "op-1" },
      }),
    );
  });

  it("accumulates the shared amount so one expense can be split between several people", async () => {
    const { service, entryRepo, queryBuilder } = setupSplit();

    await service.splitOperation(user, "op-1", 1500, "Айбек");
    await service.splitOperation(user, "op-1", 800, "Марат");

    expect(queryBuilder.where).not.toHaveBeenCalledWith(
      expect.stringContaining("IS NULL"),
      expect.anything(),
    );
    expect(queryBuilder.set).toHaveBeenCalledTimes(2);
    expect(entryRepo.save).toHaveBeenCalledTimes(2);
    expect(entryRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ person: "Марат", personKey: "марат", amount: 800 }),
    );
  });

  it("refuses a shared part that is not smaller than the expense", async () => {
    const { service, entryRepo } = setupSplit({
      affected: 0,
      operation: { type: CategoryType.EXPENSE, sharedAmount: 1500 },
    });

    const result = await service.splitOperation(user, "op-1", 5000, "Айбек");

    expect(result).toEqual({ split: false, reason: "too_much" });
    expect(entryRepo.save).not.toHaveBeenCalled();
  });

  it("reports a missing operation and rejects income", async () => {
    expect(
      await setupSplit({ affected: 0, operation: null }).service.splitOperation(
        user,
        "op-1",
        10,
        "Айбек",
      ),
    ).toEqual({ split: false, reason: "not_found" });
    expect(
      await setupSplit({
        affected: 0,
        operation: { type: CategoryType.INCOME, sharedAmount: null },
      }).service.splitOperation(user, "op-1", 10, "Айбек"),
    ).toEqual({ split: false, reason: "not_found" });
  });

  it("validates the person and the amount before touching the database", async () => {
    const { service, manager } = setupSplit();

    expect(await service.splitOperation(user, "op-1", 10, "  ")).toEqual({
      split: false,
      reason: "empty_person",
    });
    expect(await service.splitOperation(user, "op-1", 0, "Айбек")).toEqual({
      split: false,
      reason: "invalid_amount",
    });
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe("DebtService.getBalances", () => {
  it("parses numeric strings and puts the biggest balance first", async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { personKey: "марат", person: "Марат", balance: "-800.00" },
        { personKey: "айбек", person: "Айбек", balance: "1500.00" },
      ]),
    };
    const service = new DebtService(
      { createQueryBuilder: () => queryBuilder } as never,
      {} as never,
    );

    expect(await service.getBalances(user)).toEqual([
      { person: "Айбек", personKey: "айбек", balance: 1500 },
      { person: "Марат", personKey: "марат", balance: -800 },
    ]);
    expect(await service.getBalance(user, "несуществует")).toBe(0);
  });
});
