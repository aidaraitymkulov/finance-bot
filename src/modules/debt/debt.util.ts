import { createHash } from "node:crypto";
import { DebtKind } from "./debt-kind.enum";

export const MAX_PERSON_LENGTH = 64;

/**
 * Kinds that increase what the person owes me. The balance of a person is the signed sum of their
 * entries: positive = they owe me, negative = I owe them.
 */
export const DEBT_PLUS_KINDS: readonly DebtKind[] = [
  DebtKind.LEND,
  DebtKind.SPLIT,
  DebtKind.REPAID_BY_ME,
];

export const debtSign = (kind: DebtKind): 1 | -1 => (DEBT_PLUS_KINDS.includes(kind) ? 1 : -1);

export const calcBalance = (entries: { kind: DebtKind; amount: number }[]): number =>
  Math.round(entries.reduce((sum, entry) => sum + debtSign(entry.kind) * entry.amount, 0) * 100) /
  100;

export type PersonError = "empty_person" | "person_too_long";

export const validatePerson = (name: string): PersonError | null => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "empty_person";
  }
  return trimmed.length > MAX_PERSON_LENGTH ? "person_too_long" : null;
};

/** `person` keeps the spelling the user typed, `personKey` is what entries are grouped by. */
export const normalizePerson = (name: string) => {
  const person = name.trim().replace(/\s+/g, " ");
  return { person, personKey: person.toLowerCase() };
};

/** Short stable id of a person for callback data (names can exceed Telegram's 64 byte limit). */
export const personRef = (personKey: string): string =>
  createHash("sha1").update(personKey).digest("hex").slice(0, 10);
