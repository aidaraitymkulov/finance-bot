# Mini App (дашборд)

Telegram Mini App с графиками. Сейчас в нём один экран — **💰 Финансы**: сводка за период, расходы по дням, категории и последние операции. Добавлять операции по-прежнему нужно в боте. Mini App нужен для обзора.

## Как открыть

- кнопка меню бота «📊 Дашборд» (слева от поля ввода);
- команда `/dashboard`: присылает сообщение с кнопкой.

Обе появляются, только если задан `WEBAPP_URL` (адрес `https://…`). Telegram открывает Mini App только по HTTPS.

## Устройство

```
finance-bot/
├── src/modules/webapp/        # NestJS: REST API /api/* и раздача собранного фронта
│   ├── auth/                  # проверка initData от Telegram, guard
│   ├── finance.controller.ts  # GET /api/finance/dashboard
│   └── finance-dashboard.service.ts
├── webapp/                    # фронт: React + Vite + TypeScript (свой package.json)
│   └── src/finance/           # экран «Финансы»
└── scripts/dev-init-data.mjs  # подпись тестового initData для разработки в браузере
```

- Фронт и API обслуживает **тот же процесс Nest**: собранный `webapp/dist` раздаётся как статика (`@nestjs/serve-static`), всё под `/api` — это API. Один деплой, один pm2-процесс, CORS не нужен. Если `webapp/dist` нет (фронт не собран), Nest пишет предупреждение в лог и раздаёт только API.
- API — тонкий слой над доменными сервисами (`ReportService` и т. д.), как и Telegram-слой.
- Фронт: TanStack Query (загрузка и кэш), Recharts (столбики по дням), цвета берутся из темы Telegram (`--tg-theme-*`), поэтому светлая и тёмная тема переключаются вместе с Telegram.

### Авторизация

Telegram передаёт в Mini App строку `initData`, подписанную токеном бота. Фронт отправляет её в заголовке `Authorization: tma <initData>`. `WebAppAuthGuard`:

1. проверяет подпись HMAC-SHA256 (`auth/init-data.util.ts`, [алгоритм Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app));
2. отклоняет данные старше 24 часов (`auth_date`);
3. пропускает только `ALLOWED_TELEGRAM_USER_ID`, как и бот;
4. находит пользователя в `users` и передаёт его в контроллер (`@WebAppUser()`).

Ответы: `401` — нет подписи или она неверная/устарела, `403` — чужой пользователь.

### API

`GET /api/finance/dashboard?period=today|last7|month[&month=YYYY-MM]`

- `period` по умолчанию `month`; `month` — любой прошедший месяц (по умолчанию текущий, считается до сегодняшнего дня);
- ответ: `summary` (доход, расход, баланс, средние в день), `expenseByCategory`, `incomeByCategory`, `daily` (по каждому дню периода, включая дни без операций; дни считаются по `Asia/Bishkek`), `recent` (последние 20 операций периода).

## Разработка

Нужны два процесса: бэкенд и dev-сервер Vite.

```bash
PORT=3001 npm run start:dev       # бэкенд (бот + API)
npm --prefix webapp install       # один раз
npm run dev:webapp                # http://localhost:5173, /api проксируется на localhost:3001
```

**В обычном браузере.** Откройте `http://localhost:5173`. Вне Telegram настоящего `initData` нет, поэтому dev-сервер подписывает тестовый (`/__dev-init-data`) токеном бота и `ALLOWED_TELEGRAM_USER_ID` из `.env`. Эта подпись даёт доступ к данным владельца, поэтому dev-сервер выдаёт её **только прямым запросам с localhost**: через туннель (`Cf-Connecting-Ip`, чужой `Host`) — `403`. В продакшен-сборку этот код не попадает.

**Внутри Telegram.** Нужен HTTPS-адрес. Бесплатный временный туннель без аккаунта:

```bash
cloudflared tunnel --url http://localhost:5173
```

Он выдаст `https://<случайное-имя>.trycloudflare.com`. Пропишите его в `.env` тестового бота как `WEBAPP_URL` и перезапустите бэкенд: кнопка меню обновится. Адрес меняется при каждом запуске туннеля.

Проверки фронта: `npm --prefix webapp run typecheck`, сборка — `npm --prefix webapp run build`.

## Прод: бесплатный HTTPS без своего домена

1. На [duckdns.org](https://www.duckdns.org) (вход через GitHub/Google) создайте поддомен, например `my-bot.duckdns.org`, и укажите IP сервера.
2. Установите на сервер [Caddy](https://caddyserver.com/docs/install) — он сам получает и продлевает сертификат Let's Encrypt. `/etc/caddy/Caddyfile`:
   ```
   my-bot.duckdns.org {
       reverse_proxy localhost:3000
   }
   ```
   `sudo systemctl reload caddy`. Порты 80 и 443 должны быть открыты (в том числе в firewall Hetzner, если он настроен).
3. В `.env` на сервере: `WEBAPP_URL=https://my-bot.duckdns.org`.
4. Деплой с `npm run build:webapp` (см. [Установка и запуск → Деплой](setup.md#деплой-прод)).

DuckDNS удаляет поддомены неактивных аккаунтов: раз в несколько месяцев заходите в аккаунт.
