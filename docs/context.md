# Project Context

## What is ArthaGrid?

ArthaGrid is a backend API for tracking financial transactions. It lets people record money coming in and going out (transactions), and gives them dashboards that summarize their spending and income — totals, breakdowns by category, trends over time, and a quick overview.

Think of it as the engine behind a budgeting or finance-tracking product. It doesn't have a visual interface itself — it's a REST API that a website or mobile app would call.

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

- **Working:** registration/login with short-lived access tokens and revocable refresh tokens, role-based permissions, full CRUD for transactions (with soft delete and an audit trail of who created/updated/deleted each one), a full set of dashboard/analytics endpoints, and self-service plus admin-driven user management.
- **Automated tests:** a Jest + Supertest suite runs against an in-memory MongoDB (no real database needed to run tests), covering auth, RBAC, transaction CRUD, dashboard calculations, and user management. Wired into GitHub Actions so it runs on every push/PR.
- **Documented:** every route is described in an OpenAPI spec, browsable at `/api-docs` once the server is running.
- **Runnable via Docker:** `docker compose up` starts the API and a local MongoDB together, no local Node/Mongo install required.
- **Dev-only tooling:** `seed.js` fills the database with sample users and transactions for local testing; `clean.js` wipes it. Neither should ever be pointed at a production database.
- **Deliberately not built yet:** a full, immutable audit-log history (today's `updatedBy`/`deletedBy` fields record the *latest* actor, not every historical change); database-backed custom roles (the current three fixed roles are hard-coded, which is intentionally simple — see decisions.md); and the further finance-specific items listed at the end of upgrades.md. None of these were skipped by accident — each has a note explaining why it's not worth building until there's a concrete need for it.

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
