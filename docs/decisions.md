# Decisions

This is a log of the notable technical decisions already baked into the codebase, written down so future contributors (including future you) understand *why* things are the way they are, not just what they are. Each entry gives the decision, the reasoning, and the trade-off accepted.

---

### 1. Layered architecture (Routes → Middleware → Controllers → Services → Models)

**Decision:** Split the code into distinct layers instead of putting logic directly in route handlers.

**Why:** Keeps each piece of code focused on one job. Controllers only translate HTTP in and out; services hold the actual business rules; models only talk to the database. This makes it much easier to test business logic without spinning up a server, and to change one layer (e.g. swap MongoDB for something else) without rewriting everything.

**Trade-off:** More files and more "boilerplate" for very simple operations, compared to putting everything in one route file.

---

### 2. MongoDB with Mongoose

**Decision:** Use a document database instead of a relational one (Postgres/MySQL).

**Why:** Financial transaction records are fairly simple, self-contained documents that don't need complex joins. Mongoose adds schema validation, hooks (like password hashing before save), and indexing on top of MongoDB's flexibility, giving structure without giving up MongoDB's easy horizontal scaling and quick iteration.

**Trade-off:** No native multi-document transactions/joins the way a relational database has them by default (MongoDB does support transactions, but they're not used here yet), and financial data arguably benefits from strong relational guarantees.

---

### 3. JWT access tokens + database-backed refresh tokens (updated)

**Decision:** Issue a short-lived signed JWT (`ACCESS_TOKEN_EXPIRES_IN`, default 15 minutes) for authenticating requests, plus a separate long-lived refresh token (`REFRESH_TOKEN_EXPIRES_IN_DAYS`, default 7 days) that's exchanged for a new pair via `POST /auth/refresh`.

**Why:** A pure long-lived JWT (the original design) can't be revoked before it expires — if one is stolen, it stays valid for its whole lifetime with no way to cut it off. Shortening the access token's life to 15 minutes shrinks that exposure window dramatically, while the refresh token keeps the login experience convenient (no re-entering a password every 15 minutes). The refresh token itself is stored server-side (only its SHA-256 hash, never the raw value), so it *can* be revoked — on logout, on suspected theft, or by an admin deactivating the account.

Refresh tokens are also **rotated**: each `/auth/refresh` call revokes the token it was given and issues a brand new one. If a revoked token is ever presented again, that's treated as a signal of theft (an attacker replaying a stolen token after the legitimate user has already moved on) and every active session for that user is revoked immediately, forcing a fresh login everywhere.

**Trade-off:** More moving parts than a single JWT — an extra model (`RefreshToken`), an extra database round-trip per refresh, and a breaking change to the auth response shape (`{ user, token }` became `{ user, accessToken, refreshToken }`). The server is no longer fully stateless (refresh tokens live in the database), which reintroduces a small amount of the shared-storage coordination that pure JWTs were meant to avoid — though this is a single indexed lookup, not full session state, so it stays cheap even across multiple server instances.

---

### 4. Passwords hashed with bcrypt, never returned by default

**Decision:** Hash passwords with bcrypt (cost factor 12) in a Mongoose `pre('save')` hook, and mark the `password` field `select: false` so it's excluded from normal queries.

**Why:** Prevents storing or accidentally leaking plaintext or hashed passwords in API responses. Hashing in the model (not the controller) guarantees it happens no matter which code path creates a user.

**Trade-off:** None significant — this is standard practice. Cost factor 12 is a reasonable balance of security vs. login speed.

---

### 5. Role-based access control via a static permission map

**Decision:** Define three roles (`viewer`, `analyst`, `admin`) and a hard-coded map of `role → [permissions]` in `authorize.js`, rather than storing permissions per-user in the database.

**Why:** Simple to reason about and audit — anyone can read `authorize.js` and see exactly what each role can do. No extra database lookups needed to check permissions.

**Trade-off:** Roles and permissions can only be changed by editing code and redeploying. There's no way for an admin to create a custom role or tweak permissions at runtime. Fine for three fixed roles; would need to move to a database-backed permission model if the roles get more numerous or need to be user-configurable.

---

### 6. Soft delete for transactions, with a "who and when" audit trail

**Decision:** Deleting a transaction sets `isDeleted: true` (plus `deletedAt`/`deletedBy`) instead of removing the document, and a Mongoose `pre(/^find/)` hook automatically excludes soft-deleted documents from every query. Every update also stamps `updatedBy` with the acting user.

**Why:** Financial records benefit from an audit trail — being able to prove a transaction existed, who last changed it, and who removed it (and when) matters more here than in most data. Soft delete also makes "undo" trivial to add later.

**Trade-off:** Data grows indefinitely unless there's a separate archival/cleanup process. Every query pays a (small) extra filter cost. Developers must remember that bulk operations like `findByIdAndUpdate` bypass the `find` hook and need to be handled carefully (this is already done correctly in `deleteTransaction`, but it's an easy mistake to introduce later). Note also that `updatedBy`/`deletedBy` only record the *most recent* actor, not a full history of every change — see [upgrades.md](./upgrades.md) for when a real audit-log collection would be worth adding.

