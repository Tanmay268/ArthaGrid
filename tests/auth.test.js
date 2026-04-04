const request = require('supertest');
const app     = require('../src/app');
const { connect, disconnect, clearCollections } = require('./helpers');
const { User } = require('../src/models/User');

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });
beforeEach(async () => { await clearCollections(); });

describe('POST /api/v1/auth/register', () => {
  it('registers a new user and returns token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 'test@test.com', password: 'pass123', role: 'viewer' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('test@test.com');
    expect(res.body.data.user.role).toBe('viewer');
  });

  it('returns 409 on duplicate email', async () => {
    await User.create({ name: 'Existing', email: 'dup@test.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Another', email: 'dup@test.com', password: 'pass123' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'no-name@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('returns 400 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'not-an-email', password: 'pass123' });

    expect(res.status).toBe(400);
  });

  it('defaults role to viewer when not specified', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email: 'default@test.com', password: 'pass123' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('viewer');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await User.create({ name: 'Login User', email: 'login@test.com', password: 'pass123', role: 'admin' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('admin');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  it('returns 401 on non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.com', password: 'pass123' });

    expect(res.status).toBe(401);
  });

  it('does not return password in response', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'pass123' });

    expect(res.body.data.user.password).toBeUndefined();
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns current user with valid token', async () => {
    await clearCollections();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Me User', email: 'me@test.com', password: 'pass123' });
    const token = reg.body.data.token;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@test.com');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.status).toBe(401);
  });
});
