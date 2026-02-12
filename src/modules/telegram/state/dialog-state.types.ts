import { CategoryType } from "../../category/category-type.enum";

export type DialogFlow = "operation" | "stats" | "rating" | "category_manage" | "excel";

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

export type CategoryManageDialogState =
  | { flow: "category_manage"; step: "category_manage_action" }
  | { flow: "category_manage"; step: "category_manage_add_type" }
  | { flow: "category_manage"; step: "category_manage_add_name"; type: CategoryType }
  | { flow: "category_manage"; step: "category_manage_edit_type" }
  | { flow: "category_manage"; step: "category_manage_edit_select"; type: CategoryType }
  | {
      flow: "category_manage";
      step: "category_manage_edit_name";
      type: CategoryType;
      categoryCode: string;
    }
  | { flow: "category_manage"; step: "category_manage_delete_type" }
  | { flow: "category_manage"; step: "category_manage_delete_select"; type: CategoryType };

export type ExcelDialogState =
  | { flow: "excel"; step: "excel_period" }
  | { flow: "excel"; step: "excel_custom_period" };

export type DialogState =
  | OperationDialogState
  | StatsDialogState
  | RatingDialogState
  | CategoryManageDialogState
  | ExcelDialogState;
