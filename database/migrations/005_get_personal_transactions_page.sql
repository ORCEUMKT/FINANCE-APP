-- ============================================================
-- MIGRATION 005 — get_personal_transactions_page
-- ============================================================
--
-- PURPOSE
-- ───────
-- Server-side paginated version of the personal transactions list.
--
-- Problem (P2B Pessoal):
--   getTransactions() calls:
--     supabase.from('transactions').select('*, category:categories(*)')
--   PostgREST max_rows default = 1000. No .limit() or .range() is used.
--   At > 1000 rows the list is silently truncated.
--   total_count and total financial sum are wrong for truncated sets.
--   search, sort and filters operate only on the truncated universe.
--
-- Solution:
--   New RPC get_personal_transactions_page RETURNS json (scalar).
--   Returns { total_count, total_value, rows }.
--   Pagination, search, sort, count and sum happen entirely in the database.
--   A single JSON scalar crosses the PostgREST boundary — no row limit applies.
--
-- Compatibility:
--   getTransactions() in transactionsService.ts is NOT touched.
--   useTransactions hook is NOT touched.
--   ABC analysis (ABCSection, abc/page.tsx) are NOT affected.
--   get_shared_account_transactions_page (Migration 004) is NOT touched.
--   This migration is purely additive.
--
-- !! APPLY MANUALLY IN SUPABASE SQL EDITOR — DO NOT RUN AUTOMATICALLY !!
-- ============================================================
--
-- SECURITY MODEL — SECURITY INVOKER
-- ──────────────────────────────────
-- RLS is ENABLED on public.transactions:
--   Policy "transactions: select own": USING (auth.uid() = user_id)
-- RLS is ENABLED on public.categories:
--   Policy "categories: select own": USING (auth.uid() = user_id)
--
-- With SECURITY INVOKER, both policies are enforced automatically at the
-- table level. The function runs with the calling user's permissions.
-- A user can only see their own transactions and their own categories.
-- No p_user_id parameter. User A cannot access User B's data regardless
-- of what parameters they pass.
--
-- SECURITY DEFINER is deliberately NOT used:
--   - SECURITY DEFINER bypasses RLS; would require an explicit
--     WHERE user_id = auth.uid() guard — one more attack surface.
--   - SECURITY INVOKER + RLS is the correct and sufficient pattern for
--     personal data in Supabase (same as get_personal_dashboard_metrics,
--     Migration 002).
--   - The shared RPC (Migration 004) uses SECURITY DEFINER because it must
--     read rows owned by multiple users (partner's transactions and categories
--     both blocked by RLS in INVOKER mode). That reason does not apply here.
--
-- Guard 0 (auth.uid() IS NULL) is still added explicitly:
--   With SECURITY INVOKER + RLS, an unauthenticated caller would receive
--   empty results silently instead of an error. The guard makes the contract
--   explicit and prevents wasted work for keyless callers.
--
-- search_path = public, pg_temp:
--   Table names (transactions, categories) used unqualified; resolve to public.*.
--   auth.uid() is always schema-qualified (auth.*) — works regardless of path.
--   pg_temp prevents session-local object injection.
--   Pattern matches Migration 002 (SECURITY INVOKER for personal data).
--   Migration 004 uses pg_catalog, pg_temp because it qualifies all objects
--   as public.* — either approach is correct; we follow Migration 002 here.
--
-- CTE performance strategy — identical to Migration 004:
--   base_filtered (MATERIALIZED):
--     Scans transactions table once, applies all filters.
--     NO categories JOIN — categories.name etc. are not needed for COUNT/SUM.
--     MATERIALIZED: the planner cannot inline it; a single scan is guaranteed
--     even though the CTE is referenced by three consumers (page_base,
--     COUNT(*) subquery, SUM(value) subquery).
--   page_base:
--     ORDER BY + LIMIT/OFFSET applied to base_filtered — lightweight.
--   page_rows:
--     LEFT JOIN categories ONLY for the ≤100 rows in page_base.
--     Thousands of rows in base_filtered never pay the categories join cost.
--
-- account_id handling:
--   The personal query (getTransactions via PostgREST) returns the real
--   t.account_id (NULL or a valid UUID). This RPC preserves that contract.
--   (Contrast with Migration 004 which forced NULL::uuid for backward compat
--   with the older shared RPC. No such constraint exists here.)
--
-- category object shape:
--   The categories table has no updated_at column.
--   Fields returned: id, user_id, name, icon, color, type, is_default, created_at.
--   This matches what .select('*, category:categories(*)')  returns via PostgREST
--   and what Migration 002 builds for topTransactions.category.
-- ============================================================


