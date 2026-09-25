const { getTrends } = require('./dashboard.service');
const { getMonthlyHistoryFromPostgres } = require('./rollup.service');
const { linearRegression, movingAverage } = require('../utils/stats');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/forecast?months=3&metric=expenses
//
// Deliberately simple, explainable methods (see decisions.md and
// upgrades.md) — a moving average and a linear regression over monthly
// history — rather than a heavier model. Both are shown side by side so the
// reasoning stays visible instead of hidden behind a single number.
//
// History prefers the Postgres rollup (fast, pre-computed) when it's been
// populated, and transparently falls back to computing live from MongoDB
// otherwise — before Postgres is configured, before the first scheduled
// rollup has run, or if Postgres is just unreachable. Either way the
// response says which one was actually used (see decisions.md #17).
// ─────────────────────────────────────────────────────────────────────────────

const getForecast = async ({ months = 3, metric = 'expenses' } = {}) => {
    const rollupHistory = await getMonthlyHistoryFromPostgres();
    const history = rollupHistory ?? await getTrends({ period: 'monthly' });
    const source = rollupHistory ? 'postgres_rollup' : 'mongodb_live';

    const values = history.map((h) => h[metric] ?? 0);

    if (values.length < 2) {
        return {
            method: 'insufficient_data',
            source,
            metric,
            history,
            forecast: [],
            message: 'Need at least 2 months of history to forecast — keep tracking to unlock this.',
        };
    }

    const points = values.map((y, x) => ({ x, y }));
    const { slope, intercept } = linearRegression(points);

    const windowSize = Math.min(3, values.length);
    const lastMovingAverage = movingAverage(values, windowSize).at(-1);

    const forecast = [];
    for (let i = 1; i <= months; i++) {
        const x = values.length - 1 + i;
        forecast.push({
            monthsAhead: i,
            // Never project a negative amount of money.
            linearRegression: Math.max(0, round2(slope * x + intercept)),
            // The moving-average method just holds the recent average flat —
            // a deliberately simpler baseline to compare the trend line against.
            movingAverage: round2(lastMovingAverage),
        });
    }

    return {
        method: 'linear_regression + moving_average',
        source,
        metric,
        history,
        forecast,
    };
};

module.exports = { getForecast };
