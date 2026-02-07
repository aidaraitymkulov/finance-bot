import { Injectable } from "@nestjs/common";
import { buildMainMenuKeyboard } from "./keyboards/main-menu.keyboard";

@Injectable()
export class TelegramService {
  getStartMessage() {
    return [
      "Финансовый бот запущен.",
      "Используйте /income или /expense, чтобы добавить операцию.",
      "Используйте /stats, чтобы получить сводный отчет.",
      "Используйте /categories, чтобы управлять категориями.",
      "Используйте /help, чтобы увидеть список команд.",
    ].join("\n");
  }

  getMainMenuKeyboard() {
    return buildMainMenuKeyboard();
  }
}
