-- Too CRM: общее состояние (проценты + зарплата) для Supabase.
-- Выполните в SQL Editor проекта Supabase (один раз).

create table if not exists public.app_state (
  id text primary key default 'main',
  percentages jsonb not null default '{}',
  salary jsonb not null default '{"balances":{},"payoutLog":[],"accrualLog":[]}',
  updated_at timestamptz not null default now()
);

-- Для корректных payload в Realtime при UPDATE
alter table public.app_state replica identity full;

-- Строка по умолчанию (опционально; клиент при отсутствии строки использует дефолты в памяти)
insert into public.app_state (id, percentages, salary)
values (
  'main',
  '{}',
  '{"balances":{},"payoutLog":[],"accrualLog":[]}'::jsonb
)
on conflict (id) do nothing;

alter table public.app_state enable row level security;

-- MVP: доступ по anon key для всех операций. URL и anon key считаем «секретом деплоя»;
-- для продакшена замените на auth + строгие политики.
create policy "app_state_anon_all_mvp"
  on public.app_state
  for all
  using (true)
  with check (true);

-- Realtime: подписка на изменения строки
alter publication supabase_realtime add table public.app_state;
