const ApiError = require('../utils/ApiError');
const safeEqual = require('../utils/safeEqual');

// Guards GET /metrics. Uses a standard `Authorization: Bearer <token>` header
// because that's what Prometheus (`authorization.credentials`) and Grafana
// Alloy support natively for scraping. Fails closed: with METRICS_TOKEN unset,
// the endpoint answers 401 to everyone — metrics can expose route names and
// traffic shape, so there's no "open by default" mode.
const verifyMetricsToken = (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!safeEqual(process.env.METRICS_TOKEN, token)) {
        throw ApiError.unauthorized('Invalid or missing metrics token');
    }
    next();
};

module.exports = verifyMetricsToken;
