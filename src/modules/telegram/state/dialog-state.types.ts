import { CategoryType } from "../../category/category-type.enum";

export type DialogFlow = "operation" | "stats" | "rating";

export type OperationDialogState =
  | { flow: "operation"; step: "amount"; type: CategoryType }
  | { flow: "operation"; step: "category"; type: CategoryType; amount: number }
  | { flow: "operation"; step: "comment"; type: CategoryType; amount: number; categoryCode: string };

export type StatsDialogState =
  | { flow: "stats"; step: "stats_mode" }
  | { flow: "stats"; step: "stats_period" }
  | { flow: "stats"; step: "stats_custom_period" }
  | { flow: "stats"; step: "stats_category_type" }
  | { flow: "stats"; step: "stats_category_select"; type: CategoryType }
  | { flow: "stats"; step: "stats_category_period"; type: CategoryType; categoryCode: string }
  | {
      flow: "stats";
      step: "stats_category_custom_period";
      type: CategoryType;
      categoryCode: string;
    };

export type RatingDialogState =
  | { flow: "rating"; step: "rating_period" }
  | { flow: "rating"; step: "rating_custom_period" };

export type DialogState = OperationDialogState | StatsDialogState | RatingDialogState;
