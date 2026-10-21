# Как добавить модуль

Чеклист нового раздела бота на примере модуля «🔔 Подписки» (регулярные платежи с напоминанием). Готовые образцы для копирования: `habit` и `task`.

## 1. Доменный модуль

`src/modules/subscription/`:

- `subscription.entity.ts` — сущность со связью на пользователя:
  ```ts
  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user: UserEntity;
  ```
  Даты без времени хранить как `@Column({ type: "date" }) nextChargeDate: string;`: это локальная дата `"YYYY-MM-DD"` (см. [База данных → Даты](database.md#даты)).
- `subscription.service.ts` — вся бизнес-логика. Методы получают `UserEntity` и проверяют владение (`where: { id, user: { id: user.id } }`), как `TaskService.findOwned`. Валидацию ввода возвращайте как `{ created: false, reason }`, а не исключением.
- `subscription.module.ts` — `TypeOrmModule.forFeature([...])`, `exports: [SubscriptionService]`.
- Чистую логику (расчёты дат, сумм) выносите в `*.util.ts` с unit-тестом рядом (`*.spec.ts`), как `habit/streak.util.ts`.

## 2. Миграция

Новый файл в `src/database/migrations/` и сущность в `entities` в `src/database/data-source.ts`. Подробно: [База данных → Миграции](database.md#миграции).

## 3. Состояние диалога

В `src/modules/telegram/state/dialog-state.types.ts` добавьте вариант и включите его в `DialogState`:

```ts
export type SubscriptionDialogState =
  | { flow: "subscription"; step: "subscription_title" }
  | { flow: "subscription"; step: "subscription_amount"; title: string };
```

`DialogFlow` выводится из union автоматически.

## 4. Меню

- `keyboards/subscriptions-menu.keyboard.ts` — константа `SUBSCRIPTIONS_MENU_BUTTONS` и клавиатура с `MAIN_MENU_BUTTONS.back`. Надписи должны быть уникальны среди всех меню.
- Кнопка раздела в `MAIN_MENU_BUTTONS` и в `buildMainMenuKeyboard()`.
- `TelegramService`: метод `getSubscriptionsMenuKeyboard()` и `case "subscription"` в `getMenuKeyboardForFlow()`.

## 5. View, flow и Update

- `views/subscription.views.ts` — функции, которые возвращают `{ text, reply_markup }`. Если сообщение будет отправлять и планировщик, оно должно строиться только здесь.
- `flows/subscription.flow.ts` — методы `showMenu`, `startAdd`, `handleText(ctx, userId, text, state)` и обработчики кнопок. В каждом шаге проверяйте `state.flow` и `state.step`; в конце делайте `dialogStateService.clear(userId)` и возвращайте в меню раздела.
- `updates/subscription.update.ts` — `@Command(...)` и `@Action(...)`:
  ```ts
  @Action(/^sub_del:([0-9a-f-]{36})$/)
  async onDelete(@Ctx() ctx: BotContext) {
    await handleCallbackParams(ctx, "Не удалось определить подписку.", (_userId, [id]) =>
      this.subscriptionFlow.handleDelete(ctx, id),
    );
  }
  ```
  **Не добавляйте `@On("text")`**: текст обрабатывает только `CoreUpdate` (см. [Архитектура](architecture.md#почему-ontext-только-один)). Проверять доступ в обработчиках тоже не нужно, это делает middleware.
- Callback data держите в пределах 64 байт: `prefix:<uuid>:<param>` укладывается.

## 6. Подключение к роутеру

В `updates/core.update.ts`:
- внедрите `SubscriptionFlow` в конструктор;
- в `onText` добавьте `case "subscription"` в switch по `state.flow`;
- в `handleMenuText` добавьте кнопку раздела (`showMenu`) и кнопки подменю.

В `telegram.module.ts`: импортируйте `SubscriptionModule`, а в `providers` добавьте `SubscriptionFlow` и `SubscriptionUpdate`.

## 7. Уведомления (если нужны)

В `NotificationService` (или в отдельном сервисе в `src/modules/scheduler/`):

```ts
@Cron("0 10 * * *", { name: "subscription-reminder", timeZone: APP_TIME_ZONE })
async sendSubscriptionReminders() {
  await this.forEachRecipient(async (user) => { /* ... */ });
}
```

Добавьте модуль в `imports` у `SchedulerModule`, а имя job'а — в список в `onApplicationBootstrap`, чтобы время следующего запуска попадало в лог.

## 8. Справка и проверка

- Опишите раздел в `HelpFlow` и `TelegramService.getStartMessage()`, а также в [руководстве пользователя](user-guide.md).
- Проверьте: `npx tsc --noEmit -p tsconfig.json`, `npm test`, `npx eslint <изменённые файлы>`, затем применение и откат миграции и ручной прогон в тестовом боте.
