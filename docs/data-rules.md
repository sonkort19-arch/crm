# Правила данных

## Фиксированная структура `db` (клиент)

```text
{
  users: User[],
  activeUserId: string | null
}
```

## User (клиентское представление)

```ts
{
  id: string,
  name: string,
  percent: number,
  logs: Log[]
}
```

Поля `username`, `passwordHash`, `role` **не** хранятся в клиентском `db` для списка сотрудников; роль и профиль для UI берутся из `crm_auth_user` / `authService.getCurrentUser()`.

## Серверная таблица `users` (SQLite)

- `id`, `name`, `percent` — как раньше.
- `username` — уникальный логин (латиница, цифры, `_.-`, длина 3–30).
- `passwordHash` — только bcrypt, пароль в открытом виде не хранится.
- `role` — `admin` | `employee`.

## Log

```ts
{
  type: 'income' | 'withdraw',
  amount: number,
  date: string
}
```

## Правила

- **Нельзя хранить `undefined`** в полях, которые уходят на сервер или отображаются в UI. При загрузке отсутствующие поля нормализуются в `db.js` (`normalizeUser`, `normalizeLog`).
- **Нельзя хранить `NaN`.** Все числовые значения после чтения и перед записью проходят через `roundMoney` / `safeNumber` в соответствующих слоях.
- **Пароли:** только на сервере, только хеш; клиент хранит **только** JWT и объект пользователя **без** пароля.
- **Имя** — строка, ограничение длины задаётся константой (`MAX_NAME_LEN` в `utils.js`).
- **Миграции:** выполняются на сервере (`server/database/db.js`); клиент получает уже нормализованный список (для employee — одну запись).
