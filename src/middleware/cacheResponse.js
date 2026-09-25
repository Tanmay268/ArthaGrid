const cache = require('../utils/cache');

// Requests currently being computed, by cache key. Lets simultaneous misses
// for the same URL share ONE computation instead of each running the full
// query — without this, a cold or just-expired entry under load triggers a
// "cache stampede": N concurrent users = N identical expensive computations,
// which is exactly when the database can least afford it. (Measured: see
// docs/load-testing.md — before this, /analytics/insights p95 stayed at ~6.4 s
// at 100 users even with the cache on.)
const inflight = new Map(); // key -> Promise<body | null>

// Caches successful GET JSON responses by full URL (query string included).
// Mount AFTER authenticate/authorize — an unauthorized caller must never be
// able to read a cached body. Sets X-Cache: HIT | MISS | COALESCED so
// behaviour is observable (and so the load test can show it working).
const cacheResponse = async (req, res, next) => {
    if (req.method !== 'GET' || cache.ttlSeconds() <= 0) return next();

    const key = req.originalUrl;

    const hit = cache.get(key);
    if (hit !== undefined) {
        res.set('X-Cache', 'HIT');
        return res.status(200).json(hit);
    }

    // Someone else is already computing this exact response — wait for it.
    if (inflight.has(key)) {
        const body = await inflight.get(key);
        if (body !== null) {
            res.set('X-Cache', 'COALESCED');
            return res.status(200).json(body);
        }
        // The leader failed (non-200 / error) — don't share its failure, compute our own.
        res.set('X-Cache', 'MISS');
        return next();
    }

    // We're the leader for this key.
    let settle;
    const pending = new Promise((resolve) => { settle = resolve; });
    inflight.set(key, pending);
    const finish = (body) => {
        if (inflight.get(key) === pending) inflight.delete(key);
        settle(body); // resolving twice is a no-op
    };

    const versionAtStart = cache.version();
    const originalJson = res.json.bind(res);
    res.set('X-Cache', 'MISS');
    res.json = (body) => {
        const ok = res.statusCode === 200;
        // If a write cleared the cache while we were computing, this result may
        // already be stale — serve it to this caller, but don't store it.
        if (ok && cache.version() === versionAtStart) cache.set(key, body);
        finish(ok ? body : null);
        return originalJson(body);
    };
    res.on('close', () => finish(null)); // safety net: never leave waiters hanging
    next();
};

module.exports = cacheResponse;
