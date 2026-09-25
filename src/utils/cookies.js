// Refresh-token cookie for the browser frontend (see decisions.md #21).
//
// This is issued ALONGSIDE the existing JSON `refreshToken` field, never
// instead of it — non-browser API clients keep working exactly as before.

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth'; // only ever sent to auth endpoints, not the whole API

const refreshCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 7;

    return {
        httpOnly: true, // never readable by JavaScript — the whole point of this decision
        // The frontend and API are deployed on different domains (e.g. Vercel +
        // Render), so the cookie must be sendable cross-site. That requires
        // SameSite=None, which browsers only honor alongside Secure (HTTPS).
        // Locally, http:// dev doesn't support Secure, so Lax is used instead —
        // it's not cross-site there anyway during same-machine development.
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: REFRESH_COOKIE_PATH,
        maxAge: days * 24 * 60 * 60 * 1000,
    };
};

const setRefreshCookie = (res, token) => {
    res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
};

const clearRefreshCookie = (res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
};

module.exports = { REFRESH_COOKIE_NAME, setRefreshCookie, clearRefreshCookie };
