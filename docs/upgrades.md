# Upgrades

This tracks the production-readiness work for ArthaGrid, framed around what a finance company would expect from a system that holds real money data: correctness first, then security, then auditability, then everything else. Items are grouped the same way as before, and each one is now marked with its status.

**Status legend:** ✅ Implemented · 🟡 Partially implemented / needs follow-up · ⬜ Not started (deliberately, see note)

---

## 🔴 Critical — fixed

### 1. ✅ Fixed two bugs that broke `GET /dashboard/summary` entirely
**Where:** `src/services/dashboard.service.js`, inside `getSummary`.
**Bug A:** `'$$amount'` (a reference to an undefined aggregation variable) instead of `'$amount'` (the field), when computing `largestExpense`.
**Bug B (found only once the test suite actually called the endpoint):** `transactionCount`, `avgTransactionAmount`, `largestIncome`, `largestExpense`, and `savingsRate` were written as siblings of `$project` inside the pipeline-stage object instead of nested inside it — a pipeline stage can only have one top-level key, so MongoDB rejected the whole pipeline with a 500 error. This means fixing bug A alone wouldn't have been enough; the endpoint was fully broken, not just returning a wrong number.
**Fix applied:** `$amount` corrected, and every projected field moved inside the single `$project: {...}` object. Covered by a regression test in `tests/dashboard.test.js` that seeds income and expense transactions and asserts the endpoint returns 200 with correct totals and `largestExpense`.

### 2. ✅ Removed a plaintext-password logging bug
**Where:** `src/controllers/auth.controller.js`.
**What was wrong:** `register` logged `console.log("BODY:", req.body)`, which printed the user's plaintext password to the server console (and, in most hosting setups, to persisted log files) on every signup. This wasn't in the original upgrade list — it surfaced while wiring up structured logging — but for a finance product it's a serious data-handling issue: passwords should never appear in any log, ever.
**Fix applied:** Line removed entirely.

### 3. ✅ Stack traces no longer reach the client
**Where:** `src/middleware/errorHandler.js`.
**Fix applied:** The full error (including stack) is now always logged server-side via the structured logger. The client only receives `err.stack` when `NODE_ENV !== 'production'`; in production it gets a generic "Something went wrong" message instead of the raw error text.

