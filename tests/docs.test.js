const request = require('supertest');
const app = require('../src/app');

describe('API docs URLs', () => {
    it('redirects the legacy /api/docs link to /api-docs/', async () => {
        for (const path of ['/api/docs', '/api/docs/']) {
            const res = await request(app).get(path);
            expect(res.status).toBe(301);
            expect(res.headers.location).toBe('/api-docs/');
        }
    });

    it('serves Swagger UI at /api-docs/', async () => {
        const res = await request(app).get('/api-docs/');
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/swagger/i);
    });
});
