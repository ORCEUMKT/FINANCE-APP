-- ============================================================
-- SCHEMA — financeiro-app
-- Run this in Supabase SQL Editor
-- ============================================================

-- profiles (extends auth.users)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  email      text,
  avatar_url text,
  created_at timestamptz default now()
);

-- categories
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text not null default 'circle',
  color      text not null default '#A29BFE',
  type       text not null default 'expense' check (type in ('expense','income','both')),
  is_default boolean default false,
  created_at timestamptz default now()
);

-- accounts
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  label          text not null default 'Conta Principal',
  bank_name      text,
  agency         text,
  account_number text,
  created_at     timestamptz default now()
);

-- transactions
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  account_id  uuid references public.accounts(id) on delete set null,
  description text not null,
  value       numeric(12,2) not null check (value > 0),
  date        date not null,
  type        text not null default 'expense' check (type in ('expense','income','recover')),
  status      text not null default 'paid' check (status in ('paid','pending','recoverable','recovered')),
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
