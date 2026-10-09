const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

const generateAccessToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    });

const createRefreshToken = async (userId) => {
    const rawToken = crypto.randomBytes(40).toString('hex');
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
    isDemo: Boolean(user.isDemo),
});

const register = async ({ name, email, password, role }) => {
    const existing = await User.findOne({ email });
    if (existing) throw ApiError.conflict('Email already registered');

    const user = await User.create({ name, email, password, role });
    const tokens = await issueTokenPair(user._id);

    return { user: sanitizeUser(user), ...tokens };
};

const login = async ({ email, password }) => {
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
const refresh = async (rawToken) => {
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

const logout = async (rawToken) => {
    const tokenHash = hashToken(rawToken);
    // Idempotent — logging out twice, or with an already-expired token,
    // should never error out for the client.
    await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
};

module.exports = { register, login, refresh, logout };
