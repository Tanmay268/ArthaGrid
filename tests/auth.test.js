const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('POST /api/v1/auth/register', () => {
    it('creates a user and returns an access + refresh token pair', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'jane@test.com',
            password: 'Password123',
        });

        expect(res.status).toBe(201);
        expect(res.body.data.user.email).toBe('jane@test.com');
        expect(res.body.data.user.password).toBeUndefined();
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('rejects a weak password', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'jane2@test.com',
            password: 'weak',
        });

        expect(res.status).toBe(400);
    });

    it('rejects a duplicate email', async () => {
        const payload = { name: 'Jane Doe', email: 'dupe@test.com', password: 'Password123' };
        await request(app).post('/api/v1/auth/register').send(payload);
        const res = await request(app).post('/api/v1/auth/register').send(payload);

        expect(res.status).toBe(409);
    });
});

describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials', async () => {
        await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'login@test.com',
            password: 'Password123',
        });

        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'login@test.com',
            password: 'Password123',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
    });

    it('rejects an incorrect password', async () => {
        await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'login2@test.com',
            password: 'Password123',
        });

        const res = await request(app).post('/api/v1/auth/login').send({
            email: 'login2@test.com',
            password: 'WrongPassword1',
        });

        expect(res.status).toBe(401);
    });
});

describe('POST /api/v1/auth/refresh', () => {
    const register = () =>
        request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'refresh@test.com',
            password: 'Password123',
        });

    it('exchanges a valid refresh token for a new pair', async () => {
        const { body } = await register();
        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: body.data.refreshToken });

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        expect(res.body.data.refreshToken).not.toBe(body.data.refreshToken);
    });

    it('rejects reuse of an already-rotated refresh token and kills the session', async () => {
        const { body } = await register();
        const originalRefreshToken = body.data.refreshToken;

        // First use rotates it successfully
        const firstRefresh = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: originalRefreshToken });
        expect(firstRefresh.status).toBe(200);

        // Reusing the now-revoked token must fail...
        const reuse = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: originalRefreshToken });
        expect(reuse.status).toBe(401);

        // ...and must have revoked the token issued by the first refresh too
        const afterReuse = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: firstRefresh.body.data.refreshToken });
        expect(afterReuse.status).toBe(401);
    });
});

describe('POST /api/v1/auth/logout', () => {
    it('revokes the refresh token so it can no longer be used', async () => {
        const { body } = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'logout@test.com',
            password: 'Password123',
        });

        const logoutRes = await request(app)
            .post('/api/v1/auth/logout')
            .send({ refreshToken: body.data.refreshToken });
        expect(logoutRes.status).toBe(200);

        const refreshRes = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: body.data.refreshToken });
        expect(refreshRes.status).toBe(401);
    });
});

// The browser frontend relies on the httpOnly cookie instead of holding the
// refresh token itself (decisions.md #21) — these tests drive that path
// specifically, separate from the body-based flow every test above uses.
describe('httpOnly refresh-token cookie (decisions.md #21)', () => {
    const getCookieValue = (res, name) => {
        const setCookieHeaders = res.headers['set-cookie'] || [];
        const match = setCookieHeaders.find((c) => c.startsWith(`${name}=`));
        return match ? match.split(';')[0].split('=')[1] : null;
    };

    it('sets an httpOnly refresh-token cookie on register and login', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'cookie-register@test.com',
            password: 'Password123',
        });

        const setCookieHeaders = res.headers['set-cookie'] || [];
        const refreshCookie = setCookieHeaders.find((c) => c.startsWith('refreshToken='));

        expect(refreshCookie).toBeDefined();
        expect(refreshCookie).toMatch(/HttpOnly/i);
        expect(getCookieValue(res, 'refreshToken')).toBe(res.body.data.refreshToken);
    });

    it('accepts a refresh via the cookie alone, given the required client header', async () => {
        const register = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'cookie-refresh@test.com',
            password: 'Password123',
        });
        const cookieValue = getCookieValue(register, 'refreshToken');

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', `refreshToken=${cookieValue}`)
            .set('X-ArthaGrid-Client', 'web')
            .send({}); // no body token — the cookie is the only source

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        // The cookie is refreshed too, on the same rotation as the JSON token.
        expect(getCookieValue(res, 'refreshToken')).toBe(res.body.data.refreshToken);
    });

    it('rejects a cookie-only refresh missing the required client header (CSRF guard)', async () => {
        const register = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'cookie-csrf@test.com',
            password: 'Password123',
        });
        const cookieValue = getCookieValue(register, 'refreshToken');

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', `refreshToken=${cookieValue}`)
            .send({}); // no X-ArthaGrid-Client header, simulating a cross-site <form> POST

        expect(res.status).toBe(403);
    });

    it('rejects a refresh with neither a body token nor a cookie', async () => {
        const res = await request(app).post('/api/v1/auth/refresh').send({});
        expect(res.status).toBe(400);
    });

    it('clears the cookie on logout', async () => {
        const register = await request(app).post('/api/v1/auth/register').send({
            name: 'Jane Doe',
            email: 'cookie-logout@test.com',
            password: 'Password123',
        });
        const cookieValue = getCookieValue(register, 'refreshToken');

        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Cookie', `refreshToken=${cookieValue}`)
            .set('X-ArthaGrid-Client', 'web')
            .send({});

        expect(res.status).toBe(200);
        const setCookieHeaders = res.headers['set-cookie'] || [];
        const cleared = setCookieHeaders.find((c) => c.startsWith('refreshToken='));
        expect(cleared).toMatch(/refreshToken=;/); // cleared — empty value
    });
});
