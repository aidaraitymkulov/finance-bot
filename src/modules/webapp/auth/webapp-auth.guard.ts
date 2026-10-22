import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { UserService } from "../../user/user.service";
import { UserEntity } from "../../user/user.entity";
import { validateInitData } from "./init-data.util";

type WebAppRequest = Request & { webAppUser?: UserEntity };

/**
 * Mini App requests carry Telegram's signed launch data as `Authorization: tma <initData>`.
 * Only the bot owner (ALLOWED_TELEGRAM_USER_ID) gets through, same as in the bot.
 */
@Injectable()
export class WebAppAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebAppRequest>();
    const [scheme, initData] = (request.headers.authorization ?? "").split(" ");
    const telegram = this.configService.get<{ botToken?: string; allowedUserId?: number }>(
      "telegram",
    );

    const tgUser =
      scheme === "tma" && initData && telegram?.botToken
        ? validateInitData(initData, telegram.botToken)
        : null;
    if (!tgUser) {
      throw new UnauthorizedException("Invalid Telegram init data");
    }
    if (telegram?.allowedUserId && tgUser.id !== telegram.allowedUserId) {
      throw new ForbiddenException();
    }

    request.webAppUser = await this.userService.findOrCreateByTelegramUser({
      id: String(tgUser.id),
      userName: tgUser.username ?? "",
      firstName: tgUser.first_name ?? "",
      lastName: tgUser.last_name ?? "",
    });
    return true;
  }
}

/** The user resolved by WebAppAuthGuard. */
export const WebAppUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<WebAppRequest>().webAppUser,
);
