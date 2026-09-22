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
