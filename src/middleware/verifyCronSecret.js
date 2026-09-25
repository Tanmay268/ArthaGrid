const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

// Guards the internal rollup endpoint. This is deliberately NOT the usual
// authenticate/authorize pair — GitHub Actions has no user account or
// session to hold a JWT for, just a static shared secret (see
// decisions.md #18). If CRON_SECRET isn't configured at all, every request
// is rejected — there is no "open" fallback state.
const verifyCronSecret = (req, res, next) => {
    const configuredSecret = process.env.CRON_SECRET || '';
    const providedSecret = req.headers['x-cron-secret'] || '';

    const expected = Buffer.from(configuredSecret);
    const provided = Buffer.from(String(providedSecret));

    // Length check first — crypto.timingSafeEqual throws on mismatched
    // buffer lengths rather than returning false.
    const isValid = configuredSecret.length > 0
        && expected.length === provided.length
        && crypto.timingSafeEqual(expected, provided);

    if (!isValid) throw ApiError.unauthorized('Invalid or missing cron secret');
    next();
};

module.exports = verifyCronSecret;
