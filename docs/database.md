# База данных

PostgreSQL, TypeORM. Схема меняется **только миграциями**: `DB_SYNCHRONIZE=false`.

## Схема

```
users ─┬─< operations >── categories
       ├─< habits ─< habit_checkins
       ├─< tasks
       └─< subscriptions
```

Все пользовательские данные привязаны к `users` с `ON DELETE CASCADE`: удаление пользователя удаляет его операции, привычки с отметками, задачи и подписки. Категории **общие** для всех пользователей.

### `users`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `serial` | PK |
| `telegramId` | `varchar(64)` | unique; для личного чата совпадает с chat id |
| `userName`, `firstName`, `lastName` | `varchar(64)` | обновляются, если изменились в Telegram |
| `isPaused` | `boolean` | бот на паузе (`/disable`); снимается по `/start` |
| `createdAt` | `timestamptz` | |

Запись создаётся при первом действии пользователя (`UserService.findOrCreateByTelegramUser`).

### `categories`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `type` | enum `INCOME` / `EXPENSE` | |
| `code` | `varchar(64)` | unique вместе с `type`; используется в callback data |
| `displayName` | `varchar(64)` | |
| `order` | `int` | порядок кнопок |

Категории по умолчанию (`category/category.deafult.ts`) досоздаются при каждом старте (`CategoryService.onModuleInit`), если их нет. Среди них «🔔 Подписки» (`subscriptions`): под ней записываются оплаченные подписки.

### `operations`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `userId` | `int` | FK → `users`, cascade |
| `categoryId` | `uuid` | FK → `categories`, **без** cascade: категорию с операциями удалить нельзя |
| `type` | enum `INCOME` / `EXPENSE` | |
| `amount` | `numeric(12,2)` | в коде приводится к `number` |
| `comment` | `varchar(256)`, null | |
| `createdAt` | `timestamptz` | дата операции |

### `habits`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `userId` | `int` | FK → `users`, cascade |
| `title` | `varchar(128)` | |
| `isActive` | `boolean` | `false` = привычка удалена (мягкое удаление, история сохраняется) |
| `order` | `int` | |
| `createdAt` | `timestamptz` | |

### `habit_checkins`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `habitId` | `uuid` | FK → `habits`, cascade |
| `date` | `date` | локальная дата отметки |
| `status` | enum `DONE` / `SKIPPED` | |
| `createdAt` | `timestamptz` | |

Ограничение `UQ_habit_checkins_habit_date (habitId, date)`: одна отметка на привычку в день. Повторная отметка перезаписывает `status`.

Серии в базе не хранятся. Их на лету считает `habit/streak.util.ts` (`calcStreak`) по датам со статусом `DONE`.

### `tasks`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `userId` | `int` | FK → `users`, cascade |
| `title` | `varchar(256)` | |
| `dueDate` | `date` | локальная дата, на которую поставлена задача |
| `isDone` | `boolean` | |
| `doneAt` | `timestamptz`, null | когда отмечена выполненной |
| `createdAt` | `timestamptz` | |

Индекс `IDX_tasks_user_due (userId, dueDate)`. Просроченные задачи никуда не переносятся: `TaskService.getOpenUntil(user, date)` возвращает все открытые задачи с `dueDate <= date`. Так они остаются в списке «Сегодня», пока их не закроют.

### `subscriptions`

| Колонка | Тип | Примечание |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `userId` | `int` | FK → `users`, cascade |
| `name` | `varchar(128)` | |
| `amount` | `numeric(12,2)` | в коде приводится к `number`; валюта не хранится |
| `period` | `varchar(16)` | `monthly` или `yearly` |
| `billingDay` | `smallint` | день месяца (1–31), на который настроено списание |
| `nextPaymentDate` | `date` | локальная дата ближайшего списания |
| `createdAt` | `timestamptz` | |

Индекс `IDX_subscriptions_user_next (userId, nextPaymentDate)`. После даты списания `nextPaymentDate` сдвигается на следующий период: ночью планировщиком (`advanceOverdue`) и при открытии списка (`getAll`). Кнопка «✅ Оплачено» (`SubscriptionService.markPaid`) сдвигает дату сразу и создаёт запись в `operations` (тип `EXPENSE`, категория с кодом `subscriptions`, `comment` = название). Сдвиг делается условным `UPDATE ... WHERE nextPaymentDate = <дата из кнопки>`, поэтому повторное нажатие не создаёт второй расход. Сдвиг считает `subscription/next-payment.util.ts` от `billingDay`, поэтому подписка с 31-м числом идёт 31.01 → 28.02 → 31.03, а не «застревает» на 28-м.

## Даты

- Колонки `date` (`habit_checkins.date`, `tasks.dueDate`, `subscriptions.nextPaymentDate`) хранят **локальную** дату по `Asia/Bishkek`. В коде это строки `"YYYY-MM-DD"` (`common/utils/local-date.util.ts`), и сравниваются они как строки.
- TypeORM возвращает `date` строкой только при загрузке сущностей. В сырых запросах (`getRawMany`) драйвер `pg` возвращает объект `Date`, поэтому там форматируйте дату в SQL: ``to_char(col, 'YYYY-MM-DD')`` (см. `HabitService.withStats`).
- `timestamptz` (`createdAt`, `doneAt`) хранят момент времени. Периоды финансов строятся по ним в локальном времени процесса.

## Миграции

Файлы лежат в `src/database/migrations/` и пишутся вручную (`migration:generate` в проекте не используется):

| Миграция | Что создаёт |
| --- | --- |
| `1760000000000-InitSchema` | `users`, `categories`, `operations` |
| `1792540800000-AddHabits` | `habits`, `habit_checkins`, enum `habit_checkins_status_enum` |
| `1792540900000-AddTasks` | `tasks` |
| `1792541000000-AddUserIsPaused` | колонка `users.isPaused` |
| `1792541100000-AddSubscriptions` | `subscriptions` |

Как добавить миграцию:

1. Создать `src/database/migrations/<timestamp>-<Name>.ts` с классом `<Name><timestamp>` и полем `name`. Timestamp должен быть больше, чем у последней миграции.
2. Написать `up` и симметричный `down`. Ограничениям давать явные имена (`PK_<table>`, `FK_<table>_<ref>`, `UQ_...`, `IDX_...`).
3. Если появилась новая сущность, добавить её в массив `entities` в `src/database/data-source.ts`. Рантайм Nest подхватывает сущности сам (`autoLoadEntities`), а CLI — нет.
4. Проверить применение и откат: `npm run migration:run:dev`, затем `npm run migration:revert:dev` и снова `npm run migration:run:dev`.

> В базах, где раньше работала автосинхронизация (до исправления `DB_SYNCHRONIZE`), TypeORM переименовал ограничения таблиц из `InitSchema`. Поэтому `InitSchema.down` там может не сработать. Остальные миграции это не затрагивает.