---

### 7. MongoDB aggregation pipelines for dashboard analytics

**Decision:** Compute all dashboard numbers (summary, by-category, trends, overview) using MongoDB's aggregation framework, including a `$facet` stage in `/dashboard/overview` to run four different summaries in a single database round trip.

**Why:** Pushes the number-crunching down to the database, which is far more efficient than pulling every transaction into Node.js and calculating totals in JavaScript — especially as transaction volume grows. `$facet` specifically avoids making four separate queries for the overview endpoint.

**Trade-off:** Aggregation pipeline syntax is harder to read and debug than plain JavaScript, and mistakes inside a pipeline (see [upgrades.md](./upgrades.md) for a bug found in `getSummary`) can silently produce wrong numbers or errors that are harder to spot in review.

---

### 8. Centralized error handling with a custom `ApiError` class

**Decision:** All expected errors (bad input, not found, forbidden, etc.) are thrown as `ApiError` instances and caught by a single global error-handling middleware, rather than each controller writing its own try/catch and response formatting.

**Why:** Guarantees every error response has the same shape (`{ success: false, error: { message, details } }`), and lets controllers/services just `throw` instead of manually building error responses. Combined with `express-async-errors`, this means async route handlers don't need manual `try/catch` at all — thrown errors are automatically forwarded to the error handler.

**Trade-off:** Relies on `express-async-errors` patching Express's internals, which is a well-established library but is still a "magic" dependency that changes how errors flow through the framework.

---

### 9. Input validation with Joi, applied as middleware

**Decision:** Define request-shape schemas with Joi and run them through a reusable `validate(schema, target)` middleware before the request reaches the controller.

**Why:** Keeps validation rules declarative and in one place per resource, separate from business logic. Using `stripUnknown: true` and `abortEarly: false` means unexpected fields are silently dropped and all validation errors are reported at once, rather than one at a time.

**Trade-off:** Joi schemas need to be kept in sync with Mongoose schemas by hand. This is now handled consistently: transaction categories/types, user roles, and password rules are each defined in exactly one place (the owning model, or `src/validators/shared.js` for cross-cutting rules like password complexity) and imported everywhere they're validated, rather than being retyped as string literals per schema.

---

### 10. API versioning from day one (`/api/v1/...`)

**Decision:** Prefix every route with `/api/v1`, even though there's only one version so far.

**Why:** Costs nothing now and avoids a painful migration later — if the API shape needs to change in a breaking way, `/api/v2` can be introduced alongside `/v1` without breaking existing clients.

**Trade-off:** None meaningful.

---

### 11. Layered rate limiting — strict on auth, generous everywhere else

**Decision:** Apply a strict `express-rate-limit` (10 requests per 15 minutes) to the auth endpoints (`register`, `login`, `refresh`), and a more generous global limiter (300 requests per 15 minutes per IP) to every `/api` route underneath it.

**Why:** The main risk on auth endpoints is credential brute-forcing / account enumeration, which justifies a tight limit even though it costs legitimate users a little convenience on typos. Other endpoints (transactions, dashboard analytics) don't carry that same risk profile but still shouldn't be unbounded — a global limit acts as a baseline safety net against a misbehaving client or a simple denial-of-service attempt, without getting in the way of normal usage.

