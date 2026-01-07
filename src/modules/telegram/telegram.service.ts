import { Injectable } from "@nestjs/common";

@Injectable()
export class TelegramService {
  getStartMessage() {
    return [
      "Финансовый бот запущен.",
      "Используйте /income или /expense, чтобы добавить операцию.",
      "Используйте /stats, чтобы получить сводный отчет.",
    ].join("\n");
  }
}
