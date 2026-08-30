-- ============================================================
-- MIGRATION 006 — get_personal_abc_data
-- ============================================================
--
-- PURPOSE
-- ───────
-- Provides a complete, unpaginated transaction dataset for
-- client-side ABC/Pareto analysis, eliminating the PostgREST
-- 1000-row silent truncation that affects the ABC module.
--
-- Problem (identified in ABC-001 diagnostic, 2026-08-30):
--   useTransactions() → getTransactions() calls:
--     supabase.from('transactions').select('*, category:categories(*)')
--   PostgREST max_rows = 1000. No .limit() is applied.
--   At > 1000 rows in the filtered period the dataset is silently
--   truncated. The ABC/Pareto classification computed on this partial
--   dataset is incorrect:
--     - category totals are undervalued (missing transactions)
--     - cumulative percentages are wrong
--     - A/B/C classification is incorrect
--     - no error or warning is surfaced to the user
--
-- Solution:
--   New RPC get_personal_abc_data RETURNS json (scalar array).
--   Returns ALL transactions matching the period+type filter — no
--   pagination, no row limit. A single JSON scalar crosses the
--   PostgREST boundary safely regardless of row count.
--   Only the minimal fields required for ABC are returned:
--     id, value, description, category_id, category{name, color}
--   All ABC aggregation (group by category, sort, cumulative %)
--   continues in the browser — no change to existing calculation
--   logic is required. Both "por categoria" and "por lançamento"
--   view modes are fully preserved.
--
-- Compatibility:
--   getTransactions() in transactionsService.ts is NOT touched.
--   useTransactions hook is NOT touched.
--   get_personal_transactions_page (Migration 005) is NOT touched.
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
-- With SECURITY INVOKER, both policies are enforced automatically
-- at the table level. The function runs with the calling user's
-- permissions. User A cannot access User B's data regardless of
-- which parameters are passed — there is no p_user_id parameter.
-- Same model as Migration 005 (get_personal_transactions_page) and
-- Migration 002 (get_personal_dashboard_metrics).
--
-- Guard 0 (auth.uid() IS NULL):
--   With SECURITY INVOKER + RLS, an unauthenticated caller would
--   silently receive an empty array instead of an error. This guard
--   makes the contract explicit and prevents wasted query work.
--   Matches Migration 005, Guard 0.
--
-- SECURITY DEFINER is deliberately NOT used:
--   SECURITY DEFINER bypasses RLS and would require an explicit
--   WHERE user_id = auth.uid() guard — one more attack surface.
--   SECURITY INVOKER + RLS is correct and sufficient for personal
--   data in Supabase. Matches Migration 002 and 005.
--   (Contrast: Migration 004 uses SECURITY DEFINER because it must
--   read rows owned by multiple users — a requirement that does NOT
--   apply to personal ABC data.)
--
-- search_path = public, pg_temp:
--   Table names (transactions, categories) resolve to public.*.
--   auth.uid() is always schema-qualified (auth.*) — works
--   regardless of search_path. pg_temp prevents session-local
--   object injection. Matches Migration 005 pattern.
--
-- ============================================================
--
-- DESIGN RATIONALE — WHY RETURN RAW TRANSACTIONS
-- ────────────────────────────────────────────────
-- ABCSection.tsx supports two view modes:
--
--   1. "Por categoria"   — groups by category_id, sums values,
--                          then classifies categories into A/B/C.
--   2. "Por lançamento"  — ranks individual transactions by value,
--                          then classifies each transaction into A/B/C.
--
-- Aggregating by category in SQL would destroy individual transaction
-- data — "por lançamento" mode would be impossible. Returning raw
-- transactions at the minimal field set supports both modes without
-- changing any frontend calculation logic.
--
-- Field set comparison:
--   Migration 005 (full Transaction):  id, user_id, category_id,
--     account_id, description, value, date, type, status, notes,
--     created_at, updated_at, category{id, user_id, name, icon,
--     color, type, is_default, created_at}  ≈ 19 fields
--   Migration 006 (minimal ABC):       id, value, description,
--     category_id, category{name, color}                ≈ 6 fields
--
-- Payload estimate for a typical monthly dataset:
--   500 rows × 6 fields × ~80 bytes  ≈  40 KB   (trivially small)
--   5 000 rows × 6 fields × ~80 bytes ≈ 400 KB   (browser handles easily)
--
-- Guard 3 (require at least one date boundary) prevents accidental
-- all-time queries. The ABC component always passes both dateFrom
-- and dateTo from monthRange(selectedMonth) — a caller omitting
-- both dates is assumed to be a bug.
--
-- ============================================================
--
-- PERFORMANCE
-- ───────────
-- No MATERIALIZED CTE needed:
--   abc_rows is referenced exactly once (in the json_agg subquery).
--   MATERIALIZED would add overhead by forcing an intermediate
--   materialize step that the planner cannot optimize away.
--   Contrast with Migration 005 where base_filtered is referenced
--   by three consumers (page_base, COUNT(*), SUM(value)) and
--   MATERIALIZED is essential to avoid triple-scanning the table.
--
-- categories JOIN on the full filtered set:
--   In Migration 005, the categories JOIN is deferred to page_base
--   (≤100 rows) to avoid joining to thousands of rows. Here, all
--   rows are returned, so the JOIN happens on the full filtered set.
--   For monthly ABC (50–500 rows) this is equivalent cost. For
--   larger date ranges Guard 3 provides a backstop.
--
-- Index utilization (no new indexes required):
--   The existing composite index on transactions(user_id, date)
--   covers the RLS predicate (user_id = auth.uid()) and date range
--   filters. The categories LEFT JOIN uses the primary key (id).
--
-- ORDER BY value DESC, id DESC:
--   Deterministic ordering. Pre-sorts for "por lançamento" mode
--   (buildABCByTransaction also sorts by value DESC). buildABCByCategory
--   re-sorts client-side by category total — the DB order is incidental
--   for that mode. id DESC as tiebreaker ensures stable pagination
--   of equal-value rows.
--
-- ============================================================
--
-- RETURN CONTRACT
-- ───────────────
-- Returns a JSON array (not a wrapped object).
-- Contrast: Migration 005 wraps { total_count, total_value, rows }
-- because the page slice count differs from the total count.
-- Here, ALL matching rows are always returned, so json_array_length
-- equals the total count — no out-of-band total is needed.
-- The ABC frontend computes its own aggregates (grandTotal, pct,
-- cumulative) from the raw rows — no server-side pre-aggregation.
-- Returns '[]'::json when no rows match (never NULL).
--
-- TypeScript-equivalent row shape:
--   {
--     id:          string           // UUID
--     value:       number           // float8 — always > 0 (schema constraint)
--     description: string
--     category_id: string | null    // UUID or null
--     category:    { name: string; color: string } | null
--   }
--
-- Note: category.name and category.color are the only category
-- fields consumed by the ABC frontend. Including the full category
-- object (id, icon, type, is_default, ...) would increase payload
-- size with no benefit. This RPC is intentionally narrower than
-- the full Transaction category shape returned by Migration 005.
-- ============================================================


