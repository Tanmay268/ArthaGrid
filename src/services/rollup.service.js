const { Transaction } = require('../models/Transaction');
const { getPool, isConfigured } = require('../config/postgres');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─────────────────────────────────────────────────────────────────────────────
// Compute every month's totals from MongoDB — the source of truth. Mirrors
// dashboard.service.js's getTrends(), but returns every month at once
// (no date filtering) since the rollup always rebuilds the full history.
// ─────────────────────────────────────────────────────────────────────────────

const computeMonthlyMetrics = async () => {
    const rows = await Transaction.aggregate([
        {
            $group: {
                _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
                totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
                transactionCount: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return rows.map((r) => ({
        monthKey: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
        year: r._id.year,
        month: r._id.month,
        totalIncome: round2(r.totalIncome),
        totalExpenses: round2(r.totalExpenses),
        net: round2(r.totalIncome - r.totalExpenses),
        transactionCount: r.transactionCount,
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/internal/jobs/rollup — rebuilds monthly_metrics in Postgres.
//
// Safe to run repeatedly (every write is an upsert) and safe to call when
// Postgres isn't configured at all — it just reports that it skipped,
// rather than erroring, since Postgres is optional infrastructure
// (see decisions.md #17).
// ─────────────────────────────────────────────────────────────────────────────

const runRollup = async () => {
    if (!isConfigured()) {
        return { skipped: true, reason: 'POSTGRES_URL not configured' };
    }

    const pool = getPool();
    if (!pool) {
        return { skipped: true, reason: 'Postgres connection not available' };
    }

    const monthlyRows = await computeMonthlyMetrics();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const row of monthlyRows) {
            await client.query(
                `INSERT INTO monthly_metrics
                    (month_key, year, month, total_income, total_expenses, net, transaction_count, computed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 ON CONFLICT (month_key) DO UPDATE SET
                    total_income = EXCLUDED.total_income,
                    total_expenses = EXCLUDED.total_expenses,
                    net = EXCLUDED.net,
                    transaction_count = EXCLUDED.transaction_count,
                    computed_at = NOW()`,
                [row.monthKey, row.year, row.month, row.totalIncome, row.totalExpenses, row.net, row.transactionCount]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return { skipped: false, monthsWritten: monthlyRows.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// Read path used by forecast.service.js — returns the same shape as
// dashboard.service.js's getTrends({ period: 'monthly' }), so callers can
// treat a Postgres-backed history and a MongoDB-computed one identically.
// Returns null (never an empty array) when there's nothing to prefer yet,
// so callers know to fall back to computing live from MongoDB instead.
// ─────────────────────────────────────────────────────────────────────────────

const getMonthlyHistoryFromPostgres = async () => {
    if (!isConfigured()) return null;

    const pool = getPool();
    if (!pool) return null;

    const { rows } = await pool.query(
        'SELECT month_key, year, month, total_income, total_expenses, net FROM monthly_metrics ORDER BY year ASC, month ASC'
    );
    if (rows.length === 0) return null;

    return rows.map((r) => ({
        period: r.month_key,
        label: `${MONTH_NAMES[r.month - 1]} ${r.year}`,
        income: Number(r.total_income),
        expenses: Number(r.total_expenses),
        net: Number(r.net),
    }));
};

module.exports = { runRollup, getMonthlyHistoryFromPostgres, computeMonthlyMetrics };
