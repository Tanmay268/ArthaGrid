const router = require('express').Router();
const { register, login, refresh, logout } = require('../../controllers/auth.controller');
const validate = require('../../middleware/validate');
const extractRefreshToken = require('../../middleware/extractRefreshToken');
const { registerSchema, loginSchema, refreshSchema, logoutSchema } = require('../../validators/auth.validator');
const rateLimit = require('express-rate-limit');
const { shouldSkipRateLimit } = require('../../config/rateLimit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, //15 minutes
    max: 10,
    skip: shouldSkipRateLimit, // real rate limiting stays on in dev/production
    message: {
        success: false,
        error: {
            message: 'Too many attempts. Try again later.'
        },
    },
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', authLimiter, validate(refreshSchema), extractRefreshToken, refresh);
router.post('/logout', validate(logoutSchema), extractRefreshToken, logout);

module.exports = router;
