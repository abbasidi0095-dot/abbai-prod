# ABBAI — Sophisticated Intelligence Platform

ABBAI is a production-ready AI chat platform with a premium dark/glassmorphic interface, built with **Fastify + TypeScript** on the backend, **Supabase** for auth/database/storage, and a vanilla JS frontend matching the provided ABBAI design system.

---

## Table of Contents

1. [Stack](#stack)
2. [Features](#features)
3. [Folder Architecture](#folder-architecture)
4. [Database Schema](#database-schema)
5. [Environment Variables](#environment-variables)
6. [Local Development](#local-development)
7. [Production Deployment](#production-deployment)
8. [Security](#security)
9. [Observability](#observability)
10. [API Routes](#api-routes)
11. [AI Providers](#ai-providers)

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML/JS, Tailwind CSS (CDN), Material Symbols |
| Backend | Node.js, TypeScript, Fastify |
| Auth | Supabase Auth (email, OAuth, password reset, JWT validation) |
| Database | PostgreSQL via Prisma ORM |
| Storage | Supabase Storage (local fallback in dev) |
| Cache / Rate Limiting | Redis (memory fallback in dev) |
| AI | Google AI Studio (default), provider abstraction for OpenAI, Anthropic, etc. |
| Logging | Pino |
| Deployment | Railway (backend), Vercel (frontend) |

---

## Features

- **Authentication**: Email login/signup, Google & GitHub OAuth, password reset, session refresh, protected routes, RBAC.
- **Chat API**: `/chat` non-streaming, `/stream` Server-Sent Events, conversation CRUD, history, messages.
- **File Uploads**: Images, PDF, TXT, DOCX, CSV, JSON, Markdown. Stored in Supabase Storage with signed URLs.
- **Security**: Helmet, CORS, rate limiting, input validation (Zod), secure headers, SQL injection protection via Prisma.
- **Observability**: Pino logger, health/readiness/metrics endpoints.
- **Admin**: Role-based admin routes for users, model settings, usage logs.

---

## Folder Architecture

```
abbai-prod/
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Fastify app setup
│   │   ├── index.ts               # Entry point
│   │   ├── auth/                  # Supabase client + auth plugin
│   │   ├── config/                # Environment configuration
│   │   ├── providers/             # AI provider abstraction
│   │   ├── routes/                # API route handlers
│   │   ├── services/              # Business logic
│   │   ├── types/                 # Shared TypeScript types
│   │   └── utils/                 # Prisma, logger, errors, helpers
│   ├── prisma/
│   │   ├── schema.prisma          # PostgreSQL schema (active)
│   │   ├── schema.postgresql.prisma
│   │   └── schema.sqlite.prisma   # Local SQLite reference
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   └── public/
│       ├── index.html
│       ├── login.html
│       ├── signup.html
│       ├── chat.html
│       ├── css/
│       └── js/                    # api.js, auth.js
├── railway.toml
├── vercel.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Database Schema

Managed by Prisma. Tables:

- `users` — synced from Supabase Auth, role, email verified.
- `profiles` — user profile data.
- `conversations` — chat threads.
- `messages` — chat messages (user/assistant/system).
- `attachments` — uploaded files metadata & signed URLs.
- `model_settings` — per-user default model/settings.
- `usage_logs` — usage & cost tracking.
- `subscriptions` — subscription status.
- `api_keys` — API keys for programmatic access.

See `backend/prisma/schema.prisma` for full definitions.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# App
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Database (production uses PostgreSQL)
DATABASE_URL=postgresql://...

# Redis (optional for dev)
REDIS_URL=

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_STORAGE_BUCKET=attachments

# AI providers
GOOGLE_AI_API_KEY=...
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
# ...

# Security
SESSION_SECRET=...
ENCRYPTION_KEY=...
CORS_ORIGIN=http://localhost:3000

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Local dev bypass (NEVER enable in production)
DEV_AUTH_BYPASS=true
```

---

## Local Development

### Option 1: Direct backend (serves frontend)

```bash
cd backend
cp .env.example .env
# Fill in credentials
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

### Option 2: Docker Compose (requires PostgreSQL URL)

```bash
cp .env.example .env
# Fill in credentials
docker-compose up --build
```

---

## Production Deployment

### Backend — Railway

1. Push code to GitHub.
2. Create a Railway project and connect the repo.
3. Add environment variables in Railway dashboard.
4. `railway.toml` is pre-configured; deploy.

### Database — Supabase PostgreSQL

Use Supabase PostgreSQL connection string as `DATABASE_URL`.

### Frontend — Vercel

1. Connect the repo to Vercel.
2. Set framework preset to "Other".
3. Set output directory to `frontend/public`.
4. Add environment variables and update `vercel.json` rewrites to point to your Railway backend.

### Auth — Supabase Auth

Configure email templates and OAuth providers (Google, GitHub) in Supabase Dashboard > Authentication.

---

## Security

- Helmet for secure headers + CSP.
- CORS restricted to configured origins.
- Rate limiting per user/IP.
- Zod validation on all inputs.
- Prisma ORM prevents SQL injection.
- Passwords handled by Supabase Auth (never stored locally).
- Encrypted secrets via environment variables.

---

## Observability

- `GET /api/health` — health check including database.
- `GET /api/ready` — readiness probe.
- `GET /api/metrics` — memory, CPU, uptime.
- Structured logging with Pino.

---

## API Routes

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Email login |
| POST | `/api/auth/signup` | Email signup |
| POST | `/api/auth/refresh` | Refresh session |
| POST | `/api/auth/reset-password` | Password reset email |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/oauth/:provider` | OAuth URL (google, github) |

### Chat

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat` | Non-streaming chat |
| POST | `/api/stream` | Streaming chat (SSE) |

### Conversations

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/history` | List conversations |
| GET | `/api/conversation/:id` | Get conversation |
| POST | `/api/conversation` | Create conversation |
| PATCH | `/api/conversation/:id` | Update conversation |
| DELETE | `/api/conversation/:id` | Delete conversation |
| GET | `/api/conversation/:id/messages` | List messages |

### Attachments

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/attachments` | Upload file |
| POST | `/api/attachments/:id/refresh` | Refresh signed URL |

### Admin (ADMIN role)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/users` | List users |
| PATCH | `/api/admin/users/:id/role` | Update role |
| POST | `/api/admin/model-settings` | Set model settings |
| GET | `/api/admin/usage` | Usage logs |

---

## AI Providers

Default provider is **Google AI Studio** with `gemini-3.1-flash-lite`.

Future providers are abstracted and can be added in `backend/src/providers/`:
- OpenAI
- Anthropic
- OpenRouter
- Groq
- Mistral
- DeepSeek
- xAI

Set the corresponding `*_API_KEY` environment variable to enable a provider.

---

## License

Private — for the ABBAI project.
