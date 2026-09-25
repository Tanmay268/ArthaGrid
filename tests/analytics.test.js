const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('Analytics RBAC', () => {
    it('blocks a viewer from analytics endpoints (same gate as /dashboard)', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });
        const res = await request(app).get('/api/v1/analytics/metrics').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });
});

describe('GET /api/v1/analytics/metrics', () => {
    it('computes the most expensive/frequent category and the expense-to-income ratio', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        await Transaction.create([
            { amount: 1000, type: 'income', category: 'salary', createdBy: user._id },
            { amount: 100, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 100, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 100, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 100, type: 'expense', category: 'transport', createdBy: user._id },
        ]);

        const res = await request(app)
            .get('/api/v1/analytics/metrics')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.mostExpensiveCategory).toBe('food');
        expect(res.body.data.mostFrequentCategory).toBe('food');
        expect(res.body.data.expenseToIncomeRatio).toBe(0.4);
    });
});

describe('weekday vs weekend spending', () => {
    it('averages per DAY (total ÷ days in the span), not per transaction', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        // Mon 2024-01-01 .. Sun 2024-01-07: 5 weekdays + 2 weekend days.
        // Weekday: two transactions on Monday (100 + 100) = 200 over 5 weekdays  -> 40/day
        // Weekend: one transaction on Saturday (140) over 2 weekend days         -> 70/day
        // (A per-transaction average would have said 100 and 140 — a different question.)
        await Transaction.create([
            { amount: 100, type: 'expense', category: 'food', date: new Date('2024-01-01T10:00:00Z'), createdBy: user._id },
            { amount: 100, type: 'expense', category: 'food', date: new Date('2024-01-01T18:00:00Z'), createdBy: user._id },
            { amount: 140, type: 'expense', category: 'food', date: new Date('2024-01-06T12:00:00Z'), createdBy: user._id },
            { amount: 0.01, type: 'expense', category: 'food', date: new Date('2024-01-07T12:00:00Z'), createdBy: user._id }, // extends the span to Sunday
        ]);

        const res = await request(app).get('/api/v1/analytics/metrics').set('Authorization', `Bearer ${token}`);
        const { weekday, weekend } = res.body.data.weekdayVsWeekend;

        expect(weekday).toMatchObject({ total: 200, days: 5, avgPerDay: 40 });
        expect(weekend.days).toBe(2);
        expect(weekend.avgPerDay).toBe(70.01); // (140 + 0.01) / 2 = 70.005, rounded to 2 dp
    });
});

describe('GET /api/v1/analytics/forecast', () => {
    it('produces a linear-regression forecast from monthly history', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        // A perfectly linear trend (100, 200, 300) — the regression forecast
        // for the following two months is deterministic: 400, then 500.
        await Transaction.create([
            { amount: 100, type: 'expense', category: 'food', date: new Date('2024-01-15'), createdBy: user._id },
            { amount: 200, type: 'expense', category: 'food', date: new Date('2024-02-15'), createdBy: user._id },
            { amount: 300, type: 'expense', category: 'food', date: new Date('2024-03-15'), createdBy: user._id },
        ]);

        const res = await request(app)
            .get('/api/v1/analytics/forecast?months=2')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        // Postgres isn't configured in tests (see testUtils/env.js), so this
        // also locks in the fallback-to-MongoDB behavior from rollup.service.js.
        expect(res.body.data.source).toBe('mongodb_live');
        expect(res.body.data.history).toHaveLength(3);
        expect(res.body.data.forecast).toHaveLength(2);
        expect(res.body.data.forecast[0].linearRegression).toBe(400);
        expect(res.body.data.forecast[1].linearRegression).toBe(500);
    });

    it('reports insufficient data instead of guessing from a single month', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });
        await Transaction.create({ amount: 100, type: 'expense', category: 'food', createdBy: user._id });

        const res = await request(app)
            .get('/api/v1/analytics/forecast')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.method).toBe('insufficient_data');
        expect(res.body.data.forecast).toEqual([]);
    });
});

describe('Anomaly detection', () => {
    it('flags a statistically unusual transaction, both at creation and in the anomalies list', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        // Baseline: five normal food expenses (minimum sample size to judge "unusual" at all)
        await Transaction.create([
            { amount: 100, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 110, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 90, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 105, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 95, type: 'expense', category: 'food', createdBy: user._id },
        ]);

        const create = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 5000, type: 'expense', category: 'food' });

        expect(create.status).toBe(201);
        expect(create.body.unusual.flagged).toBe(true);

        const anomalies = await request(app)
            .get('/api/v1/analytics/anomalies')
            .set('Authorization', `Bearer ${token}`);

        expect(anomalies.status).toBe(200);
        expect(anomalies.body.data.some((t) => t.amount === 5000)).toBe(true);
    });

    it('never flags anything when a category has too little history', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });

        const create = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 999999, type: 'expense', category: 'food' });

        expect(create.body.unusual.flagged).toBe(false);
        expect(create.body.unusual.sampleSize).toBe(0);
    });
});

describe('GET /api/v1/analytics/recurring', () => {
    it('detects a recurring monthly charge by merchant', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        const dates = ['2024-01-01', '2024-01-31', '2024-03-01']; // ~30-day gaps
        await Transaction.create(
            dates.map((d) => ({
                amount: 649,
                type: 'expense',
                category: 'entertainment',
                merchant: 'Netflix',
                date: new Date(d),
                createdBy: user._id,
            }))
        );

        const res = await request(app)
            .get('/api/v1/analytics/recurring')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const netflix = res.body.data.find((r) => r.merchant === 'Netflix');
        expect(netflix).toBeDefined();
        expect(netflix.interval).toBe('monthly');
        expect(netflix.occurrences).toBe(3);
    });
});

describe('GET /api/v1/analytics/health-score', () => {
    it('returns a 0-100 score with a component breakdown and published methodology', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });
        await Transaction.create({ amount: 1000, type: 'income', category: 'salary', createdBy: user._id });
        await Transaction.create({ amount: 400, type: 'expense', category: 'food', createdBy: user._id });

        const res = await request(app)
            .get('/api/v1/analytics/health-score')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.score).toBeGreaterThanOrEqual(0);
        expect(res.body.data.score).toBeLessThanOrEqual(100);
        expect(['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS ATTENTION']).toContain(res.body.data.rating);
        expect(res.body.data.components).toHaveProperty('savingsRate');
        expect(res.body.data.methodology).toEqual(expect.any(String));
    });
});

describe('GET /api/v1/analytics/insights', () => {
    it('is blocked for a viewer', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });
        const res = await request(app).get('/api/v1/analytics/insights').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('returns a list of insights for an analyst', async () => {
        const { token, user } = await createUserWithToken({ role: 'analyst' });
        await Transaction.create({ amount: 500, type: 'expense', category: 'food', createdBy: user._id });

        const res = await request(app)
            .get('/api/v1/analytics/insights')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});
