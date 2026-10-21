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
| `PORT` | нет | HTTP-порт Nest, по умолчанию `3000`. На нём работают API и фронт Mini App |
| `WEBAPP_URL` | нет | публичный `https://` адрес Mini App. Если задан, у бота появляется кнопка меню «📊 Дашборд» и работает `/dashboard`. См. [Mini App](webapp.md) |

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

Фронт Mini App запускается отдельно (`npm run dev:webapp`), подробнее в [Mini App → Разработка](webapp.md#разработка).

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
npm run build:webapp            # собирает фронт Mini App в webapp/dist
npm run migration:run:prod      # собирает dist/ и применяет миграции; обязательно до перезапуска
pm2 startOrReload ecosystem.config.js --env production
```

Запускайте **ровно один экземпляр**. Второй процесс с тем же токеном вызовет `409 Conflict`, а уведомления по расписанию придут дважды.

### CI/CD (GitHub Actions)

Workflow `.github/workflows/ci-cd.yml`:

- на каждый pull request в `main` и на каждый push в `main` запускается job `test`: `npm ci`, `npm run lint`, `npm test`, `npm run build`;
- после успешного push в `main` запускается job `deploy`: заходит на сервер по SSH и выполняет `deploy/deploy.sh` (fetch + `reset --hard origin/main`, `npm ci`, `npm run migration:run:prod`, `pm2 startOrReload`, проверка, что процесс остался `online`). Если сборка или миграция упали, бот продолжает работать на прежнем коде.

**Секреты репозитория** (Settings → Secrets and variables → Actions):

| Секрет | Значение |
| --- | --- |
| `SSH_HOST` | адрес сервера |
| `SSH_USER` | пользователь на сервере |
| `SSH_PRIVATE_KEY` | приватный ключ, созданный только для деплоя |
| `SSH_KNOWN_HOSTS` | вывод `ssh-keyscan -t ed25519 <адрес>` (закрепляет отпечаток сервера) |

**Одноразовая настройка сервера.**

1. Скопировать `deploy/deploy.sh` **вне репозитория** (например, `/root/deploy-finance-bot.sh`) и сделать исполняемым. Внутри рабочей папки его нельзя держать: `git reset` перезаписал бы скрипт, пока bash его читает.
2. Создать отдельный ключ: `ssh-keygen -t ed25519 -N "" -f deploy_key -C github-actions-finance-bot`.
3. Добавить публичную часть в `~/.ssh/authorized_keys` с ограничением на единственную команду:
   ```
   command="/root/deploy-finance-bot.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-finance-bot
   ```
   Такой ключ нельзя использовать для входа в оболочку: что бы ни передали в `ssh`, выполнится только скрипт деплоя.
4. Проверить ключ, ничего не деплоя: `ssh -i deploy_key root@<адрес> check` должно ответить `ok`. Любая другая команда, переданная этим ключом, запускает деплой (скрипт игнорирует, что именно ему передали).
5. Приватную часть положить в секрет `SSH_PRIVATE_KEY` и удалить локальные копии.

При изменении `deploy/deploy.sh` скопируйте новую версию на сервер вручную: автодеплой её не обновляет.

Рекомендуется включить в GitHub защиту ветки `main` (Settings → Branches): обязательный статус `test` перед слиянием.

### Переход на версию с привычками и задачами

До этой версии из-за ошибки разбора `DB_SYNCHRONIZE` автосинхронизация схемы TypeORM была включена всегда, даже при `false`. Теперь она действительно выключена, поэтому новые таблицы (`habits`, `habit_checkins`, `tasks`, `subscriptions`) и колонка `users.isPaused` создаются **только миграциями**. При первом деплое обязательно выполните `npm run migration:run:prod`.

Побочный эффект старой синхронизации: в базах, где она работала, внешние ключи и unique-ограничения старых таблиц переименованы. На работу бота это не влияет, но откат первой миграции `InitSchema` там может не сработать.
