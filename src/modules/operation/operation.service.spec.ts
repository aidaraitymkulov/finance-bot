import { OperationService } from "./operation.service";
import type { UserEntity } from "../user/user.entity";
import type { CategoryEntity } from "../category/category.entity";

const user = { id: 1 } as unknown as UserEntity;

const setup = (found: unknown) => {
  const repository = {
    findOne: jest.fn().mockResolvedValue(found),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  return { service: new OperationService(repository as never), repository };
};

describe("OperationService.update", () => {
  it("changes only the given fields and keeps the rest", async () => {
    const { service, repository } = setup({
      id: "op-1",
      amount: 100,
      comment: "a",
      sharedAmount: 40,
    });

    const result = await service.update(user, "op-1", { amount: 250 });

    expect(result).toEqual({ id: "op-1", amount: 250, comment: "a", sharedAmount: 40 });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it("clears the comment and switches the category", async () => {
    const { service } = setup({ id: "op-1", amount: 100, comment: "a" });
    const category = { id: "cat-2" } as CategoryEntity;

    expect(await service.update(user, "op-1", { comment: null, category })).toEqual({
      id: "op-1",
      amount: 100,
      comment: null,
      category,
    });
  });

  it("returns null for an operation that is not the user's", async () => {
    const { service, repository } = setup(null);

    expect(await service.update(user, "op-1", { amount: 1 })).toBeNull();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
