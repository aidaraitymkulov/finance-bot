import { fromLocalDateString, toLocalDateString } from "../../common/utils/local-date.util";

export type SubscriptionPeriod = "monthly" | "yearly";

const MONTHS_IN_PERIOD: Record<SubscriptionPeriod, number> = { monthly: 1, yearly: 12 };

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * Date one period after `date`. `billingDay` is the original day of month, so a subscription
 * billed on the 31st goes Jan 31 -> Feb 28 -> Mar 31 instead of drifting to the 28th.
 */
export const addPeriod = (date: string, period: SubscriptionPeriod, billingDay: number): string => {
  const current = fromLocalDateString(date);
  const totalMonths = current.getFullYear() * 12 + current.getMonth() + MONTHS_IN_PERIOD[period];
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  return toLocalDateString(new Date(year, month, Math.min(billingDay, daysInMonth(year, month))));
};

/** First billing date that is not in the past, stepping forward from `date` by whole periods. */
export const nextPaymentOnOrAfter = (
  date: string,
  period: SubscriptionPeriod,
  billingDay: number,
  today: string,
): string => {
  let next = date;
  while (next < today) {
    next = addPeriod(next, period, billingDay);
  }
  return next;
};

/** Whole days from `today` to `date` (negative if `date` is in the past). */
export const daysUntil = (date: string, today: string): number =>
  Math.round(
    (fromLocalDateString(date).getTime() - fromLocalDateString(today).getTime()) / 86_400_000,
  );
