-- ============================================================
-- MIGRATION 004 — get_shared_account_transactions_page
-- ============================================================
--
-- PURPOSE
-- ───────
-- Add a server-side paginated version of the shared transactions list.
--
-- Problem (P2B — same root cause as P2A):
--   get_shared_account_transactions  RETURNS SETOF  →  PostgREST row limit
--   At > 1000 rows the list is silently truncated.
--
-- Solution:
--   New RPC  get_shared_account_transactions_page  RETURNS json (scalar).
--   Returns { rows: Transaction[], total_count: number }.
--   Pagination, search, sort and count happen entirely in the database.
--   A single JSON scalar crosses the PostgREST boundary — no row limit.
--
-- Compatibility:
--   public.get_shared_account_transactions is NOT touched.
--   This migration is purely additive.
--
-- !! THIS FILE IS NOT EXECUTED YET — FOR REVIEW ONLY !!
-- ============================================================
--
-- SECURITY MODEL — SECURITY DEFINER
-- ──────────────────────────────────
-- Required for the same reasons as the sibling RPCs
-- (confirmed in Migration 003 header and production audit):
--
--   1. transactions RLS: auth.uid() = user_id — cannot read partner rows
--      with SECURITY INVOKER.
--   2. categories  RLS: auth.uid() = user_id — same block on partner categories.
--   3. profiles    RLS: same issue for owner_name.
--
-- RLS bypassed at table level; replaced by 7 explicit PL/pgSQL guards.
-- All reads scoped by member_ids derived exclusively from shared_account_members
-- for THIS shared account only. No dynamic SQL anywhere.
--
-- search_path = pg_catalog, pg_temp:
--   All user objects as public.*.
--   auth.uid() already schema-qualified.
--   pg_catalog covers all builtins. 'public' intentionally absent.
--
-- account_id compatibility note:
--   The existing get_shared_account_transactions returns NULL::uuid AS account_id,
--   not t.account_id. This RPC preserves that contract. The transactions table
--   does have an account_id column, but the shared transaction RPCs have never
--   exposed it (the field is unused by the UI). Any future decision to expose
--   real account_id values is a separate change outside P2B scope.
--
-- CTE performance strategy:
--   base_filtered  — transactions + membership + date/search filters, NO category
--                    or profiles JOIN. Used for COUNT(*). MATERIALIZED to avoid
--                    double scan (referenced by both page_base and count subquery).
--   page_base      — ORDER BY + LIMIT/OFFSET on base_filtered (lightweight).
--   page_rows      — LEFT JOIN categories + profiles ONLY for the ≤100 page rows.
--   This avoids joining to categories/profiles for thousands of rows just to count.
-- ============================================================


-- ── Function ──────────────────────────────────────────────────────────────────

create or replace function public.get_shared_account_transactions_page(
  p_shared_account_id  uuid,
  p_date_from          date    default null,
  p_date_to            date    default null,
  p_filter_user_id     uuid    default null,
  p_search             text    default null,
  p_sort_by            text    default 'date',
  p_page               integer default 1,
  p_page_size          integer default 50
)
returns json
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp

as $$
declare
  v_offset  integer;
  v_result  json;
