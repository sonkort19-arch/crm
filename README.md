# Too CRM

Статическое веб-приложение (HTML / CSS / JS), деплой как статика (например **Render**). **Проценты и зарплата** (балансы, журналы начислений и выплат) хранятся в **Supabase** и синхронизируются между устройствами в **realtime**. **Тема оформления** и **факт входа** (роль) по-прежнему в `localStorage` браузера.

## Supabase (один раз)

1. Создайте проект на [supabase.com](https://supabase.com) (бесплатный тариф).
2. В **SQL Editor** выполните содержимое файла **`supabase-schema.sql`**.
3. В **Project Settings → API** скопируйте **Project URL** и **anon public key**.
4. Скопируйте **`crm-config.example.js`** в **`crm-config.js`** и подставьте URL и ключ. Файл **`crm-config.js`** в git не коммитьте (он в `.gitignore`).
5. Убедитесь, что для таблицы **`app_state`** включён **Realtime** (после `alter publication supabase_realtime add table` обычно достаточно; при необходимости проверьте **Database → Publications** в Dashboard).

### Безопасность (MVP)

В SQL включена политика **RLS**, разрешающая операции anon-клиенту для строки `main`. **Любой**, у кого есть **anon key** и URL (в т.ч. из исходника страницы), теоретически может менять данные. Для теста считайте URL сайта и ключи конфиденциальными; для продакшена замените политики на авторизацию Supabase Auth и строгие правила.

## Деплой на GitHub → Render

1. Закоммитьте и запушьте код (**без** `node_modules/`, **без** `crm-config.js` — он в `.gitignore`).
2. В [Render](https://dashboard.render.com) создайте **Static Site**, подключите репозиторий и ветку (например `main`).
3. Настройки:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `.` (корень репозитория)
4. **Environment** → добавьте переменные (имена **строго** такие):
   - `SUPABASE_URL` — **Project URL** из Supabase → Settings → API
   - `SUPABASE_ANON_KEY` — **anon public** ключ для клиента

   Команда `npm run build` запускает `scripts/gen-crm-config.mjs` и создаёт **`crm-config.js`** на сервере сборки (секреты в git не попадают).

5. Сохраните, дождитесь **Deploy succeeded** и откройте выданный URL (`*.onrender.com`).

**Альтернатива без Node** — в **Build command** одна строка:

```bash
printf '%s\n' "window.CRM_CONFIG={supabaseUrl:\"$SUPABASE_URL\",supabaseAnonKey:\"$SUPABASE_ANON_KEY\"};" > crm-config.js
```

(те же переменные окружения.)

## Проверка синхронизации

Откройте один и тот же URL в **двух браузерах** (или ПК), войдите, откройте «Зарплата» / сделайте расчёт. Изменения должны появляться у второго клиента **без перезагрузки страницы**.

Локально открывайте сайт через **HTTP** (например Live Server / `npx serve`), а не как `file://` — иначе ES-модули (`app.js` → `crm-cloud.js`) могут не загрузиться.

### Если локально видите `Failed to fetch`

Почти всегда причина в `crm-config.js`:
- в объекте `window.CRM_CONFIG` должна быть **ровно одна** пара `supabaseUrl` + `supabaseAnonKey`;
- не оставляйте шаблонные строки (`YOUR_PROJECT_REF`, `YOUR_SUPABASE_ANON_KEY`);
- URL должен быть вида `https://<project-ref>.supabase.co` (без лишних символов).

Также проверьте, что открываете сайт через `http://127.0.0.1:...`, а не `file://`.

## Зависимости npm (необязательно)

Сайт в браузере не требует пакетов: шрифт из **`manrope.css`**. `npm install` на Render нужен только для шага **`npm run build`** (генерация `crm-config.js`).

## Прочее

Логины и пароли для входа в **клиентском** коде (`app.js`) видны в DevTools. Для реальной защиты нужна серверная авторизация. Ограничение осознанное для текущего MVP.
