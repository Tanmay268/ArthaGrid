const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { shouldSkipRateLimit } = require('../../config/rateLimit');
const controller = require('../../controllers/copilot.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { askSchema } = require('../../validators/copilot.validator');

// Tighter than the global limiter — bounds both Azure OpenAI's rate
// limits and the cost of someone hammering an endpoint that calls out to a
// third-party API on every request.
const copilotLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, error: { message: 'Too many questions. Please try again later.' } },
});

// Same gate as the other analytics endpoints — analyst/admin only.
router.use(authenticate);
router.use(authorize('read:analytics'));

router.post('/ask', copilotLimiter, validate(askSchema), controller.ask);

module.exports = router;
