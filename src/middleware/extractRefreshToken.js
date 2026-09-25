const ApiError = require('../utils/ApiError');
const { REFRESH_COOKIE_NAME } = require('../utils/cookies');

// A browser frontend never has to hold its own refresh token — it relies on
// the httpOnly cookie the server already set (decisions.md #21). Non-browser
// API clients keep sending { refreshToken } in the body, exactly as before
// this existed.
//
// Cross-domain deployment (a Vercel frontend calling a Render API) requires
// the cookie to be SameSite=None, which reopens the CSRF door SameSite=Strict
// would otherwise close: a plain cross-site <form> POST rides along with the
// ambient cookie with no JavaScript involved at all. The fix is requiring a
// custom header whenever the cookie is the token's source — a bare HTML form
// can never set one, and a script-driven fetch/XHR that does set one forces a
// CORS preflight, which the server only lets through for the configured
// CORS_ORIGIN. That closes the gap without needing a full CSRF-token scheme.
const CSRF_HEADER = 'x-arthagrid-client';
const CSRF_HEADER_VALUE = 'web';

const extractRefreshToken = (req, res, next) => {
    if (req.body.refreshToken) {
        req.refreshToken = req.body.refreshToken;
        return next();
    }

    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (cookieToken) {
        if (req.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE) {
            throw ApiError.forbidden('Missing required client header');
        }
        req.refreshToken = cookieToken;
        return next();
    }

    throw ApiError.badRequest('No refresh token provided');
};

module.exports = extractRefreshToken;
