// Tiny in-process TTL cache for expensive, read-mostly analytics responses.
//
// Deliberately in-process rather than Redis (see decisions.md #18/#22): free
// hosting runs ONE instance, so a shared cache buys nothing, while a Redis
// dependency would add a service to host. The trade-off: with several
// instances each would hold its own copy and could serve slightly stale data
// for up to the TTL — at that point, swap this module for Redis; nothing else
// has to change (callers only use get/set/clear).
//
// The ledger is one shared pool (no per-user data), so a cached body is safe
// to reuse across users — but ONLY behind authenticate/authorize, which is
// why cacheResponse is mounted after them, never before.

const MAX_ENTRIES = 200;
const store = new Map(); // key -> { body, expiresAt }
let version = 0;

// Read lazily so tests (and operators) can change it without a restart.
// 0 disables caching. Off by default under test so cached responses can't
// leak between tests that reuse the same URL with different seeded data.
const ttlSeconds = () => {
    const raw = process.env.ANALYTICS_CACHE_TTL_SECONDS;
    if (raw !== undefined && raw !== '') return Number(raw) || 0;
    return process.env.NODE_ENV === 'test' ? 0 : 30;
};

const get = (key) => {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
    }
    return hit.body;
};

const set = (key, body) => {
    const ttl = ttlSeconds();
    if (ttl <= 0) return;
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // evict oldest
    store.set(key, { body, expiresAt: Date.now() + ttl * 1000 });
};

// Called after every write to transactions/budgets. Bumping `version` also
// lets other derived state (the category classifier's trained model) know
// the ledger changed without its own invalidation plumbing.
const clear = () => {
    store.clear();
    version += 1;
};

module.exports = { get, set, clear, ttlSeconds, version: () => version };
