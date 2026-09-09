-- ============================================================
-- MIGRATION 010 — update_shared_transaction
-- ============================================================
--
-- PURPOSE
-- ───────
-- Allow an active shared-account member to edit a transaction
-- owned by another active member of the same shared account.
--
-- ROOT CAUSE (BUG 2 — BUGFIX-BATCH-DISCOVERY-001)
--   The personal update path (transactionsService.updateTransaction)
--   issues a direct UPDATE against public.transactions.
--   RLS policy "transactions: update own" (auth.uid() = user_id)
--   blocks any update where the caller is not the row owner.
--   Shared-mode edits of a partner's transaction therefore always fail.
--
-- SOLUTION
--   New SECURITY DEFINER RPC that replaces the direct update for
--   cross-member edits. RLS is bypassed at table level; replaced by
--   four explicit PL/pgSQL authorization guards (see below).
--   The personal update path and its RLS policy are NOT changed.
--
-- COMPATIBILITY
--   Purely additive — creates one new function, touches nothing else.
--   Existing RPCs, policies, and the personal update path are unchanged.
--
-- !! THIS FILE IS NOT EXECUTED YET — FOR REVIEW ONLY !!
-- ============================================================
--
-- SECURITY MODEL — SECURITY DEFINER
-- ──────────────────────────────────
-- The same SECURITY DEFINER + explicit PL/pgSQL guard pattern
-- used by migrations 002–004. This function runs with the
-- privileges of the definer (the owning role, typically postgres),
-- bypassing RLS. Authorization is enforced entirely within the
-- function body via four guards.
--
-- search_path = pg_catalog, pg_temp:
--   All user objects referenced as public.*.
--   auth.uid() is already schema-qualified.
--   'public' intentionally absent to prevent search-path hijacking.
--
-- FIELD ALLOWLIST
-- ───────────────
-- Only the fields editable through the normal transaction edit form
-- are exposed as parameters:
--   description, value, date, type, status, notes, category_id
--
-- The following columns are NOT modifiable through this function:
--   id, user_id, created_at, updated_at (auto-managed),
--   account_id (not part of current edit flow),
--   installment_group_id (separate concern, ADJUSTMENT 4 scope).
--
-- No arbitrary field injection — no dynamic SQL anywhere.
-- ============================================================


-- ── Function ─────────────────────────────────────────────────────────────────

create or replace function public.update_shared_transaction(
  p_transaction_id    uuid,
  p_shared_account_id uuid,
  p_description       text,
  p_value             numeric,
  p_date              date,
  p_type              text,
  p_status            text,
  p_notes             text    default null,
  p_category_id       uuid    default null
)
returns json
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp

as $$
declare
  v_owner_user_id uuid;
  v_result        json;
