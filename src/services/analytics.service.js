const { Transaction } = require('../models/Transaction');
const { buildDateMatch } = require('./dashboard.service');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const AVG_DAYS_PER_MONTH = 30.44;

// ─────────────────────────────────────────────────────────────────────────────
// Weekday vs weekend expense spending
// ─────────────────────────────────────────────────────────────────────────────

const getWeekdayVsWeekend = async ({ startDate, endDate } = {}) => {
    const match = { ...buildDateMatch(startDate, endDate), type: 'expense' };

    const rows = await Transaction.aggregate([
        { $match: match },
        {
            $project: {
                amount: 1,
                // $dayOfWeek: 1 = Sunday ... 7 = Saturday
                isWeekend: { $in: [{ $dayOfWeek: '$date' }, [1, 7]] },
            },
        },
        {
            $group: {
                _id: '$isWeekend',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
    ]);

    const weekend = rows.find((r) => r._id === true) || { total: 0, count: 0 };
    const weekday = rows.find((r) => r._id === false) || { total: 0, count: 0 };

    return {
        weekday: { total: round2(weekday.total), avgPerDay: weekday.count ? round2(weekday.total / weekday.count) : 0 },
        weekend: { total: round2(weekend.total), avgPerDay: weekend.count ? round2(weekend.total / weekend.count) : 0 },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// This month vs last month, per category (expenses only)
// ─────────────────────────────────────────────────────────────────────────────

const getCategoryGrowth = async () => {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const rows = await Transaction.aggregate([
        { $match: { type: 'expense', date: { $gte: startLastMonth, $lte: now } } },
        {
            $group: {
                _id: {
                    category: '$category',
                    period: { $cond: [{ $gte: ['$date', startThisMonth] }, 'thisMonth', 'lastMonth'] },
                },
                total: { $sum: '$amount' },
            },
        },
    ]);

    const byCategory = new Map();
    for (const row of rows) {
        const { category, period } = row._id;
        if (!byCategory.has(category)) {
            byCategory.set(category, { category, thisMonth: 0, lastMonth: 0 });
        }
        byCategory.get(category)[period] = round2(row.total);
    }

    return Array.from(byCategory.values())
        .map((c) => {
            const changePercent = c.lastMonth > 0
                ? round2(((c.thisMonth - c.lastMonth) / c.lastMonth) * 100)
                : (c.thisMonth > 0 ? 100 : 0);
            return { ...c, changePercent };
        })
        .sort((a, b) => b.changePercent - a.changePercent);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/metrics — expanded financial + behavioral + comparative metrics
// ─────────────────────────────────────────────────────────────────────────────

const getMetrics = async ({ startDate, endDate } = {}) => {
    const match = buildDateMatch(startDate, endDate);

    const [totals] = await Transaction.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
                totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
                minDate: { $min: '$date' },
                maxDate: { $max: '$date' },
            },
        },
    ]);

    const totalIncome = totals?.totalIncome || 0;
    const totalExpenses = totals?.totalExpenses || 0;

    // Span of the data, in days — at least 1 to avoid dividing by zero on a
    // single day's worth of transactions.
    const days = totals
        ? Math.max(1, Math.round((totals.maxDate - totals.minDate) / (1000 * 60 * 60 * 24)) + 1)
        : 1;
    const months = Math.max(1, days / AVG_DAYS_PER_MONTH);

    const categoryTotals = await Transaction.aggregate([
        { $match: { ...match, type: 'expense' } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
    ]);

    const mostExpensiveCategory = categoryTotals[0]?._id ?? null;
    const mostFrequentCategory = categoryTotals.length
        ? [...categoryTotals].sort((a, b) => b.count - a.count)[0]._id
        : null;

    const [weekdayVsWeekend, categoryGrowth] = await Promise.all([
        getWeekdayVsWeekend({ startDate, endDate }),
        getCategoryGrowth(),
    ]);

    return {
        burnRate: round2(totalExpenses / months),
        expenseToIncomeRatio: totalIncome > 0 ? round2(totalExpenses / totalIncome) : null,
        avgDailySpending: round2(totalExpenses / days),
        avgMonthlySpending: round2(totalExpenses / months),
        mostExpensiveCategory,
        mostFrequentCategory,
        weekdayVsWeekend,
        categoryGrowth,
    };
};

module.exports = { getMetrics, getWeekdayVsWeekend, getCategoryGrowth };
