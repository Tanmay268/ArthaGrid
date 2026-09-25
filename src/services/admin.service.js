const mongoose = require('mongoose');
const { User } = require('../models/User');
const { Transaction } = require('../models/Transaction');
const { getHttpSummary } = require('../config/metrics');
const { isConfigured: postgresConfigured, getPool } = require('../config/postgres');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/stats — platform-level numbers for the admin dashboard.
//
// Deliberately aggregate-only: counts and category shares, never an
// individual transaction's amount, description, or merchant. An admin can
// already read the ledger through /transactions; this view exists to show
// how the *platform* is doing, not to be another way into anyone's data.
// ─────────────────────────────────────────────────────────────────────────────

const getUserStats = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeSince = new Date(now.getTime() - 30 * DAY_MS);

    const [total, active, newThisMonth, activeLast30Days, byRole] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ createdAt: { $gte: monthStart } }),
        User.countDocuments({ lastLoginAt: { $gte: activeSince } }),
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ]);

    return {
        total,
        active,
        newThisMonth,
        activeLast30Days,
        byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])),
    };
};

const getTransactionStats = async () => {
    const live = { isDeleted: { $ne: true } };

    const [total, span, categories] = await Promise.all([
        Transaction.countDocuments(live),
        Transaction.aggregate([
            { $match: live },
            { $group: { _id: null, first: { $min: '$date' }, last: { $max: '$date' } } },
        ]),
        Transaction.aggregate([
            { $match: { ...live, type: 'expense' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 },
        ]),
    ]);

    const days = span[0] ? Math.max(1, Math.round((span[0].last - span[0].first) / DAY_MS) + 1) : 1;
    const expenseTotal = categories.reduce((s, c) => s + c.count, 0);

    return {
        total,
        dailyAverage: round2(total / days),
        popularExpenseCategories: categories.map((c) => ({
            category: c._id,
            count: c.count,
            sharePercent: expenseTotal ? round2((c.count / expenseTotal) * 100) : 0,
        })),
    };
};

const getSystemStats = async () => {
    const http = await getHttpSummary();
    const mem = process.memoryUsage();

    return {
        http,
        // In-memory counters: they reset on restart or when a free host idles
        // the instance, so this is "since last start", not lifetime.
        since: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
        nodeVersion: process.version,
        services: {
            mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            postgres: !postgresConfigured() ? 'not configured' : getPool() ? 'connected' : 'unavailable',
            copilot: process.env.GEMINI_API_KEY ? 'configured' : 'not configured',
            email: process.env.RESEND_API_KEY ? 'configured' : 'not configured',
        },
    };
};

const getAdminStats = async () => {
    const [users, transactions, system] = await Promise.all([getUserStats(), getTransactionStats(), getSystemStats()]);
    return { users, transactions, system };
};

module.exports = { getAdminStats };
