const router      = require('express').Router();
const controller  = require('../../controllers/auth.controller');
const validate    = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rateLimiter');
const { registerSchema, loginSchema } = require('../../validators/auth.validator');

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login',    authLimiter, validate(loginSchema),    controller.login);
router.get( '/me',       authenticate,                          controller.getMe);

module.exports = router;
