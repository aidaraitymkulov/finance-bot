# Finance Telegram Bot

Личный Telegram-бот-помощник: все модули работают в одной системе с общей базой данных.

- 💰 **Финансы** — доходы и расходы, статистика, рейтинг, категории, выгрузка в Excel.
- 🔥 **Привычки** — ежедневные отметки, серии, опрос в 22:00.
- ✅ **Задачи** — задачи на конкретный день, утренний план в 09:00.
- 🔔 **Подписки** — регулярные платежи (месяц/год), напоминание за 3 дня, за 1 день и в день списания.

Подробная документация — в [`docs/`](docs/README.md).

## Как запустить проект

1. Установить зависимости:

```bash
npm install
```

2. Создать и заполнить `.env` (или `.env.development`) по примеру `.env.example`.

3. Запустить в dev-режиме:

```bash
npm run start:dev
```

4. Прод-запуск:

```bash
npm run build
npm run migration:run
npm run start:prod
```

## Библиотеки, фреймворки и БД

- `NestJS`
- `nestjs-telegraf` + `telegraf`
- `TypeORM`
- `PostgreSQL`
- `class-validator` / `class-transformer`
- `TypeScript`

## Архитектура

Модули NestJS: `user`, `category` / `operation` / `report` (финансы), `habit`, `task`, `subscription`, `scheduler` (cron-уведомления) и `telegram` (единственный UI-слой). Подробнее — в [docs/architecture.md](docs/architecture.md).

## Переменные окружения

Используемые переменные:

- `NODE_ENV`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SYNCHRONIZE` (`true`/`false`, рекомендуется `false` для production)
- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_TELEGRAM_USER_ID`
- `PORT` (необязательно, по умолчанию `3000`)

Пример:

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tg-bot
DB_SYNCHRONIZE=false
TELEGRAM_BOT_TOKEN=your_token
ALLOWED_TELEGRAM_USER_ID=123456789
```

## Миграции

После отключения `DB_SYNCHRONIZE` схему нужно применять миграциями:

```bash
npm run migration:show
npm run migration:run
```

Явные команды по окружениям:

```bash
# development
npm run migration:show:dev
npm run migration:run:dev

# production
npm run migration:show:prod
npm run migration:run:prod
```

Откат последней миграции:

```bash
npm run migration:revert

# или явно:
npm run migration:revert:dev
npm run migration:revert:prod
```

---

Powered by Aidar
