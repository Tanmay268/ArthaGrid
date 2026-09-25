const { Transaction } = require('../models/Transaction');
const { mean, stddev, zScore } = require('../utils/stats');

// How many standard deviations from a category's average amount counts as
// "unusual." 2.5 is a common statistical convention for flagging outliers
// without being trigger-happy on everyday variation.
const Z_THRESHOLD = 2.5;

// Never judge a transaction against a category with too little history —
// with only a couple of data points, "unusual" is meaningless noise.
const MIN_SAMPLE_SIZE = 5;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// Score a single transaction against its category's historical amounts.
// Used synchronously when a transaction is created (see transaction.service.js)
// to attach a non-blocking "this looks unusual" hint to the response.
// ─────────────────────────────────────────────────────────────────────────────

const scoreTransaction = async (category, amount, excludeId = null) => {
    const query = { category, type: 'expense' };
    if (excludeId) query._id = { $ne: excludeId };

    const rows = await Transaction.find(query).select('amount').lean();
    const values = rows.map((r) => r.amount);

    if (values.length < MIN_SAMPLE_SIZE) {
        return { flagged: false, score: 0, sampleSize: values.length };
    }

    const score = zScore(amount, mean(values), stddev(values));

    return {
        flagged: Math.abs(score) > Z_THRESHOLD,
        score: round2(score),
        sampleSize: values.length,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/anomalies — every currently-flagged expense transaction,
// computed live (no persistence — see decisions.md #18 on why there's no
// background job to pre-compute this).
// ─────────────────────────────────────────────────────────────────────────────

const getAnomalies = async () => {
    const categories = await Transaction.distinct('category', { type: 'expense' });
    const flagged = [];

    for (const category of categories) {
        const transactions = await Transaction.find({ category, type: 'expense' })
            .select('amount category merchant date description')
            .lean();

        // Need at least MIN_SAMPLE_SIZE *other* transactions to judge each
        // one against — one more than that in total.
        if (transactions.length < MIN_SAMPLE_SIZE + 1) continue;

        const n = transactions.length;
        const sum = transactions.reduce((s, t) => s + t.amount, 0);
        const sumOfSquares = transactions.reduce((s, t) => s + t.amount ** 2, 0);

        for (const t of transactions) {
            // Leave-one-out: score each transaction against every *other*
            // transaction in its category, not against a population that
            // already includes (and, for a real outlier, is skewed by)
            // itself — otherwise a single extreme value inflates its own
            // stddev enough that it can mathematically never cross the
            // threshold at small sample sizes.
            const otherCount = n - 1;
            const otherMean = (sum - t.amount) / otherCount;
            const otherVariance = (sumOfSquares - t.amount ** 2) / otherCount - otherMean ** 2;
            const otherStddev = Math.sqrt(Math.max(0, otherVariance));

            const score = zScore(t.amount, otherMean, otherStddev);
            if (Math.abs(score) > Z_THRESHOLD) {
                flagged.push({ ...t, zScore: round2(score) });
            }
        }
    }

    return flagged.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
};

module.exports = { scoreTransaction, getAnomalies, Z_THRESHOLD, MIN_SAMPLE_SIZE };
