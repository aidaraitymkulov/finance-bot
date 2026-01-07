import { CategoryType } from "../../category/category-type.enum";

export type DialogFlow = "operation" | "stats" | "rating";

export type DialogStep =
  | "amount"
  | "category"
  | "comment"
  | "stats_mode"
  | "stats_period"
  | "stats_custom_period"
  | "stats_category_type"
  | "stats_category_select"
  | "stats_category_period"
  | "stats_category_custom_period"
  | "rating_period"
  | "rating_custom_period";

export interface DialogState {
  flow: DialogFlow;
  step: DialogStep;
  type?: CategoryType;
  amount?: number;
  categoryCode?: string;
}
