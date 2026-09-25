<<<<<<< HEAD
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
=======
const router      = require('express').Router();
const controller  = require('../../controllers/auth.controller');
const validate    = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rateLimiter');
const { registerSchema, loginSchema } = require('../../validators/auth.validator');

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login',    authLimiter, validate(loginSchema),    controller.login);
router.get( '/me',       authenticate,                          controller.getMe);
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

module.exports = router;
