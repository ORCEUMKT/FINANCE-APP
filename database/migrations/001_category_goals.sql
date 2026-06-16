-- ============================================================
-- MIGRATION 001 — category_goals (metas mensais por categoria)
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.category_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, category_id)
);

drop trigger if exists trg_category_goals_updated_at on public.category_goals;
create trigger trg_category_goals_updated_at
  before update on public.category_goals
  for each row execute function public.handle_updated_at();

alter table public.category_goals enable row level security;

create policy "category_goals: select own" on public.category_goals
  for select using (auth.uid() = user_id);
create policy "category_goals: insert own" on public.category_goals
  for insert with check (auth.uid() = user_id);
create policy "category_goals: update own" on public.category_goals
  for update using (auth.uid() = user_id);
create policy "category_goals: delete own" on public.category_goals
  for delete using (auth.uid() = user_id);
