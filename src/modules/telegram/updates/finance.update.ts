import { Action, Command, Ctx, Update } from "nestjs-telegraf";
import { CategoryType } from "../../category/category-type.enum";
import { PeriodType } from "../../../common/types/period.type";
import { ExcelReportType } from "../state/dialog-state.types";
import { OperationFlow } from "../flows/operation.flow";
import { StatsFlow } from "../flows/stats.flow";
import { RatingFlow } from "../flows/rating.flow";
import { LastFlow } from "../flows/last.flow";
import { CategoryManageFlow } from "../flows/category-manage.flow";
import { ExcelFlow } from "../flows/excel.flow";
import {
  BotContext,
  getCallbackParts,
  handleCallbackParams,
  requireUserId,
} from "../telegram.helpers";

@Update()
export class FinanceUpdate {
  constructor(
    private readonly operationFlow: OperationFlow,
    private readonly statsFlow: StatsFlow,
    private readonly ratingFlow: RatingFlow,
    private readonly lastFlow: LastFlow,
    private readonly categoryManageFlow: CategoryManageFlow,
    private readonly excelFlow: ExcelFlow,
  ) {}

  @Command("income")
  async onIncome(@Ctx() ctx: BotContext) {
    await this.operationFlow.start(ctx, CategoryType.INCOME);
  }

  @Command("expense")
  async onExpense(@Ctx() ctx: BotContext) {
    await this.operationFlow.start(ctx, CategoryType.EXPENSE);
  }

  @Command("stats")
  async onStats(@Ctx() ctx: BotContext) {
    const userId = await requireUserId(ctx);
    if (userId) {
      await this.statsFlow.start(ctx, userId);
    }
  }

  @Command("rating")
  async onRating(@Ctx() ctx: BotContext) {
    const userId = await requireUserId(ctx);
    if (userId) {
      await this.ratingFlow.start(ctx, userId);
    }
  }

  @Command("categories")
  async onCategories(@Ctx() ctx: BotContext) {
    const userId = await requireUserId(ctx);
    if (userId) {
      await this.categoryManageFlow.start(ctx, userId);
    }
  }

  @Command("last")
  async onLast(@Ctx() ctx: BotContext) {
    await this.lastFlow.start(ctx);
  }

  @Command("excel")
  async onExcel(@Ctx() ctx: BotContext) {
    const userId = await requireUserId(ctx);
    if (userId) {
      await this.excelFlow.start(ctx, userId);
    }
  }

  @Action(/^stats_mode:(.+)$/)
  async onStatsModeSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить режим.", (userId, [mode]) =>
      this.statsFlow.handleModeSelected(ctx, userId, mode),
    );
  }

  @Action(/^category:(.+)$/)
  async onOperationCategorySelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить категорию.", (userId, [code]) =>
      this.operationFlow.handleCategorySelected(ctx, userId, code),
    );
  }

  @Action(/^stats_type:(.+)$/)
  async onStatsTypeSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить тип.", (userId, [type]) =>
      this.statsFlow.handleTypeSelected(ctx, userId, type),
    );
  }

  @Action(/^stats_category:(.+)$/)
  async onStatsCategorySelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить категорию.", (userId, [code]) =>
      this.statsFlow.handleCategorySelected(ctx, userId, code),
    );
  }

  @Action(/^stats_period:(.+)$/)
  async onStatsPeriodSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить период.", (userId, [period]) =>
      this.statsFlow.handlePeriodSelected(ctx, userId, period as PeriodType),
    );
  }

  @Action(/^stats_category_period:(.+)$/)
  async onStatsCategoryPeriodSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить период.", (userId, [period]) =>
      this.statsFlow.handleCategoryPeriodSelected(ctx, userId, period as PeriodType),
    );
  }

  @Action(/^category_manage:(add|edit|delete|view)$/)
  async onCategoryManageAction(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить действие.", (userId, [action]) =>
      this.categoryManageFlow.handleActionSelected(ctx, userId, action),
    );
  }

  @Action(/^category_manage_add_type:(.+)$/)
  async onCategoryManageAddType(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить тип.", (userId, [type]) =>
      this.categoryManageFlow.handleAddTypeSelected(ctx, userId, type),
    );
  }

  @Action(/^category_manage_delete_type:(.+)$/)
  async onCategoryManageDeleteType(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить тип.", (userId, [type]) =>
      this.categoryManageFlow.handleDeleteTypeSelected(ctx, userId, type),
    );
  }

  @Action(/^category_manage_edit_type:(.+)$/)
  async onCategoryManageEditType(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить тип.", (userId, [type]) =>
      this.categoryManageFlow.handleEditTypeSelected(ctx, userId, type),
    );
  }

  @Action(/^category_manage_delete:(.+)$/)
  async onCategoryManageDelete(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить категорию.", (userId, [code]) =>
      this.categoryManageFlow.handleDeleteSelected(ctx, userId, code),
    );
  }

  @Action(/^category_manage_edit:(.+)$/)
  async onCategoryManageEdit(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить категорию.", (userId, [code]) =>
      this.categoryManageFlow.handleEditSelected(ctx, userId, code),
    );
  }

  @Action(/^rating_type:(.+)$/)
  async onRatingTypeSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить тип.", (userId, [type]) =>
      this.ratingFlow.handleTypeSelected(ctx, userId, type),
    );
  }

  @Action(/^rating_period:(.+)$/)
  async onRatingPeriodSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить период.", (userId, [period]) =>
      this.ratingFlow.handlePeriodSelected(ctx, userId, period as PeriodType),
    );
  }

  @Action(/^last_more:(\d+)$/)
  async onLastMore(@Ctx() ctx: BotContext) {
    const [offsetRaw] = getCallbackParts(ctx);
    const offset = offsetRaw ? Number(offsetRaw) : NaN;
    if (!Number.isFinite(offset) || offset < 0) {
      await ctx.answerCbQuery("Не удалось определить страницу.");
      return;
    }

    await this.lastFlow.handleMore(ctx, offset);
  }

  @Action(/^excel_type:(.+)$/)
  async onExcelTypeSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить тип отчёта.", (userId, [type]) =>
      this.excelFlow.handleTypeSelected(ctx, userId, type as ExcelReportType),
    );
  }

  @Action(/^excel_period:(.+)$/)
  async onExcelPeriodSelected(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить период.", (userId, [period]) =>
      this.excelFlow.handlePeriodSelected(ctx, userId, period as PeriodType),
    );
  }
}
