-- ============================================================
-- EXTRACAO DE SCHEMA — somente leitura, nao altera nada
--
-- Objetivo: recuperar o DDL das tabelas/funcoes de conta compartilhada
-- que foram criadas direto no SQL Editor e nunca versionadas no repo.
--
-- Como usar:
--   1. Supabase -> SQL Editor -> New query
--   2. Rode UM bloco por vez e copie o resultado
--   3. Cole a saida no chat, que eu monto a migration definitiva
--
-- Alternativa (mais completa, se voce tiver a senha do banco):
--   npx supabase db dump --db-url "postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres" -f database/migrations/002_shared_accounts.sql
-- ============================================================


-- ── BLOCO 1 — colunas de todas as tabelas do schema public ──
select
  c.relname                                     as tabela,
  a.attnum                                      as ord,
  a.attname                                     as coluna,
  format_type(a.atttypid, a.atttypmod)          as tipo,
  a.attnotnull                                  as not_null,
  pg_get_expr(d.adbin, d.adrelid)               as default_expr
from pg_attribute a
join pg_class c      on c.oid = a.attrelid
join pg_namespace n  on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where n.nspname = 'public'
  and c.relkind = 'r'
  and a.attnum > 0
  and not a.attisdropped
order by c.relname, a.attnum;


-- ── BLOCO 2 — constraints (PK, FK, unique, check) ──
select
  rel.relname                        as tabela,
  con.conname                        as constraint_name,
  pg_get_constraintdef(con.oid)      as definicao
from pg_constraint con
join pg_class rel     on rel.oid = con.conrelid
join pg_namespace n   on n.oid = rel.relnamespace
where n.nspname = 'public'
order by rel.relname, con.contype desc, con.conname;


-- ── BLOCO 3 — indices ──
select tablename as tabela, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- ── BLOCO 4 — RLS: status por tabela ──
select c.relname as tabela, c.relrowsecurity as rls_ativo, c.relforcerowsecurity as rls_forcado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;


-- ── BLOCO 5 — RLS: policies ──
select
  tablename as tabela,
  policyname,
  permissive,
  roles,
  cmd,
  qual        as using_expr,
  with_check  as with_check_expr
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ── BLOCO 6 — funcoes e RPCs (inclui as 5 que o app chama) ──
-- get_shared_account_member_categories, get_shared_account_member_goals,
-- get_shared_account_transactions, get_users_names, leave_shared_account_cascade
select
  p.proname                       as funcao,
  pg_get_functiondef(p.oid)       as definicao
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;


-- ── BLOCO 7 — triggers ──
select
  c.relname                          as tabela,
  t.tgname                           as trigger_name,
  pg_get_triggerdef(t.oid)           as definicao
from pg_trigger t
join pg_class c     on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by c.relname, t.tgname;


-- ── BLOCO 8 — max-rows do PostgREST (confirma o risco de truncamento) ──
-- Se voltar 1000, as queries sem .limit() truncam silenciosamente a partir
-- do 1001o lancamento e o dashboard passa a calcular sobre dado incompleto.
show pgrst.db_max_rows;
