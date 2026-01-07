export type PeriodType = "today" | "last7" | "month" | "custom";

export interface PeriodRange {
  start: Date;
  end: Date;
  days: number;
}
