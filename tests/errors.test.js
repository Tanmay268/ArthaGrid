const request = require('supertest');
const app     = require('../src/app');
const { connect, disconnect, clearCollections } = require('./helpers');

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });
beforeEach(async () => { await clearCollections(); });

describe('Error handling', () => {
  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/api/v1/doesnotexist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('not found');
  });

  it('returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": "test@test.com", "password": }');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid JSON in request body');
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('No token provided');
  });

  it('returns 401 with malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', 'Bearer totally.fake.token');
    expect(res.status).toBe(401);
  });

  it('health check returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('all error responses have consistent shape', async () => {
    const endpoints = [
      { method: 'get',  path: '/api/v1/transactions' },
      { method: 'get',  path: '/api/v1/dashboard/summary' },
      { method: 'get',  path: '/api/v1/users' },
    ];

    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.path);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error.message).toBe('string');
    }
  });
});
