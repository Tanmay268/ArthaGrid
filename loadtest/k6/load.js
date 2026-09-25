// k6 load test for ArthaGrid — free, open source (https://k6.io).
//
//   k6 run loadtest/k6/load.js
//   k6 run -e VUS=50 -e DURATION=30s loadtest/k6/load.js
//   k6 run --summary-export=loadtest/results/run.json loadtest/k6/load.js
//
// Simulates a realistic dashboard session: every virtual user repeatedly loads
// the pages the frontend actually loads (overview, transactions list,
// analytics, insights, budgets), with a small amount of write traffic and an
// occasional login mixed in.
//
// Thresholds are the pass/fail bar — if any fails, k6 exits non-zero:
//   • fewer than 1% of requests may fail
//   • 95% of requests must finish under 800 ms (2 s for the heavy analytics endpoints)

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5050';
const EMAIL = __ENV.LOGIN_EMAIL || 'loadtest-admin@example.com';
const PASSWORD = __ENV.LOGIN_PASSWORD || 'LoadTest123';
const VUS = Number(__ENV.VUS) || 20;
const DURATION = __ENV.DURATION || '30s';
// Writes clear the response cache (by design), so a cache measurement needs WRITE_RATE=0.
const WRITE_RATE = __ENV.WRITE_RATE === undefined ? 2 : Number(__ENV.WRITE_RATE);

const scenarios = {
    // Steady dashboard traffic — the bulk of real usage is reads.
    reads: { executor: 'constant-vus', vus: VUS, duration: DURATION, exec: 'browseDashboard' },
    // Login is deliberately expensive (bcrypt, cost 12) — keep it low-rate.
    logins: { executor: 'constant-arrival-rate', rate: 1, timeUnit: '1s', duration: DURATION, preAllocatedVUs: 2, exec: 'login' },
};
if (WRITE_RATE > 0) {
    // A trickle of writes.
    scenarios.writes = { executor: 'constant-arrival-rate', rate: WRITE_RATE, timeUnit: '1s', duration: DURATION, preAllocatedVUs: 2, exec: 'addTransaction' };
}

export const options = {
    scenarios,
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<800'],
        // Listing a threshold per endpoint is also what makes k6 print per-endpoint numbers.
        'http_req_duration{endpoint:summary}': ['p(95)<800'],
        'http_req_duration{endpoint:transactions}': ['p(95)<800'],
        'http_req_duration{endpoint:budgets}': ['p(95)<800'],
        'http_req_duration{endpoint:metrics}': ['p(95)<2000'],
        'http_req_duration{endpoint:insights}': ['p(95)<2000'],
        'http_req_duration{endpoint:forecast}': ['p(95)<2000'],
        'http_req_duration{endpoint:login}': ['p(95)<2000'],
    },
};

// Runs once: log in and share the token with every virtual user.
export function setup() {
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
        headers: { 'Content-Type': 'application/json' },
    });
    if (res.status !== 200) {
        throw new Error(`Setup login failed (${res.status}). Is the server running? Try: npm run loadtest:server`);
    }
    return { token: res.json('data.accessToken') };
}

const authed = (token, name) => ({
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { endpoint: name },
});

export function browseDashboard(data) {
    const get = (path, name) => {
        const res = http.get(`${BASE_URL}${path}`, authed(data.token, name));
        check(res, { [`${name} is 200`]: (r) => r.status === 200 });
    };

    get('/api/v1/dashboard/summary', 'summary');
    get('/api/v1/transactions?page=1&limit=20', 'transactions');
    get('/api/v1/budgets', 'budgets');
    get('/api/v1/analytics/metrics', 'metrics');
    get('/api/v1/analytics/insights', 'insights');
    get('/api/v1/analytics/forecast?months=3', 'forecast');
    sleep(1); // a person reads the page before clicking again
}

export function addTransaction(data) {
    const res = http.post(
        `${BASE_URL}/api/v1/transactions`,
        JSON.stringify({ amount: 100 + Math.round(Math.random() * 900), type: 'expense', category: 'food', description: 'k6 load test' }),
        authed(data.token, 'create-transaction')
    );
    check(res, { 'create is 201': (r) => r.status === 201 });
}

export function login() {
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'login' },
    });
    check(res, { 'login is 200': (r) => r.status === 200 });
}
