import { CategoryType } from "../../category/category-type.enum";

export type DialogFlow = "operation" | "stats";

export type DialogStep =
  | "amount"
  | "category"
  | "comment"
  | "stats_period"
  | "stats_custom_period";

export interface DialogState {
  flow: DialogFlow;
  step: DialogStep;
  type?: CategoryType;
  amount?: number;
  categoryCode?: string;
}