### 4. ✅ Automated test suite added
**Where:** `tests/`.
**Fix applied:** Jest + Supertest + `mongodb-memory-server` (an in-memory MongoDB, so tests don't touch a real database or require one running locally). Coverage includes:
- `auth.test.js` — registration, login, password strength rejection, duplicate email, and the full refresh-token rotation/reuse-detection flow.
- `transactions.test.js` — RBAC (viewer can read but not write), full CRUD, and confirms a soft-deleted transaction disappears from reads.
- `dashboard.test.js` — a direct regression test for the `$$amount` bug above, plus an RBAC check that viewers can't reach analytics.
- `users.test.js` — self-service profile read/update, and admin-only list/update/deactivate, including the self-deactivation guard.

`npm test` runs the suite once (`--runInBand`, CI-friendly); `npm run test:watch` keeps the old watch-mode behavior for local development.

**Two small follow-up fixes surfaced by actually running the suite:** the auth and global rate limiters now `skip` requests when `NODE_ENV === 'test'` (otherwise a single test file making a realistic number of login/register calls trips the same 10-requests/15-minutes limit a real attacker would — real rate limiting stays fully active in development and production), and `findByIdAndUpdate`/`findOneAndUpdate` calls were switched from the deprecated `{ new: true }` option to `{ returnDocument: 'after' }` to remove Mongoose deprecation warnings from the logs.

---

## 🟠 High priority — security and correctness

### 5. ✅ Refresh tokens with rotation and reuse detection
**Where:** `src/models/RefreshToken.js`, `src/services/auth.service.js`, `src/routes/v1/auth.routes.js`.
**What changed:** Login/register now issue a short-lived access token (`ACCESS_TOKEN_EXPIRES_IN`, default 15 minutes) and a separate long-lived refresh token (`REFRESH_TOKEN_EXPIRES_IN_DAYS`, default 7 days). Only a SHA-256 hash of the refresh token is ever stored — a database leak alone can't be replayed as a valid session.
- `POST /auth/refresh` exchanges a refresh token for a new pair and **revokes the old one** (rotation).
- If an already-revoked refresh token is presented again, every active session for that user is revoked immediately — a strong signal of theft is treated as an incident, not just a rejected request.
- `POST /auth/logout` revokes a specific refresh token on demand.
- Expired refresh tokens are auto-deleted by a MongoDB TTL index — no cleanup cron job needed.
**API impact:** This is a breaking change to the auth response shape — `{ user, token }` is now `{ user, accessToken, refreshToken }`. Any client integration needs to be updated accordingly.

### 6. ✅ NoSQL injection protection
**Where:** `src/app.js`.
**Fix applied:** Added `express-mongo-sanitize` as global middleware, stripping `$` and `.` operators from user-supplied input before it can reach a Mongoose query.

### 7. ✅ Stronger password requirements
**Where:** `src/validators/shared.js`, used by both registration and profile updates.
**Fix applied:** Minimum length raised from 6 to 8 characters, plus a complexity requirement (at least one uppercase letter, one lowercase letter, and one digit). Defined once and imported everywhere passwords are validated, so the rule can't drift out of sync between registration and profile updates.

### 8. ✅ Ownership/audit trail on transactions
**Where:** `src/models/Transaction.js`, `src/services/transaction.service.js`.
**Fix applied:** Added `updatedBy` (visible on every transaction), and `deletedAt`/`deletedBy` (hidden by default, same as `isDeleted`, since they only matter for internal audit queries). Every update and soft-delete now records which user performed it — a baseline audit trail for financial records, letting a team trace who changed or removed a transaction and when.
**Follow-up not done:** This records the *last* editor, not a full history of every change. A dedicated audit-log collection (one row per change, not just the latest) would be needed if regulatory/compliance requirements call for a complete change history — see item #20.

### 9. ✅ Rate limiting beyond `/auth`
**Where:** `src/app.js`.
**Fix applied:** Added a global rate limiter (300 requests / 15 minutes per IP) on all `/api` routes, layered underneath the stricter 10-requests/15-minutes limiter already on `/auth/*`.

---

## 🟡 Medium priority — completeness and reliability

### 10. ✅ User management implemented
**Where:** `src/controllers/user.controller.js`, `src/services/user.service.js`, `src/validators/user.validator.js`, `src/routes/v1/user.routes.js`.
**Fix applied:**
- `GET /users/me`, `PATCH /users/me` — every authenticated user can view and update their own name/password.
- `GET /users` (paginated, filterable by role/isActive), `GET /users/:id`, `PATCH /users/:id` (name/role/isActive), `PATCH /users/:id/deactivate` — admin only.
- Password updates always go through `User.save()` (not `findByIdAndUpdate`), so the model's password-hashing hook actually runs — using `findByIdAndUpdate` for a password change would have silently stored it in plain text.
- Admins cannot deactivate their own account (guards against an admin locking themselves out).
- No hard delete of user records — users are deactivated, never removed, so transaction history (`createdBy`) never points at a deleted document.

### 11. ✅ Database connection resilience and graceful shutdown
**Where:** `src/config/db.js`, `server.js`.
**Fix applied:** Initial connection now retries up to 5 times with a 3-second delay instead of crashing on a transient failure. Connection `error`/`disconnected` events are logged. `server.js` now listens for `SIGINT`/`SIGTERM` and closes the HTTP server and MongoDB connection cleanly before exiting (with a 10-second forced-exit fallback), which matters when a hosting platform restarts or redeploys the app.

### 12. ✅ Structured logging
**Where:** `src/config/logger.js`, used in place of `console.*` throughout the app.
**Fix applied:** Added `pino` (with `pino-pretty` for readable local output). Replaces ad-hoc `console.log`/`console.error` calls in the error handler, DB connection module, and server startup/shutdown with leveled, structured logs (`logger.info`, `logger.warn`, `logger.error`) that are ready to ship to a log aggregator in production. `morgan` is kept for human-readable HTTP access logs during development.

### 13. ✅ API documentation
**Where:** `docs/openapi.yaml`, served at `/api-docs` via `swagger-ui-express`.
**Fix applied:** A hand-written OpenAPI 3.0 spec covering every route (auth, transactions, dashboard, users, health), with request/response shapes and the bearer-auth security scheme. Anyone integrating against the API — or a future frontend developer — can browse and try requests directly instead of reading route files.

### 14. ✅ Single source of truth for shared validation values
**Where:** `src/validators/auth.validator.js`, `src/validators/user.validator.js`.
**Fix applied:** Roles are now imported from `ROLES` in `src/models/User.js` everywhere (previously hard-coded as `'viewer', 'analyst', 'admin'` strings in the auth validator). Password rules live in one shared schema (`src/validators/shared.js`). Transaction categories/types were already imported correctly from the model — this extends the same pattern consistently.

### 15. ✅ Fixed the `package.json` entry point mismatch
**Fix applied:** `"main"` now points to `server.js` (the actual entry point) instead of a nonexistent `index.js`.

### 16. ✅ Environment validation at startup
**Where:** `src/config/env.js`, required at the very top of `server.js`.
**Fix applied:** Required variables (`MONGO_URI`, `JWT_SECRET` — enforced to be at least 32 characters) are validated with Joi before the server does anything else. Missing or malformed configuration now fails immediately with a clear error message instead of surfacing as a cryptic failure deep inside a request or a Mongoose connection error.

---

## 🟢 Nice to have — polish and scale

### 17. ✅ Containerized
**Where:** `Dockerfile`, `.dockerignore`, `docker-compose.yml`.
**Fix applied:** A production-style Docker image (`node:20-alpine`, dependencies installed with `npm ci --omit=dev`) and a Compose file that also spins up a local MongoDB container for one-command local setup (`docker compose up`).

### 18. ✅ CI pipeline
**Where:** `.github/workflows/ci.yml`.
**Fix applied:** A GitHub Actions workflow that installs dependencies and runs the full test suite on every push/PR to `main`. There's no linter configured yet, so this catches regressions but not style issues — see item #21.

### 19. 🟡 Pagination limits
**Status:** Consistent everywhere list endpoints exist (`transactions`, `dashboard/recent`, and the new `users` list all cap page size). No further action needed unless a new list endpoint is added later.

### 20. ⬜ Full audit-log history (not built — deliberately)
**Why not done now:** Item #8 covers "who last touched this record," which is enough for day-to-day accountability. A true audit log (every change, not just the latest, immutable, queryable by record) is a bigger feature — a separate `AuditLog` collection or an event-sourcing-style approach — and is worth building specifically if/when there's a concrete compliance requirement (e.g. SOC 2, an internal audit) driving it, rather than speculatively.

### 21. ⬜ Linting (not built — deliberately)
**Why not done now:** Not in the original request and not a correctness or security issue — it's a code-consistency nicety. Worth adding (ESLint + Prettier, wired into the same CI workflow) whenever more than one person starts contributing regularly, since that's when style drift actually starts costing time in review.

### 22. ⬜ Database-backed roles/permissions (not built — deliberately)
**Why not done now:** As noted in [decisions.md](./decisions.md), the current hard-coded three-role permission map is intentionally simple and easy to audit. Move to database-backed roles only if the product needs custom roles per organization or finer-grained, admin-configurable permissions — don't build it ahead of that need.

---

## What a finance company would still want before going further

These weren't in the original list but are worth naming explicitly, since "finance company" raises the bar beyond a typical CRUD API:

- **Idempotency keys on transaction creation** — prevents a retried request (flaky network, double-click) from creating a duplicate financial record.
- **Money stored as integers (smallest currency unit, e.g. cents), not floats** — `amount` is currently a JavaScript `Number`, which is fine for display but risks floating-point rounding errors in aggregation over large datasets. Worth revisiting if this ever needs to reconcile against real account balances.
- **Encryption at rest / field-level encryption** for especially sensitive fields, and a documented data-retention policy — driven by whatever regulatory framework applies (e.g. PCI DSS if card data is ever involved, SOC 2 for a B2B product).
- **Multi-factor authentication** for admin accounts specifically, given they can create/delete/modify financial records.
- **Per-organization data isolation** if this ever serves more than one company/household from the same database — right now all transactions live in one global pool.

None of these are implemented yet. They're listed here so the gap is visible rather than assumed away.

---

## Suggested order of attack (updated)

1. ~~Fix the `$$amount` bug, the password-logging bug, and the stack-trace leak.~~ ✅ Done.
2. ~~Add a first batch of tests.~~ ✅ Done.
3. ~~Add refresh tokens/logout and NoSQL-injection protection.~~ ✅ Done.
4. ~~Finish user management endpoints.~~ ✅ Done.
5. Decide, with the product/compliance owner, which items in "What a finance company would still want" are actually required for your launch — those should come before further polish.
6. Linting + a real CI quality gate (item #21), then the audit-log and DB-backed-roles items only if a concrete need shows up (items #20, #22).

---

## ArthaGrid 2.0 — Analytics, Budgets, Insights & Frontend

This tracks a separate, larger initiative: turning ArthaGrid from a transaction-tracking API into a small analytics/insights product, with a real frontend on top — while staying entirely on free-tier hosting. The full plan (architecture, free-tier services chosen, and the reasoning behind each) lives in [decisions.md](./decisions.md) (entries #17–21) and [architecture.md](./architecture.md). Nothing below is marked ✅ until it's actually built and covered by a test — same rule as the rest of this document.

### Phase 1 — complete (Stages A–D)

**Stage A (MongoDB only, no new infra) — done:**

- ✅ **Expanded analytics engine** — financial, behavioral, and comparative metrics beyond today's summary/category/trends (burn rate, expense-to-income ratio, weekday vs. weekend spending, month-over-month category growth). `GET /api/v1/analytics/metrics`. Covered by `tests/analytics.test.js`.
- ✅ **Budgets** — per-category monthly limits with live progress tracking (spent/remaining/percentage/over-budget). `GET/POST/PATCH/DELETE /api/v1/budgets`. Read: all roles; write: admin only, same pattern as transactions. Covered by `tests/budgets.test.js`.
- ✅ **Recurring expense detection** — groups transactions by the new optional `merchant` field when present, or by category + similar amount otherwise, and flags groups recurring at a consistent weekly/monthly interval. `GET /api/v1/analytics/recurring`.
- ✅ **Spending forecasting** — moving average and linear regression over historical monthly totals, computed in plain JS (`src/utils/stats.js`) rather than adding a stats/ML dependency. Deliberately not using a heavier model (Random Forest, Prophet, LSTM) — a simple, explainable model is a better fit for this project's scale and easier to trust. `GET /api/v1/analytics/forecast`.
- ✅ **Anomaly detection** — a leave-one-out z-score flag on unusually large expenses per category, shown as an ArthaGrid-computed signal, not a certainty. Runs both as a live list (`GET /api/v1/analytics/anomalies`) and as a non-blocking hint attached to `POST /api/v1/transactions`'s response (`unusual: { flagged, score }`) — it never rejects a write, only flags it.
- ✅ **Financial Health Score** — a transparent, weighted score (30% savings rate / 25% cash-flow stability / 20% spending consistency / 15% budget adherence / 10% emergency reserve), documented as an ArthaGrid metric with a published formula in the response itself, not an objective financial truth. `GET /api/v1/analytics/health-score`.
- ✅ **Insights engine** — rule-based, plain-language observations generated from the services above (e.g. "Food is currently your fastest-growing expense category"), computed live when requested rather than pushed proactively (proactive/scheduled insights would need a background worker — see decision #18 on why that's out of scope for a free-tier deployment). `GET /api/v1/analytics/insights`.

**Stage B (Postgres rollup pipeline) — done:**

- ✅ **Postgres analytics rollups** — an optional free Postgres database (Neon), holding one rollup table (`monthly_metrics`), rebuilt from MongoDB by `POST /api/v1/internal/jobs/rollup`. MongoDB remains the only source of truth — Postgres only ever holds derived, rebuildable data, and the app runs identically without it configured at all. The original design sketched five rollup tables (daily/category/recurring/forecast, alongside monthly); only `monthly_metrics` actually has a reader, so the rest were cut rather than built as write-only tables — see [decisions.md](./decisions.md) #17.
- ✅ **Forecast prefers the rollup** — `GET /api/v1/analytics/forecast` reads its monthly history from Postgres once populated, and transparently falls back to computing it live from MongoDB otherwise (before Postgres is configured, before the first scheduled rollup runs, or if Postgres is unreachable). The response's `source` field says which one was actually used.
- ✅ **Scheduled trigger** — `.github/workflows/rollup.yml`, a GitHub Actions workflow that calls the rollup endpoint daily with a shared secret (`CRON_SECRET`), standing in for a background worker (decision #18). Covered by `tests/rollup.test.js` (the auth guard and the optional/skip behavior — the actual Postgres writes are a manual deployment check against a real Neon database, since no Postgres is available in this test environment).

**Stage C (AI Financial Copilot) — done:**

- ✅ **AI Financial Copilot** — `POST /api/v1/copilot/ask`, plain-language Q&A ("why did my expenses increase?") answered by Google Gemini's free API tier (`gemini-2.5-flash` by default, overridable via `GEMINI_MODEL`). Only a small, explicitly allow-listed bundle of pre-computed aggregate numbers (totals, savings rate, top category changes, anomaly count/top few) is ever sent — never a raw transaction, `description`, or `merchant`. Read: analyst/admin, same gate as other analytics endpoints; its own tighter rate limit (20/hour) on top of that. Optional like Postgres: without `GEMINI_API_KEY` set, the endpoint returns `503` instead of the server failing to start.
- ✅ **Privacy guarantee is tested, not just documented** — `tests/copilot.test.js` mocks the Gemini call and inspects the exact request body sent to it, asserting a transaction's `merchant`/`description` text never appears — an automated check of the promise in [decisions.md](./decisions.md) #19, not only a code comment.

**Stage D (frontend) — done — Phase 1 is now complete:**

- ✅ **React frontend** (`frontend/`) — Overview, Analytics, Budgets, Forecast, Insights, an "Ask ArthaGrid" copilot page, Transactions (full CRUD, gated by role), and Settings. Built with React + TypeScript + Vite + Tailwind + hand-authored shadcn-style UI primitives (`src/components/ui/`, since the shadcn CLI needs an interactive registry fetch this environment couldn't run — same visual result, written by hand instead) + Recharts + TanStack Query + React Router + Zustand, exactly the stack decided on. TanStack Query hooks live in `frontend/src/api/`, one file per resource, mirroring the backend's own route grouping.
- ✅ **httpOnly refresh-token cookie** — `POST /auth/login`, `/register`, and `/refresh` now also set the refresh token as a cookie (`src/utils/cookies.js`), alongside the unchanged JSON response. `POST /auth/refresh`/`/logout` accept the token from either the cookie or the body (`extractRefreshToken` middleware) — existing non-browser clients are unaffected. **Corrected while building it:** the original plan said `SameSite=Strict`; that breaks entirely once frontend and API are on different domains (Vercel + Render), so it's `SameSite=None; Secure` in production and `SameSite=Lax` in local dev instead — see [decisions.md](./decisions.md) #21 for the full reasoning, including the CSRF-mitigating header (`X-ArthaGrid-Client`) that `SameSite=None` makes necessary.
- ✅ **CORS tightened for credentialed requests** — `cors()` (wide open) became `{ origin: CORS_ORIGIN || true, credentials: true }`, required for the cookie to cross origins at all; unset in development, it reflects the request's own origin back so `npm run dev` needs no configuration.
- ✅ **Auth test coverage extended** — `tests/auth.test.js` gained cases for the cookie being set, a cookie-only refresh succeeding with the required header, that same request being rejected without it (the CSRF guard, proven rather than just described), and the cookie being cleared on logout.

Everything from the Phase 1 plan is now built. See "Roadmap" below for what's deliberately still open, and the top of [decisions.md](./decisions.md) for the reasoning behind each piece.

**Follow-up since completed:** the single ~670KB bundle was split with route-based `React.lazy()` (see Round 2 below).

## Round 2 — the deferred roadmap items, a redesigned UI, and proof it scales

Everything the first round deferred was revisited. Same rule as ever: ✅ only after it's built and tested. The backend suite is now **79 tests passing**; the frontend type-checks and builds cleanly (`tsc -b`, `vite build`).

### Built

- ✅ **Auto-categorization** — `POST /api/v1/transactions/suggest-category`. A small Naive Bayes classifier in plain JS, no ML dependency and no third-party call (decision #23). It abstains rather than guessing when unsure. **Accuracy, honestly:** 94.6% (35/37) on a small held-out set, but only 49.2% in 5-fold cross-validation on the seed phrases; the "score" is a relative ranking, not a probability. Reproduce with `npm run eval:categorizer`. Covered by `tests/categorize.test.js`.
- ✅ **Scheduled weekly email reports** — users opt in from Settings; `.github/workflows/weekly-report.yml` triggers `POST /api/v1/internal/jobs/weekly-report`; email goes out over Resend's HTTPS API because Render's free tier blocks SMTP ports (decision #24). Optional (skipped without `RESEND_API_KEY`), with a `REPORT_ALLOWED_RECIPIENTS` allow-list because registration doesn't verify email ownership. Also `GET /api/v1/analytics/weekly-report` for the same data in the app. Covered by `tests/reports.test.js`. **Not built:** PDF reports.
- ✅ **Admin analytics dashboard** — `GET /api/v1/admin/stats` (admin only, `read:admin` permission) and an `/admin` page: user counts (total, active in the last 30 days, new this month, by role), transaction count and daily average, popular expense categories, and system health (request count, average/p95/p99 latency, server-error rate, memory, and whether MongoDB/Postgres/copilot/email are connected). Aggregate-only — never an individual transaction's amount, description or merchant. Request/latency numbers reset when the free host restarts. Covered by `tests/observability.test.js`.
- ✅ **Observability** — Prometheus-format `GET /metrics` behind a bearer token, with bounded label cardinality (decision #25). Setup for Grafana Cloud's free tier is in [observability.md](./observability.md). **Not built:** OpenTelemetry tracing (needs a collector to host).
- ✅ **Load testing** — k6 script + a self-contained in-memory test server + a results summarizer; real measured results and caveats in [load-testing.md](./load-testing.md). Free, local, no accounts.
- ✅ **Response cache with request coalescing** (decision #22) — added *because* of the load test: ~3.7× throughput and ~8.6× lower p95 at 100 simulated users on the same laptop.
- ✅ **`/api-docs` reachable from the frontend** — the Swagger UI is still served by the API at `/api-docs`; the frontend now has a `/api-docs` route that forwards to it, so the address works on either domain.
- ✅ **Redesigned frontend** — dark/light/system theme toggle (remembered, and no flash of the wrong theme on load), mobile-friendly layout (slide-out navigation drawer, tables that collapse to cards, safe-area padding), toast notifications instead of inline error text, skeleton loading states, confirm dialogs for destructive actions, empty/error states, a viewer-specific Overview (viewers can't call analyst endpoints), and lazy-loaded routes (first-load JS ~210KB → ~81KB gzipped).

### Bugs found and fixed while doing this (kept here because finding them is the point of testing)

- **Soft-deleted transactions leaked into totals.** The soft-delete filter is a Mongoose `find` hook, which does **not** run for `aggregate()`, `countDocuments()` or `distinct()`. A deleted transaction still counted in the transactions-list total, budget "spent", category growth, rollups, and the anomaly category list. Each now filters `isDeleted` explicitly, with a regression test (`tests/softDelete.test.js`).
- **Cache stampede** (found by the load test, not by unit tests) — see decision #22 and [load-testing.md](./load-testing.md) §3c.
- **"Weekday vs weekend" insight was misleading** — it averaged per *transaction*, so a weekend with a few big purchases looked "cheaper" than it was. It now averages per *day* (total ÷ number of weekday/weekend days in the range), with a test.
- **Metrics route labels lost their prefix on 404s** because Express restores `baseUrl` after a mismatch; labels are now built from the original URL with ids normalized.

### Roadmap — still deliberately not built

- **OpenTelemetry tracing** — needs an always-on collector; free hosting has none. (Metrics are built — see above.)
- **PDF report export** — email reports are HTML only.
- **Verified email addresses at registration** — would remove the need for the report recipient allow-list.
- **Redis** — not needed while there is one instance (decision #22); the swap point is `src/utils/cache.js`.
- **Full microservices split** — see decision #20. Not planned; would need multiple free hosting instances for no benefit at this project's scale.
- **Redis + BullMQ job queues** — see decision #18. The scheduled-cron approach covers the same need without a worker.
- **Fixing the query-per-category loop in `getAnomalies`** — a known inefficiency, not yet measured as a bottleneck; noted in [load-testing.md](./load-testing.md) §5.
- **Money stored as integer cents instead of a float** — already flagged in "What a finance company would still want" above; still open, and would be a breaking migration.
