import { CategoryType } from "../../category/category-type.enum";
import { CategoryEntity } from "../../category/category.entity";
import { UserEntity } from "../../user/user.entity";

export interface CreateOperationDto {
  user: UserEntity;
  category: CategoryEntity;
  type: CategoryType;
  amount: number;
  comment: string | null;
}
