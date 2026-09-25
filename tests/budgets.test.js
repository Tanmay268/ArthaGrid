const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('Budgets', () => {
    it('blocks a non-admin from creating a budget', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });

        const res = await request(app)
            .post('/api/v1/budgets')
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'food', monthlyLimit: 5000 });

        expect(res.status).toBe(403);
    });

    it('lets any role read budgets, including current-month progress', async () => {
        const { token: adminToken, user } = await createUserWithToken({ role: 'admin' });

        const create = await request(app)
            .post('/api/v1/budgets')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ category: 'food', monthlyLimit: 1000 });
        expect(create.status).toBe(201);

        // Dated "now" so it falls inside the current calendar month that
        // getBudgets() scopes progress to.
        await Transaction.create({
            amount: 400, type: 'expense', category: 'food', date: new Date(), createdBy: user._id,
        });
        // A transaction in a different category shouldn't affect this budget.
        await Transaction.create({
            amount: 999, type: 'expense', category: 'transport', date: new Date(), createdBy: user._id,
        });

        const { token: viewerToken } = await createUserWithToken({ role: 'viewer' });
        const res = await request(app)
            .get('/api/v1/budgets')
            .set('Authorization', `Bearer ${viewerToken}`);

        expect(res.status).toBe(200);
        const foodBudget = res.body.data.find((b) => b.category === 'food');
        expect(foodBudget.spent).toBe(400);
        expect(foodBudget.remaining).toBe(600);
        expect(foodBudget.percentage).toBe(40);
        expect(foodBudget.isOverBudget).toBe(false);
    });

    it('flags a budget as over once spending exceeds the limit', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        await request(app)
            .post('/api/v1/budgets')
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'shopping', monthlyLimit: 100 });

        await Transaction.create({
            amount: 250, type: 'expense', category: 'shopping', date: new Date(), createdBy: user._id,
        });

        const res = await request(app).get('/api/v1/budgets').set('Authorization', `Bearer ${token}`);
        const shoppingBudget = res.body.data.find((b) => b.category === 'shopping');

        expect(shoppingBudget.isOverBudget).toBe(true);
        expect(shoppingBudget.remaining).toBe(-150);
    });

    it('rejects a second budget for a category that already has one', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });

        await request(app)
            .post('/api/v1/budgets')
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'transport', monthlyLimit: 3000 });

        const duplicate = await request(app)
            .post('/api/v1/budgets')
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'transport', monthlyLimit: 4000 });

        expect(duplicate.status).toBe(409);
    });

    it('lets an admin update and remove a budget', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });

        const create = await request(app)
            .post('/api/v1/budgets')
            .set('Authorization', `Bearer ${token}`)
            .send({ category: 'entertainment', monthlyLimit: 1000 });
        const id = create.body.data._id;

        const update = await request(app)
            .patch(`/api/v1/budgets/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ monthlyLimit: 1500 });
        expect(update.status).toBe(200);
        expect(update.body.data.monthlyLimit).toBe(1500);

        const remove = await request(app)
            .delete(`/api/v1/budgets/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(remove.status).toBe(200);

        const list = await request(app).get('/api/v1/budgets').set('Authorization', `Bearer ${token}`);
        expect(list.body.data.find((b) => b.category === 'entertainment')).toBeUndefined();
    });
});
