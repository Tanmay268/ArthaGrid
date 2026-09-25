# Project Context

## What is ArthaGrid?

ArthaGrid is a personal-finance analytics platform: an API plus a React dashboard (`frontend/`) that together let people record money coming in and going out, and understand what that money is doing — totals, category breakdowns, trends, budgets, spending forecasts, unusual-transaction flags, a Financial Health Score, plain-language insights, and an AI assistant that answers questions like "why did my expenses go up?"

The API (`src/`) is the engine; the dashboard is the first visual interface built on top of it — though the API is still a normal REST API any other website or mobile app could call directly instead.

"Artha" is a Sanskrit word meaning wealth or prosperity, and "Grid" suggests a structured system — so the name roughly means "a structured system for managing wealth."

## Who uses it

The system is built around three roles, which fits a small finance team as much as a single user — someone entering transactions, someone reviewing the numbers, and someone with full administrative control:

| Role | What they can do |
|---|---|
| **Viewer** | Read-only access to transactions and dashboards, plus managing their own profile. Good for someone who just needs to see the numbers. |
| **Analyst** | Same as Viewer, plus access to deeper analytics. Good for someone reviewing the data but not changing it. |
| **Admin** | Full control — create, edit, and soft-delete transactions, and manage other users' roles and active status. |

## Building this for a finance company

The project is explicitly aimed at the standard a finance company should hold a backend to, not just a working demo. Concretely, that shaped a set of choices beyond "does it work":

- **Every financial record says who touched it, and when.** Transactions record who created them, who last updated them, and — since they're never actually deleted — who removed them and when. This is a baseline expectation for anything holding money data: you should always be able to explain how a number got the way it is.
- **Sessions can be cut off, not just left to expire.** Login no longer hands out one long-lived token with no way to revoke it. A short-lived access token plus a revocable, rotating refresh token means a compromised session can be shut down immediately, and reusing a stolen token is detected and treated as an incident (see [decisions.md](./decisions.md) for how).
- **Nothing sensitive gets logged.** Passwords are never printed anywhere, and error responses never leak stack traces or internal details to a client outside of local development.
- **The system fails loudly and immediately when misconfigured**, rather than quietly doing the wrong thing in production. A missing or too-short JWT secret, for example, stops the server from starting at all.
- **What's still missing is written down, not hidden.** [upgrades.md](./upgrades.md) has a section specifically calling out what a finance company would still want beyond what's built (idempotency keys, storing money as integer cents, encryption at rest, per-organization data isolation, MFA for admins) — so the gap between "production-ready API" and "ready for real regulated money" stays visible rather than assumed away.

## Current state of the project

