# Deploy — Vercel + Supabase

O app roda inteiro no **Vercel** (Next + API routes) com **Supabase** (Postgres + Storage).
O backend Express/Oracle continua existindo para uso local, mas **não é usado** nesse deploy.

Arquitetura:
- **Frontend + API**: `frontend/` (Next 14). As rotas em `frontend/app/api/**` substituem o Express.
- **Banco**: Supabase Postgres (`frontend/supabase/migrations/0001_init.sql`).
- **Arquivos** (frame de capa): Supabase Storage, bucket `covers`.

---

## 1. Supabase

1. [supabase.com](https://supabase.com) → **New project**. Guarde a senha do banco.
2. **SQL Editor** → cole e rode `frontend/supabase/migrations/0001_init.sql`.
3. **Storage** → **New bucket** → nome `covers` → **Private**.
4. Pegue as chaves:
   - **Project Settings → API**: `Project URL` (→ `SUPABASE_URL`) e `service_role` key (→ `SUPABASE_SERVICE_ROLE_KEY`).
   - **Project Settings → Database → Connection pooling** (modo *Transaction*, porta **6543**): a connection string (→ `DATABASE_URL`).

## 2. Google OAuth (opcional, para sync)

Mesma config de antes, mas o redirect vira o domínio do Vercel:
```
https://SEU-APP.vercel.app/api/google/callback
```
Adicione essa URI no OAuth Client (Google Cloud → Credenciais).

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório.
2. **Root Directory**: `frontend`.
3. **Environment Variables** (copie de `frontend/.env.example`):
   | Var | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | *(vazio)* — usa a API same-origin |
   | `DATABASE_URL` | pooler do Supabase (porta 6543) |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key |
   | `JWT_SECRET` | string longa aleatória |
   | `ADMIN_USER` / `ADMIN_PASSWORD` | login admin |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | (se for usar Google) |
   | `GOOGLE_REDIRECT_URI` | `https://SEU-APP.vercel.app/api/google/callback` |
   | `GOOGLE_CALENDAR_ID` | `primary` |
   | `APP_ORIGIN` | `https://SEU-APP.vercel.app` |
4. **Deploy**.

O admin é criado automático no primeiro login (com `ADMIN_USER`/`ADMIN_PASSWORD`).

---

## Notas
- **Rate limit** de login não foi portado (serverless não tem memória compartilhada). Para produção, usar Upstash Ratelimit ou o WAF do Vercel.
- A rota `/api/google/sync` tem `maxDuration=60` — no plano Hobby o limite pode ser menor; se tiver muitas reuniões, syncar em lotes.
- `DATABASE_URL` **precisa** ser o pooler (6543), não a conexão direta (5432), por causa do serverless.
- O bucket `covers` é privado; as capas são servidas via URL assinada de curta duração pela rota `/api/meetings/:id/cover`.

## Rodar a API nova localmente (opcional)
1. `frontend/.env.local` com `DATABASE_URL`, `SUPABASE_*`, `JWT_SECRET`, e `NEXT_PUBLIC_API_URL=` (vazio).
2. `cd frontend && npm run dev` → API em `/api` (mesma origem), sem Express/Oracle.
