const request = require('supertest');
const app     = require('../src/app');
const { connect, disconnect, clearCollections } = require('./helpers');
const { User }        = require('../src/models/User');
const { Transaction } = require('../src/models/Transaction');

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });

const getToken = async (role = 'analyst') => {
  const email = `${role}dash@t.com`;
  try {
    await User.create({ name: role, email, password: 'pass123', role });
  } catch (_) {}
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'pass123' });
  return res.body.data.token;
};

describe('GET /api/v1/dashboard/summary', () => {
  beforeEach(async () => { await clearCollections(); });

  it('analyst gets 200 and correct shape', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalIncome');
    expect(res.body.data).toHaveProperty('totalExpenses');
    expect(res.body.data).toHaveProperty('netBalance');
    expect(res.body.data).toHaveProperty('transactionCount');
    expect(res.body.data).toHaveProperty('savingsRate');
  });

  it('returns zeros shape when no transactions', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.totalIncome).toBe('number');
    expect(typeof res.body.data.netBalance).toBe('number');
  });

  it('viewer cannot access summary (403)', async () => {
    await User.create({ name: 'viewer', email: 'vdash@t.com', password: 'pass123', role: 'viewer' });
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'vdash@t.com', password: 'pass123' });
    const token = r.body.data.token;

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when endDate is before startDate', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/summary?startDate=2024-12-01&endDate=2024-01-01')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/by-category', () => {
  beforeEach(async () => { await clearCollections(); });

  it('returns income/expense grouped shape', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/by-category')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('income');
    expect(res.body.data).toHaveProperty('expense');
    expect(Array.isArray(res.body.data.income)).toBe(true);
    expect(Array.isArray(res.body.data.expense)).toBe(true);
  });

  it('returns 400 for invalid type query param', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/by-category?type=invalid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/dashboard/trends', () => {
  beforeEach(async () => { await clearCollections(); });

  it('returns array of trend periods', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/trends?period=monthly&year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('defaults to monthly period', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/trends')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid period', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/trends?period=yearly')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('viewer cannot access trends (403)', async () => {
    await User.create({ name: 'v2', email: 'v2dash@t.com', password: 'pass123', role: 'viewer' });
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'v2dash@t.com', password: 'pass123' });
    const res = await request(app)
      .get('/api/v1/dashboard/trends')
      .set('Authorization', `Bearer ${r.body.data.token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dashboard/recent', () => {
  beforeEach(async () => { await clearCollections(); });

  it('analyst gets 200 and array', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/recent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('viewer CAN access recent (read:dashboard permission)', async () => {
    await User.create({ name: 'vr', email: 'vrdash@t.com', password: 'pass123', role: 'viewer' });
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'vrdash@t.com', password: 'pass123' });
    const res = await request(app)
      .get('/api/v1/dashboard/recent')
      .set('Authorization', `Bearer ${r.body.data.token}`);
    expect(res.status).toBe(200);
  });

  it('returns 400 when limit exceeds 20', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/recent?limit=999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/dashboard/overview', () => {
  beforeEach(async () => { await clearCollections(); });

  it('returns facet overview with all required sections', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('topExpenseCategories');
    expect(res.body.data).toHaveProperty('typeBreakdown');
    expect(res.body.data).toHaveProperty('recentVsPrevious');
  });

  it('viewer cannot access overview (403)', async () => {
    await User.create({ name: 'vo', email: 'vodash@t.com', password: 'pass123', role: 'viewer' });
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'vodash@t.com', password: 'pass123' });
    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${r.body.data.token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dashboard/audit', () => {
  beforeEach(async () => { await clearCollections(); });

  it('admin can access audit log', async () => {
    await User.create({ name: 'admin', email: 'adminaudit@t.com', password: 'pass123', role: 'admin' });
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'adminaudit@t.com', password: 'pass123' });
    const token = r.body.data.token;

    const res = await request(app)
      .get('/api/v1/dashboard/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('analyst cannot access audit log (403)', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/dashboard/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('viewer cannot access audit log (403)', async () => {
    await User.create({ name: 'av', email: 'avdash@t.com', password: 'pass123', role: 'viewer' });
    const r = await request(app).post('/api/v1/auth/login').send({ email: 'avdash@t.com', password: 'pass123' });
    const res = await request(app)
      .get('/api/v1/dashboard/audit')
      .set('Authorization', `Bearer ${r.body.data.token}`);
    expect(res.status).toBe(403);
  });
});
