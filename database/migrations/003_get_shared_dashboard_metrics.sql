-- ============================================================
-- MIGRATION 003 — get_shared_dashboard_metrics
-- ============================================================
--
-- PURPOSE
-- ───────
-- Eliminate the client-side aggregation risk in the shared dashboard.
--
-- Current path (P2 risk — silent truncation at db_max_rows):
--
--   getUnifiedDashboardMetrics()
--     → getSharedTransactions()         SETOF RPC → PostgREST row limit
--     → computeMetrics(txs)             JS aggregation on possibly truncated array
--                                       → WRONG financial totals above 1000 txs
--
-- Replacement path (this migration):
--
--   getUnifiedDashboardMetrics()        [updated in dashboardService.ts — separate step]
--     → get_shared_dashboard_metrics()  RETURNS json → single scalar → no row limit
--                                       → SQL aggregation on full dataset always
--
-- !! THIS FILE IS NOT EXECUTED YET — FOR REVIEW ONLY !!
-- ============================================================
--
-- SECURITY MODEL — SECURITY DEFINER (confirmed necessary)
-- ─────────────────────────────────────────────────────────────
-- Verified 2026-08-19 by direct pg_catalog queries on production:
--
--   [CONFIRMED] get_shared_account_transactions: prosecdef = true (SECURITY DEFINER)
--   [CONFIRMED] transactions RLS SELECT: auth.uid() = user_id  — no cross-member policy
--   [CONFIRMED] categories  RLS SELECT: auth.uid() = user_id  — no cross-member policy
--   [CONFIRMED] shared_account_members: has members_read_members policy
--   [CONFIRMED] status CHECK: 'active' | 'left'  (exactly two values)
--   [CONFIRMED] UNIQUE(shared_account_id, user_id) — one membership row per user
--
-- WHY SECURITY INVOKER CANNOT BE USED HERE:
--
--   1. transactions: The function must read transactions from both members.
--      With SECURITY INVOKER, RLS enforces auth.uid() = user_id — the caller
--      cannot read the partner's transactions. Cross-member data is inaccessible.
--
--   2. categories: The function LEFT JOINs categories to resolve name/color for
--      each transaction. With SECURITY INVOKER, the partner's categories are
--      invisible (RLS: auth.uid() = user_id). Partner transactions would silently
--      appear as 'Sem categoria' even when they have categories assigned.
--      This would produce wrong categoryRanking groupings — a silent financial bug.
--
--   Both of the above are definitively blocked by verified RLS. SECURITY DEFINER
--   is the only correct model, consistent with get_shared_account_transactions.
--
-- HOW SECURITY IS RESTORED WITH SECURITY DEFINER:
--
--   RLS is bypassed at the table level, but four explicit guards written in
--   PL/pgSQL replace it. No data can be accessed without passing all four guards.
--   The member_ids scope pins all data reads to the target shared account only.
--
--   Guard 0 — authentication presence
--   Guard 1 — caller is an active member of p_shared_account_id
--   Guard 2 — p_filter_user_id (if provided) is also an active member
--   Scope   — transactions and categories are only read for active member user_ids
--
-- search_path = pg_catalog, pg_temp:
--   All user-defined objects (shared_account_members, transactions, categories)
--   are already fully schema-qualified as public.* inside the function body.
--   auth.uid() is already schema-qualified as auth.uid().
--   pg_catalog covers all builtin functions (lower, trim, coalesce, json_*,
--   sum, count, max, etc.). pg_temp prevents local-object injection.
--   'public' is intentionally absent — no implicit resolution needed.
-- ============================================================


-- ── Function ──────────────────────────────────────────────────────────────────

create or replace function public.get_shared_dashboard_metrics(
  p_shared_account_id  uuid,
  p_filter_user_id     uuid  default null,
  p_date_from          date  default null,
  p_date_to            date  default null
)
returns json
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp

as $$
declare
  v_result json;
