# Архитектура

## Обзор

Одно NestJS-приложение с одной базой PostgreSQL. Доменные модули хранят данные и бизнес-логику. Модуль `telegram` — единственный UI-слой. Модуль `scheduler` рассылает уведомления по расписанию.

```
src/
├── main.ts                      # первым импортом фиксирует часовой пояс
├── app.module.ts                # Config, Schedule, Database + модули ниже
├── common/
│   ├── constants/time-zone.ts   # APP_TIME_ZONE = "Asia/Bishkek"
│   └── utils/                   # local-date.util (даты "YYYY-MM-DD"), data-range.util (периоды финансов)
├── config/                      # configuration.ts (типизированный конфиг), validation.ts
├── database/                    # TypeORM, data-source.ts для CLI, migrations/
└── modules/
    ├── user/                    # пользователь Telegram
    ├── category/ operation/ report/   # финансы
    ├── habit/                   # привычки, отметки, расчёт серий
    ├── task/                    # задачи
    ├── subscription/            # подписки, расчёт даты следующего списания
    ├── scheduler/               # cron-уведомления
    └── telegram/                # всё взаимодействие с ботом
```

```
telegram ──┬──> finance (category, operation, report) ──┐
           ├──> habit ──────────────────────────────────┼──> user
           ├──> task ───────────────────────────────────┤
           └──> subscription ───────────────────────────┘
scheduler ───> habit, task, subscription, user
```

`subscription` дополнительно зависит от `operation` и `category`: `SubscriptionService.markPaid` записывает оплату как расход.

Доменные модули не знают о Telegram. `telegram` и `scheduler` используют их сервисы.

## Обработка апдейта

```
Telegram ──polling──> Telegraf
                        │
                        ├─ errorMiddleware      ловит исключения любого обработчика, логирует,
                        │                       отвечает «Что-то пошло не так» (polling не падает)
                        ├─ accessMiddleware     пропускает только ALLOWED_TELEGRAM_USER_ID;
                        │                       при паузе пропускает только /start
                        └─ @Update-классы
                             ├─ CoreUpdate      /start /help /cancel /disable /clear + единственный @On("text")
                             ├─ FinanceUpdate   /income /expense /stats ... + inline-кнопки финансов
                             ├─ HabitUpdate     /habits + habit_check, habit_del
                             ├─ TaskUpdate      /today /tasks + task_date, task_done, task_del
                             └─ SubscriptionUpdate  /subs + sub_period, sub_del
                                     │
                                     ▼
                                  flows/*.flow.ts ──> доменные сервисы ──> PostgreSQL
```

Middleware подключаются в `TelegrafModule.forRootAsync` (`telegram.module.ts`). Проверка доступа сделана именно через middleware, а не через Nest-guard: guard при отказе бросает `ForbiddenException`, который `nestjs-telegraf` не перехватывает.

### Почему `@On("text")` только один

Telegraf отдаёт сообщение первому подходящему обработчику. Если бы каждый Update-класс объявил свой `@On("text")`, текст получал бы только один из них, и какой именно, зависело бы от порядка регистрации. Поэтому текстовый роутер один, в `CoreUpdate.onText`:

1. Текст, начинающийся с `/`, передаётся дальше через `next()` к `@Command` других классов.
2. «❌ Отмена» отменяет диалог, «⬅️ Назад» возвращает в главное меню.
3. Если активного диалога нет, `handleMenuText` сопоставляет текст с надписями кнопок меню.
4. Если диалог есть, текст отправляется в flow по полю `state.flow`.

## Flows и состояние диалога

`flows/*.flow.ts` — по одному injectable-классу на функцию: `OperationFlow`, `StatsFlow`, `RatingFlow`, `CategoryManageFlow`, `LastFlow`, `ExcelFlow`, `HelpFlow`, `HabitFlow`, `TaskFlow`, `SubscriptionFlow`. Update-классы только разбирают входные данные и вызывают методы flow.

Многошаговые диалоги — это конечный автомат:

- `state/dialog-state.types.ts` задаёт `DialogState` как discriminated union по полям `flow` и `step`, с данными шага (например, `{ flow: "task", step: "task_date", title }`). Тип `DialogFlow` выводится из union.
- `DialogStateService` хранит `Map<userId, DialogState>` **в памяти**. После перезапуска незавершённые диалоги теряются, и это допустимо.
- Каждый обработчик шага сначала проверяет, что пользователь находится на нужном шаге (`state.flow` / `state.step`), затем делает `set()` следующего шага или `clear()` в конце.

Пауза (`/disable`) хранится в `users.isPaused`. `BotPauseService` при старте загружает список пользователей на паузе и держит его в памяти, чтобы middleware проверял паузу без запроса к базе. Изменения сначала пишутся в базу, затем в кэш.

`DialogStateService` и `BotPauseService` вынесены в `TelegramStateModule`, чтобы middleware, Update-классы и планировщик использовали **одни и те же экземпляры**.

