const rateLimit = require('express-rate-limit');

const createLimiter = (windowMinutes, max, message) => {
  // Bypass rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message } },
  });
};

const authLimiter      = createLimiter(15, 10,  'Too many attempts. Try again in 15 minutes.');
const apiLimiter       = createLimiter(15, 100, 'Too many requests. Please slow down.');
const dashboardLimiter = createLimiter(1,  60,  'Too many dashboard requests.');

module.exports = { authLimiter, apiLimiter, dashboardLimiter };
