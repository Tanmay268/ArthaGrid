// Small, hand-rolled statistics helpers used by forecasting, anomaly
// detection, and the Financial Health Score — kept dependency-free since
// each formula is only a few lines (see decisions.md #17-#21 for why this
// project favors small, explainable math over adding an ML/stats library).

const mean = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
};

// Population standard deviation (divides by n, not n-1) — used here for
// describing "how spread out is this exact dataset", not for inferring
// about a larger population, so the population formula is the right one.
const stddev = (values) => {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
};

// How many standard deviations a value sits from the mean. Returns 0
// (never flags) when there's no spread to compare against.
const zScore = (value, avg, sd) => {
    if (sd === 0) return 0;
    return (value - avg) / sd;
};

// Ordinary least-squares linear regression over { x, y } points.
// Returns a flat line (slope 0, intercept = mean of y) for fewer than 2
// points instead of throwing — callers can still ask for a prediction.
const linearRegression = (points) => {
    const n = points.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    if (n === 1) return { slope: 0, intercept: points[0].y };

    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return { slope: 0, intercept: sumY / n };

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
};

// Simple trailing moving average — returns an array the same length as
// `values`, where each entry is the average of itself and up to
// (windowSize - 1) preceding values (fewer at the start of the series).
const movingAverage = (values, windowSize) => {
    return values.map((_, i) => {
        const start = Math.max(0, i - windowSize + 1);
        const window = values.slice(start, i + 1);
        return mean(window);
    });
};

module.exports = { mean, stddev, zScore, linearRegression, movingAverage };
