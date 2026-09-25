# Finance Dashboard API

A production-quality REST API backend for a multi-role finance dashboard system. Built with Node.js, Express, MongoDB, and JWT — featuring RBAC, aggregation-powered analytics, soft deletes, audit logging, input validation, and Swagger documentation.

---
## API Documentation
👉 [View Swagger API Docs](https://arthagrid.onrender.com/api/docs/)

## Quick Start
---

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# 3. Seed the database with test data
npm run seed

# 4. Start the development server
npm run dev
```

Server: `http://localhost:5000`
Swagger docs: `http://localhost:5000/api/docs`
Health check: `http://localhost:5000/health`

### Local development

Use `.env.example` for your local machine and keep local/dev data separate from production. A typical local `.env` should keep:

```bash
NODE_ENV=development
PORT=5000
ALLOWED_ORIGINS=http://localhost:3000
```

Run the local server with:

```bash
npm run dev
```

### Test credentials (after seeding)

| Email               | Password | Role    |
|---------------------|----------|---------|
| admin@test.com      | pass1234  | admin   |
| analyst@test.com    | pass1234  | analyst |
| viewer@test.com     | pass1234  | viewer  |

---

## Environment Variables

| Variable          | Required | Description                              | Example                    |
|-------------------|----------|------------------------------------------|----------------------------|
| `MONGO_URI`       | Yes      | MongoDB connection string                | `mongodb+srv://...`        |
| `JWT_SECRET`      | Yes      | Secret key for JWT signing (min 32 chars)| `your_secret_key_here`     |
| `JWT_EXPIRES_IN`  | No       | Token expiry duration                    | `7d`                       |
| `PORT`            | No       | Server port (default: 5000)              | `5000`                     |
| `NODE_ENV`        | No       | Environment mode                         | `development`/`production` |
| `ALLOWED_ORIGINS` | No       | CORS allowed origins (production)        | `https://myapp.com`        |

---

## Architecture

```
src/
├── config/
│   ├── db.js           ← MongoDB connection
│   └── swagger.js      ← OpenAPI spec config
├── models/
│   ├── User.js         ← User schema + bcrypt hooks
│   ├── Transaction.js  ← Financial record schema + soft delete
│   └── AuditLog.js     ← Append-only audit trail
├── controllers/        ← HTTP layer only (thin — no business logic)
│   ├── auth.controller.js
│   ├── user.controller.js
│   ├── transaction.controller.js
│   └── dashboard.controller.js
├── services/           ← All business logic lives here
│   ├── auth.service.js
│   ├── user.service.js
│   ├── transaction.service.js
│   ├── dashboard.service.js
│   └── auditLog.service.js
├── routes/v1/          ← Route declarations + middleware chains
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── transaction.routes.js
│   ├── dashboard.routes.js
│   └── index.js
├── middleware/
│   ├── authenticate.js    ← JWT verification + req.user injection
│   ├── authorize.js       ← RBAC permission gate factory
│   ├── validate.js        ← Joi validation factory
│   ├── validateObjectId.js← MongoDB ObjectId format check
│   ├── rateLimiter.js     ← Tiered rate limiting
│   └── errorHandler.js    ← Global error handler (9 error types)
├── validators/            ← Joi schemas
│   ├── auth.validator.js
│   ├── transaction.validator.js
│   └── dashboard.validator.js
└── utils/
    ├── ApiError.js        ← Operational error class
    └── auditLogger.js     ← Fire-and-forget audit writer
```

**Key architectural decisions:**

- **Route → Controller → Service → Model** — business logic never touches `req`/`res`; controllers never contain conditionals
- **Services are framework-agnostic** — could be tested or called without Express
- **Validators are co-located** with their domain, imported by routes

---

## Role-Permission Matrix

| Permission            | Viewer | Analyst | Admin |
|-----------------------|:------:|:-------:|:-----:|
| `read:transactions`   | YES    | YES     | YES   |
| `write:transactions`  |        |         | YES   |
| `delete:transactions` |        |         | YES   |
| `read:dashboard`      | YES    | YES     | YES   |
| `read:analytics`      |        | YES     | YES   |
| `read:users`          |        |         | YES   |
| `write:users`         |        |         | YES   |
| `read:audit`          |        |         | YES   |

RBAC is enforced server-side via a permission map in `src/middleware/authorize.js`. Roles grant sets of permissions; the `authorize(...permissions)` middleware checks those permissions — not role strings — so adding new roles requires only updating the map, not touching any route.

---

## API Reference

### Authentication

| Method | Endpoint               | Access | Description                  |
|--------|------------------------|--------|------------------------------|
| POST   | `/api/v1/auth/register`| Public | Register user, returns JWT   |
| POST   | `/api/v1/auth/login`   | Public | Login, returns JWT           |
| GET    | `/api/v1/auth/me`      | Any    | Get current user profile     |

### Transactions

| Method | Endpoint                    | Access           | Description                        |
|--------|-----------------------------|------------------|------------------------------------|
| GET    | `/api/v1/transactions`      | Viewer+          | List with filtering + pagination   |
| POST   | `/api/v1/transactions`      | Admin            | Create new transaction             |
| GET    | `/api/v1/transactions/:id`  | Viewer+          | Get single transaction             |
| PATCH  | `/api/v1/transactions/:id`  | Admin            | Update transaction                 |
| DELETE | `/api/v1/transactions/:id`  | Admin            | Soft delete transaction            |

**Query parameters for GET /transactions:**

| Param       | Type   | Description                       |
|-------------|--------|-----------------------------------|
| `type`      | string | `income` or `expense`             |
| `category`  | string | Transaction category              |
| `startDate` | date   | ISO 8601 date filter start        |
| `endDate`   | date   | ISO 8601 date filter end          |
| `minAmount` | number | Minimum amount filter             |
| `maxAmount` | number | Maximum amount filter             |
| `page`      | int    | Page number (default: 1)          |
| `limit`     | int    | Results per page (default: 20)    |
| `sortBy`    | string | `date`, `amount`, `createdAt`     |
| `sortOrder` | string | `asc` or `desc` (default: `desc`) |

### Dashboard (Analyst + Admin)

| Method | Endpoint                       | Access   | Description                              |
|--------|--------------------------------|----------|------------------------------------------|
| GET    | `/api/v1/dashboard/overview`   | Analyst+ | Full overview via `$facet` (1 DB call)   |
| GET    | `/api/v1/dashboard/summary`    | Analyst+ | Total income, expenses, net, savings rate|
| GET    | `/api/v1/dashboard/by-category`| Analyst+ | Per-category totals and stats            |
| GET    | `/api/v1/dashboard/trends`     | Analyst+ | Monthly/weekly income vs expense trends  |
| GET    | `/api/v1/dashboard/recent`     | Viewer+  | Most recent N transactions               |
| GET    | `/api/v1/dashboard/audit`      | Admin    | Paginated audit trail                    |

### Users (Admin only)

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/api/v1/users`             | List all users           |
| GET    | `/api/v1/users/:id`         | Get user by ID           |
| PATCH  | `/api/v1/users/:id/status`  | Activate/deactivate user |
| PATCH  | `/api/v1/users/:id/role`    | Change user role         |

---

## Transaction Categories

**Income:** `salary`, `freelance`, `investment`, `gift`, `other_income`

**Expense:** `food`, `transport`, `housing`, `utilities`, `healthcare`, `entertainment`, `education`, `shopping`, `other_expense`

---

## Dashboard Analytics

### `/dashboard/summary` response shape
```json
{
  "totalIncome": 42000.00,
  "totalExpenses": 18500.00,
  "netBalance": 23500.00,
  "transactionCount": 60,
  "avgTransactionAmount": 1016.67,
  "largestIncome": 8000.00,
  "largestExpense": 2400.00,
  "savingsRate": 55.9
}
```

### `/dashboard/trends?period=monthly&year=2024` response shape
```json
[
  { "period": "2024-01", "label": "Jan 2024", "income": 8000, "expenses": 3200, "net": 4800 },
  { "period": "2024-02", "label": "Feb 2024", "income": 5000, "expenses": 2100, "net": 2900 }
]
```

### `/dashboard/overview` — uses MongoDB `$facet`
Runs four sub-pipelines in a single database round trip:
1. Overall summary figures
2. Top 5 expense categories
3. Income vs expense type breakdown
4. Last 30 days vs prior period comparison

---

## Error Response Format

All errors return this consistent shape:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable description",
    "details": [
      { "field": "amount", "message": "Amount must be a positive number" }
    ]
  }
}
```

### HTTP status codes used

| Code | Meaning                                    |
|------|--------------------------------------------|
| 200  | Success                                    |
| 201  | Resource created                           |
| 400  | Bad request / validation error             |
| 401  | Unauthenticated (no or invalid token)      |
| 403  | Forbidden (authenticated but no permission)|
| 404  | Resource not found                         |
| 409  | Conflict (e.g. duplicate email)            |
| 413  | Payload too large                          |
| 422  | Unprocessable entity (Mongoose validation) |
| 429  | Too many requests (rate limited)           |
| 500  | Internal server error                      |
| 503  | Database unavailable                       |

---

## Security Features

| Feature                  | Implementation                                      |
|--------------------------|-----------------------------------------------------|
| Helmet HTTP headers      | `helmet()` — XSS, clickjacking, MIME sniffing       |
| NoSQL injection          | `express-mongo-sanitize` — strips `$` and `.`       |
| HTTP parameter pollution | `hpp` — prevents duplicate query params             |
| Rate limiting (auth)     | 10 requests per 15 minutes                          |
| Rate limiting (API)      | 100 requests per 15 minutes                         |
| Body size limit          | 10kb max payload                                    |
| Password hashing         | bcrypt with 12 salt rounds                          |
| Password hiding          | `select: false` — never returned in queries         |
| JWT expiry               | Configurable (default 7 days)                       |
| CORS                     | Wildcard in dev, explicit origins in production     |
| ObjectId validation      | Proactive check before DB queries                   |

---

## Audit Log

Every sensitive action is recorded in the `AuditLog` collection:

- `USER_REGISTER`, `USER_LOGIN`, `USER_LOGIN_FAIL`
- `USER_ACTIVATE`, `USER_DEACTIVATE`, `USER_ROLE_CHANGE`
- `TRANSACTION_CREATE`, `TRANSACTION_UPDATE`, `TRANSACTION_DELETE`

Each entry stores: who performed it, what was changed (before/after state), IP address, user agent, request path, and a request trace ID.

The logger is **fire-and-forget** — it never `await`s the write, so audit failures never block or delay the main request. This is intentional: in a finance system, the transaction must succeed even if the audit DB is momentarily slow.

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

Tests use `mongodb-memory-server` — no external MongoDB required. Each test suite gets an isolated in-memory database.

**Test coverage:**
- Auth: register, login, /me, validation, duplicate detection
- Transactions: CRUD, RBAC gating per role, filtering, pagination, soft delete
- Dashboard: summary math, category breakdown, trends, overview, audit access
- Errors: 404, malformed JSON, missing auth, consistent response shape

---

## Soft Delete

Transactions are never permanently deleted. `DELETE /transactions/:id` sets `isDeleted: true`. A Mongoose `pre(/^find/)` middleware automatically excludes these records from all queries. Aggregation pipelines manually include `{ isDeleted: { $ne: true } }` since they bypass Mongoose middleware.

---

## Assumptions Made

1. All financial amounts are in a single currency (no multi-currency support)
2. Transactions belong to the system, not individual users — any admin can modify any record
3. Soft-deleted transactions are excluded from all analytics (not counted in totals)
4. The `analyst` role cannot create or modify records — read-only analytics access
5. JWT is stateless — no token revocation (logout is client-side token discard)
6. Date fields use server timezone; clients should send ISO 8601 UTC strings
7. Categories are a fixed enum — not user-configurable in this version

---

## Tradeoffs & What I'd Add With More Time

| What | Why not now |
|------|-------------|
| Redis caching on dashboard endpoints | Would need a Redis instance; 5-min TTL on `/summary` and `/overview` would dramatically reduce DB load |
| Token refresh / revocation | Requires a token blacklist store (Redis); stateless JWT is sufficient for assessment |
| Winston structured logging | `console.log` is sufficient for dev; in production, JSON logs with log levels and rotation would be added |
| Multi-currency support | Requires exchange rate tracking and currency field on every transaction |
| WebSocket real-time updates | Dashboard could push live balance changes; needs socket.io or SSE layer |
| Forecast endpoint | Linear regression on trends data to project next-month income/expenses |
| Role inheritance | Admin currently lists all permissions explicitly; a proper hierarchy would inherit upward |

---

## Workflow and Diagrams for easy understanding
https://drive.google.com/file/d/1RaGmj0nunsP5N_0uvqRBT5MMr5CjQ-bj/view?usp=sharing

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

Backend: Node.js, Express, MongoDB (Mongoose), Postgres (`pg`, optional — analytics rollups), Google Gemini API (optional — AI copilot, called via plain `fetch`, no SDK), JWT, Joi, Pino, Jest + Supertest. Analytics/forecasting/anomaly-detection math is hand-rolled in plain JS (`src/utils/stats.js`) rather than an added dependency.
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
| `GEMINI_API_KEY` *(optional)* | Google Gemini API key, for the AI Financial Copilot. Leave unset and `POST /copilot/ask` returns `503` instead |
| `GEMINI_MODEL` *(optional)* | Which Gemini model to call — defaults to `gemini-2.5-flash` if unset |
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

The API is available at `http://localhost:5000`, with interactive docs at `http://localhost:5000/api-docs` and a health check at `http://localhost:5000/health`.

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
| Transactions | `/api/v1/transactions` | CRUD, role-gated (read: all roles, write/delete: Admin) |
| Dashboard | `/api/v1/dashboard` | `summary`, `by-category`, `trends`, `recent`, `overview` |
| Users | `/api/v1/users` | `me` for self-service; admin-only listing and management |
| Budgets | `/api/v1/budgets` | Per-category monthly limits + progress; read: all roles, write: Admin |
| Analytics | `/api/v1/analytics` | `metrics`, `forecast`, `anomalies`, `recurring`, `health-score`, `insights` — analyst/admin |
| Copilot | `/api/v1/copilot` | `ask` — plain-language Q&A over aggregate data; analyst/admin, 20 requests/hour |
| Admin | `/api/v1/admin` | `stats` — platform overview; admin only |
| Also | `/health`, `/metrics`, `/api-docs` | uptime check; Prometheus metrics (bearer `METRICS_TOKEN`); Swagger UI |

`analytics` also has `weekly-report`, and `transactions` has `suggest-category` (admin, same gate as creating one).

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

ArthaGrid is **designed** to run entirely on free-tier hosting, and every piece is code-ready and tested: Render (API), MongoDB Atlas, Neon Postgres, GitHub Actions (scheduled rollup and weekly report), Google Gemini (copilot), Resend (optional email), and Vercel (frontend). See [docs/deployment.md](docs/deployment.md) for the step-by-step guide to actually creating those accounts, and [docs/architecture.md](docs/architecture.md#deployment-free-tier) for the reasoning and known free-tier trade-offs (cold starts, rate limits, etc.).