-- ── Function ──────────────────────────────────────────────────────────────────

create or replace function public.get_personal_transactions_page(
  p_date_from   date    default null,
  p_date_to     date    default null,
  p_category_id uuid    default null,
  p_search      text    default null,
  p_type        text    default null,    -- 'expense' | 'income' | 'recover' | null (no filter)
  p_status      text    default null,    -- 'paid' | 'pending' | 'recoverable' | 'recovered' | null
  p_sort_by     text    default 'date',  -- 'date' | 'value'  (NULL explicitly rejected)
  p_page        integer default 1,
  p_page_size   integer default 50
)
returns json
language plpgsql
stable
security invoker
set search_path = public, pg_temp

as $$
declare
  v_offset  integer;
  v_result  json;
begin

  -- ── Guard 0: Reject unauthenticated callers ────────────────────────────────
  -- auth.uid() returns NULL in service_role or keyless contexts.
  -- With SECURITY INVOKER + RLS, an unauthenticated caller would silently get
  -- empty results. This guard makes the contract explicit.
  if auth.uid() is null then
    raise exception 'Not authorized: authentication required'
      using errcode = 'P0001';
  end if;

  -- ── Guard 1: p_page >= 1 ──────────────────────────────────────────────────
  if p_page < 1 then
    raise exception 'Invalid argument: p_page must be >= 1'
      using errcode = 'P0001';
  end if;

  -- ── Guard 2: p_page_size in [1, 100] ──────────────────────────────────────
  -- Lower bound prevents degenerate queries.
  -- Upper bound caps result size per call (UI default is 50).
  if p_page_size < 1 then
    raise exception 'Invalid argument: p_page_size must be >= 1'
      using errcode = 'P0001';
  end if;
  if p_page_size > 100 then
    raise exception 'Invalid argument: p_page_size must be <= 100'
      using errcode = 'P0001';
  end if;

  -- ── Guard 3: p_sort_by whitelist ──────────────────────────────────────────
  -- NULL explicitly rejected — the default 'date' applies only when the caller
  -- omits the parameter, not when NULL is passed.
  -- The ORDER BY below uses a static CASE expression; no dynamic SQL needed.
  if p_sort_by is null or p_sort_by not in ('date', 'value') then
    raise exception 'Invalid argument: p_sort_by must be "date" or "value"'
      using errcode = 'P0001';
  end if;

  -- ── Guard 4: p_type whitelist ─────────────────────────────────────────────
  -- Values from schema: check (type in ('expense','income','recover'))
  -- NULL means "no filter" — validated only when non-null.
  if p_type is not null and p_type not in ('expense', 'income', 'recover') then
    raise exception 'Invalid argument: p_type must be "expense", "income", or "recover"'
      using errcode = 'P0001';
  end if;

  -- ── Guard 5: p_status whitelist ───────────────────────────────────────────
  -- Values from schema: check (status in ('paid','pending','recoverable','recovered'))
  -- NULL means "no filter".
  if p_status is not null
    and p_status not in ('paid', 'pending', 'recoverable', 'recovered')
  then
    raise exception 'Invalid argument: p_status must be "paid", "pending", "recoverable", or "recovered"'
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
  --   base_filtered  → transactions rows passing all filters, NO category JOIN.
  --                    MATERIALIZED: single scan for COUNT, SUM and page_base.
  --   page_base      → ORDER BY + LIMIT/OFFSET on base_filtered.
  --   page_rows      → LEFT JOIN categories ONLY for the ≤100 page rows.
  --   SELECT         → assembles final JSON scalar.
  --
  with

  -- Step 1: filtered transaction set, no joins.
  --
  -- RLS "transactions: select own" (auth.uid() = user_id) is applied here
  -- automatically by SECURITY INVOKER. No explicit WHERE user_id = auth.uid()
  -- needed — but isolation is guaranteed at the policy level.
  --
  -- Filters:
  --   date range    — NULL = no bound
  --   category_id   — NULL = all categories (including NULL category_id rows)
  --   type          — NULL = all types
  --   status        — NULL = all statuses
  --   search        — NULL or empty = no filter; otherwise case-insensitive
  --                   substring on description, matching existing ilike behavior.
  --                   Wildcards (%, _) in p_search treated as LIKE wildcards,
  --                   consistent with the PostgREST ilike call this replaces.
  --
  -- MATERIALIZED forces a single evaluation of this CTE even though it is
  -- referenced by both page_base (for pagination) and the COUNT/SUM subqueries
  -- in the final SELECT.
  base_filtered as materialized (
    select
      t.id,
      t.user_id,
      t.category_id,
      t.account_id,        -- real value (NULL or UUID); not forced to NULL
      t.description,
      t.value,
      t.date,
      t.type,
      t.status,
      t.notes,
      t.created_at,
      t.updated_at
    from transactions t
    where
      (p_date_from    is null or t.date        >= p_date_from)
      and (p_date_to  is null or t.date        <= p_date_to)
      and (p_category_id is null or t.category_id = p_category_id)
      and (p_type     is null or t.type         = p_type)
      and (p_status   is null or t.status       = p_status)
      and (
        p_search is null
        or trim(p_search) = ''
        or lower(t.description) like lower('%' || trim(p_search) || '%')
      )
  ),

  -- Step 2: paginated slice of base_filtered.
  --
  -- Ordering — static CASE expression, no dynamic SQL:
  --
  --   p_sort_by = 'date' (default):
  --     CASE returns NULL for all rows → value term has no effect.
  --     Effective order: date DESC, created_at DESC, id DESC.
  --     Matches current getTransactions: .order('date', {ascending:false})
  --                                      .order('created_at', {ascending:false})
  --     id DESC added as deterministic tiebreaker for stable pagination.
  --
  --   p_sort_by = 'value':
  --     CASE returns the row's value → sorts by value DESC first.
  --     Effective order: value DESC, date DESC, created_at DESC, id DESC.
  --     Matches current getTransactions: .order('value', {ascending:false})
  --
  page_base as (
    select *
    from base_filtered
    order by
      case when p_sort_by = 'value' then value end desc nulls last,
      date        desc,
      created_at  desc,
      id          desc
    limit  p_page_size
    offset v_offset
  ),

  -- Step 3: enrich the page slice with category data.
  --
  -- LEFT JOIN categories happens ONLY here, for the ≤100 rows in page_base.
  -- Thousands of rows in base_filtered never pay this join cost.
  --
  -- RLS "categories: select own" (auth.uid() = user_id) is also active here
  -- (SECURITY INVOKER). A user's transactions can only reference that user's
  -- own categories (enforced at the application layer). The LEFT JOIN will
  -- always succeed when category_id IS NOT NULL in practice, because the
  -- category belongs to the same user and passes RLS.
  --
  -- LEFT JOIN (not INNER JOIN) preserves transactions whose category was
  -- deleted. The FK is ON DELETE SET NULL, so category_id should already be
  -- NULL in that case — but LEFT JOIN is correct defensive posture.
  --
  -- categories table has: id, user_id, name, icon, color, type, is_default,
  -- created_at. NO updated_at column. The cat_* aliases cover all fields.
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
      c.created_at    as cat_created_at
    from page_base      pb
    left join categories c on c.id = pb.category_id
  )

  -- ── JSON assembly ──────────────────────────────────────────────────────────
  --
  -- Returns a single JSON scalar — one row to PostgREST; row limit never applies.
  --
  -- total_count:
  --   COUNT(*) over the complete base_filtered set (not just the page).
  --   Represents all transactions matching the filters, regardless of pagination.
  --   Returns 0 when no rows match.
  --
  -- total_value:
  --   SUM(value) over the complete base_filtered set.
  --   Matches: displayTxs.reduce((s,t) => s + t.value, 0) in page.tsx.
  --   All values are positive (schema constraint: value > 0).
  --   coalesce handles empty set (SUM of 0 rows = NULL → 0).
  --   Returns 0.0 when no rows match.
  --
  -- rows:
  --   Page slice as a JSON array of Transaction-compatible objects.
  --   json_agg ORDER BY mirrors page_base ORDER BY — guarantees deterministic
  --   array order independent of the planner's aggregation strategy.
  --   coalesce(..., '[]'::json) ensures rows is always an array, never null.
  --
  -- Field names and types match the Transaction TypeScript interface exactly:
  --   value      → float8 (JSON decimal; no scientific notation risk for numeric(12,2))
  --   date       → text  ('YYYY-MM-DD'; matches PostgREST date serialization)
  --   account_id → real column value (NULL or UUID::text in JSON)
  --   category   → nested object matching .select('*, category:categories(*)')
  --                or null when category_id IS NULL
  --   category fields:
  --     id, user_id, name, icon, color, type, is_default, created_at
  --     (no updated_at — categories table has no such column)
  --   category is null when category_id IS NULL or when the LEFT JOIN misses
  --   (detected via cat_name IS NULL — name is NOT NULL in schema, so it is
  --   only null when the join found no row). No artificial defaults are applied.
  --   Actual DB values are returned as-is, matching PostgREST behavior exactly.
  --
  select json_build_object(

    'total_count', (select count(*)::int                       from base_filtered),
    'total_value', (select coalesce(sum(value), 0)::float8     from base_filtered),

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
            'category',    case when r.category_id is not null
                                    and r.cat_name is not null
                           then json_build_object(
                             'id',         r.category_id,
                             'user_id',    r.cat_user_id,
                             'name',       r.cat_name,
                             'icon',       r.cat_icon,
                             'color',      r.cat_color,
                             'type',       r.cat_type,
                             'is_default', r.cat_is_default,
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
revoke execute
  on function public.get_personal_transactions_page(date, date, uuid, text, text, text, text, integer, integer)
  from public;

revoke execute
  on function public.get_personal_transactions_page(date, date, uuid, text, text, text, text, integer, integer)
  from anon;

grant execute
  on function public.get_personal_transactions_page(date, date, uuid, text, text, text, text, integer, integer)
  to authenticated;


-- ── Rollback ───────────────────────────────────────────────────────────────────
-- Fully additive — creates one function, touches nothing else.
-- To rollback:
-- drop function if exists public.get_personal_transactions_page(date, date, uuid, text, text, text, text, integer, integer);


-- ── Validation queries — run MANUALLY after applying ──────────────────────────
-- Replace '2026-08-01' / '2026-08-31' with a month that has < 100 transactions
-- in your account so a single page captures all rows.
--
-- These queries run as the authenticated user inside Supabase SQL Editor.
-- auth.uid() resolves to your own UUID via the active session.
--
-- ── TEST 1: scalar totals match ───────────────────────────────────────────────
--
-- OLD (direct table query, PostgREST behavior):
--   select count(*) as old_count, sum(value) as old_total_value
--   from transactions
--   where date >= '2026-08-01' and date <= '2026-08-31';
--
-- NEW (RPC, page 1 with size 100 to capture all rows in a typical month):
--   select
--     (data->>'total_count')::int         as new_total_count,
--     (data->>'total_value')::float8      as new_total_value,
--     json_array_length(data->'rows')     as rows_in_page
--   from (
--     select get_personal_transactions_page(
--       p_date_from => '2026-08-01',
--       p_date_to   => '2026-08-31',
--       p_page      => 1,
--       p_page_size => 100
--     ) as data
--   ) sub;
--
-- Expected: new_total_count = old_count, new_total_value = old_total_value.
--
-- ── TEST 2: row-level ID and value equivalence ────────────────────────────────
--
-- with old_rows as (
--   select id, description, value::float8 as value, date::text as date,
--          type, status, category_id
--   from transactions
--   where date >= '2026-08-01' and date <= '2026-08-31'
--   order by date desc, created_at desc, id desc
-- ),
-- new_rpc as (
--   select get_personal_transactions_page(
--     p_date_from => '2026-08-01',
--     p_date_to   => '2026-08-31',
--     p_page      => 1,
--     p_page_size => 100
--   ) as data
-- ),
-- new_rows as (
--   select
--     (row_data->>'id')::uuid           as id,
--     (row_data->>'description')        as description,
--     (row_data->>'value')::float8      as value,
--     (row_data->>'date')               as date,
--     (row_data->>'type')               as type,
--     (row_data->>'status')             as status,
--     (row_data->>'category_id')::uuid  as category_id,
--     row_data->'category'              as category
--   from new_rpc,
--        json_array_elements((select data->'rows' from new_rpc)) as row_data
-- )
-- -- Rows in OLD but not in NEW (should be zero):
-- select 'only_in_old' as which, o.id, o.description
-- from old_rows o
-- where o.id not in (select id from new_rows)
-- union all
-- -- Rows in NEW but not in OLD (should be zero):
-- select 'only_in_new', n.id, n.description
-- from new_rows n
-- where n.id not in (select id from old_rows);
--
-- Expected: zero rows returned (perfect ID-set match).
--
-- ── TEST 3: guard validation (run each separately, expect error) ──────────────
--
-- select get_personal_transactions_page(p_page => 0);
--   Expected: "Invalid argument: p_page must be >= 1"
--
-- select get_personal_transactions_page(p_page_size => 0);
--   Expected: "Invalid argument: p_page_size must be >= 1"
--
-- select get_personal_transactions_page(p_page_size => 101);
--   Expected: "Invalid argument: p_page_size must be <= 100"
--
-- select get_personal_transactions_page(p_sort_by => 'invalid');
--   Expected: "Invalid argument: p_sort_by must be ..."
--
-- select get_personal_transactions_page(p_type => 'foo');
--   Expected: "Invalid argument: p_type must be ..."
--
-- select get_personal_transactions_page(p_status => 'foo');
--   Expected: "Invalid argument: p_status must be ..."
--
-- ── TEST 4: empty result ──────────────────────────────────────────────────────
--
-- select get_personal_transactions_page(
--   p_date_from => '1900-01-01',
--   p_date_to   => '1900-01-31'
-- );
-- Expected: {"total_count":0,"total_value":0,"rows":[]}
--
-- ── TEST 5: page beyond last (e.g. page 999 on a small dataset) ───────────────
--
-- select get_personal_transactions_page(
--   p_date_from => '2026-08-01',
--   p_date_to   => '2026-08-31',
--   p_page      => 999
-- );
-- Expected: total_count = real count, total_value = real sum, rows = []
--
-- ── TEST 6: >1000 rows (if dataset available) ─────────────────────────────────
--
-- select
--   (data->>'total_count')::int     as rpc_total_count,
--   (data->>'total_value')::float8  as rpc_total_value
-- from (
--   select get_personal_transactions_page(
--     p_page      => 1,
--     p_page_size => 50
--   ) as data
-- ) sub;
--
-- Cross-check with:
--   select count(*) as true_count, sum(value) as true_total from transactions;
--
-- Expected: rpc_total_count = true_count even when true_count > 1000.
-- (This is the core regression test for the truncation fix.)