-- ── Function ──────────────────────────────────────────────────────────────────

create or replace function public.get_personal_abc_data(
  p_date_from  date  default null,
  p_date_to    date  default null,
  p_type       text  default null   -- 'expense' | 'income' | 'recover' | null = no filter
)
returns json
language plpgsql
stable
security invoker
set search_path = public, pg_temp

as $$
declare
  v_result  json;
begin

  -- ── Guard 0: Reject unauthenticated callers ────────────────────────────────
  -- With SECURITY INVOKER + RLS, an unauthenticated caller would silently
  -- receive an empty array. This guard makes the contract explicit.
  if auth.uid() is null then
    raise exception 'Not authorized: authentication required'
      using errcode = 'P0001';
  end if;

  -- ── Guard 1: p_type whitelist ─────────────────────────────────────────────
  -- Values from schema: check (type in ('expense','income','recover'))
  -- NULL means "no filter" — the ABC always passes a specific type.
  if p_type is not null and p_type not in ('expense', 'income', 'recover') then
    raise exception 'Invalid argument: p_type must be "expense", "income", or "recover"'
      using errcode = 'P0001';
  end if;

  -- ── Guard 2: Date range coherence ─────────────────────────────────────────
  -- Prevents inverted ranges (from > to) which would silently return zero rows
  -- rather than producing an obvious error. Detects caller bugs early.
  if p_date_from is not null
    and p_date_to   is not null
    and p_date_from > p_date_to
  then
    raise exception 'Invalid argument: p_date_from must be <= p_date_to'
      using errcode = 'P0001';
  end if;

  -- ── Guard 3: Require at least one date boundary ───────────────────────────
  -- This RPC returns the full matching dataset without pagination.
  -- An unbounded query (both dates NULL) could return the entire
  -- transaction history — potentially very large. The ABC component
  -- always passes both dateFrom and dateTo from monthRange(), so
  -- a caller omitting both dates is assumed to be a misconfiguration.
  if p_date_from is null and p_date_to is null then
    raise exception 'Invalid argument: at least one of p_date_from or p_date_to must be provided'
      using errcode = 'P0001';
  end if;

  -- ── Query ──────────────────────────────────────────────────────────────────
  --
  -- No dynamic SQL (EXECUTE) anywhere in this function.
  -- No user-supplied value is used as a table or column identifier.
  --
  -- abc_rows CTE:
  --   Filters transactions by date range and type.
  --   LEFT JOIN categories for name and color (ABC rendering fields).
  --   RLS "transactions: select own" (auth.uid() = user_id) is applied
  --   automatically by SECURITY INVOKER — no explicit WHERE user_id
  --   guard is needed. User A cannot see User B's rows.
  --   RLS "categories: select own" also applies — but in practice, a
  --   user's transactions always reference their own categories (enforced
  --   at the application layer). LEFT JOIN (not INNER JOIN) preserves
  --   transactions whose category was deleted (FK ON DELETE SET NULL).
  --
  -- No MATERIALIZED:
  --   abc_rows is referenced exactly once. MATERIALIZED would force an
  --   intermediate materialize step with no benefit here.
  --   (Contrast: Migration 005 uses MATERIALIZED because base_filtered
  --   is referenced by three consumers — COUNT, SUM, and page_base.)
  --
  -- json_agg ORDER BY value DESC, id DESC:
  --   Deterministic ordering. Pre-sorted for "por lançamento" mode.
  --   id DESC tiebreaker ensures stable order for equal-value rows.
  --   buildABCByCategory re-sorts by category total client-side anyway.
  --
  -- coalesce(..., '[]'::json):
  --   json_agg returns NULL when no rows match — coalesce ensures the
  --   caller always receives a valid JSON array, never null.

  with abc_rows as (
    select
      t.id,
      t.value,
      t.description,
      t.category_id,
      c.name  as cat_name,
      c.color as cat_color
    from transactions t
    left join categories c on c.id = t.category_id
    where
      (p_date_from is null or t.date >= p_date_from)
      and (p_date_to   is null or t.date <= p_date_to)
      and (p_type      is null or t.type  = p_type)
  )
  select coalesce(
    (
      select json_agg(
        json_build_object(
          'id',          r.id,
          'value',       r.value::float8,
          'description', r.description,
          'category_id', r.category_id,
          'category',    case
                           -- category is non-null only when category_id IS NOT NULL
                           -- and the LEFT JOIN found a matching row.
                           -- cat_name is NOT NULL in schema, so a null here means
                           -- the join found no row (deleted category edge case).
                           when r.category_id is not null
                                and r.cat_name is not null
                           then json_build_object(
                             'name',  r.cat_name,
                             'color', r.cat_color
                           )
                           else null
                         end
        )
        order by r.value desc, r.id desc
      )
      from abc_rows r
    ),
    '[]'::json
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
-- Matches the exact pattern of Migration 005.
revoke execute
  on function public.get_personal_abc_data(date, date, text)
  from public;

revoke execute
  on function public.get_personal_abc_data(date, date, text)
  from anon;

grant execute
  on function public.get_personal_abc_data(date, date, text)
  to authenticated;


-- ── Rollback ───────────────────────────────────────────────────────────────────
-- Purely additive — creates one function, touches nothing else.
-- To rollback:
--   drop function if exists public.get_personal_abc_data(date, date, text);


-- ── Validation queries — run MANUALLY after applying ──────────────────────────
-- All queries below run as the authenticated user in the Supabase SQL Editor.
-- auth.uid() resolves to your own UUID via the active session.
-- Replace date ranges with a month that has known transaction data.
--
-- ── TEST 1: Basic invocation + empty check ────────────────────────────────────
--
--   select get_personal_abc_data(
--     p_date_from => '2026-08-01',
--     p_date_to   => '2026-08-31',
--     p_type      => 'expense'
--   );
--   Expected: JSON array of expense objects, each with id/value/description/
--             category_id/category fields. No NULL at top level — always [].
--
-- ── TEST 2: Row count matches direct table query ──────────────────────────────
--
--   OLD (direct PostgREST — truncated above 1000):
--   select count(*) as old_count, sum(value) as old_sum
--   from transactions
--   where date >= '2026-08-01' and date <= '2026-08-31'
--     and type = 'expense';
--
--   NEW (RPC — no truncation):
--   select
--     json_array_length(
--       get_personal_abc_data(
--         p_date_from => '2026-08-01',
--         p_date_to   => '2026-08-31',
--         p_type      => 'expense'
--       )
--     ) as rpc_count;
--
--   Expected: rpc_count = old_count
--   (This is the core regression test for the truncation fix.)
--
-- ── TEST 3: Value sum equivalence ─────────────────────────────────────────────
--
--   with rpc as (
--     select json_array_elements(
--       get_personal_abc_data(
--         p_date_from => '2026-08-01',
--         p_date_to   => '2026-08-31',
--         p_type      => 'expense'
--       )
--     ) as row_data
--   )
--   select sum((row_data->>'value')::float8) as rpc_sum from rpc;
--
--   Cross-check with:
--   select sum(value) as true_sum from transactions
--   where date >= '2026-08-01' and date <= '2026-08-31' and type = 'expense';
--
--   Expected: rpc_sum = true_sum (within float8 precision)
--
-- ── TEST 4: Category join correctness ─────────────────────────────────────────
--
--   with rpc as (
--     select json_array_elements(
--       get_personal_abc_data(
--         p_date_from => '2026-08-01',
--         p_date_to   => '2026-08-31',
--         p_type      => 'expense'
--       )
--     ) as row_data
--   )
--   select
--     (row_data->>'category_id')::uuid           as category_id,
--     row_data->'category'->>'name'              as cat_name,
--     row_data->'category'->>'color'             as cat_color,
--     (row_data->'category') is null             as category_is_null
--   from rpc
--   limit 10;
--
--   Expected: transactions with category_id have non-null category object;
--             transactions with category_id = NULL have category_is_null = true.
--
-- ── TEST 5: Guard validation (run each separately, expect error) ──────────────
--
--   select get_personal_abc_data(p_type => 'foo');
--   Expected: "Invalid argument: p_type must be ..."
--
--   select get_personal_abc_data(
--     p_date_from => '2026-08-31', p_date_to => '2026-08-01'
--   );
--   Expected: "Invalid argument: p_date_from must be <= p_date_to"
--
--   select get_personal_abc_data();
--   Expected: "Invalid argument: at least one of p_date_from or p_date_to ..."
--
--   select get_personal_abc_data(p_date_from => '2026-08-01', p_date_to => null);
--   Expected: succeeds (one date provided — Guard 3 satisfied)
--
-- ── TEST 6: Empty result ───────────────────────────────────────────────────────
--
--   select get_personal_abc_data(
--     p_date_from => '1900-01-01',
--     p_date_to   => '1900-01-31'
--   );
--   Expected: []   (empty array, not null)
--
-- ── TEST 7: Unauthenticated access (run via anon key or service_role direct) ──
--
--   Attempt to call the function without a valid session.
--   Expected: "Not authorized: authentication required"  (Guard 0)
--
-- ── TEST 8: >1000 rows regression (if dataset available) ──────────────────────
--
--   -- Count all personal transactions:
--   select count(*) as total from transactions;
--
--   -- If total > 1000, verify RPC returns all of them:
--   select json_array_length(
--     get_personal_abc_data(
--       p_date_from => '2020-01-01',
--       p_date_to   => '2030-12-31'
--     )
--   ) as rpc_count;
--
--   Expected: rpc_count = total (no 1000-row cap).
--
-- ── TEST 9: Ordering (por lançamento pre-sort) ────────────────────────────────
--
--   with rpc as (
--     select json_array_elements(
--       get_personal_abc_data(
--         p_date_from => '2026-08-01',
--         p_date_to   => '2026-08-31',
--         p_type      => 'expense'
--       )
--     ) as row_data
--   ),
--   ordered as (
--     select
--       (row_data->>'value')::float8 as v,
--       row_number() over () as position
--     from rpc
--   )
--   select
--     sum(case when v < lag(v) over (order by position) then 1 else 0 end) as out_of_order
--   from ordered;
--
--   Expected: 0 (rows are already sorted value DESC)
