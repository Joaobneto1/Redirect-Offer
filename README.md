# Link Inteligente de Checkout

Sistema de redirecionamento inteligente para campanhas de tráfego pago. Um link único (`/go/:slug`) escolhe o checkout ativo do grupo, faz health check e redireciona — com fallback automático se o checkout estiver fora do ar.

## Stack

- **Backend:** Node.js 18+, TypeScript, Express, Prisma, PostgreSQL
- **Frontend:** React 18, Vite, TypeScript, Framer Motion, React Router

## Setup

### Backend

```bash
cp .env.example .env
# Configure DATABASE_URL e JWT_SECRET (mín. 16 caracteres)

npm install
# gerar client prisma e aplicar schema (cria as novas tabelas de Campaign/Endpoint se ainda não existirem)
npm run db:generate
npm run db:push

# Opcional: migrar dados existentes (Products/Groups/Checkouts/SmartLinks -> Campaigns/Endpoints/CampaignLinks)
# Este script popula as novas tabelas a partir dos modelos antigos:
# npm run migrate:to-campaigns

# Popular dados de exemplo (seed) e rodar servidor
npm run seed
npm run dev
```

API em `http://localhost:3000`. Endpoints: `GET /go/:slug` (público), `GET /health`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (autenticado). Demais rotas em `/api/*` exigem `Authorization: Bearer <token>`.

### Frontend (dashboard)

```bash
cd frontend
npm install
npm run dev
```

Dashboard em `http://localhost:5173`. O Vite faz proxy de `/api`, `/go` e `/health` para o backend (porta 3000). Deixe o backend rodando ao usar o frontend.

### Rodar tudo

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:frontend
```

Depois acesse `http://localhost:5173`. É preciso **login** ou **cadastro** para usar o dashboard. O redirect `/go/:slug` segue público (ex.: `/go/demo`).

## Frontend

- **Visão geral:** métricas (produtos, grupos, checkouts, ativos, links) e tabela de links recentes.
- **Produtos:** lista, criar, abrir detalhe.
- **Produto → Grupos:** criar grupos (round-robin ou prioridade), abrir grupo.
- **Grupo:** listar checkouts e links inteligentes, adicionar checkout/link, ativar/desativar checkout, excluir.
- **Links inteligentes:** listar todos, criar (com grupo e fallback opcional), editar, excluir, copiar `/go/:slug`.

Design industrial-refinado (dark theme, Syne + DM Sans + JetBrains Mono, accent âmbar, grain, grid, motion).

## Autenticação

- **Cadastro:** `POST /api/auth/register` com `{ email, password, name? }`. Senha mín. 6 caracteres.
- **Login:** `POST /api/auth/login` com `{ email, password }`. Retorna `{ user, token }`.
- **Me:** `GET /api/auth/me` com `Authorization: Bearer <token>`.
- O frontend guarda o token em `localStorage`, envia no header e redireciona para `/login` em 401.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DATABASE_URL` | PostgreSQL | — |
| `JWT_SECRET` | Chave para JWT (mín. 16 caracteres) | — |
| `PORT` | Porta da API | `3000` |
| `HEALTH_CHECK_TIMEOUT_MS` | Timeout do health check | `5000` |
| `HEALTH_CHECK_ALLOWED_STATUSES` | Status HTTP ok | `200,302` |
| `FAILURE_THRESHOLD` | Falhas para desativar checkout | `3` |

## Modelagem (Prisma)

- **User** (email, passwordHash, name?) — login/cadastro.
- **Product** → **CheckoutGroup** (rotationStrategy: round-robin | priority) → **Checkout** (url, priority, isActive, …)
- **SmartLink** (slug, groupId, fallbackUrl?) → aponta para um **CheckoutGroup**

## Rotação

- **Round-robin:** menor `lastUsedAt` primeiro.
- **Priority:** maior `priority` primeiro.

Checkouts inativos são ignorados. Após `FAILURE_THRESHOLD` falhas consecutivas, o checkout é desativado.