- **Working:** registration/login with short-lived access tokens and revocable refresh tokens (the refresh token also set as an httpOnly cookie for the browser), role-based permissions, full CRUD for transactions (with soft delete and an audit trail of who created/updated/deleted each one, plus an optional `merchant` field), a full set of dashboard/analytics endpoints, budgets with live progress tracking, an expanded analytics engine (metrics, forecasting, anomaly detection, recurring-expense detection, a Financial Health Score, and rule-based insights), an optional Postgres rollup pipeline that speeds up the forecast endpoint once connected, an optional AI Financial Copilot for plain-language Q&A, a React dashboard (`frontend/`) covering all of the above, and self-service plus admin-driven user management.
- **Automated tests:** a Jest + Supertest suite runs against an in-memory MongoDB (no real database needed to run tests), covering auth (including the refresh-token cookie and its CSRF guard), RBAC, transaction CRUD, dashboard calculations, budgets, the analytics engine, the rollup endpoint's auth guard, the AI copilot's privacy guarantee (via a mocked Gemini call), and user management. Wired into GitHub Actions so it runs on every push/PR. The frontend is verified by `tsc` (zero type errors) and a production `vite build`, rather than a separate frontend test suite.
- **Documented:** every route is described in an OpenAPI spec, browsable at `/api-docs` once the server is running.
- **Runnable via Docker:** `docker compose up` starts the API and a local MongoDB together, no local Node/Mongo install required.
- **Dev-only tooling:** `seed.js` fills the database with sample users, transactions, and budgets for local testing (including a deliberately unusual transaction and recurring monthly charges, so anomaly/recurring detection have something real to find); `clean.js` wipes it. Neither should ever be pointed at a production database.
- **Deliberately not built yet:** a full, immutable audit-log history (today's `updatedBy`/`deletedBy` fields record the *latest* actor, not every historical change); database-backed custom roles (the current three fixed roles are hard-coded, which is intentionally simple — see decisions.md); and the further finance-specific items listed at the end of upgrades.md. None of these were skipped by accident — each has a note explaining why it's not worth building until there's a concrete need for it.

## What's new in ArthaGrid 2.0

The project moved beyond "an API that stores transactions and totals them up" toward a real personal-finance product: one that notices things about someone's money, not just reports numbers back — a proper analytics layer, budgets, a financial health score, forecasting, anomaly detection, a small AI assistant that answers plain-language questions like "why did my expenses go up?", and an actual visual dashboard (a React frontend), instead of only a REST API a developer could talk to. All four build stages (A–D) are now complete — see [upgrades.md](./upgrades.md) for the detailed history of what was built in each.

The one hard constraint driving every choice here: **the whole thing has to keep running for free.** That ruled out a lot of the "how a big company would build this" answers — a fleet of microservices, a job-queue-and-worker pipeline, self-hosted monitoring — because none of those are actually free to run continuously. Where a bigger-scale answer wasn't realistic on a free tier, a smaller, honest equivalent was chosen instead, and written down as a deliberate trade-off rather than pretended away:

- **Analytics stay inside the same service**, not split into separate microservices — one free web service instead of several.
- **A second, free database (Postgres) holds only one pre-computed analytics number set** — monthly totals — rebuilt on a schedule from the main MongoDB data. Not a second source of truth, just a faster place to read history from; connecting it is optional, and everything computes live from MongoDB when it isn't connected.
- **A scheduled GitHub Actions job stands in for a background worker**, since free hosting doesn't include a free always-on worker process.
- **The AI copilot only ever sees pre-computed summary numbers**, never raw transactions — because sending real financial detail to a third-party AI service, even a free one, is not something to do without a clear line drawn around what's shared. This is checked by an automated test, not just documented.
- **The frontend and API are deployed on different domains** (Vercel and Render), which meant correcting a piece of the original plan while building it: the refresh-token cookie needed `SameSite=None` instead of the originally planned `Strict` to work cross-domain at all, which in turn needed a small CSRF-mitigating header to stay safe. See [decisions.md](./decisions.md) #21 for the full story.

None of the pieces above are "activated" until you actually create the matching free account and set its environment variable (Neon for Postgres, Google AI Studio for Gemini, Render/Vercel for hosting) — see [deployment.md](./deployment.md). The code and tests are what's "built"; the account is a separate, deliberate step you take when you're ready to actually deploy.

See [decisions.md](./decisions.md) (entries #17–21) for the full reasoning behind each of these, and [upgrades.md](./upgrades.md) for exactly what's built vs. what's still on the roadmap (auto-categorization, scheduled email reports, an admin analytics dashboard, and a few other items from the original wishlist were deliberately left for later — the reasons are listed there, not hidden).

## Why this project exists

The purpose is to build a properly structured, secure Node.js/Express/MongoDB API to the standard a real finance product would need — not a quick script, but a foundation with the layered architecture, input validation, centralized error handling, RBAC, auditability, and operational hardening (structured logging, graceful shutdown, environment validation, containerization) that a production finance system is expected to have.

See [decisions.md](./decisions.md) for the reasoning behind specific technical choices, [architecture.md](./architecture.md) for how the system is put together, and [upgrades.md](./upgrades.md) for the full list of what's been hardened and what's intentionally still open.

## Glossary

- **Access token:** A short-lived (15 minutes by default) signed token proving who a user is, sent with every request. Short-lived on purpose — if one is stolen, the exposure window is small.
- **Refresh token:** A longer-lived (7 days by default) token used only to obtain a new access token, without the user having to log in again. Unlike the access token, it's tracked in the database (as a hash, never the raw value) so it can be revoked.
- **Token rotation:** Every time a refresh token is used, it's invalidated and replaced with a new one. If the old one is ever presented again, that's treated as a sign of theft and every session for that user is cut off.
- **RBAC (Role-Based Access Control):** Deciding what someone can do based on their role (viewer/analyst/admin), rather than checking each person individually.
- **Soft delete:** Instead of actually removing a record from the database, it's marked as deleted (`isDeleted: true`) and hidden from normal queries, along with when and by whom. The data is still there if needed later — a financial record should never simply disappear.
- **Aggregation pipeline:** A MongoDB feature for doing calculations (sums, averages, grouping) directly in the database instead of pulling all the data out and calculating in code.
- **Middleware:** A function that runs in between a request arriving and the final response being sent — used here for security headers, request sanitization, authentication, permission checks, and input validation.
- **Structured logging:** Log output written as leveled, machine-parseable records (via Pino) instead of plain `console.log` text, so it can be filtered and searched once the app is running somewhere other than a developer's terminal.
