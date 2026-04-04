# Development Log

This document records every architectural decision, tradeoff, and learning made during the build. Written during construction, not after.

---

## Day 1 — Foundation, Auth, RBAC

### What I built
- Full project scaffold with layered architecture (routes → controllers → services → models)
- MongoDB connection with Mongoose
- User model with bcrypt pre-save hook (password hashing is schema-level, not service-level)
- JWT-based authentication: register + login return signed tokens
- `authenticate` middleware: verifies JWT, attaches `req.user`, checks `isActive`
- `authorize` middleware: permission-map-based RBAC gate factory
- `validate` middleware: Joi schema factory for body and query validation
- Global error handler covering 9 distinct error types
- `ApiError` class: operational errors with status code and detail array
- `express-async-errors`: eliminates try-catch in every async controller
- Rate limiting on auth routes (10 req/15min)

### Key decisions

**Permission map over role string checks**
Instead of `if (req.user.role === 'admin')`, I built a `PERMISSIONS` map and use `authorize('write:transactions')`. This means adding a new role only requires updating one object — no route changes. It also makes the access policy readable as a table.

**`select: false` on password field**
Mongoose never returns the password hash in any query unless explicitly requested with `.select('+password')`. This prevents accidental password leakage in any endpoint.

**`pre('save')` for password hashing**
Hashing lives in the model, not the service. The service never imports bcrypt. Any code path that saves a user gets hashing automatically — including future admin password resets.

**`express-async-errors` must be first import**
It monkey-patches Express's `next` to forward rejected promises. If any middleware loads before it, those async functions won't have their errors caught. First line of `app.js`.

**`isOperational` flag on ApiError**
Distinguishes expected errors (wrong password, not found) from programmer bugs. The error handler can differentiate: operational errors get their message exposed to clients; unknown errors get a generic message in production.

---

## Day 2 — Financial Records CRUD + Filtering

### What I built
- Transaction model with 14-category enum, soft delete (`isDeleted`), and DB indexes
- `pre(/^find/)` middleware: auto-excludes soft-deleted records from all find queries
- Full CRUD: create (admin), read (viewer+), update (admin), soft delete (admin)
- Query builder in service layer: filter by type, category, date range, amount range
- Pagination with `Promise.all([countDocuments, find])` for parallel execution
- `validateObjectId` middleware: proactive ObjectId format check before DB queries
- Seed script generating 80 realistic transactions across 12 months

### Key decisions

**Soft delete via `pre(/^find/)` hook**
Setting `isDeleted: true` and using a query hook means every `find`, `findOne`, `findOneAndUpdate` automatically excludes deleted records. No developer has to remember to add the filter. The hook is invisible infrastructure.

**Important gotcha: aggregation bypasses this hook**
`Transaction.aggregate([...])` does NOT trigger Mongoose middleware. Every aggregation pipeline manually includes `{ isDeleted: { $ne: true } }` in its `$match` stage. Documented in the dashboard service and in this log.

**`select: false` on `isDeleted`**
The soft-delete flag never appears in API responses. Clients don't need to know about internal deletion state.

**`Promise.all` for count + data**
Running `countDocuments` and `find` in parallel halves the database round trips for every paginated request. At scale (many concurrent users), this matters. Sequential would be strictly worse with no benefit.

**DB indexes on query patterns**
Added indexes on `{ date: -1 }`, `{ type: 1, category: 1 }`, `{ createdBy: 1, date: -1 }`. These cover the three most common query patterns. Without indexes, every filtered query does a full collection scan — O(n) instead of O(log n).

---

## Day 3 — Dashboard Analytics

### What I built
- `getSummary`: single `$group` stage computing income, expenses, net balance, savings rate
- `getByCategory`: groups by `{category, type}`, post-processes into `{income:[], expense:[]}` shape
- `getTrends`: extracts date parts with `$year`/`$month`/`$isoWeek`, merges income+expense rows via Map
- `getRecentActivity`: find() with sort+limit+populate
- `getOverview`: `$facet` pipeline — 4 sub-pipelines in 1 DB round trip

### Key decisions

**Aggregation pipeline over application-level computation**
All math (totals, averages, grouping) is done inside MongoDB aggregation stages. The alternative — fetching all transactions and computing in JavaScript — would transfer potentially thousands of records over the network for every dashboard load. Computation at the DB layer scales; application-level aggregation does not.