begin

  -- ── Guard 0: Reject unauthenticated callers ────────────────────────────────
  -- auth.uid() returns NULL when called with service_role or any keyless context.
  -- Must be the first check — everything below depends on a real user identity.
  if auth.uid() is null then
    raise exception 'Not authorized: authentication required'
      using errcode = 'P0001';
  end if;

  -- ── Guard NULL: Reject null p_shared_account_id ───────────────────────────
  -- PostgreSQL allows NULL to be passed to uuid parameters even without DEFAULT.
  -- Guard 1 would reject NULL incidentally (NULL = x evaluates to NULL, no row
  -- found, exception raised), but relying on that incidental behavior is not
  -- acceptable. This guard makes the contract explicit and the error message clear.
  -- p_filter_user_id, p_date_from, p_date_to remain nullable — NULL there means
  -- "no filter", which is valid and intended.
  if p_shared_account_id is null then
    raise exception 'Invalid argument: p_shared_account_id must not be null'
      using errcode = 'P0001';
  end if;

  -- ── Guard 1: Caller must be an active member of this shared account ────────
  -- SECURITY DEFINER bypasses RLS; this guard replaces it for the caller.
  -- Checks: correct shared_account_id, correct user_id, status = 'active'.
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
  -- Prevents an authenticated member from using this function to query data
  -- about a user outside this shared account by passing an arbitrary UUID.
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

  -- ── Aggregate metrics ──────────────────────────────────────────────────────
  --
  -- All table reads below are scoped by member_ids, which is derived
  -- EXCLUSIVELY from shared_account_members for this p_shared_account_id.
  -- No user-supplied value is used as a table identifier or injected into SQL.
  -- No dynamic SQL (EXECUTE) is used anywhere in this function.
  --
  with

  -- Step 1 — Resolve which user_ids to include.
  --
  -- p_filter_user_id = NULL  → all active members of this shared account.
  -- p_filter_user_id = UUID  → that specific member only (validated by Guard 2).
  --
  -- This CTE, not the caller, determines which user_ids are queried.
  -- Cross-shared-account isolation: WHERE shared_account_id = p_shared_account_id
  -- ensures only members of THIS account are ever returned, regardless of what
  -- p_filter_user_id contains (Guard 2 already rejects non-members, but the
  -- WHERE clause provides defense-in-depth).
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

  -- Step 2 — Filtered transaction set.
  --
  -- Reads transactions from ALL members resolved by member_ids.
  -- SECURITY DEFINER is required here for two reasons:
  --   a) transactions RLS: auth.uid() = user_id — cannot read partner txs
  --   b) categories  RLS: auth.uid() = user_id — cannot read partner categories
  --
  -- LEFT JOIN preserves transactions whose category was deleted (ON DELETE SET NULL
  -- already zeroed category_id, so a non-null category_id always means the
  -- category still exists).
  --
  -- Cross-owner category key — replicates computeMetrics() exactly:
  --   JS:  catName.toLowerCase().trim()   where catName = t.category?.name ?? 'Sem categoria'
  --   SQL: lower(trim(coalesce(c.name, 'Sem categoria')))
  filtered as (
    select
      t.id,
      t.user_id,
      t.category_id,
      t.account_id,
      t.description,
      t.value,
      t.date,
      t.type,
      t.status,
      t.notes,
      t.created_at,
      t.updated_at,
      c.name          as cat_name,
      c.color         as cat_color,
      c.icon          as cat_icon,
      c.user_id       as cat_user_id,
      c.type          as cat_type,
      c.is_default    as cat_is_default,
      c.created_at    as cat_created_at,
      coalesce(p.name, 'Usuário')                    as owner_name,
      lower(trim(coalesce(c.name, 'Sem categoria'))) as cat_key
    from   public.transactions  t
    join   member_ids           m  on m.user_id = t.user_id
    left join public.categories c  on c.id = t.category_id
    left join public.profiles   p  on p.id = t.user_id
    where  (p_date_from is null or t.date >= p_date_from)
      and  (p_date_to   is null or t.date <= p_date_to)
  ),

  -- Step 3 — Scalar totals.
  --
  -- Source: computeMetrics() lines 36-43
  --
  --   expenses    = txs.filter(t => t.type === 'expense')
  --   income      = txs.filter(t => t.type === 'income')
  --   recover     = txs.filter(t => t.type === 'recover' && t.status !== 'recovered')
  --
  --   totalExpenses = expenses.reduce((s,t) => s+t.value, 0)
  --   totalIncome   = income.reduce((s,t) => s+t.value, 0)
  --   totalRecover  = recover.reduce((s,t) => s+t.value, 0)   ← excludes status='recovered'
  --   liquidTotal   = totalIncome - totalExpenses
  --
  --   grandTotal is txs.reduce((s,t) => s+t.value, 0) — ALL types, ALL statuses.
  --   It is the denominator for categoryRanking percentages.
  --   Note: grandTotal includes recover transactions of ALL statuses (including 'recovered'),
  --   unlike totalRecover which excludes status='recovered'. This is intentional in the JS.
  --
  --   transactionCount = txs.length       — ALL types, ALL statuses
  --   expenseCount     = expenses.length  — type='expense' only
  --   incomeCount      = income.length    — type='income' only
  totals as (
    select
      coalesce(sum(value) filter (where type = 'expense'),                           0::numeric) as total_expenses,
      coalesce(sum(value) filter (where type = 'income'),                            0::numeric) as total_income,
      coalesce(sum(value) filter (where type = 'recover' and status != 'recovered'), 0::numeric) as total_recover,
      coalesce(sum(value),                                                           0::numeric) as grand_total,
      count(*)                                          as tx_count,
      count(*) filter (where type = 'expense')          as expense_count,
      count(*) filter (where type = 'income')           as income_count
    from filtered
  ),

  -- Step 4 — Category ranking, ALL transaction types.
  --
  -- Source: computeMetrics() lines 46-75
  --
  --   catMap iterates ALL txs (expense + income + recover, all statuses).
  --   Key:   catName.toLowerCase().trim()
  --   Value: first-seen {id, name, color}, cumulative {total, count}
  --
  --   categoryRanking = Array.from(catMap.values())
  --     .map(v => ({..., percentage: grandTotal > 0 ? (v.total/grandTotal)*100 : 0}))
  --     .sort((a,b) => b.total - a.total)
  --
  -- Cross-owner merge: transactions from User A and User B with category names
  -- that produce the same lower(trim(...)) key are aggregated into ONE group.
  -- Example: 'Mercado' (A) + ' mercado ' (B) → cat_key = 'mercado' → merged.
  --
  -- For the merged group's display values (id, name, color):
  --   JS:  first-seen transaction's category values (depends on API return order)
  --   SQL: max() over the group — deterministic, indeterminate in the same sense
  --        as "first seen" since both depend on ordering that isn't user-visible.
  --   Financial totals are always correct regardless of this display choice.
  --
  -- null category_id: max(null::text) = null → ::uuid = null. Correct (no category).
  cat_agg as (
    select
      cat_key,
      max(category_id::text)::uuid             as category_id,
      coalesce(max(cat_name), 'Sem categoria') as category_name,
      coalesce(max(cat_color), '#666')          as category_color,
      sum(value)                               as total,
      count(*)::int                            as cnt
    from filtered
    group by cat_key
  ),

  -- Step 5 — Category ranking, expenses only.
  --
  -- Source: computeMetrics() lines 78-95
  --
  --   expCatMap iterates expenses ONLY (type='expense', all statuses).
  --   Same key logic, same grouping.
  --   Percentage denominator: totalExpenses (not grandTotal).
  --
  --   expenseCategoryRanking = Array.from(expCatMap.values())
  --     .map(v => ({..., percentage: totalExpenses > 0 ? (v.total/totalExpenses)*100 : 0}))
  --     .sort((a,b) => b.total - a.total)
  exp_cat_agg as (
    select
      cat_key,
      max(category_id::text)::uuid             as category_id,
      coalesce(max(cat_name), 'Sem categoria') as category_name,
      coalesce(max(cat_color), '#666')          as category_color,
      sum(value)                               as total,
      count(*)::int                            as cnt
    from filtered
    where type = 'expense'
    group by cat_key
  ),

  -- Step 6 — Daily totals, ALL transaction types.
  --
  -- Source: computeMetrics() lines 98-107
  --
  --   dayMap iterates ALL txs (all types, all statuses).
  --   Key: t.date (already a 'YYYY-MM-DD' string in JS).
  --   Sorted ascending: .sort((a,b) => a.date.localeCompare(b.date))
  --   date::text in PostgreSQL produces 'YYYY-MM-DD' → identical to JS string.
  --   Ascending string sort on ISO dates is equivalent to ascending date sort. ✓
  daily_agg as (
    select
      date::text    as day,
      sum(value)    as total,
      count(*)::int as cnt
    from filtered
    group by date
    order by date asc
  ),

  -- Step 7 — Top 5 transactions, excluding type='recover'.
  --
  -- Source: computeMetrics() lines 109-112
  --
  --   topTransactions = [...txs]
  --     .filter(t => t.type !== 'recover')   — type filter only, no status filter
  --     .sort((a,b) => b.value - a.value)    — primary: value desc
  --     .slice(0, 5)
  --
  -- Note: transactions with type='expense' or type='income' and any status
  -- (including status='recovered') DO appear in topTransactions. Only type='recover'
  -- is excluded. A 'recovered' status on an expense/income is unrelated to recover-type.
  --
  -- Secondary sort (created_at desc) is added here for determinism among equal-value
  -- transactions. computeMetrics() has no secondary sort — order among ties is
  -- undefined in JS. The secondary sort does not change any financial output.
  --
  -- owner_name: populated via LEFT JOIN public.profiles (same source as
  -- get_shared_account_transactions: COALESCE(prof.name, 'Usuário')).
  -- Included in each topTransactions object so TransactionCard.tsx:209
  -- ({tx.owner_name && <span>owner · </span>}) continues to render correctly.
  -- Financial totals, groupings and guards are unaffected.
  top5 as (
    select *
    from   filtered
    where  type != 'recover'
    order  by value desc, created_at desc
    limit  5
  )

  -- ── JSON assembly ──────────────────────────────────────────────────────────
  --
  -- Field names match DashboardMetrics TypeScript interface exactly.
  -- Numeric types cast to float8 so JSON serialization uses decimal notation.
  -- Empty arrays use '[]'::json (not null) — matches JS Array behavior.
  select json_build_object(

    -- Scalar totals
    'totalExpenses',    (select total_expenses                from totals),
    'totalIncome',      (select total_income                  from totals),
    'totalRecover',     (select total_recover                 from totals),
    'liquidTotal',      (select total_income - total_expenses from totals),
    'transactionCount', (select tx_count      from totals)::int,
    'expenseCount',     (select expense_count from totals)::int,
    'incomeCount',      (select income_count  from totals)::int,

    -- categoryRanking: all types, sorted by total desc
    -- percentage denominator = grandTotal (sum of ALL transaction values)
    'categoryRanking', (
      select coalesce(
        json_agg(
          json_build_object(
            'category_id',    g.category_id,
            'category_name',  g.category_name,
            'category_color', g.category_color,
            'total',          g.total::float8,
            'count',          g.cnt,
            'percentage',     case when t.grand_total > 0
                              then (g.total::float8 / t.grand_total::float8) * 100.0
                              else 0.0 end
          )
          order by g.total desc
        ),
        '[]'::json
      )
      from cat_agg g cross join totals t
    ),

    -- expenseCategoryRanking: expenses only, sorted by total desc
    -- percentage denominator = totalExpenses
    'expenseCategoryRanking', (
      select coalesce(
        json_agg(
          json_build_object(
            'category_id',    eg.category_id,
            'category_name',  eg.category_name,
            'category_color', eg.category_color,
            'total',          eg.total::float8,
            'count',          eg.cnt,
            'percentage',     case when t.total_expenses > 0
                              then (eg.total::float8 / t.total_expenses::float8) * 100.0
                              else 0.0 end
          )
          order by eg.total desc
        ),
        '[]'::json
      )
      from exp_cat_agg eg cross join totals t
    ),

    -- dailyTotals: all types, sorted ascending by date string
    'dailyTotals', (
      select coalesce(
        json_agg(
          json_build_object(
            'date',  d.day,
            'total', d.total::float8,
            'count', d.cnt
          )
          order by d.day asc
        ),
        '[]'::json
      )
      from daily_agg d
    ),

    -- biggestCategory = categoryRanking[0] ?? null
    -- The entry with the highest total, or null when no transactions in period.
    'biggestCategory', (
      select case when (select count(*) from cat_agg) > 0
        then (
          select json_build_object(
            'category_id',    g.category_id,
            'category_name',  g.category_name,
            'category_color', g.category_color,
            'total',          g.total::float8,
            'count',          g.cnt,
            'percentage',     case when t.grand_total > 0
                              then (g.total::float8 / t.grand_total::float8) * 100.0
                              else 0.0 end
          )
          from cat_agg g cross join totals t
          order by g.total desc
          limit 1
        )
        else null
      end
    ),

    -- topTransactions: top 5 by value, type != 'recover'
    -- Full Transaction-shaped objects with nested category
    -- Nested category matches Supabase join format: .select('*, category:categories(*)')
    'topTransactions', (
      select coalesce(
        json_agg(
          json_build_object(
            'id',          t5.id,
            'user_id',     t5.user_id,
            'category_id', t5.category_id,
            'account_id',  t5.account_id,
            'description', t5.description,
            'value',       t5.value::float8,
            'date',        t5.date::text,
            'type',        t5.type,
            'status',      t5.status,
            'notes',       t5.notes,
            'created_at',  t5.created_at,
            'updated_at',  t5.updated_at,
            'owner_name',  t5.owner_name,
            'category',    case when t5.category_id is not null
                           then json_build_object(
                             'id',         t5.category_id,
                             'user_id',    t5.cat_user_id,
                             'name',       coalesce(t5.cat_name,       'Sem categoria'),
                             'icon',       coalesce(t5.cat_icon,       'circle'),
                             'color',      coalesce(t5.cat_color,      '#666'),
                             'type',       coalesce(t5.cat_type,       'expense'),
                             'is_default', coalesce(t5.cat_is_default, false),
                             'created_at', t5.cat_created_at
                           )
                           else null end
          )
          order by t5.value desc, t5.created_at desc
        ),
        '[]'::json
      )
      from top5 t5
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
-- Signature must list all four parameter types in declaration order.
revoke execute on function public.get_shared_dashboard_metrics(uuid, uuid, date, date) from public;
revoke execute on function public.get_shared_dashboard_metrics(uuid, uuid, date, date) from anon;
grant  execute on function public.get_shared_dashboard_metrics(uuid, uuid, date, date) to   authenticated;


-- ── Rollback ───────────────────────────────────────────────────────────────────
-- This migration is fully additive:
--   • Creates one new function only.
--   • Does not modify any existing table, function, policy, or data.
--   • get_shared_account_transactions (SETOF) is not touched.
--   • Application code (dashboardService.ts) is not changed by this migration.
--
-- To rollback: drop only this function. No other action required.
--
-- drop function if exists public.get_shared_dashboard_metrics(uuid, uuid, date, date);
