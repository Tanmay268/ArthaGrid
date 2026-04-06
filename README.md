# Finance Dashboard API

A production-quality REST API backend for a multi-role finance dashboard system. Built with Node.js, Express, MongoDB, and JWT — featuring RBAC, aggregation-powered analytics, soft deletes, audit logging, input validation, and Swagger documentation.

---

## Quick Start

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

## References

- Sandhu et al. (1996). *Role-Based Access Control Models*. IEEE Computer. — foundational RBAC paper: https://csrc.nist.gov/csrc/media/projects/role-based-access-control/documents/sandhu96.pdf
- NIST RBAC Standard: https://csrc.nist.gov/projects/role-based-access-control
- MongoDB Aggregation Pipeline: https://www.mongodb.com/docs/manual/aggregation/
- Express Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
