const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');
const { User } = require('../src/models/User');
const { estimateQuantile } = require('../src/config/metrics');

const saved = {
    METRICS_TOKEN: process.env.METRICS_TOKEN,
    ANALYTICS_CACHE_TTL_SECONDS: process.env.ANALYTICS_CACHE_TTL_SECONDS,
};

beforeAll(async () => db.connect());
afterEach(async () => {
    require('../src/utils/cache').clear(); // the store is module-level; don't let one test's entries leak into the next
    await db.clearDatabase();
    Object.entries(saved).forEach(([k, v]) => (v === undefined ? delete process.env[k] : (process.env[k] = v)));
});
afterAll(async () => db.closeDatabase());

describe('GET /metrics (Prometheus)', () => {
    it('fails closed when no METRICS_TOKEN is configured', async () => {
        const res = await request(app).get('/metrics');
        expect(res.status).toBe(401);
    });

    it('rejects a wrong token and accepts the right one', async () => {
        process.env.METRICS_TOKEN = 'scrape-secret';
        expect((await request(app).get('/metrics').set('Authorization', 'Bearer nope')).status).toBe(401);

        const ok = await request(app).get('/metrics').set('Authorization', 'Bearer scrape-secret');
        expect(ok.status).toBe(200);
        expect(ok.text).toContain('http_request_duration_seconds');
        expect(ok.text).toContain('process_cpu_user_seconds_total'); // default process metrics
    });

    it('labels by route pattern, not the raw URL, so ids cannot explode cardinality', async () => {
        process.env.METRICS_TOKEN = 'scrape-secret';
        const { token } = await createUserWithToken({ role: 'admin' });
        const fakeId = '64b7f0c2a1b2c3d4e5f60718';
        await request(app).get(`/api/v1/transactions/${fakeId}`).set('Authorization', `Bearer ${token}`);

        const { text } = await request(app).get('/metrics').set('Authorization', 'Bearer scrape-secret');
        expect(text).toContain('route="/api/v1/transactions/:id"');
        expect(text).not.toContain(fakeId);
    });
});

describe('estimateQuantile', () => {
    it('interpolates inside the bucket the quantile falls in', () => {
        // 100 requests: 50 under 0.1s, 100 under 0.2s  ->  median sits at the 0.1s edge, p75 halfway into the next bucket
        const buckets = [{ le: 0.1, count: 50 }, { le: 0.2, count: 100 }, { le: Infinity, count: 100 }];
        expect(estimateQuantile(0.5, buckets, 100)).toBeCloseTo(0.1, 5);
        expect(estimateQuantile(0.75, buckets, 100)).toBeCloseTo(0.15, 5);
    });

    it('returns 0 with no data', () => {
        expect(estimateQuantile(0.95, [], 0)).toBe(0);
    });
});

describe('GET /api/v1/admin/stats', () => {
    it('is admin-only', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });
        const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('returns user, transaction, and system numbers — aggregates only', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });
        await createUserWithToken({ role: 'viewer' });
        await Transaction.create([
            { amount: 100, type: 'expense', category: 'food', description: 'secret note', createdBy: user._id },
            { amount: 50, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 20, type: 'expense', category: 'transport', createdBy: user._id },
            { amount: 900, type: 'expense', category: 'shopping', createdBy: user._id, isDeleted: true },
        ]);

        const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const { users, transactions, system } = res.body.data;
        expect(users.total).toBe(2);
        expect(users.byRole).toMatchObject({ admin: 1, viewer: 1 });
        expect(transactions.total).toBe(3); // soft-deleted excluded
        expect(transactions.popularExpenseCategories[0]).toMatchObject({ category: 'food', count: 2 });
        expect(system.http.totalRequests).toBeGreaterThan(0);
        expect(system.services.postgres).toBe('not configured');
        expect(JSON.stringify(res.body)).not.toContain('secret note');
    });
});

describe('response cache', () => {
    it('serves a repeat GET from cache, and a write invalidates it', async () => {
        process.env.ANALYTICS_CACHE_TTL_SECONDS = '30';
        const { token } = await createUserWithToken({ role: 'admin' });
        const auth = { Authorization: `Bearer ${token}` };

        const first = await request(app).get('/api/v1/analytics/insights').set(auth);
        const second = await request(app).get('/api/v1/analytics/insights').set(auth);
        expect(first.headers['x-cache']).toBe('MISS');
        expect(second.headers['x-cache']).toBe('HIT');

        await request(app).post('/api/v1/transactions').set(auth).send({ amount: 10, type: 'expense', category: 'food' });

        const afterWrite = await request(app).get('/api/v1/analytics/insights').set(auth);
        expect(afterWrite.headers['x-cache']).toBe('MISS');
    });

    it('coalesces simultaneous misses into a single computation (no cache stampede)', async () => {
        process.env.ANALYTICS_CACHE_TTL_SECONDS = '30';
        const insightsService = require('../src/services/insights.service');
        const spy = jest.spyOn(insightsService, 'getInsights').mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve([{ type: 'spending', text: 'x', data: {} }]), 150))
        );
        const { token } = await createUserWithToken({ role: 'admin' });
        const auth = { Authorization: `Bearer ${token}` };

        const responses = await Promise.all(
            Array.from({ length: 6 }, () => request(app).get('/api/v1/analytics/insights').set(auth))
        );

        expect(spy).toHaveBeenCalledTimes(1); // six concurrent requests, ONE computation
        expect(responses.every((r) => r.status === 200 && r.body.data.length === 1)).toBe(true);
        const kinds = responses.map((r) => r.headers['x-cache']);
        expect(kinds.filter((k) => k === 'MISS')).toHaveLength(1);
        expect(kinds.filter((k) => k === 'COALESCED').length).toBeGreaterThan(0);
        spy.mockRestore();
    });

    it('never serves a cached body to a caller who fails authorization', async () => {
        process.env.ANALYTICS_CACHE_TTL_SECONDS = '30';
        const { token: adminToken } = await createUserWithToken({ role: 'admin' });
        const { token: viewerToken } = await createUserWithToken({ role: 'viewer' });

        await request(app).get('/api/v1/analytics/metrics').set('Authorization', `Bearer ${adminToken}`);
        const res = await request(app).get('/api/v1/analytics/metrics').set('Authorization', `Bearer ${viewerToken}`);

        expect(res.status).toBe(403);
        expect(res.headers['x-cache']).toBeUndefined();
    });

    it('is off by default under test', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await request(app).get('/api/v1/analytics/insights').set('Authorization', `Bearer ${token}`);
        expect(res.headers['x-cache']).toBeUndefined();
    });
});

describe('lastLoginAt', () => {
    it('is stamped on login (best-effort, does not block the response)', async () => {
        await request(app).post('/api/v1/auth/register').send({ name: 'Jane Doe', email: 'll@test.com', password: 'Password123' });
        await request(app).post('/api/v1/auth/login').send({ email: 'll@test.com', password: 'Password123' });
        await new Promise((r) => setTimeout(r, 100)); // the write is fire-and-forget
        const user = await User.findOne({ email: 'll@test.com' });
        expect(user.lastLoginAt).toBeInstanceOf(Date);
    });
});
