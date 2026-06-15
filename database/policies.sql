-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- Run after schema.sql
-- ============================================================

alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.accounts     enable row level security;
alter table public.transactions enable row level security;

-- ── profiles ──
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- ── categories ──
create policy "categories: select own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories: insert own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories: update own" on public.categories
  for update using (auth.uid() = user_id);
create policy "categories: delete own" on public.categories
  for delete using (auth.uid() = user_id);

-- ── accounts ──
create policy "accounts: select own" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts: insert own" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts: update own" on public.accounts
  for update using (auth.uid() = user_id);
create policy "accounts: delete own" on public.accounts
  for delete using (auth.uid() = user_id);

-- ── transactions ──
create policy "transactions: select own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions: insert own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions: update own" on public.transactions
  for update using (auth.uid() = user_id);
create policy "transactions: delete own" on public.transactions
  for delete using (auth.uid() = user_id);
