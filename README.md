# ArthaGrid

A secure REST API for tracking financial transactions — the backend for a budgeting or finance-tracking product. It handles authentication, role-based access, transaction CRUD with a full audit trail, and dashboard analytics.

"Artha" is Sanskrit for wealth or prosperity; "Grid" suggests a structured system.

## Features

- **JWT authentication** with short-lived access tokens and revocable, rotating refresh tokens
- **Role-based access control** — Viewer, Analyst, and Admin roles with distinct permissions
- **Transactions** — full CRUD with soft delete and an audit trail (who created/updated/deleted, and when)
- **Dashboard analytics** — summaries, category breakdowns, trends, recent activity
- **User management** — self-service profile updates plus admin-driven user control
- **Hardened by default** — Helmet, CORS, rate limiting, NoSQL injection sanitization, structured logging (Pino), environment validation, graceful shutdown
- **API docs** via Swagger UI at `/api-docs`

See [docs/context.md](docs/context.md) for the full project rationale, [docs/architecture.md](docs/architecture.md) for system design, and [docs/decisions.md](docs/decisions.md) for the reasoning behind key technical choices.

## Tech stack

Node.js, Express, MongoDB (Mongoose), JWT, Joi, Pino, Jest + Supertest.

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

## API overview

All endpoints are versioned under `/api/v1`. Full request/response schemas are in [docs/openapi.yaml](docs/openapi.yaml), browsable at `/api-docs`.

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/v1/auth` | `register`, `login`, `refresh`, `logout` |
| Transactions | `/api/v1/transactions` | CRUD, role-gated (read: all roles, write/delete: Admin) |
| Dashboard | `/api/v1/dashboard` | `summary`, `by-category`, `trends`, `recent`, `overview` |
| Users | `/api/v1/users` | `me` for self-service; admin-only listing and management |

### Roles

| Role | Access |
|---|---|
| **Viewer** | Read-only on transactions and dashboards; manage own profile |
| **Analyst** | Same as Viewer, plus analytics access |
| **Admin** | Full control over transactions and user management |

## Project structure

```
src/
  config/       # env validation, DB connection, logger
  controllers/  # request handlers
  services/     # business logic
  models/       # Mongoose schemas
  middleware/   # auth, authorization, validation, error handling
  routes/v1/    # route definitions
  validators/   # Joi schemas
docs/           # architecture, decisions, and OpenAPI spec
tests/          # Jest + Supertest suite
```
