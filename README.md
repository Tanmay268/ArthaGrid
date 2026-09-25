# ArthaGrid

ArthaGrid is an intelligent personal-finance analytics platform — it tracks income and expenses, analyzes and budgets and forecasts them, flags unusual transactions, answers plain-language questions about your money, and has a real dashboard on top. Everything below is built, tested, and designed to run entirely on free-tier hosting; see [docs/upgrades.md](docs/upgrades.md) for the build history and [docs/deployment.md](docs/deployment.md) for actually putting it online.

"Artha" is Sanskrit for wealth or prosperity; "Grid" suggests a structured system.

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
- **AI Financial Copilot** *(optional)* — ask questions like "why did my expenses increase?", answered by Google Gemini's free tier from a small, explicitly allow-listed bundle of pre-computed aggregate numbers — a transaction's raw description/merchant text is never sent, which is asserted by an automated test, not just documented. Without a Gemini key configured, the endpoint returns 503 rather than failing to start
- **React dashboard** (`frontend/`) — Overview, Analytics, Budgets, Forecast, Insights, an "Ask ArthaGrid" copilot page, Transactions, and Settings
- **User management** — self-service profile updates plus admin-driven user control
- **Hardened by default** — Helmet, credentialed CORS, rate limiting, NoSQL injection sanitization, structured logging (Pino), environment validation, graceful shutdown
- **API docs** via Swagger UI at `/api-docs`

See [docs/context.md](docs/context.md) for the full project rationale, [docs/architecture.md](docs/architecture.md) for system design, and [docs/decisions.md](docs/decisions.md) for the reasoning behind key technical choices.

## Tech stack

Backend: Node.js, Express, MongoDB (Mongoose), Postgres (`pg`, optional — analytics rollups), Google Gemini API (optional — AI copilot, called via plain `fetch`, no SDK), JWT, Joi, Pino, Jest + Supertest. Analytics/forecasting/anomaly-detection math is hand-rolled in plain JS (`src/utils/stats.js`) rather than an added dependency.
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
| `GEMINI_API_KEY` *(optional)* | Google Gemini API key, for the AI Financial Copilot. Leave unset and `POST /copilot/ask` returns `503` instead |
| `GEMINI_MODEL` *(optional)* | Which Gemini model to call — defaults to `gemini-2.5-flash` if unset |
| `CORS_ORIGIN` *(optional)* | The frontend's deployed URL, allowed to call this API with credentials (needed for the refresh-token cookie). Leave unset in local development — the request's own origin is reflected back instead |

### Run

```bash
npm run dev     # start with nodemon
npm start       # start normally
```

The API is available at `http://localhost:5000`, with interactive docs at `http://localhost:5000/api-docs` and a health check at `http://localhost:5000/health`.

### Run with Docker

```bash
docker compose up
```

This starts the API alongside a local MongoDB container — no local Node or MongoDB install required.

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
| Transactions | `/api/v1/transactions` | CRUD, role-gated (read: all roles, write/delete: Admin) |
| Dashboard | `/api/v1/dashboard` | `summary`, `by-category`, `trends`, `recent`, `overview` |
| Users | `/api/v1/users` | `me` for self-service; admin-only listing and management |
| Budgets | `/api/v1/budgets` | Per-category monthly limits + progress; read: all roles, write: Admin |
| Analytics | `/api/v1/analytics` | `metrics`, `forecast`, `anomalies`, `recurring`, `health-score`, `insights` — analyst/admin |
| Copilot | `/api/v1/copilot` | `ask` — plain-language Q&A over aggregate data; analyst/admin, 20 requests/hour |

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
  services/     # business logic, incl. analytics/forecast/anomaly/recurring/healthScore/insights/budget/rollup/copilot
  models/       # Mongoose schemas (User, Transaction, RefreshToken, Budget)
  middleware/   # auth, authorization, validation, error handling, verifyCronSecret, extractRefreshToken
  routes/v1/    # route definitions (auth, transactions, dashboard, users, budgets, analytics, copilot, internal)
  validators/   # Joi schemas
  db/           # schema.sql — the one Postgres rollup table
  utils/        # ApiError, cookies.js, stats.js (mean/stddev/z-score/linear-regression helpers)
frontend/       # React dashboard — separate app, own package.json, deployed to Vercel
docs/           # architecture, decisions, deployment guide, and OpenAPI spec
tests/          # Jest + Supertest suite
```

See [docs/architecture.md](docs/architecture.md) for the frontend's internal layout (`frontend/src/api`, `components`, `pages`, `store`).

## Deployment

ArthaGrid is **designed** to run entirely on free-tier hosting, and every piece is code-ready and tested: Render (API), MongoDB Atlas, Neon Postgres, GitHub Actions (scheduled rollup), Google Gemini (copilot), and Vercel (frontend). See [docs/deployment.md](docs/deployment.md) for the step-by-step guide to actually creating those accounts, and [docs/architecture.md](docs/architecture.md#deployment-free-tier) for the reasoning and known free-tier trade-offs (cold starts, rate limits, etc.).
