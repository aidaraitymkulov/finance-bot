import { Module } from "@nestjs/common";
import { DialogStateService } from "./dialog-state.service";
import { BotPauseService } from "./bot-pause.service";
import { UserModule } from "../../user/user.module";

@Module({
  imports: [UserModule],
  providers: [DialogStateService, BotPauseService],
  exports: [DialogStateService, BotPauseService],
})
export class TelegramStateModule {}
