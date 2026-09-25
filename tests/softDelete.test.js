const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');
const rollupService = require('../src/services/rollup.service');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

// Mongoose's pre(/^find/) soft-delete hook does NOT run for aggregate(),
// countDocuments(), or distinct() — every one of those needs its own
// explicit isDeleted filter. These are regression tests for the places that
// originally missed it.
describe('soft-deleted transactions never leak into derived numbers', () => {
    it('is excluded from the list total, budget progress, category growth, and the rollup', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });
        const auth = { Authorization: `Bearer ${token}` };

        await request(app).post('/api/v1/budgets').set(auth).send({ category: 'food', monthlyLimit: 1000 });

        const kept = await Transaction.create({ amount: 100, type: 'expense', category: 'food', date: new Date(), createdBy: user._id });
        const removed = await Transaction.create({ amount: 400, type: 'expense', category: 'food', date: new Date(), createdBy: user._id });
        await request(app).delete(`/api/v1/transactions/${removed._id}`).set(auth);

        const list = await request(app).get('/api/v1/transactions').set(auth);
        expect(list.body.pagination.total).toBe(1);

        const budgets = await request(app).get('/api/v1/budgets').set(auth);
        expect(budgets.body.data[0].spent).toBe(100);

        const metrics = await request(app).get('/api/v1/analytics/metrics').set(auth);
        const food = metrics.body.data.categoryGrowth.find((c) => c.category === 'food');
        expect(food.thisMonth).toBe(100);

        const rollup = await rollupService.computeMonthlyMetrics();
        expect(rollup.reduce((sum, r) => sum + r.totalExpenses, 0)).toBe(100);
        expect(kept).toBeDefined();
    });
});
