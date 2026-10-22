import { existsSync } from "node:fs";
import { join } from "node:path";
import { DynamicModule, Logger, Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { UserModule } from "../user/user.module";
import { ReportModule } from "../report/report.module";
import { WebAppAuthGuard } from "./auth/webapp-auth.guard";
import { FinanceController } from "./finance.controller";
import { FinanceDashboardService } from "./finance-dashboard.service";

/** Built Mini App (`npm run build:webapp`); dist/modules/webapp -> <root>/webapp/dist. */
const WEBAPP_DIST = join(__dirname, "..", "..", "..", "webapp", "dist");

/** Serves the built Mini App at `/`, unless it hasn't been built (dev uses the Vite server). */
const serveWebApp = (): DynamicModule[] => {
  if (!existsSync(WEBAPP_DIST)) {
    new Logger("WebAppModule").warn(`Mini App build not found at ${WEBAPP_DIST}, not serving it`);
    return [];
  }
  return [ServeStaticModule.forRoot({ rootPath: WEBAPP_DIST, exclude: ["/api/{*path}"] })];
};

/** REST API for the Telegram Mini App (`/api/*`) and its static files. */
@Module({
  imports: [UserModule, ReportModule, ...serveWebApp()],
  controllers: [FinanceController],
  providers: [WebAppAuthGuard, FinanceDashboardService],
})
export class WebAppModule {}