## Меню

| Клавиатура | Файл | Кнопки |
| --- | --- | --- |
| главное | `keyboards/main-menu.keyboard.ts` | Задачи, Привычки, Финансы, Подписки, Помощь, Отключить |
| финансы | `keyboards/finance-menu.keyboard.ts` | Доход, Расход, Статистика, Рейтинг, Категории, Последние, Отчёт, Назад |
| привычки | `keyboards/habits-menu.keyboard.ts` | Отметить сегодня, Новая привычка, Мои привычки, Назад |
| задачи | `keyboards/tasks-menu.keyboard.ts` | Сегодня, Неделя, Новая задача, Назад |
| подписки | `keyboards/subscriptions-menu.keyboard.ts` | Мои подписки, Новая подписка, Назад |

Надписи кнопок хранятся в константах `*_MENU_BUTTONS`, и `handleMenuText` сравнивает текст именно с ними. Надписи reply-кнопок должны быть **уникальны во всех меню**. После завершения или отмены диалога пользователь возвращается в меню своего раздела: `TelegramService.getMenuKeyboardForFlow(flow)`.

## Inline-кнопки

Callback data имеет формат `prefix:param[:param]` и ограничение Telegram в 64 байта:

| Пример | Обработчик |
| --- | --- |
| `stats_period:month`, `category:food`, `last_more:10` | `FinanceUpdate` |
| `habit_check:<uuid>:done`, `habit_del:<uuid>` | `HabitUpdate` |
| `task_date:wd5`, `task_done:<uuid>:today`, `task_del:<uuid>:week` | `TaskUpdate` |
| `sub_period:monthly`, `sub_del:<uuid>`, `sub_paid:<uuid>:<YYYYMMDD>` | `SubscriptionUpdate` |

Правила:
- в регулярном выражении `@Action` ограничивайте параметры: UUID задаётся как `[0-9a-f-]{36}`, режимы перечисляются явно (`(today|week)`). Так некорректный ввод не доходит до Postgres;
- параметры разбирает `handleCallbackParams(ctx, errorText, handler, expectedParams)` из `telegram.helpers.ts`;
- чтобы перерисовать сообщение после нажатия, используйте `editMessageSafe`: он не падает на ответе Telegram «message is not modified».

## Views

`views/habit.views.ts`, `views/task.views.ts` и `views/subscription.views.ts` — чистые функции, которые возвращают `{ text, reply_markup }`. Их используют и flows (по кнопке), и планировщик (по расписанию), поэтому сообщения выглядят одинаково. Например, `buildTaskListView(tasks, today, "today" | "week", intro?)` строит и список по кнопке «📅 Сегодня», и утренний дайджест.

Сообщения финансов форматирует `telegram.formatter.ts`.

## Планировщик

`src/modules/scheduler/notification.service.ts` использует `@nestjs/schedule`:

| Job | Cron | Что делает |
| --- | --- | --- |
| `morning-digest` | `0 9 * * *` | открытые задачи до сегодняшнего дня включительно (то есть с просроченными) и число активных привычек |
| `habit-poll` | `0 22 * * *` | заголовок и по сообщению на каждую активную привычку без отметки за сегодня |
| `subscription-reminders` | `0 9 * * *` | одно сообщение со списанием, до которого осталось 3, 1 или 0 дней; затем даты прошедших списаний сдвигаются на следующий период (`advanceOverdue`) |

- Все job'ы работают в `APP_TIME_ZONE`.
- Отправка идёт через `@InjectBot()` на `user.telegramId`: для личного чата это и есть chat id.
- Получатели — все пользователи из таблицы `users`, кроме тех, кто на паузе, и кроме тех, чей ID не равен `ALLOWED_TELEGRAM_USER_ID` (если он задан).
- Ошибка отправки одному пользователю логируется и не прерывает рассылку остальным.
- При старте в лог пишется время следующего запуска каждого job'а.

## Время и даты

- `src/common/constants/time-zone.ts` выставляет `process.env.TZ = "Asia/Bishkek"`. Файл импортируется **первой строкой** `main.ts`, раньше любого кода, работающего с `Date`.
- «Локальная дата» — строка `"YYYY-MM-DD"` (`common/utils/local-date.util.ts`: `todayLocalDate`, `addDays`, `nextWeekday` и др.). В таком же виде TypeORM возвращает колонки типа `date`, поэтому даты сравниваются как строки.
- Периоды финансов (`today`, `last7`, `month`, `custom`) строит `common/utils/data-range.util.ts` из объектов `Date` в локальном времени.

## Конфигурация

`src/config/configuration.ts` собирает типизированный конфиг (`configService.get("telegram")`, `get("database")`). `src/config/validation.ts` преобразует типы переменных окружения. `@nestjs/config` записывает результат обратно в `process.env`, поэтому для булевых значений нужен явный `@Transform`: неявное преобразование превращает строку `"false"` в `true`.
