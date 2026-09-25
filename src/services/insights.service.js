const analyticsService = require('./analytics.service');
const forecastService = require('./forecast.service');
const anomalyService = require('./anomaly.service');
const recurringService = require('./recurring.service');
const budgetService = require('./budget.service');

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);
const inr = (n) => Math.round(n).toLocaleString('en-IN');

// Only surface a weekday/weekend difference worth mentioning — a 2% wobble
// isn't an "insight," it's noise.
const WEEKEND_DIFF_THRESHOLD_PERCENT = 10;

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/insights
//
// Rule-based, computed live per request from the same services every other
// analytics endpoint uses — no ML, no persistence, no push notifications
// (those need a background worker, which is out of scope on free-tier
// hosting — see decisions.md #18). Each rule is independent and only adds
// an insight when there's actually something worth saying.
// ─────────────────────────────────────────────────────────────────────────────

const getInsights = async () => {
    const [metrics, forecast, anomalies, recurring, budgets] = await Promise.all([
        analyticsService.getMetrics(),
        forecastService.getForecast({ months: 1 }),
        anomalyService.getAnomalies(),
        recurringService.getRecurringExpenses(),
        budgetService.getBudgets(),
    ]);

    const insights = [];

    addWeekdayVsWeekendInsight(insights, metrics);
    addCategoryGrowthInsight(insights, metrics);
    addBudgetPaceInsights(insights, budgets);
    addForecastInsight(insights, forecast);
    addAnomalyInsight(insights, anomalies);
    addRecurringInsight(insights, recurring);

    return insights;
};

const addWeekdayVsWeekendInsight = (insights, metrics) => {
    const { weekday, weekend } = metrics.weekdayVsWeekend;
    if (weekday.avgPerDay <= 0) return;

    const diffPercent = Math.round(((weekend.avgPerDay - weekday.avgPerDay) / weekday.avgPerDay) * 100);
    if (Math.abs(diffPercent) < WEEKEND_DIFF_THRESHOLD_PERCENT) return;

    insights.push({
        type: 'spending',
        text: `Your weekend spending is ${Math.abs(diffPercent)}% ${diffPercent > 0 ? 'higher' : 'lower'} than your weekday spending.`,
        data: { weekdayAvgPerDay: weekday.avgPerDay, weekendAvgPerDay: weekend.avgPerDay },
    });
};

const addCategoryGrowthInsight = (insights, metrics) => {
    const topGrowth = metrics.categoryGrowth[0];
    if (!topGrowth || topGrowth.changePercent <= 0) return;

    insights.push({
        type: 'category',
        text: `${capitalize(topGrowth.category)} is currently your fastest-growing expense category, up ${topGrowth.changePercent}% from last month.`,
        data: topGrowth,
    });
};

const addBudgetPaceInsights = (insights, budgets) => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    for (const budget of budgets) {
        if (!budget.isActive || budget.isOverBudget || budget.spent <= 0) continue;

        const dailyPace = budget.spent / dayOfMonth;
        const projectedMonthEnd = dailyPace * daysInMonth;
        if (projectedMonthEnd <= budget.monthlyLimit) continue;

        const daysUntilOverBudget = Math.max(0, Math.round((budget.monthlyLimit - budget.spent) / dailyPace));

        insights.push({
            type: 'budget',
            text: `You're likely to exceed your ${capitalize(budget.category)} budget in approximately `
                + `${daysUntilOverBudget} day${daysUntilOverBudget === 1 ? '' : 's'} at your current pace.`,
            data: { category: budget.category, projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100 },
        });
    }
};

const addForecastInsight = (insights, forecast) => {
    const nextMonth = forecast.forecast?.[0];
    if (!nextMonth) return;

    insights.push({
        type: 'forecast',
        text: `Your projected ${forecast.metric} for next month are ₹${inr(nextMonth.linearRegression)}.`,
        data: nextMonth,
    });
};

const addAnomalyInsight = (insights, anomalies) => {
    const top = anomalies[0];
    if (!top) return;

    insights.push({
        type: 'anomaly',
        text: `A ${capitalize(top.category)} transaction of ₹${inr(top.amount)} is significantly above your `
            + 'historical spending pattern for that category.',
        data: top,
    });
};

const addRecurringInsight = (insights, recurring) => {
    const monthlyTotal = recurring
        .filter((r) => r.interval === 'monthly')
        .reduce((sum, r) => sum + r.averageAmount, 0);
    if (monthlyTotal <= 0) return;

    insights.push({
        type: 'recurring',
        text: `You have ₹${inr(monthlyTotal)} in detected monthly recurring expenses.`,
        data: { monthlyTotal: Math.round(monthlyTotal * 100) / 100, count: recurring.length },
    });
};

module.exports = { getInsights };
