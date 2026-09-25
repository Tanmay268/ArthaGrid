const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');

const originalFetch = global.fetch;
const originalApiKey = process.env.GEMINI_API_KEY;

beforeAll(async () => db.connect());
afterEach(async () => {
    await db.clearDatabase();
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalApiKey; // undefined in this test env — see testUtils/env.js
});
afterAll(async () => db.closeDatabase());

const mockGeminiSuccess = (text) => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    });
};

describe('POST /api/v1/copilot/ask', () => {
    it('is blocked for a viewer (same gate as other analytics endpoints)', async () => {
        const { token } = await createUserWithToken({ role: 'viewer' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(403);
    });

    it('returns 503 when GEMINI_API_KEY is not configured', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(503);
    });

    it('sends only pre-computed aggregates to Gemini, never a raw transaction', async () => {
        process.env.GEMINI_API_KEY = 'test-key';
        const { token, user } = await createUserWithToken({ role: 'analyst' });

        await Transaction.create({
            amount: 500,
            type: 'expense',
            category: 'food',
            merchant: 'Some Secret Restaurant',
            description: 'a very private note about dinner',
            createdBy: user._id,
        });

        mockGeminiSuccess('Your expenses look normal this month.');

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(200);
        expect(res.body.data.answer).toBe('Your expenses look normal this month.');
        expect(res.body.data.aggregates).toBeDefined();

        // Inspect exactly what was sent to Gemini — the actual privacy guarantee,
        // not just a comment claiming it.
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('generativelanguage.googleapis.com');

        const sentText = JSON.parse(options.body).contents[0].parts[0].text;
        expect(sentText).not.toContain('Some Secret Restaurant');
        expect(sentText).not.toContain('a very private note about dinner');
    });

    it('returns 503 when Gemini responds with an error', async () => {
        process.env.GEMINI_API_KEY = 'test-key';
        const { token } = await createUserWithToken({ role: 'analyst' });

        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(503);
    });

    it('rejects a question that is too short', async () => {
        process.env.GEMINI_API_KEY = 'test-key';
        const { token } = await createUserWithToken({ role: 'analyst' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'hi' });

        expect(res.status).toBe(400);
    });
});
