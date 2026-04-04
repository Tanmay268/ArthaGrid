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

module.exports = router;