**Trade-off:** 300 requests/15 minutes is a starting guess, not a load-tested number. If the product ends up with dashboards that poll frequently or bulk-import tooling, this limit will need tuning (or a per-route override) rather than applying uniformly.

---

### 12. Structured logging with Pino instead of `console.*`

**Decision:** Introduce a single logger instance (`src/config/logger.js`, built on Pino) and route all application-level logging (startup, shutdown, DB connection events, error handling) through it, replacing scattered `console.log`/`console.error` calls. `morgan` is kept separately for human-readable HTTP access logs during local development.

**Why:** `console.log` output has no severity levels, isn't structured (can't be filtered/queried by a log aggregator), and is easy to leave in accidentally (as the removed plaintext-password log line demonstrated). A leveled, structured logger makes it possible to turn down verbosity in production (`LOG_LEVEL`), and produces output that's actually usable once this runs somewhere you can't just watch a terminal.

**Trade-off:** One more dependency, and log output during local development looks different (though `pino-pretty` keeps it colorized and readable) than the previous plain `console.log` lines.

---

### 13. Password changes always go through `.save()`, never `findByIdAndUpdate`

**Decision:** Anywhere a user's password can change (registration, self-service profile update), the code loads the Mongoose document and calls `.save()`, never `User.findByIdAndUpdate()`.

**Why:** The password-hashing logic lives in a Mongoose `pre('save')` hook (see decision #4), which — as the name implies — only runs on `.save()`. `findByIdAndUpdate()` talks to MongoDB directly and skips document middleware entirely. Using it for a password update would silently store the new password in plain text with no error raised anywhere. This is an easy trap to fall into (`findByIdAndUpdate` is otherwise the more concise, idiomatic choice for a simple field update, and is used elsewhere in this codebase for exactly that reason), so it's called out explicitly here rather than left as tribal knowledge.

**Trade-off:** Slightly more verbose than a one-line `findByIdAndUpdate` call, and it's a rule that has to be remembered by anyone adding a new "change password" code path in the future rather than being structurally impossible to get wrong.

---

### 14. Environment variables validated once, at startup

**Decision:** `src/config/env.js` validates `process.env` against a Joi schema the moment the server starts, before connecting to the database or accepting any request, and the app refuses to boot if something required (e.g. `MONGO_URI`, a `JWT_SECRET` of at least 32 characters) is missing or malformed.

**Why:** Without this, a missing environment variable surfaces later and more confusingly — a cryptic Mongoose connection error, or a JWT operation failing partway through a request. Failing fast at startup, with a specific message naming the problem, turns a production incident into a deploy-time error someone notices immediately.

**Trade-off:** None significant — this is a small amount of validation code that only runs once per process start.

---

### 15. Machine-readable API documentation (OpenAPI + Swagger UI)

**Decision:** Maintain a hand-written OpenAPI 3.0 spec (`docs/openapi.yaml`) describing every route, and serve it as an interactive, browsable page at `/api-docs` via `swagger-ui-express`.

**Why:** A finance API is very likely to have a frontend or a second team integrating against it. Without a spec, that means reading route files and Joi schemas by hand. A single, versioned spec file is both human-readable documentation and (later) a source that can generate client SDKs or contract tests.

**Trade-off:** A hand-written spec can drift from the actual implementation over time, since nothing currently enforces that they match. Generating the spec from code (e.g. via `zod-to-openapi`-style tooling, or JSDoc annotations validated in CI) would close that gap if the API grows large enough for manual upkeep to become error-prone.

---

### 16. No hard delete for user accounts

**Decision:** User accounts can only be deactivated (`isActive: false`), never deleted. There is deliberately no `DELETE /users/:id` endpoint.

**Why:** Transactions reference their creator via `createdBy`, and now also `updatedBy`/`deletedBy`. Hard-deleting a user would either orphan that reference or require cascading deletes that destroy financial history — neither is acceptable for records a finance company needs to be able to explain later. Deactivation preserves the full audit trail while still preventing the account from being used.

**Trade-off:** Deactivated accounts accumulate in the database indefinitely with no built-in archival process, the same trade-off already accepted for soft-deleted transactions (decision #6).
