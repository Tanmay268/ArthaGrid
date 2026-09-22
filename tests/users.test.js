const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('Self-service profile routes', () => {
    it('lets any authenticated user read and update their own profile', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });

        const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
        expect(me.status).toBe(200);
        expect(me.body.data.password).toBeUndefined();

        const update = await request(app)
            .patch('/api/v1/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Name' });
        expect(update.status).toBe(200);
        expect(update.body.data.name).toBe('Updated Name');
        expect(update.body.data.password).toBeUndefined();
    });
});

describe('Admin user management', () => {
    it('blocks non-admins from listing users', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });
        const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('lets an admin list, update, and deactivate another user', async () => {
        const { token: adminToken } = await createUserWithToken({ role: 'admin' });
        const { user: target } = await createUserWithToken({ role: 'viewer' });

        const list = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
        expect(list.status).toBe(200);
        expect(list.body.users.length).toBeGreaterThanOrEqual(2);

        const promote = await request(app)
            .patch(`/api/v1/users/${target._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'analyst' });
        expect(promote.status).toBe(200);
        expect(promote.body.data.role).toBe('analyst');

        const deactivate = await request(app)
            .patch(`/api/v1/users/${target._id}/deactivate`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(deactivate.status).toBe(200);
    });

    it('prevents an admin from deactivating their own account', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });

        const res = await request(app)
            .patch(`/api/v1/users/${user._id}/deactivate`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
    });
});
