const { getSummary, getTrends } = require('./dashboard.service');
const { getBudgets } = require('./budget.service');
const { mean, stddev } = require('../utils/stats');

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));

// Turns a series of monthly values into a 0-100 "stability" score using the
// coefficient of variation (stddev / mean) — a CV of 0 (dead flat) scores
// 100, a CV of 1 or more (the series swings by its own average or more)
// scores 0. Returns a neutral 50 when there isn't enough history to judge
// either way, rather than unfairly rewarding or punishing a new account.
const stabilityScoreFromSeries = (values) => {
    if (values.length < 2) return 50;
    const avg = mean(values);
    if (avg === 0) return 50;
    const coefficientOfVariation = Math.abs(stddev(values) / avg);
    return clamp(round1(100 - coefficientOfVariation * 100));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/health-score
//
// A transparent, weighted score — documented as an ArthaGrid metric with a
// published formula, not an objective financial truth (see makeItBetter.md
// item 6 and decisions.md). "Emergency reserve" is approximated as months
// of runway, since this system has no real account-balance concept to
// check against directly — that simplification is stated here rather than
// hidden inside the number.
// ─────────────────────────────────────────────────────────────────────────────

const getHealthScore = async () => {
    const [summary, trends, budgets] = await Promise.all([
        getSummary(),
        getTrends({ period: 'monthly' }),
        getBudgets(),
    ]);

    const recentMonths = trends.slice(-6);

    const savingsRateScore = clamp(round1(summary.savingsRate));
    const cashFlowStability = stabilityScoreFromSeries(recentMonths.map((m) => m.net));
    const spendingConsistency = stabilityScoreFromSeries(recentMonths.map((m) => m.expenses));

    const activeBudgets = budgets.filter((b) => b.isActive);
    const budgetAdherence = activeBudgets.length
        ? round1((activeBudgets.filter((b) => !b.isOverBudget).length / activeBudgets.length) * 100)
        : 50; // no budgets set yet — neutral, not a penalty for a feature the user hasn't used

    const avgMonthlyExpense = recentMonths.length ? mean(recentMonths.map((m) => m.expenses)) : 0;
    const monthsOfRunway = avgMonthlyExpense > 0
        ? (summary.totalIncome - summary.totalExpenses) / avgMonthlyExpense
        : 0;
    // 6 months of runway is a common "fully funded emergency fund" rule of
    // thumb, used here only as the point where this component maxes out.
    const emergencyReserve = clamp(round1((monthsOfRunway / 6) * 100));

    const score = clamp(round1(
        savingsRateScore * 0.30 +
        cashFlowStability * 0.25 +
        spendingConsistency * 0.20 +
        budgetAdherence * 0.15 +
        emergencyReserve * 0.10
    ));

    const rating = score >= 80 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : score >= 40 ? 'FAIR' : 'NEEDS ATTENTION';

    return {
        score,
        rating,
        components: {
            savingsRate: savingsRateScore,
            cashFlowStability,
            spendingConsistency,
            budgetAdherence,
            emergencyReserve,
        },
        methodology:
            'ArthaGrid Financial Health Score = 30% savings rate + 25% cash-flow stability ' +
            '+ 20% spending consistency + 15% budget adherence + 10% emergency reserve ' +
            '(approximated as months of runway ÷ 6). This is an ArthaGrid-defined metric, ' +
            'not a certified financial rating.',
    };
};

module.exports = { getHealthScore };
