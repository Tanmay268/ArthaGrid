const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

const validTxn = { amount: 100, type: 'expense', category: 'food', description: 'Lunch' };

describe('Transactions RBAC + CRUD', () => {
    it('blocks unauthenticated requests', async () => {
        const res = await request(app).get('/api/v1/transactions');
        expect(res.status).toBe(401);
    });

    it('lets a viewer read but not create transactions', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });

        const list = await request(app)
            .get('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`);
        expect(list.status).toBe(200);

        const create = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send(validTxn);
        expect(create.status).toBe(403);
    });

    it('lets an admin create, update, and soft-delete a transaction', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        const create = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send(validTxn);
        expect(create.status).toBe(201);
        const id = create.body.data._id;

        const update = await request(app)
            .patch(`/api/v1/transactions/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 250 });
        expect(update.status).toBe(200);
        expect(update.body.data.amount).toBe(250);
        expect(update.body.data.updatedBy).toBe(user._id.toString());

        const del = await request(app)
            .delete(`/api/v1/transactions/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(del.status).toBe(200);

        // Soft-deleted transactions disappear from normal reads
        const getAfterDelete = await request(app)
            .get(`/api/v1/transactions/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(getAfterDelete.status).toBe(404);
    });
});
