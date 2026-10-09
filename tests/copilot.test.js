const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { Transaction } = require('../src/models/Transaction');

const originalFetch = global.fetch;
const originalApiKey = process.env.AZURE_OPENAI_API_KEY;
const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;

beforeAll(async () => db.connect());
afterEach(async () => {
    await db.clearDatabase();
    global.fetch = originalFetch;
    // undefined in this test env — see testUtils/env.js
    process.env.AZURE_OPENAI_API_KEY = originalApiKey;
    process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
});
afterAll(async () => db.closeDatabase());

const mockAzureSuccess = (text) => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: text } }] }),
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

    it('returns 503 when Azure OpenAI is not configured', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(503);
    });

    it('sends only pre-computed aggregates to Azure OpenAI, never a raw transaction', async () => {
        process.env.AZURE_OPENAI_API_KEY = 'test-key';
        process.env.AZURE_OPENAI_ENDPOINT = 'https://test-resource.openai.azure.com';
        const { token, user } = await createUserWithToken({ role: 'analyst' });

        await Transaction.create({
            amount: 500,
            type: 'expense',
            category: 'food',
            merchant: 'Some Secret Restaurant',
            description: 'a very private note about dinner',
            createdBy: user._id,
        });

        mockAzureSuccess('Your expenses look normal this month.');

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(200);
        expect(res.body.data.answer).toBe('Your expenses look normal this month.');
        expect(res.body.data.aggregates).toBeDefined();

        // Inspect exactly what was sent to Azure OpenAI — the actual privacy
        // guarantee, not just a comment claiming it.
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('test-resource.openai.azure.com');

        const sentText = JSON.parse(options.body).messages[1].content;
        expect(sentText).not.toContain('Some Secret Restaurant');
        expect(sentText).not.toContain('a very private note about dinner');
    });

    it('returns 503 when Azure OpenAI responds with an error', async () => {
        process.env.AZURE_OPENAI_API_KEY = 'test-key';
        process.env.AZURE_OPENAI_ENDPOINT = 'https://test-resource.openai.azure.com';
        const { token } = await createUserWithToken({ role: 'analyst' });

        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'Why did my spending increase?' });

        expect(res.status).toBe(503);
    });

    it('rejects a question that is too short', async () => {
        process.env.AZURE_OPENAI_API_KEY = 'test-key';
        process.env.AZURE_OPENAI_ENDPOINT = 'https://test-resource.openai.azure.com';
        const { token } = await createUserWithToken({ role: 'analyst' });

        const res = await request(app)
            .post('/api/v1/copilot/ask')
            .set('Authorization', `Bearer ${token}`)
            .send({ question: 'hi' });

        expect(res.status).toBe(400);
    });
});
