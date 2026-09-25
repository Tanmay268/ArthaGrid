-- ArthaGrid analytics rollups (Postgres, e.g. hosted free on Neon).
--
-- Everything in this file is DERIVED and REBUILDABLE from MongoDB — MongoDB
-- stays the only system of record (see docs/decisions.md #17). If this
-- database were wiped entirely, the next scheduled rollup
-- (POST /api/v1/internal/jobs/rollup) would recreate it from scratch.
--
-- Run automatically at server startup when POSTGRES_URL is configured (see
-- src/config/postgres.js) — there is no separate migration step, and
-- CREATE TABLE IF NOT EXISTS makes this safe to run on every boot.

CREATE TABLE IF NOT EXISTS monthly_metrics (
    month_key         TEXT PRIMARY KEY,       -- e.g. '2024-03'
    year              INTEGER NOT NULL,
    month             INTEGER NOT NULL,       -- 1-12
    total_income      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_expenses    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net               NUMERIC(14, 2) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
