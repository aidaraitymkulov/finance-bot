import { Module } from "@nestjs/common";
import { DialogStateService } from "./dialog-state.service";
import { BotPauseService } from "./bot-pause.service";

@Module({
  providers: [DialogStateService, BotPauseService],
  exports: [DialogStateService, BotPauseService],
})
export class TelegramStateModule {}
