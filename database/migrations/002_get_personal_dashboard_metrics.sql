-- ============================================================
-- MIGRATION 002 — get_personal_dashboard_metrics
-- Run this in Supabase SQL Editor
--
-- SECURITY MODEL
-- ─────────────────────────────────────────────────────────────
-- This function is SECURITY INVOKER (the default).
-- It does NOT receive a p_user_id parameter.
-- User identity is derived exclusively from the active session via RLS.
--
-- The "transactions: select own" RLS policy enforces:
--   auth.uid() = user_id
-- Any row read inside this function is already filtered by that policy.
-- There is no way for User A to request User B's metrics — the policy
-- runs at the table level regardless of how the function is called.
--
-- SECURITY DEFINER is deliberately NOT used:
--   - SECURITY DEFINER bypasses RLS and would require an explicit
--     WHERE user_id = auth.uid() guard — one more attack surface.
--   - SECURITY INVOKER with RLS is the correct pattern for personal
--     data access in Supabase.
--
-- search_path is fixed to avoid schema-injection via local objects.
-- ============================================================

create or replace function public.get_personal_dashboard_metrics(
  p_date_from date default null,
  p_date_to   date default null
)
returns json
language sql
stable
security invoker
set search_path = public, pg_temp
as $$

with filtered as (
  -- ── RLS is enforced here automatically (SECURITY INVOKER) ──────────────
  -- Policy "transactions: select own": auth.uid() = user_id
  -- Only the authenticated user's transactions survive this scan.
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
    -- Category fields (null when transaction has no category)
    c.name          as cat_name,
    c.color         as cat_color,
    c.icon          as cat_icon,
    c.user_id       as cat_user_id,
    c.type          as cat_type,
    c.is_default    as cat_is_default,
    c.created_at    as cat_created_at,
    -- Normalized key replicating computeMetrics(): catName.toLowerCase().trim()
    -- catName = t.category?.name ?? 'Sem categoria'
    lower(trim(coalesce(c.name, 'Sem categoria'))) as cat_key

  from transactions t
  left join categories c on c.id = t.category_id

  where (p_date_from is null or t.date >= p_date_from)
    and (p_date_to   is null or t.date <= p_date_to)
),

-- ── Simple aggregates (matches computeMetrics totals block) ────────────────
totals as (
  select
    -- totalExpenses = expenses.reduce((s,t) => s + t.value, 0)
    coalesce(sum(value) filter (where type = 'expense'),                           0::numeric) as total_expenses,
    -- totalIncome = income.reduce(...)
    coalesce(sum(value) filter (where type = 'income'),                            0::numeric) as total_income,
    -- totalRecover = recover.filter(t.status !== 'recovered').reduce(...)
    coalesce(sum(value) filter (where type = 'recover' and status != 'recovered'), 0::numeric) as total_recover,
    -- grandTotal used for categoryRanking percentage denominator
    -- = txs.reduce((s,t) => s + t.value, 0)  (ALL types)
    coalesce(sum(value),                                                           0::numeric) as grand_total,
    count(*)                                          as tx_count,
    count(*) filter (where type = 'expense')          as expense_count,
    count(*) filter (where type = 'income')           as income_count
  from filtered
),

-- ── Category ranking — ALL transaction types ───────────────────────────────
-- Replicates: catMap built by iterating ALL txs in computeMetrics()
-- Group key: catName.toLowerCase().trim() (= cat_key)
-- grand_total denominator for percentage
cat_agg as (
  select
    cat_key,
    max(category_id::text)::uuid             as category_id,
    coalesce(max(cat_name), 'Sem categoria') as category_name,
    coalesce(max(cat_color), '#666')         as category_color,
    sum(value)                               as total,
    count(*)::int                            as cnt
  from filtered
  group by cat_key
),

-- ── Expense-only category ranking ─────────────────────────────────────────
-- Replicates: expCatMap built by iterating expenses only
-- totalExpenses denominator for percentage
exp_cat_agg as (
  select
    cat_key,
    max(category_id::text)::uuid             as category_id,
    coalesce(max(cat_name), 'Sem categoria') as category_name,
    coalesce(max(cat_color), '#666')         as category_color,
    sum(value)                               as total,
    count(*)::int                            as cnt
  from filtered
  where type = 'expense'
  group by cat_key
),

-- ── Daily totals — ALL transaction types ───────────────────────────────────
-- Replicates: dayMap built by iterating ALL txs in computeMetrics()
daily_agg as (
  select
    date::text    as day,
    sum(value)    as total,
    count(*)::int as cnt
  from filtered
  group by date
  order by date asc
),

-- ── Top 5 transactions (exclude recover type) ──────────────────────────────
-- Replicates: txs.filter(t => t.type !== 'recover').sort(...).slice(0,5)
top5 as (
  select *
  from filtered
  where type != 'recover'
  order by value desc, created_at desc
  limit 5
)

select json_build_object(

  -- ── Scalar totals ─────────────────────────────────────────────────────────
  'totalExpenses',     (select total_expenses  from totals),
  'totalIncome',       (select total_income    from totals),
  'totalRecover',      (select total_recover   from totals),
  'liquidTotal',       (select total_income - total_expenses from totals),
  'transactionCount',  (select tx_count        from totals)::int,
  'expenseCount',      (select expense_count   from totals)::int,
  'incomeCount',       (select income_count    from totals)::int,

  -- ── categoryRanking ───────────────────────────────────────────────────────
  -- percentage = (category.total / grandTotal) * 100
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

  -- ── expenseCategoryRanking ────────────────────────────────────────────────
  -- percentage = (category.total / totalExpenses) * 100
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

  -- ── dailyTotals ───────────────────────────────────────────────────────────
  -- Sorted ascending by date (matches .sort((a,b) => a.date.localeCompare(b.date)))
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

  -- ── biggestCategory ───────────────────────────────────────────────────────
  -- = categoryRanking[0] ?? null
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

  -- ── topTransactions ───────────────────────────────────────────────────────
  -- Only 5 rows, full Transaction objects (with nested category)
  -- Excludes type = 'recover' (matches computeMetrics filter)
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
          -- Nested category object (matches Supabase join format)
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

$$;

-- ── Permissions ───────────────────────────────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default on CREATE FUNCTION.
-- Revoke from PUBLIC first, then from anon explicitly (defense-in-depth),
-- then grant exclusively to the authenticated role.
revoke execute on function public.get_personal_dashboard_metrics(date, date) from public;
revoke execute on function public.get_personal_dashboard_metrics(date, date) from anon;
grant  execute on function public.get_personal_dashboard_metrics(date, date) to authenticated;
