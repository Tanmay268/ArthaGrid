const { Transaction } = require('../models/Transaction');
const anomalyService = require('./anomaly.service');
const budgetService = require('./budget.service');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// Income/expense totals for [from, to), soft-deleted rows excluded
// (aggregate() bypasses the model's soft-delete hook, hence the explicit match).
const totalsBetween = async (from, to) => {
    const rows = await Transaction.aggregate([
        { $match: { isDeleted: { $ne: true }, date: { $gte: from, $lt: to } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const get = (type) => round2(rows.find((r) => r._id === type)?.total || 0);
    return { income: get('income'), expenses: get('expense') };
};

const expenseByCategory = async (from, to) => {
    const rows = await Transaction.aggregate([
        { $match: { isDeleted: { $ne: true }, type: 'expense', date: { $gte: from, $lt: to } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
    ]);
    return new Map(rows.map((r) => [r._id, round2(r.total)]));
};

const percentChange = (current, previous) => (previous > 0 ? round2(((current - previous) / previous) * 100) : null);

// ─────────────────────────────────────────────────────────────────────────────
// A rolling 7-day report (the 7 days up to `endDate`) compared against the 7
// days before that. Aggregates only — no descriptions or merchants — so the
// same object is safe to render into an email or an in-app card.
//
// The ledger is one shared pool (no per-user data), so every recipient
// receives the same report.
// ─────────────────────────────────────────────────────────────────────────────

const getWeeklyReport = async (endDate = new Date()) => {
    const end = new Date(endDate);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const prevStart = new Date(end.getTime() - 14 * DAY_MS);

    const [current, previous, thisWeekCats, lastWeekCats, anomalies, budgets] = await Promise.all([
        totalsBetween(start, end),
        totalsBetween(prevStart, start),
        expenseByCategory(start, end),
        expenseByCategory(prevStart, start),
        anomalyService.getAnomalies(),
        budgetService.getBudgets(),
    ]);

    const [topCategory, topAmount] = [...thisWeekCats.entries()][0] || [null, 0];
    const categoryChanges = [...thisWeekCats.entries()]
        .map(([category, total]) => ({
            category,
            total,
            previous: lastWeekCats.get(category) || 0,
            changePercent: percentChange(total, lastWeekCats.get(category) || 0),
        }))
        .slice(0, 5);

    const weekAnomalies = anomalies.filter((a) => new Date(a.date) >= start && new Date(a.date) < end);
    const activeBudgets = budgets.filter((b) => b.isActive);

    return {
        period: { start: start.toISOString(), end: end.toISOString() },
        income: current.income,
        expenses: current.expenses,
        savings: round2(current.income - current.expenses),
        vsLastWeek: {
            incomeChangePercent: percentChange(current.income, previous.income),
            expensesChangePercent: percentChange(current.expenses, previous.expenses),
        },
        topCategory: topCategory ? { category: topCategory, total: topAmount } : null,
        categoryChanges,
        unusualTransactions: {
            count: weekAnomalies.length,
            // amount + category only — never description/merchant
            top: weekAnomalies.slice(0, 3).map((a) => ({ category: a.category, amount: a.amount })),
        },
        budgets: {
            total: activeBudgets.length,
            withinLimit: activeBudgets.filter((b) => !b.isOverBudget).length,
            overBudget: activeBudgets.filter((b) => b.isOverBudget).map((b) => b.category),
        },
    };
};

module.exports = { getWeeklyReport };
