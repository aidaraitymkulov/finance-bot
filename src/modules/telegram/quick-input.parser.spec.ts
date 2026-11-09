import { CategoryType } from "../category/category-type.enum";
import { parseQuickInput, QuickInputCategories } from "./quick-input.parser";

const categories: QuickInputCategories = {
  [CategoryType.EXPENSE]: [
    { code: "food", displayName: "🍔 Еда" },
    { code: "transport", displayName: "🚌 Проезд" },
    { code: "cafe", displayName: "☕ Кафе и бары" },
    { code: "other_expense", displayName: "✨ Другое" },
  ],
  [CategoryType.INCOME]: [
    { code: "work", displayName: "💼 Работа" },
    { code: "other_income", displayName: "✨ Другое" },
  ],
};

const parse = (text: string) => parseQuickInput(text, categories);

describe("parseQuickInput", () => {
  it("takes the amount and keeps the rest as a comment", () => {
    expect(parse("500 кофе")).toEqual({
      ok: true,
      type: CategoryType.EXPENSE,
      amount: 500,
      categoryCode: null,
      comment: "кофе",
    });
  });

  it("finds the category by name ignoring emoji, case and ё, in any position", () => {
    expect(parse("еда 500")).toMatchObject({ categoryCode: "food", comment: null });
    expect(parse("500 ЕДА кофе с Колей")).toMatchObject({
      categoryCode: "food",
      comment: "кофе с Колей",
    });
    expect(parse("500 обед Еда")).toMatchObject({ categoryCode: "food", comment: "обед" });
  });

  it("matches multi-word category names", () => {
    expect(parse("900 кафе и бары пятница")).toMatchObject({
      categoryCode: "cafe",
      comment: "пятница",
    });
  });

  it("treats a leading + as income and only looks at income categories", () => {
    expect(parse("+50000 работа")).toMatchObject({
      type: CategoryType.INCOME,
      amount: 50000,
      categoryCode: "work",
    });
    expect(parse("+ 700 еда")).toMatchObject({
      type: CategoryType.INCOME,
      categoryCode: null,
      comment: "еда",
    });
  });

  it("looks for the shared name 'Другое' only within the type", () => {
    expect(parse("100 другое")).toMatchObject({ categoryCode: "other_expense" });
    expect(parse("+100 другое")).toMatchObject({ categoryCode: "other_income" });
  });

  it("parses decimals and space-grouped thousands", () => {
    expect(parse("1250,50 такси")).toMatchObject({ amount: 1250.5, comment: "такси" });
    expect(parse("1 200 такси")).toMatchObject({ amount: 1200, comment: "такси" });
    expect(parse("такси 1 200")).toMatchObject({ amount: 1200, comment: "такси" });
  });

  it("ignores numbers in the middle of the text", () => {
    expect(parse("кофе 2 шт 500")).toMatchObject({ amount: 500, comment: "кофе 2 шт" });
    expect(parse("500 кофе 2 шт")).toMatchObject({ amount: 500, comment: "кофе 2 шт" });
  });

  it("returns null when there is no amount at an edge", () => {
    expect(parse("привет")).toBeNull();
    expect(parse("привет 5 мир")).toBeNull();
    expect(parse("12abc кофе")).toBeNull();
  });

  it("rejects zero and amounts that do not fit the column", () => {
    expect(parse("0 кофе")).toEqual({ ok: false, reason: "bad_amount" });
    expect(parse("99999999999 кофе")).toEqual({ ok: false, reason: "bad_amount" });
  });

  it("drops emoji-only leftovers", () => {
    expect(parse("500 🍔 еда")).toMatchObject({ categoryCode: "food", comment: null });
  });
});
