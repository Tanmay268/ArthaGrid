const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');
const rollupService = require('../src/services/rollup.service');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('rollup.service.computeMonthlyMetrics', () => {
    it('aggregates income/expenses per calendar month from MongoDB', async () => {
        const { user } = await createUserWithToken({ role: 'admin' });

        await Transaction.create([
            { amount: 1000, type: 'income', category: 'salary', date: new Date('2024-01-10'), createdBy: user._id },
            { amount: 300, type: 'expense', category: 'food', date: new Date('2024-01-20'), createdBy: user._id },
            { amount: 500, type: 'expense', category: 'housing', date: new Date('2024-02-05'), createdBy: user._id },
        ]);

        const rows = await rollupService.computeMonthlyMetrics();

        expect(rows).toEqual([
            { monthKey: '2024-01', year: 2024, month: 1, totalIncome: 1000, totalExpenses: 300, net: 700, transactionCount: 2 },
            { monthKey: '2024-02', year: 2024, month: 2, totalIncome: 0, totalExpenses: 500, net: -500, transactionCount: 1 },
        ]);
    });
});

// Postgres itself isn't available in this test environment (POSTGRES_URL is
// deliberately unset — see testUtils/env.js), so these tests cover the part
// that doesn't need a real Postgres: the shared-secret auth guard, and the
// graceful "skipped, not configured" response Postgres being optional
// requires (see decisions.md #17). Verifying the actual rollup writes
// happen correctly against a real Neon database is a manual deployment
// check (see docs/deployment.md), not something this suite can exercise.
describe('POST /api/v1/internal/jobs/rollup', () => {
    it('rejects a request with no secret header', async () => {
        const res = await request(app).post('/api/v1/internal/jobs/rollup');
        expect(res.status).toBe(401);
    });

    it('rejects a request with the wrong secret', async () => {
        const res = await request(app)
            .post('/api/v1/internal/jobs/rollup')
            .set('X-Cron-Secret', 'not-the-real-secret');
        expect(res.status).toBe(401);
    });

    it('accepts the correct secret and reports it skipped the rollup (Postgres not configured)', async () => {
        const res = await request(app)
            .post('/api/v1/internal/jobs/rollup')
            .set('X-Cron-Secret', process.env.CRON_SECRET);

        expect(res.status).toBe(200);
        expect(res.body.data.skipped).toBe(true);
        expect(res.body.data.reason).toMatch(/POSTGRES_URL/);
    });
});
