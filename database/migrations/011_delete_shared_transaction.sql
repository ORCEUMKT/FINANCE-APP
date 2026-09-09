-- ============================================================
-- MIGRATION 011 — delete_shared_transaction
-- ============================================================
--
-- PURPOSE
-- ───────
-- Allow an active shared-account member to delete a SINGLE transaction
-- owned by another active member of the same shared account.
--
-- ROOT CAUSE (BUGFIX-SHARED-DELETE-DISCOVERY-001)
--   The personal delete path (transactionsService.deleteTransaction)
--   issues a direct DELETE against public.transactions.
--   RLS policy "transactions: delete own" (auth.uid() = user_id)
--   blocks any delete where the caller is not the row owner.
--   PostgREST returns no error for a zero-row DELETE (silent block),
--   so the frontend incorrectly fires a success toast.
--
-- SOLUTION
--   New SECURITY DEFINER RPC that replaces the direct delete for
--   cross-member operations. RLS is bypassed at table level; replaced by
--   three explicit PL/pgSQL authorization guards (G0–G3, see below).
--   The personal delete path and its RLS policy are NOT changed.
--   Shared installment-group delete is OUT OF SCOPE for this migration.
--
-- COMPATIBILITY
--   Purely additive — creates one new function, touches nothing else.
--   Existing RPCs, policies, and the personal delete path are unchanged.
--
-- !! THIS FILE IS NOT EXECUTED YET — FOR REVIEW ONLY !!
-- ============================================================
--
-- SECURITY MODEL — SECURITY DEFINER
-- ──────────────────────────────────
-- The same SECURITY DEFINER + explicit PL/pgSQL guard pattern
-- used by migrations 002–004 and 010. This function runs with the
-- privileges of the definer (the owning role, typically postgres),
-- bypassing RLS. Authorization is enforced entirely within the
-- function body via three guards.
--
-- search_path = pg_catalog, pg_temp:
--   All user objects referenced as public.*.
--   auth.uid() is already schema-qualified.
--   'public' intentionally absent to prevent search-path hijacking.
--
-- SCOPE RESTRICTION
-- ─────────────────
-- This function deletes EXACTLY ONE row: the transaction identified by
-- p_transaction_id. It does NOT delete installment siblings.
-- Deleting an installment group owned by a partner is a separate feature
-- (not implemented in this migration).
--
-- No dynamic SQL anywhere.
-- ============================================================


-- ── Function ─────────────────────────────────────────────────────────────────

create or replace function public.delete_shared_transaction(
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
  v_owner_user_id uuid;
  v_deleted_id    uuid;
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
  --   B calls delete_shared_transaction(X, T).
  --
  -- Guard 1 passes: B is active in X.
  -- Guard 2 passes: T exists, v_owner_user_id = C.
  -- Guard 3: Is C an active member of X? → NO → exception raised. ✓
  --
  -- The check is scoped to p_shared_account_id (not any shared account),
  -- so B cannot exploit their own account membership to delete transactions
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

  -- ── Perform the delete ─────────────────────────────────────────────────────
  --
  -- Deletes EXACTLY the target row by its primary key.
  -- RETURNING id provides unambiguous proof that exactly one row was deleted.
  -- v_deleted_id is NULL if the DELETE affected 0 rows (safety net —
  -- should be impossible after G2 confirmed the row exists, but guards
  -- against a concurrent delete between G2 and here).
  with deleted as (
    delete from public.transactions
    where id = p_transaction_id
    returning id
  )
  select d.id
  into   v_deleted_id
  from   deleted d;

  if v_deleted_id is null then
    raise exception 'Delete failed: transaction was not removed'
      using errcode = 'P0002';
  end if;

  return json_build_object('id', v_deleted_id);

end;
$$;


-- ── Permissions ───────────────────────────────────────────────────────────────
-- Revoke EXECUTE from PUBLIC (default grant on CREATE FUNCTION) and from anon.
-- Grant exclusively to authenticated, matching the pattern used by migrations
-- 002, 003, 004, 010 for all shared-account SECURITY DEFINER functions.
revoke execute on function public.delete_shared_transaction(uuid, uuid) from public;
revoke execute on function public.delete_shared_transaction(uuid, uuid) from anon;
grant  execute on function public.delete_shared_transaction(uuid, uuid) to   authenticated;


-- ── Rollback ──────────────────────────────────────────────────────────────────
-- Purely additive — creates one function, touches nothing else.
-- To rollback:
-- drop function if exists public.delete_shared_transaction(uuid, uuid);
-- Then revert the frontend changes in:
--   services/sharedAccountService.ts  (remove deleteSharedTransaction)
--   app/(dashboard)/transactions/page.tsx  (revert handleDelete + handleDeleteGroup routing)
