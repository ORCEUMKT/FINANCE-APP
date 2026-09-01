-- ============================================================
-- Migration 009 — fix public.get_users_names
--
-- GO-LIVE-FIX-003A (GO-LIVE-SEC-003 · corrected privilege model)
--
-- Problem: function was callable with anon key (no JWT), exposing
-- any user's display name to unauthenticated callers. No scope
-- restriction enforced — any authenticated user could look up any
-- other user's name regardless of shared-account membership.
--
-- Fix: rewrite with two guards:
--   1. auth.uid() IS NOT NULL  → rejects all unauthenticated calls
--   2. shared_account scope    → returns cross-user names only when
--      caller and target are both active members of the same account
--
-- Privilege model (GO-LIVE-FIX-003A correction):
--   CREATE OR REPLACE preserves existing grants on the same function
--   signature — the PUBLIC grant is NOT removed automatically.
--   REVOKE FROM anon alone is insufficient because anon inherits
--   EXECUTE from PUBLIC. PUBLIC must be revoked first as the primary
--   privilege boundary.
--
-- Safe: CREATE OR REPLACE, no data modified, idempotent.
-- ============================================================

create or replace function public.get_users_names(p_user_ids uuid[])
returns table(id uuid, name text)
language sql
security definer
set search_path = public
as $$
  -- coalesce(name, email-prefix) mirrors the handle_new_user trigger logic so that
  -- users who pre-date the trigger and have profiles.name = null still get a label.
  select p.id,
         coalesce(p.name, split_part(p.email, '@', 1)) as name
  from   public.profiles p
  where  p.id = any(p_user_ids)
    and  auth.uid() is not null
    and  (
           -- caller may always resolve their own name
           p.id = auth.uid()
           or
           -- cross-user: allowed only when caller and target share an active account
           exists (
             select 1
             from   public.shared_account_members m1
             join   public.shared_account_members m2
                      using (shared_account_id)
             where  m1.user_id = auth.uid()
               and  m2.user_id = p.id
               and  m1.status  = 'active'
               and  m2.status  = 'active'
           )
         );
$$;

-- PRIMARY boundary: revoke from PUBLIC.
-- CREATE OR REPLACE does not drop existing grants; the original PUBLIC
-- grant remains if not explicitly revoked. Revoking only from anon
-- leaves that PUBLIC grant intact — anon (a PUBLIC member) would still
-- inherit EXECUTE. PUBLIC must be revoked as the outermost boundary.
revoke execute on function public.get_users_names(uuid[]) from public;

-- Belt-and-suspenders: removes any direct grant currently held by anon.
-- PostgreSQL privileges are additive — there is no DENY mechanism. If
-- EXECUTE is re-granted to PUBLIC in the future, anon will regain access
-- via that inherited path regardless of this REVOKE. This statement
-- covers only the current direct grant to anon.
revoke execute on function public.get_users_names(uuid[]) from anon;

-- Explicit grant to authenticated only — the only role that must call this.
grant  execute on function public.get_users_names(uuid[]) to authenticated;
