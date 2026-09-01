-- ============================================================
-- MIGRATION 008 — installment_group_id
-- Adds a stable UUID that links all installment rows of the
-- same series. Nullable so all existing rows are unaffected.
-- No backfill: legacy rows stay NULL and fall back to the
-- existing description-based delete with a collision guard.
-- ============================================================

alter table public.transactions
  add column if not exists installment_group_id uuid;

-- Partial index: only covers rows that have a group id
create index if not exists idx_transactions_installment_group_id
  on public.transactions (user_id, installment_group_id)
  where installment_group_id is not null;
