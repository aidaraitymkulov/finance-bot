# Finance Telegram Bot

`Finance Telegram Bot` — Telegram-бот для учета личных финансов.  
Проект позволяет быстро фиксировать доходы и расходы, смотреть сводную статистику, рейтинг расходов, последние операции и управлять категориями прямо из Telegram.

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

Проект модульный, основные части:

- `src/modules/telegram`  
  Telegram update handlers, клавиатуры, пользовательские флоу (`operation`, `stats`, `rating`, `category-manage`, `last`, `help`).
- `src/modules/operation`  
  Логика сохранения операций доход/расход.
- `src/modules/category`  
  Работа с категориями (создание, переименование, удаление, дефолтные категории).
- `src/modules/report`  
  Отчеты и агрегации (сводка, рейтинг, статистика по категории).
- `src/modules/user`  
  Пользователь Telegram и привязка к данным в БД.
- `src/database`  
  Конфигурация подключения TypeORM/PostgreSQL.
- `src/config`  
  Централизованная загрузка и типизация переменных окружения.

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

---

Powered by Aidar
