# Установка и запуск

## Требования

- Node.js (проверено на версии 24)
- PostgreSQL
- Токен бота от [@BotFather](https://t.me/BotFather)

Для разработки заведите **отдельного тестового бота**. Бот получает обновления через long polling, а с одним токеном так может работать только один процесс. Если запустить локальную копию с боевым токеном, оба экземпляра начнут получать ошибку `409 Conflict`.

## Переменные окружения

Файлы загружаются в порядке `.env.${NODE_ENV}` → `.env.development` → `.env`. Значение из более раннего файла не перезаписывается. Шаблон лежит в `.env.example`.

| Переменная | Обязательна | Описание |
| --- | --- | --- |
| `NODE_ENV` | да | `development` / `production` / `test` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | да | подключение к PostgreSQL |
| `DB_SYNCHRONIZE` | да | всегда `false`: схема меняется только миграциями |
| `TELEGRAM_BOT_TOKEN` | да | токен бота |
| `ALLOWED_TELEGRAM_USER_ID` | рекомендуется | числовой Telegram ID владельца (узнать можно у [@userinfobot](https://t.me/userinfobot)). Если не задан, ботом может пользоваться кто угодно |
| `PORT` | нет | HTTP-порт Nest, по умолчанию `3000`. Боту HTTP не нужен, но порт должен быть свободен |

Часовой пояс через окружение не задаётся. Он зафиксирован в коде (`src/common/constants/time-zone.ts`, `Asia/Bishkek`).

## Локальный запуск

```bash
npm install
cp .env.example .env              # заполнить значения
createdb bot-test                 # или любое имя из DB_NAME
npm run migration:run:dev         # создать схему
npm run start:dev                 # watch-режим
```

При успешном старте в логе будут строки:

```
LOG [TelegramModule] Allowed Telegram user ID: 123456789
LOG [CategoryService] Default categories ensured
LOG [NotificationService] Job "morning-digest" next run: 2026-10-22T09:00:00.000+06:00
LOG [NotificationService] Job "habit-poll" next run: 2026-10-21T22:00:00.000+06:00
LOG [NestApplication] Nest application successfully started
```

Если порт 3000 занят (`EADDRINUSE`), запустите с другим: `PORT=3001 npm run start:dev`.

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run start:dev` | запуск в watch-режиме (`NODE_ENV=development`) |
| `npm run build` | сборка в `dist/` |
| `npm run start:prod` | `node dist/main.js` с `NODE_ENV=production` |
| `npm test` | unit-тесты (`src/**/*.spec.ts`) |
| `npx jest path/to/file.spec.ts` | один тестовый файл (`-t "имя"` для одного теста) |
| `npm run lint` / `npm run format` | ESLint / Prettier (линтер должен проходить без ошибок) |

## Миграции

Скрипты миграций **сначала собирают проект** (`npm run build`) и затем запускают TypeORM CLI на `dist/database/data-source.js`.

```bash
npm run migration:show:dev      # какие миграции применены
npm run migration:run:dev       # применить новые
npm run migration:revert:dev    # откатить последнюю
```

Для прода используйте те же команды с суффиксом `:prod`. Команды без суффикса работают как `:dev`. Подробнее о схеме: [База данных](database.md).

## Деплой (прод)

Бот запускается под [pm2](https://pm2.keymetrics.io/) по конфигу `ecosystem.config.js`: один процесс в режиме `fork`, автоперезапуск через 5 секунд.

```bash
git pull
npm ci
npm run migration:run:prod      # собирает dist/ и применяет миграции; обязательно до перезапуска
pm2 startOrReload ecosystem.config.js --env production
```

Запускайте **ровно один экземпляр**. Второй процесс с тем же токеном вызовет `409 Conflict`, а уведомления по расписанию придут дважды.

### Переход на версию с привычками и задачами

До этой версии из-за ошибки разбора `DB_SYNCHRONIZE` автосинхронизация схемы TypeORM была включена всегда, даже при `false`. Теперь она действительно выключена, поэтому новые таблицы (`habits`, `habit_checkins`, `tasks`, `subscriptions`) и колонка `users.isPaused` создаются **только миграциями**. При первом деплое обязательно выполните `npm run migration:run:prod`.

Побочный эффект старой синхронизации: в базах, где она работала, внешние ключи и unique-ограничения старых таблиц переименованы. На работу бота это не влияет, но откат первой миграции `InitSchema` там может не сработать.
