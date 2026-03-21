# Архитектура CRM (зарплата)

## Слои

| Слой | Путь | Ответственность |
|------|------|-----------------|
| **AUTH (client)** | `assets/js/core/auth.js`, `services/authService.js` | Токен и пользователь в `localStorage`, `restoreSession`, роли `isAdmin` / `isEmployee` |
| **AUTH (UI)** | `assets/js/ui/authView.js` | Экран входа, переключение `#loginScreen` / `#appShell` |
| **DATA** | `assets/js/core/db.js` | Состояние приложения (`db`), загрузка с сервера (`loadUsersFromServer`), нормализация данных при чтении |
| **API** | `assets/js/core/api.js` | `fetch` с `Authorization: Bearer`, при `401` — сброс сессии и перезагрузка страницы |
| **UTILS** | `assets/js/core/utils.js` | Чистые функции: числа, даты — без доступа к `db` и DOM |
| **SERVICES** | `assets/js/services/` | Вызовы API, обновление `db` после ответа (`loadUsersFromServer`), отображаемые расчёты из данных |
| **UI** | `assets/js/ui/` | Отрисовка (`render.js`), события (`events.js`), вход (`authView.js`), кнопки (`actionButtons.js`) |
| **ENTRY** | `assets/js/app.js` | Сессия → либо экран входа, либо `init()` CRM |

## Сервер

| Путь | Назначение |
|------|------------|
| `server/index.js` | Express, CORS (в т.ч. заголовок `Authorization`), rate limit, маршруты |
| `server/database/db.js` | SQLite, миграции `users` (логин/роль/хеш) |
| `server/auth/jwt.js` | Подпись и проверка JWT (`JWT_SECRET` из `.env`) |
| `server/auth/authMiddleware.js` | `requireAuth` — Bearer-токен, `req.auth = { userId, username, role }` |
| `server/auth/requireRole.js` | `requireRole('admin')` — только администратор |
| `server/auth/authController.js` | `login`, `me`, `logout` |
| `server/routes/auth.js` | `/api/auth/*` |
| `server/controllers/userController.js` | CRUD, логи, начисления; фильтрация списка и проверка владельца для employee |

## Главные правила

1. **UI не содержит бизнес-логики** расчёта зарплаты; ограничения по ролям на клиенте — удобство, **обязательная проверка — на сервере** (401/403).
2. **Services не работают с DOM** (кроме принятого разделения: `authService` не трогает DOM).
3. **`db` — кэш** ответа `GET /api/users`; для employee сервер отдаёт только одну запись.
4. **JWT** в заголовке для всех защищённых маршрутов `/api/users`, `/api/logs`, `/api/operations/distribute`.

## Поток данных

```
Вход → POST /api/auth/login → token в localStorage → GET /api/auth/me (опционально) → GET /api/users с Bearer → loadUsersFromServer → render
```

## Модули ES

Используется `import` / `export` (`type="module"` в `index.html`).
