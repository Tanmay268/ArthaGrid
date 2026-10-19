const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { User } = require('../src/models/User');
const { Transaction } = require('../src/models/Transaction');
const { DEMO, LIVE, runWithTenant } = require('../src/config/tenant');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

// A demo user lives in the separate demo database and gets a demo-signed token.
const demoAdmin = async () => {
    let created;
    await runWithTenant(DEMO, async () => {
        created = await createUserWithToken({ role: 'admin', demo: true });
    });
    return created;
};

describe('Demo accounts run in a separate sandbox database', () => {
    it('lets a demo admin read everything', async () => {
        const { token } = await demoAdmin();
        const res = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it('lets a demo admin write — into the demo database only', async () => {
        const { token } = await demoAdmin();
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${token}`)
            .send({ amount: 100, type: 'expense', category: 'food' });
        expect(res.status).toBe(201);

        expect(await runWithTenant(DEMO, () => Transaction.countDocuments({}))).toBe(1);
        expect(await runWithTenant(LIVE, () => Transaction.countDocuments({}))).toBe(0);
    });

    it('never shows demo data to real accounts (or the reverse)', async () => {
        const demo = await demoAdmin();
        await request(app)
            .post('/api/v1/transactions')
            .set('Authorization', `Bearer ${demo.token}`)
            .send({ amount: 100, type: 'expense', category: 'food' });

        const live = await createUserWithToken({ role: 'admin' });
        const res = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${live.token}`);
        expect(res.body.transactions).toHaveLength(0);
    });

    it('does not accept a demo token for a user that only exists in the live database', async () => {
        const { user } = await createUserWithToken({ role: 'admin' });
        const jwt = require('jsonwebtoken');
        const forged = jwt.sign({ id: user._id, demo: true }, process.env.JWT_SECRET);
        const res = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${forged}`);
        expect(res.status).toBe(401);
    });

    it('logs demo users in from the demo database and tags the session as demo', async () => {
        await runWithTenant(DEMO, () =>
            User.create({ name: 'Demo Admin', email: 'demo@test.com', password: 'Password123', role: 'admin', isDemo: true })
        );
        const res = await request(app).post('/api/v1/auth/login').send({ email: 'demo@test.com', password: 'Password123' });
        expect(res.status).toBe(200);
        expect(res.body.data.user.isDemo).toBe(true);
        expect(res.body.data.user.demoRestrictions.length).toBeGreaterThan(0);
        expect(res.body.data.refreshToken.startsWith('d.')).toBe(true);

        const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: res.body.data.refreshToken });
        expect(refreshed.status).toBe(200);
    });

    it('reserves demo emails so nobody can register them as a real account', async () => {
        await runWithTenant(DEMO, () =>
            User.create({ name: 'Demo Admin', email: 'demo@test.com', password: 'Password123', role: 'admin', isDemo: true })
        );
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Imposter', email: 'demo@test.com', password: 'Password123' });
        expect(res.status).toBe(409);
    });
});

describe('Critical features are restricted for demo accounts, even for admin', () => {
    it.each([
        ['edit profile', 'patch', '/api/v1/users/me', { name: 'Hacker' }],
        ['change email', 'patch', '/api/v1/users/me', { email: 'new@test.com' }],
        ['change password', 'patch', '/api/v1/users/me', { password: 'NewPassword123' }],
        ['change a user role', 'patch', '/api/v1/users/64b000000000000000000001', { role: 'viewer' }],
        ['replace profile with PUT', 'put', '/api/v1/users/me', { name: 'X' }],
        ['delete a user', 'delete', '/api/v1/users/64b000000000000000000001', undefined],
        ['deactivate a user', 'patch', '/api/v1/users/64b000000000000000000001/deactivate', undefined],
    ])('blocks %s', async (_label, method, url, body) => {
        const { token } = await demoAdmin();
        const res = await request(app)[method](url).set('Authorization', `Bearer ${token}`).send(body);
        expect(res.status).toBe(403);
        expect(res.body.error.message).toMatch(/restricted feature on demo accounts/i);
        expect(res.body.error.details[0].code).toBe('DEMO_RESTRICTED');
    });

    it('still lets a normal admin use those features', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await request(app).patch('/api/v1/users/me').set('Authorization', `Bearer ${token}`).send({ name: 'New Name' });
        expect(res.status).toBe(200);
    });
});
