const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const { LIVE, DEMO, currentTenant, runWithTenant } = require('../config/tenant');
const { demoRestrictionLabels } = require('../config/demoRestrictions');

// Demo refresh tokens carry a "d." prefix so refresh/logout know which database
// to look in without a second lookup (and without trusting anything unsigned
// beyond a routing hint — the hash must still match a stored row).
const DEMO_REFRESH_PREFIX = 'd.';
const tenantOfRefreshToken = (raw) => (String(raw).startsWith(DEMO_REFRESH_PREFIX) ? DEMO : LIVE);

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

const generateAccessToken = (userId) =>
    jwt.sign({ id: userId, ...(currentTenant() === DEMO ? { demo: true } : {}) }, process.env.JWT_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    });

const createRefreshToken = async (userId) => {
    const rawToken = (currentTenant() === DEMO ? DEMO_REFRESH_PREFIX : '') + crypto.randomBytes(40).toString('hex');
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const doc = await RefreshToken.create({
        user: userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
    });

    return { rawToken, doc };
};

const issueTokenPair = async (userId) => {
    const accessToken = generateAccessToken(userId);
    const { rawToken: refreshToken } = await createRefreshToken(userId);
    return { accessToken, refreshToken };
};

// Best-effort: a failed timestamp write must never fail a login.
const touchLastLogin = (userId) => {
    User.updateOne({ _id: userId }, { lastLoginAt: new Date() }).catch(() => {});
};

const sanitizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isDemo: currentTenant() === DEMO,
    ...(currentTenant() === DEMO ? { demoRestrictions: demoRestrictionLabels() } : {}),
});

const register = async ({ name, email, password, role }) => {
    // Demo logins live in their own database; keep their addresses reserved here too.
    const existing = await User.findOne({ email });
    const demoTaken = await runWithTenant(DEMO, () => User.exists({ email }));
    if (existing || demoTaken) throw ApiError.conflict('Email already registered');

    const user = await User.create({ name, email, password, role });
    const tokens = await issueTokenPair(user._id);

    return { user: sanitizeUser(user), ...tokens };
};

// Real accounts first; demo logins are only consulted when no real account owns the email.
const resolveLoginTenant = async (email) => {
    if (await runWithTenant(LIVE, () => User.exists({ email }))) return LIVE;
    if (await runWithTenant(DEMO, () => User.exists({ email }))) return DEMO;
    return LIVE;
};

const loginInTenant = async ({ email, password }) => {
    const user = await User.findOne({ email }).select('+password');
    if (!user) throw ApiError.unauthorized('Invalid credentials');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw ApiError.unauthorized('Invalid credentials');

    if (!user.isActive) throw ApiError.forbidden('Account deactivated');

    const tokens = await issueTokenPair(user._id);
    touchLastLogin(user._id);

    return { user: sanitizeUser(user), ...tokens };
};

// Refresh-token rotation: every refresh consumes the old token and issues a
// brand new one. If a token is presented that was already used (revoked),
// that's a strong signal it was stolen and replayed — so every active
// session for that user is killed and they're forced to log in again.
const refreshInTenant = async (rawToken) => {
    const tokenHash = hashToken(rawToken);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored) throw ApiError.unauthorized('Invalid refresh token');

    if (stored.revokedAt) {
        await RefreshToken.updateMany(
            { user: stored.user, revokedAt: null },
            { revokedAt: new Date() }
        );
        throw ApiError.unauthorized('Refresh token reuse detected — all sessions revoked. Please log in again.');
    }

    if (stored.expiresAt < new Date()) throw ApiError.unauthorized('Refresh token expired');

    const user = await User.findById(stored.user);
    if (!user || !user.isActive) throw ApiError.unauthorized('Account no longer active');

    const { rawToken: newRawToken, doc: newDoc } = await createRefreshToken(user._id);

    stored.revokedAt = new Date();
    stored.replacedByHash = newDoc.tokenHash;
    await stored.save();

    touchLastLogin(user._id);
    const accessToken = generateAccessToken(user._id);
    return { accessToken, refreshToken: newRawToken };
};

const logoutInTenant = async (rawToken) => {
    const tokenHash = hashToken(rawToken);
    // Idempotent — logging out twice, or with an already-expired token,
    // should never error out for the client.
    await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
};

const login = async (credentials) => {
    const tenant = await resolveLoginTenant(credentials.email);
    return runWithTenant(tenant, () => loginInTenant(credentials));
};
const refresh = (rawToken) => runWithTenant(tenantOfRefreshToken(rawToken), () => refreshInTenant(rawToken));
const logout = (rawToken) => runWithTenant(tenantOfRefreshToken(rawToken), () => logoutInTenant(rawToken));

module.exports = { register, login, refresh, logout };
