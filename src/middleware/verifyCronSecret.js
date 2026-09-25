const ApiError = require('../utils/ApiError');
const safeEqual = require('../utils/safeEqual');

// Guards the internal job endpoints (rollup, weekly report). This is
// deliberately NOT the usual authenticate/authorize pair — GitHub Actions has
// no user account or session to hold a JWT for, just a static shared secret
// (see decisions.md #18). If CRON_SECRET isn't configured at all, every
// request is rejected — there is no "open" fallback state.
const verifyCronSecret = (req, res, next) => {
    if (!safeEqual(process.env.CRON_SECRET, req.headers['x-cron-secret'])) {
        throw ApiError.unauthorized('Invalid or missing cron secret');
    }
    next();
};

module.exports = verifyCronSecret;
