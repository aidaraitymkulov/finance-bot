export enum DebtKind {
  /** I lent money: the person owes me. */
  LEND = "LEND",
  /** I borrowed money: I owe the person. */
  BORROW = "BORROW",
  /** The person paid me back. */
  REPAID_TO_ME = "REPAID_TO_ME",
  /** I paid the person back. */
  REPAID_BY_ME = "REPAID_BY_ME",
  /** I paid for the person as part of a purchase (see `DebtService.splitOperation`). */
  SPLIT = "SPLIT",
}
