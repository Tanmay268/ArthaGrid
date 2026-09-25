<<<<<<< HEAD
const router = require('express').Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const cacheResponse = require('../../middleware/cacheResponse');
const {
  summarySchema,
  categorySchema,
  trendsSchema,
  recentSchema,
} = require('../../validators/dashboard.validator');

router.use(authenticate);
router.use(authorize('read:analytics'));
router.use(cacheResponse); // after authorize on purpose - see middleware/cacheResponse.js

router.get('/summary', validate(summarySchema, 'query'), controller.getSummary);
router.get('/by-category', validate(categorySchema, 'query'), controller.getByCategory);
router.get('/trends', validate(trendsSchema, 'query'), controller.getTrends);
router.get('/recent', validate(recentSchema, 'query'), controller.getRecentActivity);
router.get('/overview', validate(summarySchema, 'query'), controller.getOverview);
=======
const router          = require('express').Router();
const controller      = require('../../controllers/dashboard.controller');
const authenticate    = require('../../middleware/authenticate');
const { authorize }   = require('../../middleware/authorize');
const validate        = require('../../middleware/validate');
const { dashboardLimiter } = require('../../middleware/rateLimiter');
const {
  summarySchema, categorySchema, trendsSchema,
  recentSchema, auditQuerySchema,
} = require('../../validators/dashboard.validator');

router.use(authenticate);
router.use(dashboardLimiter);

// Analyst + Admin
router.get('/overview',    authorize('read:analytics'), controller.getOverview);
router.get('/summary',     authorize('read:analytics'), validate(summarySchema,  'query'), controller.getSummary);
router.get('/by-category', authorize('read:analytics'), validate(categorySchema, 'query'), controller.getByCategory);
router.get('/trends',      authorize('read:analytics'), validate(trendsSchema,   'query'), controller.getTrends);
router.get('/recent',      authorize('read:dashboard'),  validate(recentSchema,   'query'), controller.getRecentActivity);

// Admin only
router.get('/audit',       authorize('read:audit'),     validate(auditQuerySchema, 'query'), controller.getAuditLog);
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

module.exports = router;