**`$facet` for the overview endpoint**
`$facet` runs multiple independent sub-pipelines on the same matched dataset in a single round trip. The alternative is 4 separate `aggregate()` calls, each with their own network latency. In a real system with concurrent users, this meaningfully reduces DB load. One call; four result sets.

**`savingsRate` computed inside `$project`**
`(income - expenses) / income * 100` is calculated by MongoDB, not by the application. Keeps the service layer thin and the business formula co-located with the data that drives it.

**`Map` for trend merging**
MongoDB returns one row per `{period, type}` combination. We need one row per period with both income and expenses. A `Map` keyed by period string allows find-or-create in O(1) per row, then a single Array.from pass to compute net. Clean and readable.

**Manual `isDeleted` filter in all pipelines**
Every `$match` stage includes `{ isDeleted: { $ne: true } }`. This is the aggregation equivalent of the `pre(/^find/)` hook — it just has to be explicit rather than automatic.

---

## Day 4 — Hardening, Security, Audit Log

### What I built
- Comprehensive error handler: 9 error types (ApiError, Mongoose validation, duplicate key, CastError, network error, JWT errors, body parse error, payload too large, unknown)
- `express-mongo-sanitize`: strips `$` and `.` from all user input — prevents NoSQL injection
- `hpp`: prevents HTTP parameter pollution (`?type=income&type=expense`)
- Body size limit: 10kb max — prevents payload flooding
- Request ID header (`X-Request-Id`) on every response for distributed tracing
- `AuditLog` model: append-only, records 9 action types with before/after state
- Fire-and-forget audit logger: never awaited, never blocks the main request
- Tiered rate limiting: auth (10/15min), dashboard (60/min), API (100/15min)
- Scoped CORS: wildcard in dev, explicit origins in production

### Key decisions

**Fire-and-forget audit logging**
The audit logger does not `await` the MongoDB write. If audit logging were synchronous and MongoDB was slow or momentarily unavailable, every create/update/delete operation would be delayed or fail. The audit is a side effect — the transaction must succeed regardless. A `.catch()` handler logs audit failures to the console without surfacing them to the client.

**Storing before/after state in audit changes**
A finance audit trail needs to show not just that a record changed, but what it looked like before and after. `{ before: {...}, after: {...} }` on every update enables forensic reconstruction of the record's history. This is the pattern required by SOX/GDPR compliance.

**`CastError` + proactive `validateObjectId` — two layers**
`validateObjectId` middleware checks the ID format before any DB query, returning a clean 400 early. The `CastError` handler in `errorHandler.js` catches anything that slips through other paths. Belt and suspenders.

**`entity.parse.failed` handler**
Without this, a request with malformed JSON body (`{ "key": }`) hits Express's body-parser and throws an error with `type: 'entity.parse.failed'`. Without a specific handler, this becomes a confusing 500. With it, it's a clean 400 with an actionable message.

**Error handler must have 4 params**
Express identifies error-handling middleware by function arity. `(err, req, res, next)` — all four are required even if `next` is unused. Three params = regular middleware, errors fall through silently.

---

## Overall Tradeoffs

**Chose MongoDB over PostgreSQL**
MongoDB's aggregation pipeline is a first-class feature for analytics queries. The dashboard service is cleaner with `$group`, `$facet`, and `$project` than it would be with raw SQL GROUP BY. For a finance system with structured data, PostgreSQL would be defensible — but the pipeline readability justified MongoDB here.

**Chose Joi over Zod**
Both are excellent. Joi has a more imperative, chainable API; Zod is TypeScript-first. Since this project is plain JavaScript, Joi's ergonomics are slightly better. Either could be swapped in under the `validate` middleware factory without touching routes or controllers.

**Stateless JWT, no refresh tokens**
Adding refresh tokens requires a token store (Redis or DB table), a refresh endpoint, and rotation logic. For this assessment, stateless JWT with 7-day expiry is the right tradeoff — keeps the auth surface area small and the code readable. Production would add refresh.

**No Redis caching**
Dashboard endpoints hit MongoDB aggregation pipelines on every request. A 5-minute TTL cache on `/summary` and `/overview` would dramatically reduce load. Not added because it requires a Redis instance and complicates the setup story. The indexes make the raw queries fast enough for assessment purposes.