begin

  -- ── Guard 0: Reject unauthenticated callers ────────────────────────────────
  -- auth.uid() returns NULL with service_role or any keyless context.
  -- Must be first — all subsequent guards depend on a real user identity.
  if auth.uid() is null then
    raise exception 'Not authorized: authentication required'
      using errcode = 'P0001';
  end if;

  -- ── Guard NULL: Reject null p_shared_account_id ───────────────────────────
  -- PostgreSQL allows NULL to be passed to uuid parameters even without DEFAULT.
  -- Guard 1 would reject NULL incidentally, but this makes the contract explicit.
  -- p_date_from, p_date_to, p_filter_user_id, p_search remain nullable (NULL = no filter).
  if p_shared_account_id is null then
    raise exception 'Invalid argument: p_shared_account_id must not be null'
      using errcode = 'P0001';
  end if;

  -- ── Guard 1: Caller must be an active member of this shared account ────────
  -- SECURITY DEFINER bypasses RLS; this guard replaces it for the caller.
  -- 'left' members are rejected — they no longer have access to the data.
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

  -- ── Guard 2: p_filter_user_id must also be an active member ───────────────
  -- Prevents a member from querying data belonging to users outside this account.
  -- Only executed when p_filter_user_id IS NOT NULL.
  if p_filter_user_id is not null
    and not exists (
      select 1
      from public.shared_account_members
      where shared_account_id = p_shared_account_id
        and user_id            = p_filter_user_id
        and status             = 'active'
    )
  then
    raise exception 'Not authorized: p_filter_user_id is not an active member of this shared account'
      using errcode = 'P0001';
  end if;

  -- ── Guard 3: p_page must be >= 1 ──────────────────────────────────────────
  if p_page < 1 then
    raise exception 'Invalid argument: p_page must be >= 1'
      using errcode = 'P0001';
  end if;

  -- ── Guard 4: p_page_size must be in [1, 100] ──────────────────────────────
  -- Lower bound prevents degenerate queries. Upper bound caps memory per call.
  -- Maximum 100 is conservative — the default page size for the UI is 50.
  if p_page_size < 1 then
    raise exception 'Invalid argument: p_page_size must be >= 1'
      using errcode = 'P0001';
  end if;
  if p_page_size > 100 then
    raise exception 'Invalid argument: p_page_size must be <= 100'
      using errcode = 'P0001';
  end if;

  -- ── Guard 5: p_sort_by must be a known value ──────────────────────────────
  -- NULL is explicitly rejected — default 'date' is only applied when the
  -- caller omits the parameter, not when NULL is passed explicitly.
  -- The ORDER BY below uses a static CASE expression; no dynamic SQL needed.
  if p_sort_by is null or p_sort_by not in ('date', 'value') then
    raise exception 'Invalid argument: p_sort_by must be "date" or "value"'
      using errcode = 'P0001';
  end if;

  -- ── Compute offset ─────────────────────────────────────────────────────────
  v_offset := (p_page - 1) * p_page_size;

  -- ── Query ──────────────────────────────────────────────────────────────────
  --
  -- No user-supplied value is used as a table identifier.
  -- No dynamic SQL (EXECUTE) anywhere in this function.
  --
  -- CTE chain:
  --
  --   member_ids   → which user_ids are in scope for this shared account
  --   base_filtered → transactions filtered by membership, date, search
  --                   NO category/profiles JOIN — lightweight, used for COUNT
  --                   MATERIALIZED: scanned once, used by page_base + count
  --   page_base    → ORDER BY + LIMIT/OFFSET applied to base_filtered
  --   page_rows    → LEFT JOIN categories + profiles ONLY for ≤100 page rows
  --   SELECT       → assembles final JSON scalar
  --
  with

  -- Step 1: resolve scope — which user_ids belong to this shared account.
  -- p_filter_user_id = NULL  → all active members.
  -- p_filter_user_id = UUID  → that specific member only (validated by Guard 2).
  -- WHERE shared_account_id = p_shared_account_id provides cross-account isolation
  -- as defense-in-depth even after Guard 2.
  member_ids as (
    select user_id
    from   public.shared_account_members
    where  shared_account_id = p_shared_account_id
      and  status            = 'active'
      and  (
        p_filter_user_id is null
        or user_id = p_filter_user_id
      )
  ),

  -- Step 2: core filtered set — transactions + membership + date + search.
  --
  -- Does NOT join categories or profiles. Those joins are only needed for the
  -- rendered rows (≤100), not for counting the full result set.
  --
  -- MATERIALIZED: this CTE is referenced twice — by page_base (for pagination)
  -- and by the COUNT(*) subquery in the SELECT. MATERIALIZED guarantees a single
  -- scan of the transactions table regardless of the planner's choice.
  --
  -- account_id: returned as NULL::uuid to match the contract of the existing
  -- get_shared_account_transactions RPC. The transactions table does have a real
  -- account_id column, but the shared listing RPCs have never exposed it and the
  -- UI does not consume it. Preserving NULL avoids a silent contract change.
  --
  -- Search filter:
  --   NULL or empty string → no filter (coalesced to no-op).
  --   Otherwise: case-insensitive substring match on description.
  --   Consistent with the personal extrato ilike behaviour.
  --   p_search is a parameter value — no dynamic SQL. LIKE wildcard characters
  --   (%, _, \) in p_search are treated as LIKE wildcards/escapes, consistent
  --   with the existing client-side ilike behaviour.
  base_filtered as materialized (
    select
      t.id,
      t.user_id,
      t.category_id,
      null::uuid          as account_id,   -- preserved from old RPC contract
      t.description,
      t.value,
      t.date,
      t.type,
      t.status,
      t.notes,
      t.created_at,
      t.updated_at
    from   public.transactions t
    join   member_ids          m on m.user_id = t.user_id
    where  (p_date_from is null or t.date >= p_date_from)
      and  (p_date_to   is null or t.date <= p_date_to)
      and  (
        p_search is null
        or trim(p_search) = ''
        or lower(t.description) like lower('%' || trim(p_search) || '%')
      )
  ),

  -- Step 3: paginated slice of base_filtered.
  --
  -- Ordering — static CASE expression, no dynamic SQL:
  --
  --   p_sort_by = 'date' (default):
  --     CASE returns NULL for all rows → value term has no effect.
  --     Effective order: date DESC, created_at DESC, id DESC.
  --
  --   p_sort_by = 'value':
  --     CASE returns the row's value → sorts by value DESC first.
  --     Effective order: value DESC, date DESC, created_at DESC, id DESC.
  --
  -- id is the deterministic tiebreaker for stable pagination when multiple rows
  -- share the same date+created_at (date sort) or value+date+created_at (value sort).
  page_base as (
    select *
    from   base_filtered
    order by
      case when p_sort_by = 'value' then value end desc nulls last,
      date        desc,
      created_at  desc,
      id          desc
    limit  p_page_size
    offset v_offset
  ),

  -- Step 4: enrich the page slice with category and owner_name.
  --
  -- LEFT JOIN categories and profiles happen ONLY here, for the ≤100 rows
  -- that will actually be returned. Thousands of rows in base_filtered never
  -- pay the cost of these joins.
  --
  -- LEFT JOIN on categories: preserves transactions whose category was deleted
  -- (category_id is set to NULL by ON DELETE SET NULL on the FK).
  -- LEFT JOIN on profiles: owner_name falls back to 'Usuário' when profile
  -- is missing (same behaviour as get_shared_account_transactions).
  page_rows as (
    select
      pb.id,
      pb.user_id,
      pb.category_id,
      pb.account_id,
      pb.description,
      pb.value,
      pb.date,
      pb.type,
      pb.status,
      pb.notes,
      pb.created_at,
      pb.updated_at,
      c.name          as cat_name,
      c.color         as cat_color,
      c.icon          as cat_icon,
      c.user_id       as cat_user_id,
      c.type          as cat_type,
      c.is_default    as cat_is_default,
      c.created_at    as cat_created_at,
      coalesce(p.name, 'Usuário') as owner_name
    from   page_base              pb
    left join public.categories   c  on c.id = pb.category_id
    left join public.profiles     p  on p.id = pb.user_id
  )

  -- ── JSON assembly ─────────────────────────────────────────────────────────
  --
  -- Returns a single JSON scalar — one row to PostgREST, no row limit applies.
  --
  -- total_count: COUNT(*) over the complete base_filtered set, not the page.
  --   Always reflects the full filtered result regardless of which page is fetched.
  --   Returns 0 when no transactions match the filters.
  --
  -- rows: page slice as a JSON array of Transaction-compatible objects.
  --   json_agg ORDER BY mirrors page_base ORDER BY — guarantees deterministic
  --   JSON array order independent of the planner's aggregation strategy.
  --   coalesce(..., '[]'::json) ensures rows is always an array, never null.
  --
  -- Field names and types match the Transaction TypeScript interface exactly:
  --   value      → float8 (JSON decimal number, no scientific notation risk)
  --   date       → text  ('YYYY-MM-DD', matches PostgREST date serialisation)
  --   account_id → null  (contract preserved from get_shared_account_transactions)
  --   category   → nested object (same shape as .select('*, category:categories(*)')
  --                or null when category_id IS NULL
  --
  select json_build_object(

    'total_count', (select count(*)::int from base_filtered),

    'rows', coalesce(
      (
        select json_agg(
          json_build_object(
            'id',          r.id,
            'user_id',     r.user_id,
            'category_id', r.category_id,
            'account_id',  r.account_id,
            'description', r.description,
            'value',       r.value::float8,
            'date',        r.date::text,
            'type',        r.type,
            'status',      r.status,
            'notes',       r.notes,
            'created_at',  r.created_at,
            'updated_at',  r.updated_at,
            'owner_name',  r.owner_name,
            'category',    case when r.category_id is not null
                           then json_build_object(
                             'id',         r.category_id,
                             'user_id',    r.cat_user_id,
                             'name',       coalesce(r.cat_name,       'Sem categoria'),
                             'icon',       coalesce(r.cat_icon,       'circle'),
                             'color',      coalesce(r.cat_color,      '#666'),
                             'type',       coalesce(r.cat_type,       'expense'),
                             'is_default', coalesce(r.cat_is_default, false),
                             'created_at', r.cat_created_at
                           )
                           else null end
          )
          order by
            case when p_sort_by = 'value' then r.value end desc nulls last,
            r.date        desc,
            r.created_at  desc,
            r.id          desc
        )
        from page_rows r
      ),
      '[]'::json
    )

  )
  into v_result;

  return v_result;

end;
$$;


-- ── Permissions ────────────────────────────────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default on CREATE FUNCTION.
-- Defense-in-depth: revoke from PUBLIC (covers all roles including future ones),
-- then revoke from anon explicitly, then grant exclusively to authenticated.
-- Full parameter type signature (in declaration order) required here.
revoke execute on function public.get_shared_account_transactions_page(uuid, date, date, uuid, text, text, integer, integer) from public;
revoke execute on function public.get_shared_account_transactions_page(uuid, date, date, uuid, text, text, integer, integer) from anon;
grant  execute on function public.get_shared_account_transactions_page(uuid, date, date, uuid, text, text, integer, integer) to   authenticated;


-- ── Rollback ───────────────────────────────────────────────────────────────────
-- Fully additive — creates one function, touches nothing else.
-- To rollback:
-- drop function if exists public.get_shared_account_transactions_page(uuid, date, date, uuid, text, text, integer, integer);
