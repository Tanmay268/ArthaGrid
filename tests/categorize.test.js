const request = require('supertest');
const app = require('../src/app');
const db = require('./testUtils/db');
const { createUserWithToken } = require('./testUtils/factories');
const { trainModel, predict, seedExamples } = require('../src/services/categorize.service');
const holdout = require('./fixtures/categorizerHoldout');

beforeAll(async () => db.connect());
afterEach(async () => db.clearDatabase());
afterAll(async () => db.closeDatabase());

describe('category classifier (pure)', () => {
    it('generalises to held-out phrases it was never trained on', () => {
        const model = trainModel(seedExamples());
        const correct = holdout.filter((h) => predict(model, h.text, h.type).alternatives[0]?.category === h.category);
        // Floor set well below the measured ~95% on purpose: this guards against
        // regressions, and the honest numbers live in `npm run eval:categorizer`.
        expect(correct.length / holdout.length).toBeGreaterThanOrEqual(0.8);
    });

    it('is forgiving of a typo via character trigrams', () => {
        const model = trainModel(seedExamples());
        expect(predict(model, 'swigy', 'expense').suggestion.category).toBe('food');
    });

    it('never labels an expense with an income category when the type is given', () => {
        const model = trainModel(seedExamples());
        const result = predict(model, 'monthly salary credited', 'expense');
        expect(['salary', 'freelance', 'investment', 'gift', 'other_income']).not.toContain(result.alternatives[0]?.category);
    });

    it('abstains rather than guessing when it recognises nothing', () => {
        const model = trainModel(seedExamples());
        const result = predict(model, 'qzxv wplk', 'expense');
        expect(result.suggestion).toBeNull();
        // Either path is a correct abstention: nothing recognised at all, or
        // only an incidental shared trigram (e.g. "lk#" from "milk").
        expect(['no_known_words', 'low_confidence']).toContain(result.reason);
    });
});

describe('POST /api/v1/transactions/suggest-category', () => {
    it('is blocked for non-admins (same gate as creating a transaction)', async () => {
        const { token } = await createUserWithToken({ role: 'analyst' });
        const res = await request(app)
            .post('/api/v1/transactions/suggest-category')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'swiggy dinner' });
        expect(res.status).toBe(403);
    });

    it('requires a description or a merchant', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await request(app)
            .post('/api/v1/transactions/suggest-category')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });

    it('suggests a category from a description', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await request(app)
            .post('/api/v1/transactions/suggest-category')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'Swiggy dinner', type: 'expense' });

        expect(res.status).toBe(200);
        expect(res.body.data.suggestion.category).toBe('food');
        expect(res.body.data.basedOn.seedExamples).toBeGreaterThan(100);
    });

    it("learns from the ledger's own history, which outweighs the seed", async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const auth = { Authorization: `Bearer ${token}` };

        const before = await request(app)
            .post('/api/v1/transactions/suggest-category')
            .set(auth)
            .send({ merchant: 'Zorbatek', type: 'expense' });
        expect(before.body.data.suggestion).toBeNull(); // never seen this word

        // Created through the API so the ledger-changed signal fires and the model retrains.
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/api/v1/transactions')
                .set(auth)
                .send({ amount: 500 + i, type: 'expense', category: 'education', merchant: 'Zorbatek' });
        }

        const after = await request(app)
            .post('/api/v1/transactions/suggest-category')
            .set(auth)
            .send({ merchant: 'Zorbatek', type: 'expense' });
        expect(after.body.data.suggestion.category).toBe('education');
        expect(after.body.data.basedOn.ledgerExamples).toBe(3);
    });
});
