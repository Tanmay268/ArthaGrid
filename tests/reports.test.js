const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');
const { User } = require('../src/models/User');
const { getWeeklyReport } = require('../src/services/report.service');
const { renderHtml } = require('../src/services/reportMailer.service');

const originalFetch = global.fetch;
const ENV_KEYS = ['RESEND_API_KEY', 'REPORT_ALLOWED_RECIPIENTS'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

beforeAll(async () => db.connect());
afterEach(async () => {
    await db.clearDatabase();
    global.fetch = originalFetch;
    ENV_KEYS.forEach((k) => (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k])));
});
afterAll(async () => db.closeDatabase());

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const cron = { 'X-Cron-Secret': 'test_only_cron_secret' };

describe('getWeeklyReport', () => {
    it('totals the last 7 days, compares against the 7 before, and ignores soft-deleted rows', async () => {
        const { user } = await createUserWithToken({ role: 'admin' });
        await Transaction.create([
            { amount: 1000, type: 'income', category: 'salary', date: daysAgo(2), createdBy: user._id },
            { amount: 300, type: 'expense', category: 'food', date: daysAgo(3), createdBy: user._id },
            { amount: 200, type: 'expense', category: 'food', date: daysAgo(9), createdBy: user._id }, // previous week
            { amount: 999, type: 'expense', category: 'shopping', date: daysAgo(1), createdBy: user._id, isDeleted: true },
        ]);

        const r = await getWeeklyReport();

        expect(r.income).toBe(1000);
        expect(r.expenses).toBe(300); // deleted 999 excluded, previous-week 200 excluded
        expect(r.savings).toBe(700);
        expect(r.vsLastWeek.expensesChangePercent).toBe(50); // 200 -> 300
        expect(r.topCategory).toEqual({ category: 'food', total: 300 });
    });
});

describe('GET /api/v1/analytics/weekly-report', () => {
    it('is analyst/admin only', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });
        const res = await request(app).get('/api/v1/analytics/weekly-report').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('returns the report for an analyst', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });
        const res = await request(app).get('/api/v1/analytics/weekly-report').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('savings');
    });
});

describe('email template', () => {
    it('escapes user-controlled text so it cannot inject markup', async () => {
        const report = await getWeeklyReport();
        const html = renderHtml(report, '<script>alert(1)</script>');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

describe('POST /api/v1/internal/jobs/weekly-report', () => {
    it('rejects requests without the cron secret', async () => {
        const res = await request(app).post('/api/v1/internal/jobs/weekly-report');
        expect(res.status).toBe(401);
    });

    it('reports "skipped" when no email provider is configured', async () => {
        const res = await request(app).post('/api/v1/internal/jobs/weekly-report').set(cron);
        expect(res.status).toBe(200);
        expect(res.body.data.skipped).toBe(true);
    });

    it('emails only opted-in, active users — and never sends transaction descriptions', async () => {
        process.env.RESEND_API_KEY = 'test-key';
        const { user: admin } = await createUserWithToken({ role: 'admin' });
        await createUserWithToken({ role: 'viewer', email: 'optedout@test.com' });
        const { user: optedIn } = await createUserWithToken({ role: 'viewer', email: 'optedin@test.com' });
        await User.updateOne({ _id: optedIn._id }, { 'preferences.weeklyReport': true });
        await Transaction.create({
            amount: 500, type: 'expense', category: 'food', date: daysAgo(1),
            description: 'very private dinner note', merchant: 'Secret Bistro', createdBy: admin._id,
        });

        global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });

        const res = await request(app).post('/api/v1/internal/jobs/weekly-report').set(cron);

        expect(res.body.data).toMatchObject({ recipients: 1, sent: 1, failed: 0 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('api.resend.com');
        const body = JSON.parse(options.body);
        expect(body.to).toEqual(['optedin@test.com']);
        expect(body.html).not.toContain('very private dinner note');
        expect(body.html).not.toContain('Secret Bistro');
        expect(JSON.stringify(res.body)).not.toContain('optedin@test.com'); // no addresses in the response
    });

    it('honours the recipient allowlist', async () => {
        process.env.RESEND_API_KEY = 'test-key';
        process.env.REPORT_ALLOWED_RECIPIENTS = 'allowed@test.com';
        const { user: a } = await createUserWithToken({ role: 'viewer', email: 'allowed@test.com' });
        const { user: b } = await createUserWithToken({ role: 'viewer', email: 'stranger@test.com' });
        await User.updateMany({ _id: { $in: [a._id, b._id] } }, { 'preferences.weeklyReport': true });

        global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
        const res = await request(app).post('/api/v1/internal/jobs/weekly-report').set(cron);

        expect(res.body.data).toMatchObject({ recipients: 1, sent: 1, excludedByAllowlist: 1 });
    });

    it('counts a provider failure without failing the whole run', async () => {
        process.env.RESEND_API_KEY = 'test-key';
        const { user } = await createUserWithToken({ role: 'viewer', email: 'x@test.com' });
        await User.updateOne({ _id: user._id }, { 'preferences.weeklyReport': true });

        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
        const res = await request(app).post('/api/v1/internal/jobs/weekly-report').set(cron);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ recipients: 1, sent: 0, failed: 1 });
    });
});

describe('weekly report preference', () => {
    it('lets a user opt in and out via PATCH /users/me', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });
        const auth = { Authorization: `Bearer ${token}` };

        const on = await request(app).patch('/api/v1/users/me').set(auth).send({ weeklyReport: true });
        expect(on.body.data.preferences.weeklyReport).toBe(true);

        const off = await request(app).patch('/api/v1/users/me').set(auth).send({ weeklyReport: false });
        expect(off.body.data.preferences.weeklyReport).toBe(false);
    });
});
