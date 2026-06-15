# Setup — Dashboard Financeiro

## 1. Supabase

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor** e execute em ordem:
   - `database/schema.sql`
   - `database/policies.sql`
3. Copie a **Project URL** e a **anon key** (Settings → API)

## 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
```

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 → redireciona para `/login`

## 4. Primeiro uso

1. Clique em **Criar conta**
2. Insira nome, e-mail e senha
3. As categorias padrão são criadas automaticamente no primeiro login
4. Acesse `/transactions` e adicione um lançamento
5. Verifique no Supabase (Table Editor → transactions) que o dado foi salvo

## 5. Deploy Vercel

```bash
# Instale a Vercel CLI se não tiver
npm i -g vercel

# Deploy
vercel

# Adicione as env vars no painel Vercel ou via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Ou pelo painel: Vercel → Settings → Environment Variables.

## 6. Git

```bash
git init        # já foi feito pelo create-next-app
git add .
git commit -m "feat: dashboard financeiro inicial"
git remote add origin https://github.com/seu-usuario/financeiro-app.git
git push -u origin main
```

## Estrutura

```
app/
  (auth)/login register forgot-password   ← páginas públicas
  (dashboard)/dashboard transactions categories settings ← protegidas
components/
  ui/          Button Input Card Modal Toast EmptyState Badge
  layout/      Sidebar BottomNav
  dashboard/   MetricCard DonutChart BarChart
  transactions/ TransactionCard TransactionForm
hooks/         useTransactions useCategories useDashboardMetrics useAuth
services/      transactionsService categoriesService dashboardService authService
types/         database.ts transaction.ts category.ts user.ts
lib/           supabase/client.ts supabase/server.ts formatters.ts validations.ts utils.ts
database/      schema.sql policies.sql seed.sql
middleware.ts  ← proteção de rotas (server-side)
```
