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

module.exports = router;
