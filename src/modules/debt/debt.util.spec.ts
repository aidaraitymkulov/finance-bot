import { DebtKind } from "./debt-kind.enum";
import { calcBalance, debtSign, normalizePerson, personRef, validatePerson } from "./debt.util";

describe("debtSign", () => {
  it.each([
    [DebtKind.LEND, 1],
    [DebtKind.SPLIT, 1],
    [DebtKind.REPAID_BY_ME, 1],
    [DebtKind.BORROW, -1],
    [DebtKind.REPAID_TO_ME, -1],
  ])("%s -> %i", (kind, sign) => {
    expect(debtSign(kind)).toBe(sign);
  });
});

describe("calcBalance", () => {
  it("is zero after a friend pays back the shared part of a purchase", () => {
    expect(
      calcBalance([
        { kind: DebtKind.SPLIT, amount: 1500 },
        { kind: DebtKind.REPAID_TO_ME, amount: 1500 },
      ]),
    ).toBe(0);
  });

  it("is negative when I owe more than I lent", () => {
    expect(
      calcBalance([
        { kind: DebtKind.LEND, amount: 500 },
        { kind: DebtKind.BORROW, amount: 1300.5 },
      ]),
    ).toBe(-800.5);
  });

  it("does not accumulate floating point noise", () => {
    expect(
      calcBalance([
        { kind: DebtKind.LEND, amount: 0.1 },
        { kind: DebtKind.LEND, amount: 0.2 },
      ]),
    ).toBe(0.3);
  });
});

describe("person helpers", () => {
  it("groups differently spelled names by the same key", () => {
    expect(normalizePerson("  Айбек ")).toEqual({ person: "Айбек", personKey: "айбек" });
    expect(normalizePerson("АЙБЕК").personKey).toBe(normalizePerson("айбек").personKey);
    expect(normalizePerson("Анна   Мария").person).toBe("Анна Мария");
  });

  it("validates names", () => {
    expect(validatePerson("   ")).toBe("empty_person");
    expect(validatePerson("a".repeat(65))).toBe("person_too_long");
    expect(validatePerson("Айбек")).toBeNull();
  });

  it("builds a short callback-safe ref", () => {
    const ref = personRef("очень длинное имя ".repeat(3));
    expect(ref).toMatch(/^[0-9a-f]{10}$/);
    expect(personRef("айбек")).toBe(personRef("айбек"));
    expect(personRef("айбек")).not.toBe(personRef("марат"));
  });
});
