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

---

**A note on entries #17–21:** every decision in this document, including #17–21 below, describes something already built and running — check [upgrades.md](./upgrades.md) if you want the build/test status of each piece rather than just the reasoning behind it.

### 17. Postgres for analytics rollups, alongside MongoDB

**Decision:** Introduce a second database — Postgres (hosted free on Neon) — used only to hold a pre-computed analytics rollup table (`monthly_metrics`), populated on a schedule from MongoDB. MongoDB remains the only system of record for transactions, users, and budgets. (The original design sketched five rollup tables; only the one an endpoint actually reads — monthly totals, for the forecast endpoint's history — was built. The rest were cut rather than shipped as write-only tables nobody consumes; see [architecture.md](./architecture.md) for that reasoning.)

**Why:** This directly revisits decision #2 ("don't introduce a second database unless you can justify why"). The justification: multi-month trend and forecast queries are read-heavy and benefit from a shape that's cheap to query repeatedly, and MongoDB Atlas's free tier caps throughput at roughly 100 operations/second — running heavy historical aggregation on the same cluster that serves live transaction reads/writes competes for that same limited budget. A dedicated free relational store, populated by a scheduled rebuild rather than live writes, keeps the two workloads from fighting each other. Because every row in Postgres is derived and rebuildable from MongoDB, it never becomes a second source of truth — if it were ever lost entirely, the next scheduled rollup would recreate it.

**Trade-off:** A second database is genuinely more moving parts — a second connection to manage, a second set of credentials, and a second thing that can be down. Rollup data is only as fresh as the last scheduled run (see decision #18), not real-time. This is accepted specifically because the data is disposable and rebuildable, which is what makes it different from the kind of "second database" decision #2 originally warned against. It's also treated as strictly optional at the code level — `POSTGRES_URL` unset, or Postgres unreachable, just means the forecast endpoint falls back to computing its history live from MongoDB (see `src/config/postgres.js`), never a hard failure.

---

### 18. Scheduled computation via external cron, not a background job queue

**Decision:** Heavier or periodic computation (rebuilding analytics rollups, and any future scheduled reports) runs via a GitHub Actions scheduled workflow calling a secret-protected internal HTTP endpoint (`POST /api/v1/internal/jobs/rollup`), rather than a job queue (e.g. BullMQ) backed by a persistent worker process.

**Why:** This project is deployed entirely on free-tier hosting, and none of the realistic free hosting options (Render, Railway, Fly.io) include a free always-on background-worker process — only a free web service, which sleeps when idle. A job queue needs something to keep consuming it; without a free worker to run, BullMQ/Redis would add a dependency with nothing free to run it on. A scheduled GitHub Actions workflow is free (GitHub Actions gives a generous free monthly minute allowance, with no cap at all on public repos) and needs nothing else to be hosted — it just calls an existing endpoint on a timer.

**Trade-off:** No true event-driven pipeline — data is only as fresh as the last scheduled run, and there's no queue to retry a failed job automatically (a failed run just waits for the next scheduled tick, or can be re-triggered manually). The internal endpoint is authenticated with a static shared secret rather than a user session, which is a different (simpler, but less flexible) trust model than the rest of the API and needs to be kept out of the public API documentation.

---

### 19. AI Financial Copilot built on Google Gemini's free API tier, aggregates only

**Decision:** The natural-language "ask ArthaGrid" feature calls Google's Gemini API (free tier), and only ever sends it pre-computed aggregate figures the analytics engine already produced (e.g. "Food spending is up 18% this month, +₹2,340") — never raw transaction descriptions, merchant names, or account details.

**Why:** Gemini's free tier is, as of when this was researched, the only mainstream LLM API with a genuinely free, non-expiring quota suitable for a project with no operating budget. Restricting what's sent to pre-aggregated numbers bounds the exposure: even in the worst case, what leaves the server is a handful of already-derived statistics, not a user's actual spending history.

**Trade-off:** Google's free tier terms allow inputs to be used to improve their products — this is a real, disclosed trade-off of using a free LLM API for something touching financial data, accepted deliberately rather than glossed over. There's also no real intent-classification step in this version: every question sends the same fixed bundle of aggregates regardless of what was actually asked, which works for the "why did my spending change" style questions this was built for but won't generalize to arbitrary questions without further work.

Like Postgres (decision #17), this is optional at the code level: without `GEMINI_API_KEY` configured, `POST /api/v1/copilot/ask` returns a `503` rather than the server failing to start or the endpoint crashing. And the "never raw transaction data" promise isn't just a comment — `tests/copilot.test.js` mocks the Gemini call and asserts a seeded transaction's `merchant`/`description` text never appears in the request actually sent.

---

### 20. Staying a single service, not splitting into microservices

**Decision:** All new analytics, budgeting, and copilot functionality is added as new modules inside the existing single Express application (new services/controllers/routes, same layered architecture), not as separate deployed services.

**Why:** A microservices split (separate Auth/Transaction/Analytics/ML deployments) was considered, since it's how a larger-scale version of this system would eventually look. It was rejected for now because it directly conflicts with staying on free-tier hosting: each service would need its own free hosting instance, each with its own independent cold-start delay, plus inter-service network calls and separate deployment pipelines — real operational cost with no corresponding benefit at this project's actual traffic volume. This is the same reasoning as decision #1, reapplied.

**Trade-off:** All analytics computation runs in the same process as everything else, so a very expensive analytics query could, in principle, slow down unrelated requests. At this data scale that's a theoretical concern, not an observed one — worth revisiting only if it actually happens.

---

### 21. Refresh token also set as an httpOnly cookie, for the browser frontend

**Decision:** Now that a browser-based frontend exists, `POST /auth/login`, `POST /auth/register`, and `POST /auth/refresh` also set the refresh token as an `httpOnly` cookie (scoped to the `/api/v1/auth` path), in addition to returning it in the JSON response body exactly as before. `POST /auth/refresh` and `POST /auth/logout` now accept the token from either source — the cookie or the JSON body — via `extractRefreshToken` middleware, so existing non-browser API clients that send `{ refreshToken }` in the body keep working completely unchanged.

**Why:** The original design (decision #3) assumed a generic API client and left storage entirely up to the caller. A browser SPA that stores a long-lived refresh token itself — typically in `localStorage`, since JavaScript needs to read it to use it — makes that token readable by any script that manages to run on the page (e.g. via a dependency vulnerability), which is a meaningfully worse exposure than the access token's short 15-minute life already limits. An `httpOnly` cookie can't be read by JavaScript at all, closing that specific exposure for the one client (the browser frontend) that would otherwise need to hold it directly. The frontend never sees or stores a refresh token; it just relies on the browser attaching the cookie automatically, and does a silent `POST /auth/refresh` on every page load to trade it for a fresh access token.

**Cookie attributes, and a correction made while actually building this:** the original plan called for `SameSite=Strict`, written before the deployment topology was pinned down. That would have been wrong — the frontend (Vercel) and the API (Render) are deployed on different domains, and `SameSite=Strict` (or even `Lax`) blocks a cookie from being sent on cross-site requests at all, which would make the cookie useless for exactly the client it exists for. The actual settings, in `src/utils/cookies.js`: `Secure` + `SameSite=None` in production (required together — browsers only honor `SameSite=None` over HTTPS), and `SameSite=Lax` without `Secure` for local `http://` development, where frontend and API differ only by port and are therefore still "same-site" by the cookie spec's own definition (the site comparison ignores port).

**Trade-off:** The API now has two ways to carry the same token (JSON body and cookie), which is slightly more surface area. More importantly, `SameSite=None` reopens a CSRF door that `Strict`/`Lax` would otherwise close: a plain cross-site `<form>` POST rides along with the ambient cookie, no JavaScript required, and could trigger a refresh-token rotation the legitimate frontend didn't ask for. This is mitigated with a custom header (`X-ArthaGrid-Client: web`), required by `extractRefreshToken` whenever the token's source is the cookie rather than the body: a bare HTML form can never set a custom header, and a script that does set one forces a CORS preflight, which only succeeds for the configured `CORS_ORIGIN`. This is a standard, lightweight mitigation for cookie+JSON APIs — not a full CSRF-token scheme, which would be more machinery than this narrow surface (one endpoint, no state-changing side effect beyond rotating a token that's revocable anyway) justifies. The cookie itself stays deliberately narrow in scope: only ever read for the refresh/logout flow; the access token continues to be sent as a normal `Authorization` header on every other request, unaffected by any of this.

---

**A note on entries #22–26:** these cover the "roadmap" items that were first deferred and then built (auto-categorization, weekly email reports, the admin dashboard, observability, load testing). Same rule as above — each describes something built and tested; check [upgrades.md](./upgrades.md) for status.

### 22. An in-process response cache with request coalescing, not Redis

**Decision:** The expensive read-only analytics endpoints (`/analytics/*`, `/dashboard/*`) are cached in memory for 30 seconds (`ANALYTICS_CACHE_TTL_SECONDS`, `0` turns it off). Every successful write to transactions or budgets clears the cache. When several requests ask for the same uncached answer at once, only the first does the work and the rest wait for and share its result ("single-flight" coalescing). The cache is mounted *after* authentication and role checks, so a caller who isn't allowed to see a response can never be handed a cached copy of it.

**Why:** The load test ([load-testing.md](./load-testing.md)) showed the analytics endpoints are the bottleneck: without a cache, 100 simultaneous users pushed `/analytics/insights` to a ~6 s p95. A 30-second cache lifted throughput about 3.7× on the same laptop. Free hosting runs exactly one instance, so a shared cache (Redis) would add a service to host without any benefit — every request already reaches the same process. Coalescing was added because the first cache-only version *still* showed a ~7 s worst case: when an entry expired, every waiting request recomputed it at once (a "cache stampede"). The load test found that; the unit tests hadn't.

**Trade-off:** Data can be up to 30 seconds stale for reads *after someone else's write on another instance* — with a single instance, writes clear the cache immediately, so users see their own changes at once. If the app ever runs on more than one instance, each holds its own cache and can be up to 30 s behind the others; at that point, swap `src/utils/cache.js` for Redis (callers only use get/set/clear, so nothing else changes). The cache is capped at 200 entries so memory can't grow without bound on a 512 MB host. It is off by default in tests so seeded data can't leak between them.

---

### 23. Auto-categorization with a small on-server text classifier, not an external ML/LLM service

**Decision:** `POST /api/v1/transactions/suggest-category` suggests a category from a description/merchant using a hand-written Naive Bayes classifier (words + character trigrams) inside the API process. It learns from a small built-in seed list plus the ledger's own already-categorized transactions (weighted higher), and **abstains** — returns no suggestion — when it isn't confident enough. It only ever *suggests*; the user still picks the category.

**Why:** The earlier roadmap deferred this because a new account has no history to learn from. The seed list solves the cold start, and the ledger data improves it over time. Doing it in-process keeps it free, instant, private (nothing is sent to a third party — unlike the copilot, decision #19), and dependency-free. An LLM call per keystroke would burn the Gemini free quota and leak descriptions.

**Trade-off / honesty about accuracy:** on the 191 built-in seed phrases, 5-fold cross-validation gave **49.2%** accuracy (94/191) — a pessimistic number, because each fold removes whole merchants the model then has never seen. On a separate hand-written held-out set of 37 realistic descriptions (`tests/fixtures/categorizerHoldout.js`), accuracy is **94.6%** (35/37) — but that set is small, and written by the same person who wrote the seed list, so it is optimistic. Both numbers are real; the truth is somewhere in between and depends on how familiar the merchants are. The "score" it returns is a relative ranking, **not a calibrated probability**, and the docs/UI don't call it one. `npm run eval:categorizer` reproduces both numbers. It will not understand a merchant it has never seen and will say so rather than guess.

---

### 24. Weekly email reports sent through an HTTPS email API (Resend), not SMTP

**Decision:** Users can opt in (Settings → "Weekly email report"). A scheduled GitHub Actions workflow (`weekly-report.yml`) calls `POST /api/v1/internal/jobs/weekly-report` with the shared `X-Cron-Secret`; the API sends each opted-in user the same summary email via Resend's HTTPS API using plain `fetch`, no SDK. Optional like Postgres and Gemini: with `RESEND_API_KEY` unset, the job reports "skipped" and the workflow still succeeds.

**Why HTTPS instead of SMTP (nodemailer):** Render's free tier blocks outbound SMTP ports (25/465/587), so an SMTP library would work on a laptop and silently fail in production. Sending over HTTPS (port 443) works everywhere.

**Trade-offs:** (1) Resend's free tier limits volume, and until you verify your own domain it can only send from its sandbox address to the account owner's email — fine for a demo, which is why `REPORT_FROM_EMAIL` is configurable. (2) Registration doesn't verify that someone owns the email they type in, so anyone could sign up with another person's address and opt them in. `REPORT_ALLOWED_RECIPIENTS` (comma-separated) is a safety net: when set, only those addresses are ever emailed. Verified-email registration is the proper fix and is not built. (3) The report is computed once and is identical for everyone (the ledger is a single shared pool), which is why it can be a single computation rather than one per user.

---

### 25. Observability: Prometheus-format metrics behind a token, no OpenTelemetry

**Decision:** The API exposes `GET /metrics` in Prometheus text format (request counts, latency histograms, process stats via `prom-client`), protected by `Authorization: Bearer $METRICS_TOKEN`. With `METRICS_TOKEN` unset the endpoint returns 401 to everyone (fail closed). Route labels are normalized (`/transactions/:id`) and unknown paths are grouped under `unmatched`, so a scanner hitting random URLs can't create unlimited metric series and exhaust memory. A separate, JWT-protected `GET /api/v1/admin/stats` feeds the admin dashboard page in the frontend.

**Why:** Free Grafana Cloud accepts Prometheus scrapes, so this gives real dashboards with no self-hosted server. See [observability.md](./observability.md).

**Trade-offs:** In-process metrics reset when the (free, sleeping) Render instance restarts, and counters live per instance. Latency percentiles shown in the admin page are *estimated* from histogram buckets, not exact. OpenTelemetry tracing was **not** built — traces need a collector to be useful, which needs a host; it stays on the roadmap.

---

### 26. Behind a proxy: `trust proxy = 1`, and a rate-limit bypass that can't be enabled in production

**Decision:** In production the app sets `trust proxy` to 1 (Render puts exactly one proxy in front of it) so `req.ip` is the real client, not the proxy. A `DISABLE_RATE_LIMIT=true` switch exists for load testing, but it is honored only when `NODE_ENV` is not `production`.

**Why:** Without `trust proxy`, every user on Render appears to have the proxy's IP, so all users share one rate-limit bucket — one busy user could lock everyone out. And load testing needs the limiter off, but a limiter that can be switched off by one environment variable is a security hole if that variable is ever set by mistake in production.

**Trade-off:** `trust proxy = 1` is only correct while there is exactly one proxy hop in front of the app; if deployed behind a CDN plus a load balancer, the number must change or clients could spoof their IP via `X-Forwarded-For`.