begin

  -- ── Guard 0: Reject unauthenticated callers ────────────────────────────────
  -- auth.uid() returns NULL in any keyless or service-role context.
  -- Must be first — all subsequent guards depend on a real user identity.
  if auth.uid() is null then
    raise exception 'Not authorized: authentication required'
      using errcode = 'P0001';
  end if;

  -- ── Guard NULL: Reject null required parameters ────────────────────────────
  if p_transaction_id is null then
    raise exception 'Invalid argument: p_transaction_id must not be null'
      using errcode = 'P0001';
  end if;
  if p_shared_account_id is null then
    raise exception 'Invalid argument: p_shared_account_id must not be null'
      using errcode = 'P0001';
  end if;

  -- ── Guard 1: Caller must be an active member of this shared account ────────
  -- SECURITY DEFINER bypasses RLS; this guard replaces it for the caller.
  -- 'left' or pending members are rejected — they no longer have write access.
  -- A non-existent shared_account_id produces zero rows → exception raised.
  if not exists (
    select 1
    from public.shared_account_members
    where shared_account_id = p_shared_account_id
      and user_id            = auth.uid()
      and status             = 'active'
  ) then
    raise exception 'Not authorized: caller is not an active member of this shared account'
      using errcode = 'P0001';
  end if;

  -- ── Guard 2: Load the target transaction and verify it exists ──────────────
  -- Reads the owner's user_id for use in Guard 3.
  -- Because SECURITY DEFINER bypasses RLS, this read succeeds for any
  -- transaction in the system — Guard 3 is the critical cross-account isolation.
  select t.user_id
  into   v_owner_user_id
  from   public.transactions t
  where  t.id = p_transaction_id;

  if v_owner_user_id is null then
    raise exception 'Not found: transaction does not exist'
      using errcode = 'P0002';
  end if;

  -- ── Guard 3: Transaction owner must be an active member of the SAME account ─
  --
  -- This is the critical cross-account isolation guard.
  --
  -- Attack scenario that MUST fail:
  --   User B is active in Shared Account X.
  --   User C owns transaction T but is only a member of Shared Account Y.
  --   B calls update_shared_transaction(T, X, ...).
  --
  -- Guard 1 passes: B is active in X.
  -- Guard 2 passes: T exists, v_owner_user_id = C.
  -- Guard 3: Is C an active member of X? → NO → exception raised. ✓
  --
  -- The check is scoped to p_shared_account_id (not any shared account),
  -- so B cannot exploit their own account membership to edit transactions
  -- belonging to users in a completely different shared account.
  if not exists (
    select 1
    from public.shared_account_members
    where shared_account_id = p_shared_account_id
      and user_id            = v_owner_user_id
      and status             = 'active'
  ) then
    raise exception 'Not authorized: transaction owner is not an active member of this shared account'
      using errcode = 'P0001';
  end if;

  -- ── Guard 4: category_id must belong to the transaction owner ────────────────
  --
  -- The transactions table has no DB-level constraint preventing a category
  -- owned by User B from being FK-referenced by a transaction owned by User A.
  -- The invariant (categories.user_id = transactions.user_id) is enforced by
  -- convention in the personal path — any cross-user write is blocked by RLS
  -- before reaching the DB.
  --
  -- In the shared path (SECURITY DEFINER), RLS is bypassed, so this guard
  -- enforces the invariant explicitly:
  --
  --   If p_category_id is provided, it must exist in public.categories AND
  --   its user_id must equal the transaction owner's user_id (v_owner_user_id).
  --
  -- This prevents User B from assigning their own personal category to User A's
  -- transaction. Such a mismatch would cause A's transaction to show no category
  -- (the categories RLS "select own" would block A from reading B's category row).
  --
  -- NULL is allowed: clearing a category is a valid operation.
  -- Caller-owned categories with the same UUID as an owner category are an
  -- impossible edge case (UUIDs are unique across users).
  if p_category_id is not null then
    if not exists (
      select 1
      from public.categories
      where id      = p_category_id
        and user_id = v_owner_user_id
    ) then
      raise exception 'Not authorized: category does not belong to the transaction owner'
        using errcode = 'P0001';
    end if;
  end if;

  -- ── Perform the update ─────────────────────────────────────────────────────
  --
  -- Explicit column list — no dynamic SQL. Only the allowlisted fields
  -- are touched. updated_at is managed by the trg_transactions_updated_at
  -- trigger (defined in schema.sql) and is NOT set here.
  --
  -- p_notes: NULL = "clear this field". Matches existing updateTransaction semantics.
  -- p_category_id: NULL = "clear category". Guard 4 above validates non-null values.
  with updated as (
    update public.transactions
    set
      description = p_description,
      value       = p_value,
      date        = p_date,
      type        = p_type,
      status      = p_status,
      notes       = p_notes,
      category_id = p_category_id
    where id = p_transaction_id
    returning *
  )
  select to_json(u.*)
  from   updated u
  into   v_result;

  return v_result;

end;
$$;


-- ── Permissions ───────────────────────────────────────────────────────────────
-- Revoke EXECUTE from PUBLIC (default grant on CREATE FUNCTION) and from anon.
-- Grant exclusively to authenticated, matching the pattern used by migrations
-- 002, 003, 004 for all shared-account SECURITY DEFINER functions.
revoke execute on function public.update_shared_transaction(uuid, uuid, text, numeric, date, text, text, text, uuid) from public;
revoke execute on function public.update_shared_transaction(uuid, uuid, text, numeric, date, text, text, text, uuid) from anon;
grant  execute on function public.update_shared_transaction(uuid, uuid, text, numeric, date, text, text, text, uuid) to   authenticated;


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Purely additive — creates one function, touches nothing else.
-- To rollback:
-- drop function if exists public.update_shared_transaction(uuid, uuid, text, numeric, date, text, text, text, uuid);
-- Then revert the frontend changes in:
--   services/sharedAccountService.ts  (remove updateSharedTransaction)
--   app/(dashboard)/transactions/page.tsx  (revert handleSubmit routing)
