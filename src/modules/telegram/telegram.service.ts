import { Injectable } from "@nestjs/common";
import { buildCancelKeyboard } from "./keyboards/cancel.keyboard";
import { buildMainMenuKeyboard } from "./keyboards/main-menu.keyboard";
import { buildFinanceMenuKeyboard } from "./keyboards/finance-menu.keyboard";
import { buildHabitsMenuKeyboard } from "./keyboards/habits-menu.keyboard";
import { buildTasksMenuKeyboard } from "./keyboards/tasks-menu.keyboard";
import { buildPausedKeyboard } from "./keyboards/paused.keyboard";
import { DialogFlow } from "./state/dialog-state.types";

@Injectable()
export class TelegramService {
  getStartMessage() {
    return [
      "Личный бот-помощник запущен.",
      "💰 Финансы — доходы, расходы, статистика и отчёты.",
      "🔥 Привычки — ежедневные отметки и серии, напоминание в 22:00.",
      "✅ Задачи — дела на конкретный день, утренний план в 09:00.",
      "Используйте /help, чтобы увидеть список команд.",
    ].join("\n");
  }

  getMainMenuKeyboard() {
    return buildMainMenuKeyboard();
  }

  getFinanceMenuKeyboard() {
    return buildFinanceMenuKeyboard();
  }

  getHabitsMenuKeyboard() {
    return buildHabitsMenuKeyboard();
  }

  getTasksMenuKeyboard() {
    return buildTasksMenuKeyboard();
  }

  /** Menu of the section a dialog belongs to, so cancelling keeps the user in that section. */
  getMenuKeyboardForFlow(flow?: DialogFlow) {
    switch (flow) {
      case "operation":
      case "stats":
      case "rating":
      case "category_manage":
      case "excel":
        return this.getFinanceMenuKeyboard();
      case "habit":
        return this.getHabitsMenuKeyboard();
      case "task":
        return this.getTasksMenuKeyboard();
      default:
        return this.getMainMenuKeyboard();
    }
  }

  getCancelKeyboard() {
    return buildCancelKeyboard();
  }

  getPausedKeyboard() {
    return buildPausedKeyboard();
  }
}
