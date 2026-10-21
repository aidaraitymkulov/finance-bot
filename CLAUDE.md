# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal assistant Telegram bot (NestJS 11 + `nestjs-telegraf` + TypeORM + PostgreSQL) with three sections: **Finance** (income/expenses, stats, ratings, categories, Excel export via `exceljs`), **Habits** (daily check-ins with streaks, 22:00 poll) and **Tasks** (one-off tasks bound to a date, 09:00 morning digest). All user-facing text is in Russian.

## Commands

```bash
npm run start:dev          # watch mode, NODE_ENV=development (set PORT if 3000 is taken)
npm run build              # nest build -> dist/
npm run start:prod         # node dist/main.js, NODE_ENV=production (deployed via pm2: ecosystem.config.js)
npm run lint               # eslint src  (lint:fix to autofix)
npm run format             # prettier (double quotes, trailing commas, printWidth 100)
npm test                   # jest, unit specs = src/**/*.spec.ts
npx jest path/to/file.spec.ts   # single test file (add -t "name" for a single test)
npm run test:e2e           # test/jest-e2e.json
```

`npm run lint` currently reports pre-existing prettier/`no-useless-escape` errors in older files; lint the files you touch. `test/app.e2e-spec.ts` is the stale Nest scaffold (expects `GET /` → "Hello World!", which doesn't exist).

### Migrations

Migration scripts **build first** and run against `dist/database/data-source.js`, so migrations must compile. `:dev` / `:prod` suffixes pick `NODE_ENV`; unsuffixed variants default to dev.

```bash
npm run migration:show | migration:run | migration:revert   # (+ :dev / :prod)
```

Migrations live in `src/database/migrations/` and are hand-written (no `migration:generate` script). `src/database/data-source.ts` (CLI) lists entities explicitly — add new entities there too; the Nest runtime uses `autoLoadEntities` instead.

## Configuration

Env files load in order `.env.${NODE_ENV}`, `.env.development`, `.env` (both in `app.module.ts` and `data-source.ts`). Vars: `DB_HOST/PORT/USER/PASSWORD/NAME`, `DB_SYNCHRONIZE` (keep `false`; schema via migrations), `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_ID`, `PORT`. Typed config is in `src/config/configuration.ts` (accessed as `configService.get("telegram")` / `get("database")`), transformed by `src/config/validation.ts`. Note `@nestjs/config` writes the transformed values back into `process.env`, so boolean env vars need an explicit `@Transform` there (implicit conversion makes `"false"` truthy).

**Time zone**: `src/common/constants/time-zone.ts` pins `process.env.TZ` to `Asia/Bishkek` (UTC+6) and is the first import in `main.ts`. "Today", streaks, task due dates and cron jobs all use it. Local dates are `"YYYY-MM-DD"` strings (`common/utils/local-date.util.ts`), matching how TypeORM returns `date` columns — but raw query results (`getRawMany`) return `Date`, so format with `to_char` in SQL.

## Architecture

Domain modules in `src/modules/` hold TypeORM entities + services: `user`, `category`, `operation`, `report` (finance), `habit`, `task`. `telegram` is the only UI layer and depends on them. `scheduler` sends the cron notifications.

**Telegram layer (`src/modules/telegram/`)**:

- **Middlewares** (registered in `TelegrafModule.forRootAsync` in `telegram.module.ts`): `error.middleware.ts` catches handler errors so polling survives; `access.middleware.ts` enforces the `ALLOWED_TELEGRAM_USER_ID` whitelist and the `/disable` pause (only `/start` passes while paused). Handlers do no access checks themselves. (Nest guards are not used: a rejecting guard throws `ForbiddenException`, which nestjs-telegraf does not catch.)
- **Update classes** in `updates/`: `core.update.ts` (`/start`, `/help`, `/cancel`, `/disable`, menu navigation), `finance.update.ts`, `habit.update.ts`, `task.update.ts` — commands and `@Action(regex)` handlers that delegate to flows.
- **Exactly one `@On("text")`**, in `CoreUpdate`: Telegraf gives text to the first matching handler. It calls `next()` for `/commands` (so commands in other Update classes still fire), handles cancel/back, routes reply-keyboard labels via `handleMenuText` when no dialog is active, and otherwise dispatches by `state.flow` to the flow's text handler.
- `flows/*.flow.ts` — one injectable per feature. Each has `start()`/`showMenu()` plus `handleXxx()` methods per step.
- **Dialog state machine**: `state/dialog-state.service.ts` keeps an **in-memory** `Map<userId, DialogState>` (lost on restart). `state/dialog-state.types.ts` defines `DialogState` as a discriminated union on `flow` + `step` (`DialogFlow` is derived from it). Flow handlers guard with `if (!state || state.flow !== "x" || state.step !== "y")`, `set()` the next step, and `clear()` when done. `DialogStateService`/`BotPauseService` live in `TelegramStateModule` so the scheduler and the middleware can share the same instances.
- **Menus**: main menu (`keyboards/main-menu.keyboard.ts`) opens sections; each section has its own reply keyboard with "⬅️ Назад" (`finance-menu`, `habits-menu`, `tasks-menu`). After a dialog, flows return to their section's keyboard; `TelegramService.getMenuKeyboardForFlow()` maps a flow to its section.
- **Callback data** is `prefix:param[:param]` (≤ 64 bytes), e.g. `stats_period:month`, `habit_check:<uuid>:done`, `task_done:<uuid>:today`. Use `handleCallbackParams(ctx, errorText, handler, expectedParams)` from `telegram.helpers.ts`; restrict UUID params in the `@Action` regex (`[0-9a-f-]{36}`) so bad input never reaches Postgres. Use `editMessageSafe` to re-render a message after a button press.
- **Views** (`views/*.views.ts`) are pure functions returning `{ text, reply_markup }`; they are shared by flows and the scheduler so on-demand and scheduled messages look the same. Finance message formatting lives in `telegram.formatter.ts`.
- Shared finance period picker: `keyboards/period-select.keyboard.ts` (`today | last7 | month | custom`); custom ranges/dates are parsed by `telegram.parsers.ts`, ranges built in `common/utils/data-range.util.ts`.

**Adding a feature** typically touches: a `DialogState` variant, a flow + Update class registered in `telegram.module.ts`, a section keyboard + entries in `CoreUpdate.handleMenuText` / the `onText` flow switch, and `getMenuKeyboardForFlow`.

**Scheduler** (`src/modules/scheduler/notification.service.ts`): `@nestjs/schedule` cron jobs in `APP_TIME_ZONE` — 09:00 morning digest (open tasks due today incl. overdue) and 22:00 habit poll (active habits not checked today). Sends via `@InjectBot()` to `user.telegramId`, skipping paused users and users other than `ALLOWED_TELEGRAM_USER_ID`; failures are logged per user. Next run times are logged at startup.

**Data model**:
- `UserEntity` (keyed by `telegramId`, created lazily via `userService.findOrCreateByTelegramUser`).
- Finance: `CategoryEntity` (global, not per-user; unique `(type, code)`; `CategoryType` = `INCOME | EXPENSE`), `OperationEntity` (user + category + type + `numeric(12,2)` amount transformed to `number` + optional comment). `CategoryService.onModuleInit` seeds `DEFAULT_CATEGORIES` from `category.deafult.ts` (sic).
- `HabitEntity` (soft-deleted via `isActive`) and `HabitCheckinEntity` (one per habit per local date, `DONE | SKIPPED`, re-check overwrites). Streaks are computed on read by `habit/streak.util.ts` (`calcStreak`): consecutive DONE days ending today, or yesterday if today isn't checked yet.
- `TaskEntity` (`dueDate` local date, `isDone`). Overdue tasks are never moved: `TaskService.getOpenUntil(user, date)` returns all open tasks due up to that date, which is how they carry over.

Note: `src/common/enums/*.ts` are empty files — the real `CategoryType` is `src/modules/category/category-type.enum.ts`. `InitSchema.down` references constraint names that TypeORM `synchronize` renamed in databases where it ran (it was accidentally always on before the `DB_SYNCHRONIZE` fix), so reverting the first migration may fail there.
