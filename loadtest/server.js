// Self-contained server for load testing — NOT for production use.
//
//   npm run loadtest:server
//
// Starts the real Express app against an in-memory MongoDB (no Atlas account,
// nothing to install, nothing to clean up), seeded with a known admin user
// and a realistic amount of data, with rate limiting switched off so the
// numbers measure the app rather than the 300-requests/15-min cap.
//
// Knobs (environment variables):
//   PORT                          default 5050
//   SEED_TRANSACTIONS             default 5000
//   ANALYTICS_CACHE_TTL_SECONDS   default 0  (set to 30 to measure the cache)

process.env.NODE_ENV = 'development'; // DISABLE_RATE_LIMIT is deliberately ignored in production
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'loadtest_only_secret_at_least_32_characters_long';
process.env.ACCESS_TOKEN_EXPIRES_IN = '2h'; // outlast a long test run
process.env.LOG_LEVEL = 'error';
process.env.ANALYTICS_CACHE_TTL_SECONDS = process.env.ANALYTICS_CACHE_TTL_SECONDS ?? '0';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.PORT) || 5050;
const SEED_TRANSACTIONS = Number(process.env.SEED_TRANSACTIONS) || 5000;

const CATEGORY_WEIGHTS = [
    ['food', 30], ['transport', 15], ['shopping', 12], ['utilities', 10], ['entertainment', 8],
    ['housing', 8], ['healthcare', 6], ['education', 5], ['other_expense', 6],
];
const pickCategory = () => {
    let r = Math.random() * CATEGORY_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    for (const [c, w] of CATEGORY_WEIGHTS) { if ((r -= w) <= 0) return c; }
    return 'food';
};

(async () => {
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const { User } = require('../src/models/User');
    const { Transaction } = require('../src/models/Transaction');
    const { Budget } = require('../src/models/Budget');

    const admin = await User.create({
        name: 'Load Test Admin', email: 'loadtest-admin@example.com', password: 'LoadTest123', role: 'admin',
    });

    // ~24 months of history, ~1 income per 8 transactions, amounts with a realistic spread
    const now = Date.now();
    const docs = [];
    for (let i = 0; i < SEED_TRANSACTIONS; i++) {
        const isIncome = i % 8 === 0;
        docs.push({
            amount: isIncome ? 20000 + Math.round(Math.random() * 60000) : 50 + Math.round(Math.random() * 3000),
            type: isIncome ? 'income' : 'expense',
            category: isIncome ? 'salary' : pickCategory(),
            merchant: isIncome ? null : ['Swiggy', 'Uber', 'Amazon', 'Netflix', null][i % 5],
            description: isIncome ? 'Salary' : `Seeded transaction ${i}`,
            date: new Date(now - Math.random() * 730 * 24 * 60 * 60 * 1000),
            createdBy: admin._id,
        });
    }
    await Transaction.insertMany(docs, { ordered: false });
    await Budget.create(['food', 'transport', 'shopping', 'entertainment', 'utilities'].map((category) => ({
        category, monthlyLimit: 8000, createdBy: admin._id,
    })));

    const app = require('../src/app');
    const server = app.listen(PORT, () => {
        console.log(`\nLoad-test server ready on http://localhost:${PORT}`);
        console.log(`  seeded:  ${SEED_TRANSACTIONS} transactions, 5 budgets, 1 admin`);
        console.log(`  login:   loadtest-admin@example.com / LoadTest123`);
        console.log(`  cache:   ANALYTICS_CACHE_TTL_SECONDS=${process.env.ANALYTICS_CACHE_TTL_SECONDS}`);
        console.log('  Ctrl+C to stop.\n');
    });

    const stop = async () => { server.close(); await mongoose.disconnect(); await mongod.stop(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
})().catch((err) => { console.error(err); process.exit(1); });
