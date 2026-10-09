const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { User } = require('../src/models/User');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

const demoAdminToken = async () => {
    const { user, token } = await createUserWithToken({ role: 'admin' });
    await User.updateOne({ _id: user._id }, { isDemo: true });
    return token;
};

describe('Demo accounts are read-only', () => {
    it('lets a demo admin read everything', async () => {
        const token = await demoAdminToken();
        const res = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it('rejects writes from a demo admin even though the role allows them', async () => {
        const token = await demoAdminToken();
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 100, type: 'expense', category: 'food' });
        expect(res.status).toBe(403);
        expect(res.body.error.message).toMatch(/not allowed for demo accounts/i);
    });

    it('still lets a normal admin write', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 100, type: 'expense', category: 'food' });
        expect(res.status).toBe(201);
    });
});
