const request = require('supertest');
const app     = require('../src/app');
const { connect, disconnect, clearCollections } = require('./helpers');
const { User }        = require('../src/models/User');
const { Transaction } = require('../src/models/Transaction');

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });

// ── Helpers ──────────────────────────────────────────────────────────────────
const getToken = async (role = 'admin') => {
  const emails = { admin: 'admin@t.com', analyst: 'analyst@t.com', viewer: 'viewer@t.com' };
  await User.create({ name: role, email: emails[role], password: 'pass123', role });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: emails[role], password: 'pass123' });
  return res.body.data.token;
};

const createTx = (overrides = {}) => ({
  amount: 1000,
  type: 'income',
  category: 'salary',
  date: '2024-06-15',
  description: 'Test transaction',
  ...overrides,
});

// ── CREATE ────────────────────────────────────────────────────────────────────
describe('POST /api/v1/transactions', () => {
  it('admin can create a transaction', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(createTx());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(1000);
    expect(res.body.data.type).toBe('income');
  });

  it('analyst cannot create a transaction (403)', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(createTx());

    expect(res.status).toBe(403);
  });

  it('viewer cannot create a transaction (403)', async () => {
    const token = await getToken('viewer');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(createTx());

    expect(res.status).toBe(403);
  });

  it('returns 400 on negative amount', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(createTx({ amount: -500 }));

    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid type', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(createTx({ type: 'revenue' }));

    expect(res.status).toBe(400);
  });

  it('returns 400 on future date', async () => {
    const token = await getToken('admin');
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(createTx({ date: '2099-01-01' }));

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .send(createTx());

    expect(res.status).toBe(401);
  });
});

// ── READ ──────────────────────────────────────────────────────────────────────
describe('GET /api/v1/transactions', () => {
  let adminToken, adminUser;

  beforeEach(async () => {
    await clearCollections();
    adminToken = await getToken('admin');
    await getToken('analyst');
    await getToken('viewer');
    adminUser  = await User.findOne({ role: 'admin' });

    await Transaction.insertMany([
      { amount: 5000, type: 'income',  category: 'salary',    date: '2024-01-15', createdBy: adminUser._id },
      { amount: 2000, type: 'expense', category: 'housing',   date: '2024-02-10', createdBy: adminUser._id },
      { amount: 1500, type: 'income',  category: 'freelance', date: '2024-03-05', createdBy: adminUser._id },
      { amount: 300,  type: 'expense', category: 'food',      date: '2024-03-20', createdBy: adminUser._id },
    ]);
  });

  it('returns paginated transactions', async () => {
    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(4);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(4);
  });

  it('filters by type', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?type=income')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions.every(t => t.type === 'income')).toBe(true);
    expect(res.body.transactions).toHaveLength(2);
  });

  it('filters by category', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?category=salary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].category).toBe('salary');
  });

  it('filters by date range', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?startDate=2024-02-01&endDate=2024-03-15')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
  });

  it('paginates correctly', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.pagination.pages).toBe(2);
    expect(res.body.pagination.hasNext).toBe(true);
  });

  it('analyst can read transactions', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('viewer can read transactions', async () => {
    const token = await getToken('viewer');
    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 400 when endDate is before startDate', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?startDate=2024-12-01&endDate=2024-01-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
describe('PATCH /api/v1/transactions/:id', () => {
  let adminToken, txId;

  beforeEach(async () => {
    await clearCollections();
    adminToken = await getToken('admin');
    await getToken('analyst');
    const user = await User.findOne({ role: 'admin' });
    const tx   = await Transaction.create({
      amount: 1000, type: 'income', category: 'salary',
      date: '2024-05-01', createdBy: user._id,
    });
    txId = tx._id.toString();
  });

  it('admin can update a transaction', async () => {
    const res = await request(app)
      .patch(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 2000, description: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(2000);
    expect(res.body.data.description).toBe('Updated');
  });

  it('returns 400 on empty body', async () => {
    const res = await request(app)
      .patch(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid ObjectId', async () => {
    const res = await request(app)
      .patch('/api/v1/transactions/not-valid-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 500 });

    expect(res.status).toBe(400);
  });

  it('returns 404 on non-existent transaction', async () => {
    const res = await request(app)
      .patch('/api/v1/transactions/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 500 });

    expect(res.status).toBe(404);
  });

  it('analyst cannot update (403)', async () => {
    const token = await getToken('analyst');
    const res = await request(app)
      .patch(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });

    expect(res.status).toBe(403);
  });
});

// ── DELETE (soft) ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/transactions/:id', () => {
  let adminToken, txId;

  beforeEach(async () => {
    await clearCollections();
    adminToken = await getToken('admin');
    await getToken('viewer');
    const user = await User.findOne({ role: 'admin' });
    const tx   = await Transaction.create({
      amount: 500, type: 'expense', category: 'food',
      date: '2024-04-01', createdBy: user._id,
    });
    txId = tx._id.toString();
  });

  it('admin can soft delete a transaction', async () => {
    const res = await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Transaction deleted successfully');
  });

  it('deleted transaction does not appear in list', async () => {
    await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const listRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    const ids = listRes.body.transactions.map(t => t._id);
    expect(ids).not.toContain(txId);
  });

  it('deleted transaction returns 404 on direct GET', async () => {
    await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('viewer cannot delete (403)', async () => {
    const token = await getToken('viewer');
    const res = await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
