import { CategoryType } from "../../category/category-type.enum";

export type DialogStep = "amount" | "category" | "comment";

export interface DialogState {
  step: DialogStep;
  type: CategoryType;
  amount?: number;
  categoryCode?: string;
}
