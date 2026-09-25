const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('GET /api/v1/dashboard/summary', () => {
    it('returns correct totals without erroring on expense transactions', async () => {
        // Regression test: getSummary() previously referenced the undefined
        // aggregation variable "$$amount" instead of the field "$amount" when
        // computing largestExpense, which made this endpoint throw a MongoDB
        // error as soon as any expense transaction existed.
        const { user, token } = await createUserWithToken({ role: 'admin' });

        await Transaction.create([
            { amount: 1000, type: 'income', category: 'salary', createdBy: user._id },
            { amount: 200, type: 'expense', category: 'food', createdBy: user._id },
            { amount: 500, type: 'expense', category: 'housing', createdBy: user._id },
        ]);

        const res = await request(app)
            .get('/api/v1/dashboard/summary')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.totalIncome).toBe(1000);
        expect(res.body.data.totalExpenses).toBe(700);
        expect(res.body.data.netBalance).toBe(300);
        expect(res.body.data.largestExpense).toBe(500);
        expect(res.body.data.largestIncome).toBe(1000);
    });

    it('returns zeroed defaults when there is no data', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });

        const res = await request(app)
            .get('/api/v1/dashboard/summary')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.transactionCount).toBe(0);
    });

    it('is not reachable by a viewer (analytics is analyst/admin only)', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });

        const res = await request(app)
            .get('/api/v1/dashboard/summary')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});
