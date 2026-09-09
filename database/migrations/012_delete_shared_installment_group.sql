-- ============================================================
-- MIGRATION 012 — delete_shared_installment_group
-- ============================================================
--
-- PURPOSE
-- ───────
-- Allow an active shared-account member to atomically delete ALL
-- installments of a group owned by another active member of the
-- same shared account.
--
-- PRIOR WORK
-- ──────────
-- Migration 011 (delete_shared_transaction) added single-row delete.
-- Partner group delete was explicitly left out of scope there and
-- blocked in the frontend with a controlled message.
-- This migration implements the group-delete counterpart.
--
-- SCOPE RESTRICTION
-- ─────────────────
-- Accepts p_transaction_id (any anchor row in the group).
-- The server loads owner + installment_group_id from that row.
-- Client-supplied installment_group_id is NOT accepted directly.
-- Deletes ONLY rows matching BOTH:
--   user_id             = v_owner_user_id
--   installment_group_id = v_installment_group_id
-- Uses the composite index idx_transactions_installment_group_id
-- (user_id, installment_group_id) for the DELETE — exact match.
-- Legacy rows (installment_group_id IS NULL) are rejected with a
-- controlled error; no heuristic description matching is performed.
--
-- ATOMICITY
-- ─────────
-- One DELETE statement removes all rows. PostgreSQL guarantees
-- all-or-nothing within a single statement. No partial success.
--
-- SECURITY MODEL — SECURITY DEFINER
-- ──────────────────────────────────
-- Same pattern as migrations 002–004, 010, 011.
-- SECURITY DEFINER bypasses RLS at the table level.
-- Authorization is enforced entirely within the function body.
-- search_path = pg_catalog, pg_temp: all user objects referenced
-- as public.*; 'public' absent to prevent search-path hijacking.
-- No dynamic SQL anywhere.
--
-- !! THIS FILE IS NOT EXECUTED YET — FOR REVIEW ONLY !!
-- ============================================================


-- ── Function ─────────────────────────────────────────────────────────────────

create or replace function public.delete_shared_installment_group(
  p_shared_account_id uuid,
  p_transaction_id    uuid
)
returns json
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp

as $$
declare
  v_owner_user_id        uuid;
  v_installment_group_id uuid;
  v_deleted_count        int;
begin

  -- ── Guard 0: Reject unauthenticated callers ────────────────────────────────
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
  -- SECURITY DEFINER bypasses RLS; this guard enforces caller authorization.
  -- A fabricated or wrong p_shared_account_id produces zero rows → exception.
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

  -- ── Guard 2: Load the anchor transaction ──────────────────────────────────
  -- Reads owner user_id and installment_group_id from the anchor row.
  -- SECURITY DEFINER allows reading any row; Guard 3 provides cross-account
  -- isolation — any transaction in the system can be loaded here, but the
  -- owner must pass G3 before any DELETE is reached.
  select t.user_id, t.installment_group_id
  into   v_owner_user_id, v_installment_group_id
  from   public.transactions t
  where  t.id = p_transaction_id;

  if v_owner_user_id is null then
    raise exception 'Not found: transaction does not exist'
      using errcode = 'P0002';
  end if;

  -- ── Guard 3: Owner must be an active member of the SAME shared account ─────
  --
  -- Cross-account isolation: prevents B (in account X) from deleting
  -- a group belonging to C who is only in account Y.
  --
  -- Attack scenario that MUST fail:
  --   B is active in Shared Account X.
  --   C owns the group and is only active in Shared Account Y.
  --   B calls delete_shared_installment_group(X, anchor_id).
  --
  -- G1 passes: B is active in X.
  -- G2 passes: anchor exists, v_owner_user_id = C.
  -- G3: Is C an active member of X? → NO → exception raised. ✓
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

  -- ── Guard 4: Reject legacy (null) installment groups ─────────────────────
  -- installment_group_id is NULL on rows created before migration 008,
  -- or on non-installment transactions. Description-based heuristics are
  -- NOT used here — they carry collision risk across user_id and accounts.
  -- The caller must handle this case and offer single-row delete instead.
  if v_installment_group_id is null then
    raise exception 'Unsupported: transaction has no installment group id (legacy or non-installment row)'
      using errcode = 'P0003';
  end if;

  -- ── Atomic DELETE: all rows matching owner + group ─────────────────────────
  --
  -- Scoped to BOTH v_owner_user_id AND v_installment_group_id.
  -- This matches the composite index idx_transactions_installment_group_id
  -- (user_id, installment_group_id) — the WHERE predicate is an exact match.
  --
  -- Security properties:
  --   - Client never supplies installment_group_id directly; it is loaded
  --     from the anchor row after G1–G3 pass.
  --   - user_id = v_owner_user_id ensures we never delete rows belonging to
  --     a different user who happens to share the same group UUID by collision
  --     (theoretically impossible with a v4 UUID, but scoped defensively).
  --   - One SQL statement: no partial delete possible.
  with deleted as (
    delete from public.transactions
    where user_id             = v_owner_user_id
      and installment_group_id = v_installment_group_id
    returning id
  )
  select count(*) into v_deleted_count from deleted;

  -- ── Safety net: concurrent delete or unexpected state ─────────────────────
  if v_deleted_count = 0 then
    raise exception 'Delete failed: no installment rows were removed'
      using errcode = 'P0002';
  end if;

  return json_build_object(
    'installment_group_id', v_installment_group_id::text,
    'deleted_count',         v_deleted_count
  );

end;
$$;


-- ── Permissions ───────────────────────────────────────────────────────────────
revoke execute on function public.delete_shared_installment_group(uuid, uuid) from public;
revoke execute on function public.delete_shared_installment_group(uuid, uuid) from anon;
grant  execute on function public.delete_shared_installment_group(uuid, uuid) to   authenticated;


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Purely additive — creates one function, touches nothing else.
-- To rollback:
--   drop function if exists public.delete_shared_installment_group(uuid, uuid);
-- Then revert frontend changes in:
--   services/sharedAccountService.ts  (remove deleteSharedInstallmentGroup)
--   app/(dashboard)/transactions/page.tsx  (restore controlled "not available" block)
