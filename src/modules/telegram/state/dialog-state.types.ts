import { CategoryType } from "../../category/category-type.enum";

export type DialogFlow = "operation" | "stats" | "rating" | "category_manage";

export type DialogStep =
  | "amount"
  | "category"
  | "comment"
  | "category_manage_action"
  | "category_manage_add_type"
  | "category_manage_name"
  | "category_manage_delete_type"
  | "category_manage_delete_select"
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
