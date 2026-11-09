import { CategoryType } from "../category/category-type.enum";
import { normalizeWord } from "../category/category-keyword.util";

/** `numeric(12,2)` holds up to 10 integer digits. */
const MAX_AMOUNT = 9_999_999_999.99;
const COMMENT_MAX_LENGTH = 256;

const NUMBER = String.raw`\d{1,3}(?:\s\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const LEADING_AMOUNT = new RegExp(`^(${NUMBER})(?:\\s+|$)`);
const TRAILING_AMOUNT = new RegExp(`(?:^|\\s)(${NUMBER})$`);

export interface QuickCategory {
  code: string;
  displayName: string;
}

export type QuickInputCategories = Record<CategoryType, QuickCategory[]>;

export type QuickInputResult =
  | {
      ok: true;
      type: CategoryType;
      amount: number;
      /** Set when the text names a category explicitly. */
      categoryCode: string | null;
      comment: string | null;
    }
  | { ok: false; reason: "bad_amount" };

const toAmount = (raw: string): number | null => {
  const amount = Number(raw.replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT
    ? Math.round(amount * 100) / 100
    : null;
};

/** Splits "<amount> rest" / "rest <amount>"; the amount must be the first or the last token. */
const extractAmount = (text: string): { raw: string; rest: string } | null => {
  const leading = LEADING_AMOUNT.exec(text);
  if (leading) {
    return { raw: leading[1], rest: text.slice(leading[0].length) };
  }

  const trailing = TRAILING_AMOUNT.exec(text);
  if (trailing) {
    return { raw: trailing[1], rest: text.slice(0, trailing.index) };
  }
  return null;
};

/** Finds the leftmost run of tokens equal to a category name; the longest name wins on a tie. */
const extractCategory = (
  tokens: string[],
  categories: QuickCategory[],
): { code: string; start: number; length: number } | null => {
  const normalizedTokens = tokens.map(normalizeWord);
  const candidates = categories
    .map((category) => ({
      code: category.code,
      words: category.displayName.split(/\s+/).map(normalizeWord).filter(Boolean),
    }))
    .filter((candidate) => candidate.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length);

  for (let start = 0; start < normalizedTokens.length; start += 1) {
    for (const { code, words } of candidates) {
      const matches = words.every((word, offset) => normalizedTokens[start + offset] === word);
      if (matches) {
        return { code, start, length: words.length };
      }
    }
  }
  return null;
};

/**
 * Parses a one-line operation like "500 кофе", "еда 1 200 обед с Колей" or "+50000 работа".
 * `+` in front makes it an income. Returns null when the text has no amount at its edge, so the
 * caller can treat it as ordinary text. Category names are compared without emoji and case.
 */
export const parseQuickInput = (
  input: string,
  categories: QuickInputCategories,
): QuickInputResult | null => {
  let text = input.trim();
  let type = CategoryType.EXPENSE;
  if (text.startsWith("+")) {
    type = CategoryType.INCOME;
    text = text.slice(1).trim();
  }

  const extracted = extractAmount(text);
  if (!extracted) {
    return null;
  }

  const amount = toAmount(extracted.raw);
  if (amount === null) {
    return { ok: false, reason: "bad_amount" };
  }

  const tokens = extracted.rest.split(/\s+/).filter(Boolean);
  const category = extractCategory(tokens, categories[type]);
  if (category) {
    tokens.splice(category.start, category.length);
  }

  // Emoji-only leftovers carry no information.
  const comment = tokens
    .filter((token) => normalizeWord(token) !== "")
    .join(" ")
    .slice(0, COMMENT_MAX_LENGTH)
    .trim();

  return {
    ok: true,
    type,
    amount,
    categoryCode: category?.code ?? null,
    comment: comment || null,
  };
};
