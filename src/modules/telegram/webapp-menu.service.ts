import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectBot } from "nestjs-telegraf";
import { Markup, Telegraf } from "telegraf";

const MENU_BUTTON_TEXT = "📊 Дашборд";

/** Wires the Mini App (WEBAPP_URL) into the bot: the chat menu button and /dashboard. */
@Injectable()
export class WebAppMenuService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebAppMenuService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly configService: ConfigService,
  ) {}

  /** The Mini App URL if configured; Telegram only opens https Mini Apps. */
  getUrl(): string | null {
    const url = this.configService.get<{ webAppUrl?: string }>("telegram")?.webAppUrl;
    return url?.startsWith("https://") ? url : null;
  }

  /** Inline button that opens the Mini App (inline buttons pass full initData). */
  buildOpenKeyboard() {
    const url = this.getUrl();
    return url ? Markup.inlineKeyboard([Markup.button.webApp(MENU_BUTTON_TEXT, url)]) : null;
  }

  async onApplicationBootstrap() {
    const url = this.getUrl();
    if (this.configService.get<{ webAppUrl?: string }>("telegram")?.webAppUrl && !url) {
      this.logger.warn("WEBAPP_URL must start with https://, Mini App button is disabled");
    }

    try {
      await this.bot.telegram.setChatMenuButton({
        menuButton: url
          ? { type: "web_app", text: MENU_BUTTON_TEXT, web_app: { url } }
          : { type: "default" },
      });
      this.logger.log(url ? `Mini App menu button: ${url}` : "Mini App menu button not set");
    } catch (error) {
      this.logger.warn(
        `Failed to set the menu button: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
