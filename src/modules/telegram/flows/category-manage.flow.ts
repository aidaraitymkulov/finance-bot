import { Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import { CategoryType } from "../../category/category-type.enum";
import { CategoryService } from "../../category/category.service";
import { buildExpenseCategoriesKeyboard } from "../keyboards/expense-categories.keyboard";
import { buildIncomeCategoriesKeyboard } from "../keyboards/income-categories.keyboard";
import { TelegramService } from "../telegram.service";
import { DialogStateService } from "../state/dialog-state.service";
import { replyWithMarkup } from "../telegram.helpers";
import type { BotContext } from "../telegram.helpers";

type ManageAction = "add" | "edit" | "delete" | "view";
type ManageActionWithType = Exclude<ManageAction, "view">;

@Injectable()
export class CategoryManageFlow {
  constructor(
    private readonly dialogStateService: DialogStateService,
    private readonly categoryService: CategoryService,
    private readonly telegramService: TelegramService,
  ) {}

  async start(ctx: BotContext, userId: string) {
    this.dialogStateService.set(userId, {
      flow: "category_manage",
      step: "category_manage_action",
    });

    await replyWithMarkup(
      ctx,
      "Режим категорий запущен. Для выхода используйте ❌ Отмена.",
      this.telegramService.getCancelKeyboard().reply_markup,
    );
    await replyWithMarkup(
      ctx,
      "Что сделать с категориями?",
      this.buildManageActionKeyboard().reply_markup,
    );
  }

  async handleActionSelected(ctx: BotContext, userId: string, action: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "category_manage") {
      await ctx.answerCbQuery("Сначала откройте управление категориями.");
      return;
    }

    if (action === "view") {
      await ctx.answerCbQuery();
      await this.sendAllCategories(ctx);
      await replyWithMarkup(
        ctx,
        "Что сделать с категориями?",
        this.buildManageActionKeyboard().reply_markup,
      );
      return;
    }

    if (action !== "add" && action !== "delete" && action !== "edit") {
      await ctx.answerCbQuery("Не удалось определить действие.");
      return;
    }

    const stepByAction: Record<
      ManageActionWithType,
      "category_manage_add_type" | "category_manage_edit_type" | "category_manage_delete_type"
    > = {
      add: "category_manage_add_type",
      edit: "category_manage_edit_type",
      delete: "category_manage_delete_type",
    };

    this.dialogStateService.set(userId, {
      flow: "category_manage",
      step: stepByAction[action],
    });

    await ctx.answerCbQuery();
    await replyWithMarkup(
      ctx,
      action === "add"
        ? "Для какого типа добавить категорию?"
        : action === "edit"
          ? "Для какого типа редактировать категорию?"
          : "Для какого типа удалить категорию?",
      this.buildTypeKeyboard(action).reply_markup,
    );
  }

  async handleAddTypeSelected(ctx: BotContext, userId: string, type: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "category_manage" || state.step !== "category_manage_add_type") {
      await ctx.answerCbQuery("Сначала выберите действие.");
      return;
    }

    const categoryType = this.mapCategoryType(type);
    if (!categoryType) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "category_manage",
      step: "category_manage_add_name",
      type: categoryType,
    });

    await ctx.answerCbQuery();
    await ctx.reply("Введите название новой категории.");
  }

  async handleAddNameText(ctx: BotContext, userId: string, text: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "category_manage" || state.step !== "category_manage_add_name") {
      await ctx.reply("Сначала выберите действие в управлении категориями.");
      return;
    }

    const result = await this.categoryService.createCategory(state.type, text);
    if (!result.created) {
      if (result.reason === "empty_name") {
        await ctx.reply("Название не может быть пустым.");
        return;
      }
      if (result.reason === "name_too_long") {
        await ctx.reply("Название слишком длинное. Максимум 64 символа.");
        return;
      }
      if (result.reason === "exists") {
        await ctx.reply("Такая категория уже существует.");
        return;
      }

      await ctx.reply("Не удалось создать категорию.");
      return;
    }

    this.dialogStateService.clear(userId);
    await ctx.reply(`Категория добавлена: ${result.category?.displayName}`);
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getFinanceMenuKeyboard().reply_markup,
    );
  }

  async handleDeleteTypeSelected(ctx: BotContext, userId: string, type: string) {
    const state = this.dialogStateService.get(userId);
    if (
      !state ||
      state.flow !== "category_manage" ||
      state.step !== "category_manage_delete_type"
    ) {
      await ctx.answerCbQuery("Сначала выберите действие.");
      return;
    }

    const categoryType = this.mapCategoryType(type);
    if (!categoryType) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "category_manage",
      step: "category_manage_delete_select",
      type: categoryType,
    });

    await this.sendCategorySelect(ctx, userId, categoryType, "delete", true);
  }

  async handleDeleteSelected(ctx: BotContext, userId: string, categoryCode: string) {
    const state = this.dialogStateService.get(userId);
    if (
      !state ||
      state.flow !== "category_manage" ||
      state.step !== "category_manage_delete_select"
    ) {
      await ctx.answerCbQuery("Сначала выберите тип.");
      return;
    }

    const result = await this.categoryService.deleteCategory(state.type, categoryCode);
    if (!result.deleted) {
      if (result.reason === "has_operations") {
        await ctx.answerCbQuery("Категория используется в операциях.");
        await ctx.reply("Эту категорию нельзя удалить: есть связанные операции.");
        await this.sendCategorySelect(ctx, userId, state.type, "delete", false);
        return;
      }

      if (result.reason === "not_found") {
        await ctx.answerCbQuery("Категория не найдена.");
        await this.sendCategorySelect(ctx, userId, state.type, "delete", false);
        return;
      }

      await ctx.answerCbQuery("Не удалось удалить категорию.");
      return;
    }

    this.dialogStateService.clear(userId);
    await ctx.answerCbQuery();
    await ctx.reply("Категория удалена.");
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getFinanceMenuKeyboard().reply_markup,
    );
  }

  async handleEditTypeSelected(ctx: BotContext, userId: string, type: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "category_manage" || state.step !== "category_manage_edit_type") {
      await ctx.answerCbQuery("Сначала выберите действие.");
      return;
    }

    const categoryType = this.mapCategoryType(type);
    if (!categoryType) {
      await ctx.answerCbQuery("Не удалось определить тип.");
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "category_manage",
      step: "category_manage_edit_select",
      type: categoryType,
    });

    await this.sendCategorySelect(ctx, userId, categoryType, "edit", true);
  }

  async handleEditSelected(ctx: BotContext, userId: string, categoryCode: string) {
    const state = this.dialogStateService.get(userId);
    if (
      !state ||
      state.flow !== "category_manage" ||
      state.step !== "category_manage_edit_select"
    ) {
      await ctx.answerCbQuery("Сначала выберите тип.");
      return;
    }

    const category = await this.categoryService.getByCode(state.type, categoryCode);
    if (!category) {
      await ctx.answerCbQuery("Категория не найдена.");
      await this.sendCategorySelect(ctx, userId, state.type, "edit", false);
      return;
    }

    this.dialogStateService.set(userId, {
      flow: "category_manage",
      step: "category_manage_edit_name",
      type: state.type,
      categoryCode,
    });

    await ctx.answerCbQuery();
    await ctx.reply(`Текущее название: ${category.displayName}\nВведите новое название.`);
  }

  async handleEditNameText(ctx: BotContext, userId: string, text: string) {
    const state = this.dialogStateService.get(userId);
    if (!state || state.flow !== "category_manage" || state.step !== "category_manage_edit_name") {
      await ctx.reply("Сначала выберите категорию для редактирования.");
      return;
    }

    const result = await this.categoryService.renameCategory(state.type, state.categoryCode, text);
    if (!result.renamed) {
      if (result.reason === "empty_name") {
        await ctx.reply("Название не может быть пустым.");
        return;
      }
      if (result.reason === "name_too_long") {
        await ctx.reply("Название слишком длинное. Максимум 64 символа.");
        return;
      }
      if (result.reason === "exists") {
        await ctx.reply("Такая категория уже существует.");
        return;
      }
      if (result.reason === "same_name") {
        await ctx.reply("Это то же самое название. Введите другое.");
        return;
      }
      if (result.reason === "not_found") {
        this.dialogStateService.clear(userId);
        await ctx.reply("Категория не найдена.");
        await replyWithMarkup(
          ctx,
          "Выберите действие:",
          this.telegramService.getFinanceMenuKeyboard().reply_markup,
        );
        return;
      }

      await ctx.reply("Не удалось переименовать категорию.");
      return;
    }

    this.dialogStateService.clear(userId);
    await ctx.reply(`Категория переименована: ${result.category?.displayName}`);
    await replyWithMarkup(
      ctx,
      "Выберите действие:",
      this.telegramService.getFinanceMenuKeyboard().reply_markup,
    );
  }

  private async sendCategorySelect(
    ctx: BotContext,
    userId: string,
    type: CategoryType,
    mode: "edit" | "delete",
    answerCb: boolean,
  ) {
    const categories = await this.categoryService.getCategoriesByType(type);
    if (categories.length === 0) {
      this.dialogStateService.clear(userId);
      if (answerCb) {
        await ctx.answerCbQuery();
      }
      await ctx.reply("Категорий для удаления нет.");
      await replyWithMarkup(
        ctx,
        "Выберите действие:",
        this.telegramService.getFinanceMenuKeyboard().reply_markup,
      );
      return;
    }

    const callbackPrefix = mode === "edit" ? "category_manage_edit" : "category_manage_delete";
    const keyboard =
      type === CategoryType.INCOME
        ? buildIncomeCategoriesKeyboard(categories, callbackPrefix)
        : buildExpenseCategoriesKeyboard(categories, callbackPrefix);

    if (answerCb) {
      await ctx.answerCbQuery();
    }
    await replyWithMarkup(
      ctx,
      mode === "edit"
        ? "Выберите категорию для редактирования:"
        : "Выберите категорию для удаления:",
      keyboard.reply_markup,
    );
  }

  private async sendAllCategories(ctx: BotContext) {
    const [incomeRaw, expenseRaw] = await Promise.all([
      this.categoryService.getCategoriesByType(CategoryType.INCOME),
      this.categoryService.getCategoriesByType(CategoryType.EXPENSE),
    ]);
    const incomeCategories = this.moveOtherToBottom(incomeRaw);
    const expenseCategories = this.moveOtherToBottom(expenseRaw);

    const toLines = (items: { displayName: string }[]) =>
      items.length > 0 ? items.map((item, index) => `${index + 1}. ${item.displayName}`) : ["-"];

    const message = [
      "Категории:",
      "",
      "Доход:",
      ...toLines(incomeCategories),
      "",
      "Расход:",
      ...toLines(expenseCategories),
    ].join("\n");

    await ctx.reply(message);
  }

  private moveOtherToBottom<T extends { code: string; displayName: string }>(categories: T[]) {
    const regular = categories.filter((category) => !this.isOtherCategory(category));
    const other = categories.filter((category) => this.isOtherCategory(category));
    return [...regular, ...other];
  }

  private isOtherCategory(category: { code: string; displayName: string }) {
    return category.code.startsWith("other_") || /другое/i.test(category.displayName);
  }

  private mapCategoryType(type: string): CategoryType | null {
    if (type === "income") {
      return CategoryType.INCOME;
    }
    if (type === "expense") {
      return CategoryType.EXPENSE;
    }
    return null;
  }

  private buildManageActionKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("➕ Добавить", "category_manage:add")],
      [Markup.button.callback("✏️ Редактировать", "category_manage:edit")],
      [Markup.button.callback("🗑 Удалить", "category_manage:delete")],
      [Markup.button.callback("📋 Посмотреть", "category_manage:view")],
    ]);
  }

  private buildTypeKeyboard(action: ManageAction) {
    const prefix =
      action === "add"
        ? "category_manage_add_type"
        : action === "edit"
          ? "category_manage_edit_type"
          : "category_manage_delete_type";
    return Markup.inlineKeyboard([
      [Markup.button.callback("💰 Доход", `${prefix}:income`)],
      [Markup.button.callback("💸 Расход", `${prefix}:expense`)],
    ]);
  }
}
