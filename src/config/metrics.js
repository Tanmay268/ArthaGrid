const client = require('prom-client');

// One private registry (not prom-client's global one) so tests and the app
// can't accidentally double-register the same metric name.
const register = new client.Registry();
client.collectDefaultMetrics({ register }); // CPU, memory, event-loop lag, GC

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: BUCKETS,
    registers: [register],
});

// Replaces id-looking path segments so /transactions/64b7… and
// /transactions/64c1… land in one time series instead of thousands. This API's
// only path parameter is :id (Mongo ObjectId), plus numeric ids for safety.
const normalizePath = (urlPath) =>
    urlPath
        .split('/')
        .map((seg) => (/^[a-f0-9]{24}$/i.test(seg) || /^\d+$/.test(seg) ? ':id' : seg))
        .join('/');

// Express middleware. Only requests that matched a real route get their path
// as a label; everything else (404s, scanners probing random URLs) collapses
// into a single "unmatched" series, so a bot can't create unbounded label
// values. (req.route is used purely as the "did a route match" signal —
// req.baseUrl/req.params can't be trusted at 'finish' time because Express
// restores them when an error propagates out of a router.)
const metricsMiddleware = (req, res, next) => {
    if (req.path === '/metrics') return next();
    const end = httpDuration.startTimer();
    res.on('finish', () => {
        const route = req.route ? normalizePath(req.originalUrl.split('?')[0]) : 'unmatched';
        end({ method: req.method, route, status_code: res.statusCode });
    });
    next();
};

// Approximates a quantile from cumulative histogram buckets by linear
// interpolation inside the bucket the quantile falls in — the same method
// Prometheus's histogram_quantile() uses. Accurate to bucket resolution, not exact.
const estimateQuantile = (q, bucketCounts, total) => {
    if (total === 0) return 0;
    const target = q * total;
    let prevBound = 0;
    let prevCount = 0;
    for (const { le, count } of bucketCounts) {
        if (count >= target) {
            if (!Number.isFinite(le)) return prevBound;
            const inBucket = count - prevCount;
            const fraction = inBucket === 0 ? 0 : (target - prevCount) / inBucket;
            return prevBound + (le - prevBound) * fraction;
        }
        prevBound = le;
        prevCount = count;
    }
    return prevBound;
};

// Aggregates every label combination into headline numbers for the admin
// dashboard. Counters live in this process's memory: they reset whenever the
// server restarts or a free-tier host spins it down after idling, so these
// are "since last start", not lifetime totals — the API says so explicitly.
const getHttpSummary = async () => {
    const { values } = await httpDuration.get();

    let count = 0;
    let sum = 0;
    let serverErrors = 0;
    let clientErrors = 0;
    const cumulative = new Map(); // le -> total across all labels

    for (const v of values) {
        if (v.metricName.endsWith('_count')) {
            count += v.value;
            const status = Number(v.labels.status_code);
            if (status >= 500) serverErrors += v.value;
            else if (status >= 400) clientErrors += v.value;
        } else if (v.metricName.endsWith('_sum')) {
            sum += v.value;
        } else if (v.metricName.endsWith('_bucket')) {
            const le = v.labels.le === '+Inf' ? Infinity : Number(v.labels.le);
            cumulative.set(le, (cumulative.get(le) || 0) + v.value);
        }
    }

    const buckets = [...cumulative.entries()].sort((a, b) => a[0] - b[0]).map(([le, c]) => ({ le, count: c }));
    const ms = (seconds) => Math.round(seconds * 1000 * 10) / 10;

    return {
        totalRequests: count,
        avgLatencyMs: count ? ms(sum / count) : 0,
        p50Ms: ms(estimateQuantile(0.5, buckets, count)),
        p95Ms: ms(estimateQuantile(0.95, buckets, count)),
        p99Ms: ms(estimateQuantile(0.99, buckets, count)),
        serverErrorRatePercent: count ? Math.round((serverErrors / count) * 10000) / 100 : 0,
        clientErrorRatePercent: count ? Math.round((clientErrors / count) * 10000) / 100 : 0,
    };
};

module.exports = { register, metricsMiddleware, getHttpSummary, estimateQuantile };
