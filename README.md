# ArthaGrid

ArthaGrid is an intelligent personal-finance analytics platform — it tracks income and expenses, analyzes and budgets and forecasts them, flags unusual transactions, answers plain-language questions about your money, and has a real dashboard on top. Everything below is built, tested, and designed to run entirely on free-tier hosting; see [docs/upgrades.md](docs/upgrades.md) for the build history and [docs/deployment.md](docs/deployment.md) for actually putting it online.

"Artha" is Sanskrit for wealth or prosperity; "Grid" suggests a structured system.

**Links**

- 👉 [Live API docs (Swagger UI)](https://arthagrid.onrender.com/api-docs/) — free hosting sleeps when idle, so the first load can take up to a minute
- [Workflow and diagrams](https://drive.google.com/file/d/1RaGmj0nunsP5N_0uvqRBT5MMr5CjQ-bj/view?usp=sharing)
- [Project report](docs/report.md) · [Architecture](docs/architecture.md) · [Decisions](docs/decisions.md) · [Load testing](docs/load-testing.md) · [Observability](docs/observability.md) · [Deployment](docs/deployment.md)

## Quick start

```bash
# 1. Install and configure
npm install
cp .env.example .env          # then set MONGO_URI and JWT_SECRET (32+ characters)

# 2. Load sample users, transactions and budgets
npm run seed

# 3. Start the API            → http://localhost:5000  (docs at /api-docs, health at /health)
npm run dev

# 4. In a second terminal, start the dashboard   → http://localhost:5173
cd frontend && npm install && cp .env.example .env && npm run dev
```

Log in with a seeded account (from `seed.js`):

| Email | Password | Role |
|---|---|---|
| admin@test.com | Password123 | admin |
| analyst@test.com | Password123 | analyst |
| viewer@test.com | Password123 | viewer |

The admin can add and edit data and sees the Admin page; the analyst also gets analytics, forecast, insights and the copilot; the viewer gets a read-only overview.

## Features

- **JWT authentication** with short-lived access tokens and revocable, rotating refresh tokens — the refresh token is also set as an httpOnly cookie for the browser frontend, which never has to hold it itself
- **Role-based access control** — Viewer, Analyst, and Admin roles with distinct permissions
- **Transactions** — full CRUD with soft delete and an audit trail (who created/updated/deleted, and when), plus an optional `merchant` field
- **Dashboard analytics** — summaries, category breakdowns, trends, recent activity
- **Expanded analytics engine** — burn rate, expense-to-income ratio, weekday vs. weekend spending, month-over-month category growth
- **Budgets** — per-category monthly limits with live progress tracking (spent/remaining/percentage)
- **Forecasting & anomaly detection** — simple, explainable statistical models (moving average, linear regression, leave-one-out z-score) — no black-box ML. Anomaly detection also attaches a non-blocking hint to every new transaction
- **Recurring expense detection** and a transparent **Financial Health Score** (published formula, not a black-box number)
- **Insights engine** — plain-language, rule-based observations generated from your own data, computed live per request
- **Postgres analytics rollups** *(optional)* — a second free database (Neon) that the forecast endpoint reads from once populated, keeping multi-month queries fast as data grows; entirely optional — without it configured, everything computes live from MongoDB exactly as before
- **Scheduled rollup job** — a GitHub Actions workflow standing in for a background worker (no free host provides one for free), calling a shared-secret-protected internal endpoint on a daily schedule
- **AI Financial Copilot** *(optional)* — ask questions like "why did my expenses increase?", answered by Azure OpenAI (GPT-5 mini) from a small, explicitly allow-listed bundle of pre-computed aggregate numbers — a transaction's raw description/merchant text is never sent, which is asserted by an automated test, not just documented. Without Azure OpenAI credentials configured, the endpoint returns 503 rather than failing to start
- **Auto-categorization** — suggests a category from a transaction's description; a small on-server classifier (no third-party call) that says "not sure" instead of guessing. Accuracy numbers, good and bad, are in [docs/decisions.md](docs/decisions.md) #23
- **Weekly email report** *(optional)* — opt-in from Settings, sent by a scheduled GitHub Actions job through Resend's free HTTPS API
- **Admin dashboard** and **Prometheus `/metrics`** — platform stats and latency numbers for admins; a token-protected metrics endpoint for Grafana ([docs/observability.md](docs/observability.md))
- **Load-tested** — a free k6 script and a self-contained test server; measured results and their limits in [docs/load-testing.md](docs/load-testing.md). A small in-process response cache (with request coalescing) came out of it: about 3.7× the throughput at 100 simulated users
- **React dashboard** (`frontend/`) — Overview, Analytics, Budgets, Forecast, Insights, an "Ask ArthaGrid" copilot page, Transactions, Settings and an Admin page. **Light/dark/system theme toggle**, a mobile-friendly layout (slide-out navigation, tables that turn into cards on phones), toast notifications, loading skeletons and lazy-loaded pages
- **User management** — self-service profile updates plus admin-driven user control
- **Hardened by default** — Helmet, credentialed CORS, rate limiting, NoSQL injection sanitization, structured logging (Pino), environment validation, graceful shutdown
- **API docs** via Swagger UI at `/api-docs` — on the API's own address, and the frontend's `/api-docs` forwards to it

See [docs/context.md](docs/context.md) for the full project rationale, [docs/architecture.md](docs/architecture.md) for system design, and [docs/decisions.md](docs/decisions.md) for the reasoning behind key technical choices.

## Tech stack

Backend: Node.js, Express, MongoDB (Mongoose), Postgres (`pg`, optional — analytics rollups), Azure OpenAI (optional — AI copilot, GPT-5 mini, called via plain `fetch`, no SDK), JWT, Joi, Pino, Jest + Supertest. Analytics/forecasting/anomaly-detection math is hand-rolled in plain JS (`src/utils/stats.js`) rather than an added dependency.
Metrics & load testing: `prom-client`, k6.
Frontend: React, TypeScript, Vite, Tailwind, hand-authored shadcn-style UI primitives, Recharts, TanStack Query, React Router, Zustand.

## Getting started

### Prerequisites

- Node.js 20+
- A MongoDB instance (local, Docker, or Atlas)

### Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs (min 32 characters) |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token lifetime (e.g. `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Refresh token lifetime in days |
| `NODE_ENV` | `development`, `test`, or `production` |
| `LOG_LEVEL` | Pino log level (e.g. `debug`, `info`) |
| `POSTGRES_URL` *(optional)* | Postgres connection string, for analytics rollups (e.g. from Neon). Leave unset and analytics just computes live from MongoDB instead |
| `CRON_SECRET` | Shared secret the scheduled rollup job (GitHub Actions) must send (as `X-Cron-Secret`) to trigger `POST /internal/jobs/rollup`. Without it set, that endpoint rejects every request |
| `AZURE_OPENAI_API_KEY` *(optional)* | Azure OpenAI API key, for the AI Financial Copilot. Leave unset (with the endpoint) and `POST /copilot/ask` returns `503` instead |
| `AZURE_OPENAI_ENDPOINT` *(optional)* | Your Azure OpenAI resource endpoint, e.g. `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` *(optional)* | Which deployment to call — defaults to `gpt-5-mini` if unset |
| `AZURE_OPENAI_API_VERSION` *(optional)* | Azure OpenAI REST API version — defaults to `2025-04-01-preview` if unset |
| `RESEND_API_KEY` *(optional)* | Resend API key for the weekly email report. Unset = the weekly job reports "skipped" |
| `REPORT_FROM_EMAIL` *(optional)* | Sender address for the report (defaults to Resend's sandbox sender) |
| `REPORT_ALLOWED_RECIPIENTS` *(optional)* | Comma-separated list; when set, only these addresses are ever emailed (registration doesn't verify email ownership) |
| `METRICS_TOKEN` *(optional)* | Bearer token protecting `GET /metrics`. Unset = `/metrics` returns 401 |
| `ANALYTICS_CACHE_TTL_SECONDS` *(optional)* | Response-cache lifetime in seconds (default `30`; `0` turns it off) |
| `CORS_ORIGIN` *(optional)* | The frontend's deployed URL, allowed to call this API with credentials (needed for the refresh-token cookie). Leave unset in local development — the request's own origin is reflected back instead |

### Run

```bash
npm run dev     # start with nodemon
npm start       # start normally
```

The API is available at `http://localhost:5000`, with interactive docs at `http://localhost:5000/api-docs` and a health check at `http://localhost:5000/health`. The quick start above shows how to run the frontend alongside it.

### Run with Docker

```bash
docker compose up
```

This starts the API alongside a local MongoDB container — no local Node or MongoDB install required.

### Load testing

Free, local, no accounts — see [docs/load-testing.md](docs/load-testing.md) for the simple steps and the results. In short: install [k6](https://k6.io), then

```bash
npm run loadtest:server          # terminal 1 — real app on an in-memory database
k6 run loadtest/k6/load.js       # terminal 2
```

### Tests

```bash
npm test         # run the full suite (Jest + Supertest, in-memory MongoDB)
npm run test:watch
```

### Seed / clean local data

```bash
npm run seed    # populate sample users and transactions
npm run clean   # wipe the database
```

Both are dev-only tools and should never be pointed at a production database.

### Frontend

The dashboard runs as its own app:

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL if the API isn't on http://localhost:5000
npm run dev
```

expecting the API to already be running (locally or deployed). Build for production with `npm run build` (outputs to `frontend/dist/`).

## API overview

All endpoints are versioned under `/api/v1`. Full request/response schemas are in [docs/openapi.yaml](docs/openapi.yaml), browsable at `/api-docs`.

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/v1/auth` | `register`, `login`, `refresh`, `logout` |
| Transactions | `/api/v1/transactions` | CRUD with filtering, sorting and pagination (`type`, `category`, `startDate`, `endDate`, `minAmount`, `maxAmount`, `page`, `limit`, `sortBy`, `sortOrder`); read: all roles, write/delete: Admin |
| Dashboard | `/api/v1/dashboard` | `summary`, `by-category`, `trends`, `recent`, `overview` |
| Users | `/api/v1/users` | `me` for self-service; admin-only listing and management |
| Budgets | `/api/v1/budgets` | Per-category monthly limits + progress; read: all roles, write: Admin |
| Analytics | `/api/v1/analytics` | `metrics`, `forecast`, `anomalies`, `recurring`, `health-score`, `insights` — analyst/admin |
| Copilot | `/api/v1/copilot` | `ask` — plain-language Q&A over aggregate data; analyst/admin, 20 requests/hour |
| Admin | `/api/v1/admin` | `stats` — platform overview; admin only |
| Also | `/health`, `/metrics`, `/api-docs` | uptime check; Prometheus metrics (bearer `METRICS_TOKEN`); Swagger UI |

`analytics` also has `weekly-report`, and `transactions` has `suggest-category` (admin, same gate as creating one).

### Transaction categories

**Income:** `salary`, `freelance`, `investment`, `gift`, `other_income`
**Expense:** `food`, `transport`, `housing`, `utilities`, `healthcare`, `entertainment`, `education`, `shopping`, `other_expense`

### Errors

Every error uses one shape, and stack traces never reach the client in production:

```json
{ "success": false, "error": { "message": "Human-readable description", "details": [{ "field": "amount", "message": "Amount must be a positive number" }] } }
```

Status codes used: 200, 201, 400 (validation), 401 (no/invalid token), 403 (no permission), 404, 409 (conflict, e.g. duplicate email), 429 (rate limited), 500, 503 (optional service such as the copilot not configured).

### Roles

| Role | Access |
|---|---|
| **Viewer** | Read-only on transactions and dashboards; view budgets; manage own profile |
| **Analyst** | Same as Viewer, plus analytics access |
| **Admin** | Full control over transactions, budgets, and user management |

## Project structure

```
src/
  config/       # env validation, DB + Postgres connections, logger
  controllers/  # request handlers
  services/     # business logic, incl. analytics/forecast/anomaly/recurring/healthScore/insights/budget/rollup/copilot/categorize/report/email/admin
  models/       # Mongoose schemas (User, Transaction, RefreshToken, Budget)
  middleware/   # auth, authorization, validation, error handling, verifyCronSecret, verifyMetricsToken, cacheResponse, extractRefreshToken
  routes/v1/    # route definitions (auth, transactions, dashboard, users, budgets, analytics, copilot, admin, internal)
  validators/   # Joi schemas
  db/           # schema.sql — the one Postgres rollup table
  utils/        # ApiError, cookies.js, stats.js (mean/stddev/z-score/linear-regression helpers)
frontend/       # React dashboard — separate app, own package.json, deployed to Vercel
loadtest/       # k6 script, in-memory test server, results
docs/           # architecture, decisions, deployment, load-testing, observability, and the OpenAPI spec
tests/          # Jest + Supertest suite
```

See [docs/architecture.md](docs/architecture.md) for the frontend's internal layout (`frontend/src/api`, `components`, `pages`, `store`).

## Deployment

ArthaGrid is **designed** to run on free-tier hosting for everything except the AI copilot, and every piece is code-ready and tested: Render (API), MongoDB Atlas, Neon Postgres, GitHub Actions (scheduled rollup and weekly report), Azure OpenAI (copilot, pay-as-you-go), Resend (optional email), and Vercel (frontend). See [docs/deployment.md](docs/deployment.md) for the step-by-step guide to actually creating those accounts, and [docs/architecture.md](docs/architecture.md#deployment-free-tier) for the reasoning and known free-tier trade-offs (cold starts, rate limits, etc.).

## Assumptions and known limits

1. **One currency, one shared ledger.** Amounts are a single currency, and transactions belong to the system rather than to individual users — every analyst sees the same data. There is no per-organization isolation.
2. **Money is stored as a floating-point number**, not integer cents. Fine for display and this scale; a breaking migration would be needed before reconciling against real account balances.
3. **Soft delete only.** Deleted transactions are hidden, never removed, and are excluded from every total. (Mongoose's soft-delete hook doesn't run for `aggregate()`, `countDocuments()` or `distinct()`, so those queries filter `isDeleted` explicitly — covered by a regression test.)
4. **The audit trail records the latest actor** (`createdBy`, `updatedBy`, `deletedBy`), not a full change history.
5. **Sign-up doesn't verify email ownership.** That is why weekly reports have an optional recipient allow-list.
6. **Free-tier trade-offs are real:** the API sleeps when idle (about a minute to wake), MongoDB Atlas M0 is capped at roughly 100 operations per second, and the in-process cache is per instance. See [docs/deployment.md](docs/deployment.md) and [docs/load-testing.md](docs/load-testing.md) for what was measured and what was not.

The complete list of what is deliberately not built (OpenTelemetry tracing, PDF reports, verified-email sign-up, a shared cache, a full audit log, microservices) is in [docs/upgrades.md](docs/upgrades.md).
