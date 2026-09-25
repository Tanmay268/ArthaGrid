const { Transaction } = require('../models/Transaction');

const MIN_OCCURRENCES = 3;
const AMOUNT_TOLERANCE = 0.1; // 10% — amounts within this range of each other count as "the same" charge
const INTERVAL_TOLERANCE_DAYS = 4;

const KNOWN_INTERVALS = [
    { label: 'weekly', days: 7 },
    { label: 'monthly', days: 30 },
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Prefer grouping by merchant when it's set (accurate — "Netflix" is
// "Netflix"), falling back to category when it isn't (older transactions,
// or anyone who skips the optional field).
const groupKey = (t) => (t.merchant ? `merchant:${t.merchant.toLowerCase().trim()}` : `category:${t.category}`);

// A category-only group can contain totally unrelated expenses (e.g. two
// different one-off "food" purchases that happen to recur by coincidence),
// so it's further split into clusters of similar amounts before checking
// for a regular interval. A merchant-based group doesn't need this, since
// the merchant name already does that narrowing.
const clusterBySimilarAmount = (items) => {
    const sorted = [...items].sort((a, b) => a.amount - b.amount);
    const clusters = [];
    let current = [];

    for (const item of sorted) {
        const fitsCurrentCluster = current.length > 0
            && Math.abs(item.amount - current[0].amount) <= current[0].amount * AMOUNT_TOLERANCE;

        if (fitsCurrentCluster) {
            current.push(item);
        } else {
            if (current.length) clusters.push(current);
            current = [item];
        }
    }
    if (current.length) clusters.push(current);

    return clusters.map((c) => c.sort((a, b) => a.date - b.date));
};

const detectInterval = (dayGaps) => {
    for (const { label, days } of KNOWN_INTERVALS) {
        if (dayGaps.every((gap) => Math.abs(gap - days) <= INTERVAL_TOLERANCE_DAYS)) {
            return label;
        }
    }
    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/recurring — subscriptions, rent, and other regular charges
// ─────────────────────────────────────────────────────────────────────────────

const getRecurringExpenses = async () => {
    const transactions = await Transaction.find({ type: 'expense' })
        .select('amount category merchant date')
        .sort({ date: 1 })
        .lean();

    const groups = new Map();
    for (const t of transactions) {
        const key = groupKey(t);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }

    const recurring = [];

    for (const [key, items] of groups) {
        if (items.length < MIN_OCCURRENCES) continue;

        const clusters = key.startsWith('merchant:') ? [items] : clusterBySimilarAmount(items);

        for (const cluster of clusters) {
            if (cluster.length < MIN_OCCURRENCES) continue;

            const gaps = [];
            for (let i = 1; i < cluster.length; i++) {
                gaps.push((cluster[i].date - cluster[i - 1].date) / (1000 * 60 * 60 * 24));
            }

            const interval = detectInterval(gaps);
            if (!interval) continue;

            const amounts = cluster.map((c) => c.amount);
            recurring.push({
                merchant: cluster[0].merchant || null,
                category: cluster[0].category,
                averageAmount: round2(amounts.reduce((a, b) => a + b, 0) / amounts.length),
                interval,
                occurrences: cluster.length,
                lastDate: cluster[cluster.length - 1].date,
            });
        }
    }

    return recurring.sort((a, b) => b.averageAmount - a.averageAmount);
};

module.exports = { getRecurringExpenses };
