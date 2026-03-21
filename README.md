# CRM «Зарплата»

Frontend (ES modules) + Express API + SQLite (`better-sqlite3`). **Авторизация:** JWT (Bearer), роли `admin` и `employee`, пароли только в виде bcrypt-хеша в БД.

## Запуск

```bash
cd project
npm install
```

Создайте или проверьте `.env` в корне `project` (см. `.env.example`):

- `PORT` — порт (по умолчанию `3001`)
- `JWT_SECRET` — секрет подписи JWT (**обязательно смените в продакшене**)
- `CORS_ORIGIN` — разрешённые origin через запятую (или пусто для дефолтных localhost)

```bash
npm start
```

Откройте в браузере: **http://localhost:3001/** (или ваш `PORT`).

Статика и API обслуживаются одним процессом (`express.static` + `/api/*`).

## Вход

- **Администратор по умолчанию:** логин `admin`, пароль `1234` (после первого запуска смените пароль через БД или добавьте политику смены пароля).
- Сотрудники из демо-данных: логины `yuri`, `alex`, `erika`, пароль **`1234`** (миграция задаёт их при обновлении схемы).

Токен и профиль (без пароля) хранятся в `localStorage`: ключи `crm_token`, `crm_auth_user`.

## API

### Авторизация

| Метод | Путь | Описание |
|--------|------|----------|
| POST | `/api/auth/login` | `{ username, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Заголовок `Authorization: Bearer <token>` → `{ user }` |
| POST | `/api/auth/logout` | С токеном; клиент всё равно удаляет токен локально |

### CRM (требуется JWT, кроме login)

| Метод | Путь | Кто | Описание |
|--------|------|-----|----------|
| GET | `/api/users` | admin — все; employee — только себя | Сотрудники с логами |
| POST | `/api/users` | **admin** | Создать (`name`, `percent`, `username`, `password`) |
| PUT | `/api/users/:id` | **admin** | Обновить `name` / `percent` |
| DELETE | `/api/users/:id` | **admin** | Удалить |
| GET | `/api/logs/:userId` | admin или владелец | Логи |
| POST | `/api/logs` | admin — любой `userId`; employee — только свой | Добавить лог |
| POST | `/api/operations/distribute` | **admin** | Общее начисление (`amount`) |
| POST | `/api/users/:id/income` | admin или владелец | Начисление от суммы до % (`gross`) |
| POST | `/api/users/:id/withdraw` | admin или владелец | Выплата (`amount`) |

Ответы об ошибках — JSON, коды `400` / `401` / `403` / `500`.

## База данных

Файл: `server/data/crm.sqlite` (создаётся автоматически). Таблица `users` содержит поля `username`, `passwordHash`, `role`; миграции выполняются при старте без потери строк.

## Документация по слоям

См. `docs/architecture.md`, `docs/data-rules.md`, `docs/ui-rules.md`, `docs/dev-checklist.md`.
